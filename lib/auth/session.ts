import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'auth-token'

export interface SessionPayload {
  userId: string
  email: string
  onboardingCompleted: boolean
}

export function signToken(payload: SessionPayload): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) return null
    return jwt.verify(token, secret) as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function cookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  }
}
