import { NextResponse } from 'next/server'
import { getSession, signToken, cookieOptions } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { onboardingCompleted: true },
  })

  // Re-issue cookie with onboardingCompleted: true so middleware routes correctly
  const token = signToken({ userId: session.userId, email: session.email, onboardingCompleted: true })
  const res = NextResponse.json({ success: true })
  res.cookies.set(cookieOptions(token))
  return res
}
