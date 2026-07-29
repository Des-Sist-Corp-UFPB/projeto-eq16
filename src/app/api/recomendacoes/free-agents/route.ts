import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isLane, rankearFreeAgents } from '@/lib/recomendacao';
import { buscarElos, eloHabilitado } from '@/lib/opgg';

/**
 * GET /api/recomendacoes/free-agents — jogadores recomendados para vagas.
 *
 * Sem IA e sem custo: filtro/ranking determinístico na nossa própria base
 * (encaixe de rota > elo > antiguidade). O elo é enriquecido via MCP público
 * do op.gg (gratuito) apenas com `?elo=1`, limitado e cacheado.
 *
 * Parâmetros:
 * - `lanes=TOP,MID`: vagas explícitas — usado pelo modal de cadastro ANTES de
 *   a equipe existir.
 * - sem `lanes`: usa as vagas da equipe aberta mais recente do usuário logado
 *   (aba Free Agents, visão do capitão).
 * - `elo=1`: habilita o enriquecimento com elo.
 */

const MAX_RESULTADOS = 8;
const MAX_ELO_AGENTES = 6;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const comElo = params.get('elo') === '1';

  const session = await getServerSession(authOptions);
  const usuarioId = session?.user?.id ?? null;

  let lanes: string[] | null = params.get('lanes')?.split(',').filter(Boolean) ?? null;
  let origem: 'PARAMS' | 'CADASTRO' = 'PARAMS';
  let equipeNome: string | null = null;
  // Equipe do capitão: é o que habilita o botão "Convidar" na UI (no modal de
  // cadastro a equipe ainda não existe, então fica null).
  let equipeId: string | null = null;

  if (!lanes || lanes.length === 0) {
    // Sem vagas explícitas: usa a equipe aberta mais recente do usuário logado.
    if (!usuarioId) {
      return NextResponse.json(
        { erro: 'Informe as vagas (lanes) ou entre na sua conta com uma equipe cadastrada.' },
        { status: 400 }
      );
    }
    const minhaEquipe = await prisma.equipe.findFirst({
      where: { userId: usuarioId, status: 'ABERTA', vagasLanes: { isEmpty: false } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nome: true, vagasLanes: true },
    });
    if (!minhaEquipe) {
      return NextResponse.json({ freeAgents: [], motivo: 'SEM_CADASTRO' });
    }
    lanes = minhaEquipe.vagasLanes;
    equipeNome = minhaEquipe.nome;
    equipeId = minhaEquipe.id;
    origem = 'CADASTRO';
  }

  const unicas = [...new Set(lanes)];
  const vagas = unicas.filter(isLane);
  if (vagas.length === 0 || vagas.length !== unicas.length) {
    return NextResponse.json({ erro: 'Vaga (lane) inválida.' }, { status: 400 });
  }

  const agentes = await prisma.freeAgent.findMany({
    // Não recomenda o free agent do próprio usuário para ele mesmo.
    where: usuarioId ? { NOT: { userId: usuarioId } } : {},
    orderBy: { createdAt: 'asc' },
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

  // 1º passe: só encaixe de rota (sem rede) para escolher os finalistas.
  let ranking = rankearFreeAgents(agentes, vagas).slice(0, MAX_RESULTADOS);

  // 2º passe (opcional): enriquece com elo e reordena os finalistas.
  if (comElo && eloHabilitado() && ranking.length > 0) {
    const nicknames = ranking.slice(0, MAX_ELO_AGENTES).map((r) => r.agente.nickname);
    const elos = await buscarElos(nicknames, MAX_ELO_AGENTES);
    ranking = rankearFreeAgents(
      ranking.map((r) => r.agente),
      vagas,
      elos
    );
  }

  // Estado do convite por (jogador, vaga): a UI usa isso para mostrar
  // "Convidado"/"Aceito" em vez de oferecer o botão de novo.
  const convites = equipeId
    ? await prisma.candidatura.findMany({
        where: { equipeId, userId: { in: ranking.map((r) => r.agente.userId) } },
        select: { userId: true, lane: true, status: true },
      })
    : [];
  const statusConvite = (userId: string, vaga: string) =>
    convites.find((c) => c.userId === userId && c.lane === vaga)?.status ?? null;

  return NextResponse.json({
    criterios: { lanes: vagas, origem, equipeNome, equipeId },
    freeAgents: ranking.map(({ agente, vaga, encaixe, elo }) => ({
      id: agente.id,
      nickname: agente.nickname,
      lanePrincipal: agente.lanePrincipal,
      laneSecundaria: agente.laneSecundaria,
      discordUsername: agente.user?.discordUsername ?? null,
      createdAt: agente.createdAt,
      userId: agente.userId,
      vaga,
      encaixe,
      elo,
      convite: statusConvite(agente.userId, vaga),
    })),
  });
}
