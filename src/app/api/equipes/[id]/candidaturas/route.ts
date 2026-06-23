import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';

// GET /api/equipes/[id]/candidaturas — candidaturas recebidas (só o capitão ou admin).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;

  const equipe = await prisma.equipe.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!equipe) {
    return NextResponse.json({ erro: 'Equipe não encontrada' }, { status: 404 });
  }

  const isAdmin = session!.user.role === 'ADMIN';
  const isOwner = equipe.userId === session!.user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
  }

  const candidaturas = await prisma.candidatura.findMany({
    where: { equipeId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      lane: true,
      status: true,
      createdAt: true,
      user: {
        select: {
          username: true,
          discordUsername: true,
          freeAgents: { select: { nickname: true }, take: 1 },
        },
      },
    },
  });

  const resposta = candidaturas.map((c) => ({
    id: c.id,
    lane: c.lane,
    status: c.status,
    createdAt: c.createdAt,
    username: c.user.username,
    discordUsername: c.user.discordUsername,
    nickname: c.user.freeAgents[0]?.nickname ?? null,
  }));

  return NextResponse.json(resposta);
}
