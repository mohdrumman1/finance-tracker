import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/google/callback',
]

function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part, 'base64url').toString('utf-8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('auth-token')?.value

  if (!token) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = decodeJWTPayload(token)

  if (!payload) {
    const res = NextResponse.redirect(new URL('/auth/login', req.url))
    res.cookies.delete('auth-token')
    return res
  }

  const exp = payload.exp as number | undefined
  if (exp && Date.now() / 1000 > exp) {
    const res = NextResponse.redirect(new URL('/auth/login', req.url))
    res.cookies.delete('auth-token')
    return res
  }

  const isOnboarding = pathname.startsWith('/onboarding')
  const isApiRoute = pathname.startsWith('/api/')

  if (!payload.onboardingCompleted && !isOnboarding && !isApiRoute) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }

  if (payload.onboardingCompleted && isOnboarding) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
