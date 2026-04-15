'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Send, RefreshCw, Calendar, Bot, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { subMonths, startOfDay, endOfDay, format, startOfMonth, endOfMonth } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

type RangePreset = '1m' | '3m' | '6m' | '1y' | 'all'

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: '1m', label: 'Last month' },
  { id: '3m', label: 'Last 3 months' },
  { id: '6m', label: 'Last 6 months' },
  { id: '1y', label: 'Last year' },
  { id: 'all', label: 'All time' },
]

function getRange(preset: RangePreset): { start: Date; end: Date } {
  const now = new Date()
  const end = endOfDay(now)
  switch (preset) {
    case '1m': return { start: startOfMonth(subMonths(now, 1)), end }
    case '3m': return { start: startOfDay(subMonths(now, 3)), end }
    case '6m': return { start: startOfDay(subMonths(now, 6)), end }
    case '1y': return { start: startOfDay(subMonths(now, 12)), end }
    case 'all': return { start: new Date('2000-01-01'), end }
  }
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-indigo-600' : 'bg-gray-200'}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-gray-600" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

export default function AdvisorPage() {
  const [preset, setPreset] = useState<RangePreset>('3m')
  const range = getRange(preset)

  // Analysis tab state
  const [report, setReport] = useState('')
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  // Chat tab state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  async function streamResponse(
    mode: 'report' | 'chat',
    msgs: Message[],
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (msg: string) => void
  ) {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        messages: msgs,
        mode,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      onError(err.error ?? 'Something went wrong. Please try again.')
      return
    }

    const reader = res.body?.getReader()
    if (!reader) { onError('No response stream'); return }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') { onDone(); return }
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content ?? ''
          if (delta) onChunk(delta)
        } catch {
          // ignore malformed chunks
        }
      }
    }
    onDone()
  }

  const generateReport = useCallback(async () => {
    setLoadingReport(true)
    setReport('')
    setReportError(null)
    try {
      await streamResponse(
        'report',
        [],
        (chunk) => setReport((prev) => prev + chunk),
        () => setLoadingReport(false),
        (err) => { setReportError(err); setLoadingReport(false) }
      )
    } catch {
      setReportError('Failed to connect to AI service.')
      setLoadingReport(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  async function sendMessage() {
    const text = input.trim()
    if (!text || chatLoading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setChatLoading(true)
    setChatError(null)

    let assistantContent = ''
    try {
      await streamResponse(
        'chat',
        newMessages,
        (chunk) => {
          assistantContent += chunk
          setMessages([...newMessages, { role: 'assistant', content: assistantContent }])
        },
        () => {
          if (!assistantContent) {
            setMessages([...newMessages, { role: 'assistant', content: '(No response received)' }])
          }
          setChatLoading(false)
        },
        (err) => { setChatError(err); setChatLoading(false) }
      )
    } catch {
      setChatError('Failed to connect to AI service.')
      setChatLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Reset chat/report when date range changes
  function applyPreset(p: RangePreset) {
    setPreset(p)
    setReport('')
    setReportError(null)
    setMessages([])
    setChatError(null)
  }

  const rangeLabel = `${format(range.start.getFullYear() === 2000 ? new Date() : range.start, 'dd MMM yyyy')} – ${format(range.end, 'dd MMM yyyy')}`

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-100">
          <Sparkles className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">AI Finance Advisor</h2>
          <p className="text-sm text-gray-500">Analyses aggregated summaries — no individual transactions sent</p>
        </div>
      </div>

      {/* Date range selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-500 mr-1">Period:</span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  preset === p.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
            {preset !== 'all' && (
              <span className="text-xs text-gray-400 ml-auto">{rangeLabel}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="analysis">
        <TabsList className="w-full">
          <TabsTrigger value="analysis" className="flex-1">Analysis Report</TabsTrigger>
          <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
        </TabsList>

        {/* ── Analysis Tab ── */}
        <TabsContent value="analysis" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Get a comprehensive AI analysis of your spending habits and personalised recommendations.
            </p>
            <Button onClick={generateReport} disabled={loadingReport} className="shrink-0">
              {loadingReport ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Analysing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {report ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {report ? 'Regenerate' : 'Generate Analysis'}
                </span>
              )}
            </Button>
          </div>

          {reportError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {reportError}
            </div>
          )}

          {(report || loadingReport) && (
            <Card className="overflow-hidden">
              {/* Report header bar */}
              <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-100">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium text-indigo-700">AI Financial Report</span>
                <span className="ml-auto text-xs text-indigo-400">{format(range.start.getFullYear() === 2000 ? new Date() : range.start, 'dd MMM yyyy')} – {format(range.end, 'dd MMM yyyy')}</span>
              </div>
              <CardContent className="py-6 px-6">
                {report ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-gray-900 mt-6 mb-3 first:mt-0 pb-2 border-b border-gray-200">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-base font-semibold text-gray-800 mt-6 mb-2 first:mt-0 flex items-center gap-2">
                          <span className="w-1 h-4 rounded-full bg-indigo-500 inline-block shrink-0" />
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-1.5">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm text-gray-700 leading-relaxed mb-3">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="space-y-1.5 mb-3 ml-1">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-sm text-gray-700 flex gap-2 leading-relaxed">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          <span>{children}</span>
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-gray-900">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-gray-600">{children}</em>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-indigo-300 pl-4 py-1 bg-indigo-50 rounded-r-lg my-3 text-sm text-indigo-800 italic">
                          {children}
                        </blockquote>
                      ),
                      hr: () => <hr className="my-4 border-gray-200" />,
                      code: ({ children }) => (
                        <code className="bg-gray-100 text-gray-800 text-xs px-1.5 py-0.5 rounded font-mono">{children}</code>
                      ),
                    }}
                  >
                    {report}
                  </ReactMarkdown>
                ) : (
                  <div className="flex items-center gap-3 text-gray-500 py-4">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm">Analysing your financial data...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!report && !loadingReport && (
            <div className="text-center py-16 text-gray-400">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Click "Generate Analysis" to get your personalised financial report</p>
            </div>
          )}
        </TabsContent>

        {/* ── Chat Tab ── */}
        <TabsContent value="chat" className="mt-4">
          <Card className="flex flex-col" style={{ height: '60vh' }}>
            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
              {messages.length === 0 && !chatLoading && (
                <div className="text-center py-12 text-gray-400">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Ask me anything about your finances</p>
                  <div className="mt-4 space-y-2">
                    {[
                      'Where am I spending the most?',
                      'How can I improve my savings rate?',
                      'What are my biggest unnecessary expenses?',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => { setInput(suggestion); textareaRef.current?.focus() }}
                        className="block w-full text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}

              {chatLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <LoadingSpinner size="sm" />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </CardContent>

            {/* Input */}
            <div className="border-t border-gray-100 p-4">
              {chatError && (
                <p className="text-xs text-red-600 mb-2">{chatError}</p>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your spending… (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={chatLoading}
                />
                <Button onClick={sendMessage} disabled={chatLoading || !input.trim()} size="sm" className="h-[60px] px-3">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
