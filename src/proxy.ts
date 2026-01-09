import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // 1. If no session, redirect to login for all dashboard routes
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Role-Based Access Control (RBAC) Logic
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, window_number')
      .eq('id', session.user.id)
      .single()

    const path = request.nextUrl.pathname

    // Protect Master Dashboard: Only 'master' role allowed
    if (path.startsWith('/dashboard/master') && profile?.role !== 'master') {
      return NextResponse.redirect(new URL('/dashboard/staff', request.url))
    }

    // Protect Staff Dashboard: 'master' or 'staff' with valid window
    if (path === '/dashboard/staff' || path.startsWith('/dashboard/staff/')) {
       if (profile?.role === 'master') {
         // Masters trying to go to staff page should be pushed to Master Panel
         return NextResponse.redirect(new URL('/dashboard/master', request.url))
       }
       // Standard staff must have a window number between 1 and 3
       if (profile?.role === 'staff' && (!profile?.window_number || profile.window_number === 0)) {
         return NextResponse.redirect(new URL('/login?error=no-window', request.url))
       }
    }
  }

  return response
}

export default proxy;

export const config = {
  // Update matcher to include both staff and master routes
  matcher: ['/dashboard/:path*'],
}