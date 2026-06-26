import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { addMemberToChannel, postChannelMessage } from '@/lib/discord';
import { buildCandidaturaButtons } from '@/lib/discordInteractions';
import { logAudit, requestMeta, AuditAction } from '@/lib/audit';
import { PLAYER_POSITIONS } from '@/constants/positions';
import { Lane } from '@/types';

const LANES_VALIDAS = PLAYER_POSITIONS.map((p) => p.key);

function labelDaLane(lane: Lane): string {
  return PLAYER_POSITIONS.find((p) => p.key === lane)?.label ?? lane;
}

// GET /api/equipes/[id]/solicitar — candidaturas do usuário logado nesta equipe (com status).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;

  const candidaturas = await prisma.candidatura.findMany({
    where: { equipeId: id, userId: session!.user.id },
    select: { lane: true, status: true },
  });

  return NextResponse.json({ candidaturas });
}

// POST /api/equipes/[id]/solicitar — free agent solicita entrada para uma vaga.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;

  // Vínculo do Discord é obrigatório (fonte da verdade no banco).
  const solicitante = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { discordId: true, discordUsername: true },
  });
  if (!solicitante?.discordId) {
    return NextResponse.json(
      { erro: 'Vincule sua conta do Discord antes de solicitar entrada.' },
      { status: 403 }
    );
  }

  let lane: Lane;
  try {
    ({ lane } = await req.json());
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida' }, { status: 400 });
  }

  if (!lane || !LANES_VALIDAS.includes(lane)) {
    return NextResponse.json({ erro: 'Lane inválida' }, { status: 400 });
  }

  const equipe = await prisma.equipe.findUnique({
    where: { id },
    select: { id: true, nome: true, userId: true, vagasLanes: true, discordChannelId: true },
  });
  if (!equipe) {
    return NextResponse.json({ erro: 'Equipe não encontrada' }, { status: 404 });
  }

  if (equipe.userId === session!.user.id) {
    return NextResponse.json(
      { erro: 'Você é o capitão desta equipe.' },
      { status: 400 }
    );
  }

  if (!equipe.vagasLanes.includes(lane)) {
    return NextResponse.json(
      { erro: 'Essa vaga não está mais disponível.' },
      { status: 409 }
    );
  }

  // Verifica limites de solicitações: máx. 3 por equipe; bloqueio permanente após 3 recusas.
  const candidaturasExistentes = await prisma.candidatura.findMany({
    where: { equipeId: id, userId: session!.user.id },
    select: { status: true, lane: true },
  });
  const recusadasCount = candidaturasExistentes.filter((c) => c.status === 'RECUSADA').length;
  if (recusadasCount >= 3) {
    return NextResponse.json(
      { erro: 'Você foi recusado 3 vezes por esta equipe. Não é possível enviar mais solicitações.' },
      { status: 403 }
    );
  }
  const totalCandidaturas = candidaturasExistentes.length;
  if (totalCandidaturas >= 3) {
    return NextResponse.json(
      { erro: 'Você atingiu o limite de 3 solicitações para esta equipe.' },
      { status: 403 }
    );
  }

  // Idempotência: não duplica o mesmo pedido (equipe + usuário + lane).
  const jaSolicitou = await prisma.candidatura.findUnique({
    where: { equipeId_userId_lane: { equipeId: id, userId: session!.user.id, lane } },
    select: { id: true },
  });

  let candidaturaId = jaSolicitou?.id;
  if (!jaSolicitou) {
    const novaCandidatura = await prisma.candidatura.create({
      data: { equipeId: id, userId: session!.user.id, lane },
    });
    candidaturaId = novaCandidatura.id;

    await logAudit({
      action: AuditAction.CANDIDATURA_CREATE,
      actorId: session!.user.id,
      actorLabel: session!.user.username,
      targetType: 'Candidatura',
      targetId: novaCandidatura.id,
      metadata: { equipeId: id, equipeNome: equipe.nome, lane },
      ...requestMeta(req),
    });
  }

  // Best-effort: joga o free agent dentro do canal e posta o painel de Aceitar/Recusar
  // (os botões disparam o Interactions Endpoint quando o capitão decide).
  let noCanal = false;
  if (equipe.discordChannelId) {
    noCanal = await addMemberToChannel(equipe.discordChannelId, solicitante.discordId);
    if (noCanal && candidaturaId) {
      const nick = solicitante.discordUsername ?? 'Um jogador';
      await postChannelMessage(
        equipe.discordChannelId,
        `🎯 ${nick} solicitou entrada para a posição ${labelDaLane(lane)}.`,
        buildCandidaturaButtons(candidaturaId)
      );
    }
  }

  return NextResponse.json({
    mensagem: noCanal
      ? `Você entrou no canal de "${equipe.nome}" no Discord! O capitão já foi avisado.`
      : `Solicitação registrada para ${labelDaLane(lane)}. O capitão será avisado.`,
    noCanal,
  });
}
