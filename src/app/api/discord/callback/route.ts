import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  exchangeCodeForToken,
  fetchDiscordUser,
  addUserToGuild,
  encryptToken,
} from '@/lib/discord';

type Status = 'ok' | 'erro_login' | 'erro_state' | 'ja_vinculado' | 'erro';

function redirectComStatus(req: NextRequest, status: Status): NextResponse {
  const url = new URL('/inicio', req.url);
  url.searchParams.set('discord', status);
  return NextResponse.redirect(url);
}

// GET /api/discord/callback — recebe o code do Discord, vincula a conta logada.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return redirectComStatus(req, 'erro_login');

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get('discord_oauth_state')?.value;

  // Valida o state (CSRF): tem que casar com o cookie httpOnly que setamos no /link.
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectComStatus(req, 'erro_state');
  }

  try {
    const token = await exchangeCodeForToken(code);
    const discordUser = await fetchDiscordUser(token.access_token);

    // Esse Discord já está vinculado a outra conta?
    const emUso = await prisma.user.findUnique({
      where: { discordId: discordUser.id },
      select: { id: true },
    });
    if (emUso && emUso.id !== session.user.id) {
      return redirectComStatus(req, 'ja_vinculado');
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordAccessToken: encryptToken(token.access_token),
        discordRefreshToken: encryptToken(token.refresh_token),
        discordTokenExpires: new Date(Date.now() + token.expires_in * 1000),
      },
    });

    // Auto-join no servidor (não bloqueia o vínculo se o bot ainda não foi configurado).
    try {
      await addUserToGuild(discordUser.id, token.access_token);
    } catch {
      // ignora — o vínculo em si já foi salvo.
    }

    const res = redirectComStatus(req, 'ok');
    res.cookies.delete('discord_oauth_state');
    return res;
  } catch {
    return redirectComStatus(req, 'erro');
  }
}
