import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { isNicknameValido } from '@/constants/links';
import { createTeamChannel } from '@/lib/discord';

const MAX_VAGAS = 5;

// GET /api/equipes — público
export async function GET() {
  const equipes = await prisma.equipe.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nome: true,
      nicknameCapitao: true,
      vagasLanes: true,
      status: true,
      createdAt: true,
      userId: true,
      user: { select: { discordUsername: true } },
      _count: { select: { candidaturas: true } },
    },
  });

  const resposta = equipes.map(({ user, _count, ...equipe }) => ({
    ...equipe,
    discordUsername: user?.discordUsername ?? null,
    candidaturasCount: _count.candidaturas,
  }));

  return NextResponse.json(resposta);
}

// POST /api/equipes — autenticado + Discord vinculado
export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  // Vínculo do Discord é obrigatório (fonte da verdade no banco, não no token).
  const dono = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { discordId: true },
  });
  if (!dono?.discordId) {
    return NextResponse.json(
      { erro: 'Vincule sua conta do Discord antes de cadastrar uma equipe.' },
      { status: 403 }
    );
  }
  const capitaoDiscordId = dono.discordId;

  try {
    const { nome, nicknameCapitao, vagasLanes } = await req.json();

    if (!nome || !nicknameCapitao) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      );
    }

    if (!isNicknameValido(nicknameCapitao)) {
      return NextResponse.json(
        { erro: 'Nickname do capitão inválido. Use o formato Nome#TAG.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(vagasLanes) || vagasLanes.length === 0) {
      return NextResponse.json(
        { erro: 'Selecione ao menos uma vaga aberta.' },
        { status: 400 }
      );
    }

    if (vagasLanes.length > MAX_VAGAS) {
      return NextResponse.json(
        { erro: `Máximo de ${MAX_VAGAS} vagas por equipe.` },
        { status: 400 }
      );
    }

    const equipe = await prisma.equipe.create({
      data: {
        nome,
        nicknameCapitao,
        vagasLanes: vagasLanes ?? [],
        userId: session!.user.id,
      },
    });

    // Best-effort: cria o canal privado da equipe (só roda com o bot configurado).
    let discordChannelId: string | null = null;
    try {
      discordChannelId = await createTeamChannel(nome, capitaoDiscordId);
      if (discordChannelId) {
        await prisma.equipe.update({
          where: { id: equipe.id },
          data: { discordChannelId },
        });
      }
    } catch {
      // segue sem canal — a equipe já foi criada.
    }

    return NextResponse.json({ ...equipe, discordChannelId }, { status: 201 });
  } catch {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}
