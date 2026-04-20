import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not set' }, { status: 501 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not set' }, { status: 500 })
    }

    const redirectUri = `${appUrl}/api/auth/google-callback`
    const scope = 'openid email profile'

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', scope)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'select_account')

    return NextResponse.redirect(url.toString())
  } catch (err) {
    console.error('[GET /api/auth/google]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
