import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { buildAuthorizeUrl } from '@/lib/discord';

// GET /api/discord/link — inicia o vínculo: gera state (CSRF) e redireciona ao Discord.
export async function GET() {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;

  const state = crypto.randomBytes(16).toString('hex');

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch {
    return NextResponse.json(
      { erro: 'Integração com o Discord ainda não configurada (variáveis de ambiente ausentes).' },
      { status: 503 }
    );
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set('discord_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 min
  });
  return res;
}
