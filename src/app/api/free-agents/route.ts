import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { isNicknameValido } from '@/constants/links';

// GET /api/free-agents — público
export async function GET() {
  const freeAgents = await prisma.freeAgent.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nickname: true,
      lanePrincipal: true,
      laneSecundaria: true,
      createdAt: true,
      userId: true,
      user: { select: { discordUsername: true } },
    },
  });

  // Achata o Discord vinculado do dono para o shape consumido pelo front.
  const resposta = freeAgents.map(({ user, ...fa }) => ({
    ...fa,
    discordUsername: user?.discordUsername ?? null,
  }));

  return NextResponse.json(resposta);
}

// POST /api/free-agents — autenticado + Discord vinculado
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
      { erro: 'Vincule sua conta do Discord antes de se cadastrar como Free Agent.' },
      { status: 403 }
    );
  }

  // Apenas um free agent por conta.
  const jaExiste = await prisma.freeAgent.findFirst({
    where: { userId: session!.user.id },
    select: { id: true },
  });
  if (jaExiste) {
    return NextResponse.json(
      { erro: 'Você já possui um free agent cadastrado. Remova o atual para criar outro.' },
      { status: 409 }
    );
  }

  try {
    const { nickname, lanePrincipal, laneSecundaria } = await req.json();

    if (!nickname || !lanePrincipal) {
      return NextResponse.json(
        { erro: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Fill como principal joga qualquer rota, então não exige secundária.
    const ehFill = lanePrincipal === 'FILL';
    const secundaria = ehFill ? null : laneSecundaria;

    if (!ehFill && !secundaria) {
      return NextResponse.json(
        { erro: 'Selecione a lane secundária' },
        { status: 400 }
      );
    }

    if (secundaria && secundaria === lanePrincipal) {
      return NextResponse.json(
        { erro: 'A lane principal deve ser diferente da secundária' },
        { status: 400 }
      );
    }

    if (!isNicknameValido(nickname)) {
      return NextResponse.json(
        { erro: 'Nickname inválido. Use o formato Nome#TAG.' },
        { status: 400 }
      );
    }

    const freeAgent = await prisma.freeAgent.create({
      data: {
        nickname,
        lanePrincipal,
        laneSecundaria: secundaria,
        userId: session!.user.id,
      },
    });

    return NextResponse.json(freeAgent, { status: 201 });
  } catch {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}
