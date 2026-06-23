import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { isNicknameValido } from '@/constants/links';
import { deleteChannel } from '@/lib/discord';

const MAX_VAGAS = 5;

// PUT /api/equipes/[id] — atualizar equipe (dono ou admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;

  const equipe = await prisma.equipe.findUnique({ where: { id } });

  if (!equipe) {
    return NextResponse.json({ erro: 'Equipe não encontrada' }, { status: 404 });
  }

  const isAdmin = session!.user.role === 'ADMIN';
  const isOwner = equipe.userId === session!.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
  }

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

    const updated = await prisma.equipe.update({
      where: { id },
      data: {
        nome,
        nicknameCapitao,
        vagasLanes: vagasLanes ?? [],
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}

// DELETE /api/equipes/[id] — remover equipe (dono ou admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;

  const equipe = await prisma.equipe.findUnique({ where: { id } });

  if (!equipe) {
    return NextResponse.json({ erro: 'Equipe não encontrada' }, { status: 404 });
  }

  const isAdmin = session!.user.role === 'ADMIN';
  const isOwner = equipe.userId === session!.user.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
  }

  await prisma.equipe.delete({ where: { id } });

  // Best-effort: remove o canal do Discord junto (candidaturas caem por cascade).
  if (equipe.discordChannelId) {
    await deleteChannel(equipe.discordChannelId);
  }

  return NextResponse.json({ mensagem: 'Equipe removida com sucesso' });
}

