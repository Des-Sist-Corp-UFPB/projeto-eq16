import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { logAudit, requestMeta, AuditAction } from '@/lib/audit';

// POST /api/discord/unlink — remove o vínculo do Discord do usuário logado.
export async function POST(req: Request) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  // Captura o vínculo atual antes de apagar, para registrar o que foi removido.
  const antes = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { discordId: true, discordUsername: true },
  });

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

  await logAudit({
    action: AuditAction.DISCORD_UNLINK,
    actorId: session!.user.id,
    actorLabel: session!.user.username,
    targetType: 'User',
    targetId: session!.user.id,
    metadata: { discordId: antes?.discordId ?? null, discordUsername: antes?.discordUsername ?? null },
    ...requestMeta(req),
  });

  return NextResponse.json({ mensagem: 'Discord desvinculado.' });
}
