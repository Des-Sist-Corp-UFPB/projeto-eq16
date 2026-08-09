import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { NextResponse } from 'next/server';

export async function getSessionOrUnauthorized() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ erro: 'Não autenticado' }, { status: 401 }),
    };
  }
  return { session, error: null };
}

/**
 * Guarda das rotas administrativas: exige sessão **e** papel ADMIN.
 *
 * É a checagem que vale — o `proxy.ts` faz só uma triagem otimista na borda
 * (barata, mas baseada no cookie), enquanto aqui a sessão é validada de fato.
 * Toda rota sob `/api/admin` deve começar por este helper.
 */
export async function requireAdmin() {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return { session: null, error };

  if (session!.user.role !== 'ADMIN') {
    return {
      session: null,
      error: NextResponse.json({ erro: 'Acesso restrito a administradores.' }, { status: 403 }),
    };
  }

  return { session, error: null };
}
