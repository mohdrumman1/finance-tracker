import Link from 'next/link'
import { DollarSign } from 'lucide-react'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen w-full bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-semibold text-white">Monyze</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Reset your password</h1>
          <p className="text-gray-400 text-sm mb-6">
            Email-based password reset isn&apos;t available yet.
          </p>

          <div className="space-y-4 text-sm text-gray-300">
            <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
              <p className="font-medium text-indigo-300 mb-1">Using Google?</p>
              <p className="text-gray-400 text-xs">
                If you signed up with a Google account, go back and use <strong className="text-white">Continue with Google</strong> - no password needed.
              </p>
            </div>

            <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
              <p className="font-medium text-white mb-1">Need help?</p>
              <p className="text-gray-400 text-xs">
                Contact us at{' '}
                <a href="mailto:support@monyze.app" className="text-indigo-400 hover:text-indigo-300">
                  support@monyze.app
                </a>{' '}
                and we&apos;ll reset your account manually.
              </p>
            </div>
          </div>

          <Link
            href="/auth/login"
            className="mt-8 flex items-center justify-center w-full py-2.5 px-4 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-sm font-medium transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
