import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { addMemberToChannel, postChannelMessage } from '@/lib/discord';
import { buildCandidaturaButtons } from '@/lib/discordInteractions';
import { logAudit, requestMeta, AuditAction } from '@/lib/audit';
import { PLAYER_POSITIONS } from '@/constants/positions';
import { Lane } from '@/types';

/**
 * Convite: o CAPITÃO chama um free agent para uma vaga.
 *
 * É o caminho inverso de `POST /api/equipes/[id]/solicitar` e usa exatamente a
 * mesma máquina: cria uma `Candidatura` PENDENTE, libera o canal privado da
 * equipe para o convidado e posta o painel Aceitar/Recusar. Assim o convite e a
 * solicitação convergem no mesmo ponto de decisão (`src/lib/candidaturas.ts`) —
 * inclusive pelos botões do Discord.
 *
 * Idempotente: se já existe candidatura para (equipe, jogador, vaga), devolve o
 * estado atual em vez de duplicar. Se o próprio jogador já tinha solicitado, o
 * convite apenas confirma o que já estava lá.
 */

const LANES_VALIDAS: Lane[] = PLAYER_POSITIONS.map((p) => p.key);

function labelDaLane(lane: Lane): string {
  return PLAYER_POSITIONS.find((p) => p.key === lane)?.label ?? lane;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;

  let userId: string;
  let lane: Lane;
  try {
    ({ userId, lane } = await req.json());
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida' }, { status: 400 });
  }

  if (!userId || !lane || !LANES_VALIDAS.includes(lane)) {
    return NextResponse.json({ erro: 'Jogador ou lane inválidos' }, { status: 400 });
  }

  const equipe = await prisma.equipe.findUnique({
    where: { id },
    select: { id: true, nome: true, userId: true, vagasLanes: true, discordChannelId: true },
  });
  if (!equipe) {
    return NextResponse.json({ erro: 'Equipe não encontrada' }, { status: 404 });
  }

  // Convidar é ato de capitão: só o dono da equipe (nem admin entra no lugar dele).
  if (equipe.userId !== session!.user.id) {
    return NextResponse.json({ erro: 'Só o capitão da equipe pode convidar.' }, { status: 403 });
  }

  if (userId === session!.user.id) {
    return NextResponse.json({ erro: 'Você é o capitão desta equipe.' }, { status: 400 });
  }

  if (!equipe.vagasLanes.includes(lane)) {
    return NextResponse.json({ erro: 'Essa vaga não está mais disponível.' }, { status: 409 });
  }

  // Vínculo do Discord do capitão é obrigatório (fonte da verdade no banco),
  // mesma regra de cadastrar equipe e de solicitar entrada.
  const capitao = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { discordId: true, discordUsername: true },
  });
  if (!capitao?.discordId) {
    return NextResponse.json(
      { erro: 'Vincule sua conta do Discord antes de convidar jogadores.' },
      { status: 403 }
    );
  }

  const convidado = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      discordId: true,
      discordUsername: true,
      freeAgents: { select: { nickname: true }, take: 1 },
    },
  });
  if (!convidado || convidado.freeAgents.length === 0) {
    return NextResponse.json({ erro: 'Free agent não encontrado.' }, { status: 404 });
  }

  // Idempotência: um convite não vira duas candidaturas para a mesma vaga.
  const existente = await prisma.candidatura.findUnique({
    where: { equipeId_userId_lane: { equipeId: id, userId, lane } },
    select: { id: true, status: true },
  });
  if (existente) {
    const jaDecidida = existente.status !== 'PENDENTE';
    return NextResponse.json({
      status: existente.status,
      jaExistia: true,
      mensagem: jaDecidida
        ? `Este jogador já foi ${existente.status === 'ACEITA' ? 'aceito' : 'recusado'} para ${labelDaLane(lane)}.`
        : `${convidado.freeAgents[0].nickname} já está na fila para ${labelDaLane(lane)}.`,
    });
  }

  const candidatura = await prisma.candidatura.create({
    data: { equipeId: id, userId, lane },
  });

  await logAudit({
    action: AuditAction.CANDIDATURA_INVITE,
    actorId: session!.user.id,
    actorLabel: session!.user.username,
    targetType: 'Candidatura',
    targetId: candidatura.id,
    metadata: {
      equipeId: id,
      equipeNome: equipe.nome,
      lane,
      convidadoId: userId,
      convidadoLabel: convidado.freeAgents[0].nickname,
    },
    ...requestMeta(req),
  });

  // Best-effort: leva o convidado para dentro do canal da equipe e posta o painel
  // de decisão (os botões disparam o Interactions Endpoint quando o capitão decide).
  let noCanal = false;
  if (equipe.discordChannelId && convidado.discordId) {
    noCanal = await addMemberToChannel(equipe.discordChannelId, convidado.discordId);
    if (noCanal) {
      await postChannelMessage(
        equipe.discordChannelId,
        `📨 <@${convidado.discordId}> foi convidado pelo capitão para a posição ${labelDaLane(lane)}.`,
        buildCandidaturaButtons(candidatura.id)
      );
    }
  }

  return NextResponse.json(
    {
      status: 'PENDENTE',
      noCanal,
      mensagem: noCanal
        ? `Convite enviado! ${convidado.freeAgents[0].nickname} já entrou no canal de "${equipe.nome}" no Discord.`
        : `Convite registrado para ${labelDaLane(lane)}. Chame ${convidado.freeAgents[0].nickname} pelo Discord.`,
    },
    { status: 201 }
  );
}
