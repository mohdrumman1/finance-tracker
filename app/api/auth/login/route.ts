import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/client'
import { signToken, cookieOptions } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      onboardingCompleted: user.onboardingCompleted,
    })
    const opts = cookieOptions(token)
    const res = NextResponse.json({ success: true, onboardingCompleted: user.onboardingCompleted })
    res.cookies.set(opts.name, opts.value, opts)
    return res
  } catch (err) {
    console.error('[POST /api/auth/login]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
