import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { signToken, cookieOptions } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=google_denied`)
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
    const redirectUri = `${appUrl}/api/auth/google-callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`)
    }

    const { access_token } = await tokenRes.json()

    // Fetch Google profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!profileRes.ok) {
      throw new Error(`Profile fetch failed: ${profileRes.status}`)
    }

    const profile = await profileRes.json()
    const { id: googleId, email } = profile

    if (!email) {
      return NextResponse.redirect(`${appUrl}/auth/login?error=no_email`)
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    })

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({ where: { id: user.id }, data: { googleId } })
      }
    } else {
      user = await prisma.user.create({ data: { email, googleId } })
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      onboardingCompleted: user.onboardingCompleted,
    })

    const destination = user.onboardingCompleted ? `${appUrl}/dashboard` : `${appUrl}/onboarding`
    const res = NextResponse.redirect(destination)
    res.cookies.set(cookieOptions(token))
    return res
  } catch (err) {
    console.error('[GET /api/auth/google-callback]', err)
    return NextResponse.redirect(`${appUrl}/auth/login?error=google_failed`)
  }
}
