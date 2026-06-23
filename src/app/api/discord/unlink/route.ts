import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';

// POST /api/discord/unlink — remove o vínculo do Discord do usuário logado.
export async function POST() {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  await prisma.user.update({
    where: { id: session!.user.id },
    data: {
      discordId: null,
      discordUsername: null,
      discordAccessToken: null,
      discordRefreshToken: null,
      discordTokenExpires: null,
    },
  });

  return NextResponse.json({ mensagem: 'Discord desvinculado.' });
}
