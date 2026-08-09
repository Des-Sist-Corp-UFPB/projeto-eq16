import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Triagem de borda das rotas administrativas (`/admin` e `/api/admin`).
 *
 * É uma checagem OTIMISTA, de defesa em profundidade: barra o tráfego óbvio
 * (anônimo ou não-admin) antes de chegar à aplicação e evita que uma rota
 * administrativa nova nasça desprotegida por esquecimento. Não substitui a
 * autorização real — o papel lido aqui vem do cookie assinado, que pode estar
 * defasado em relação ao banco. A palavra final continua sendo de
 * `requireAdmin()` nas rotas de API e da checagem de sessão nas páginas,
 * onde o papel é reconferido no banco (ver `carregarDadosUsuario` em auth.ts).
 */

const LOGIN = '/auth/login';

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (isApi) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = LOGIN;
    url.search = '';
    url.searchParams.set('redirect', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (token.role !== 'ADMIN') {
    if (isApi) {
      return NextResponse.json({ erro: 'Acesso restrito a administradores.' }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/inicio';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Área administrativa nunca deve ser indexada nem cacheada por intermediários.
  const res = NextResponse.next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store, private');
  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
