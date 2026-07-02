import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const session = request.cookies.get('auth_session');
  const { pathname } = request.nextUrl;

  // Paths that don't require authentication
  const isPublicPath = pathname === '/login' || pathname.startsWith('/api/auth');

  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Excluye del middleware los internos de Next y CUALQUIER archivo estático
  // (rutas con extensión: /logo.png, /lapicito.jpg, *.svg, etc.). Si no se
  // excluyen, esas imágenes se redirigen a /login sin sesión y no cargan.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
