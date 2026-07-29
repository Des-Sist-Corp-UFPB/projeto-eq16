import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isLane, rankearEquipes, type EloInfo } from '@/lib/recomendacao';
import type { Lane } from '@/types';
import { buscarElo, buscarElos, eloHabilitado } from '@/lib/opgg';

/**
 * GET /api/recomendacoes/equipes — equipes recomendadas para um jogador.
 *
 * Sem IA e sem custo: filtro/ranking determinístico na nossa própria base
 * (encaixe de rota > proximidade de elo > antiguidade). O elo é enriquecido
 * via MCP público do op.gg (gratuito) apenas com `?elo=1`, limitado e cacheado.
 *
 * Parâmetros:
 * - `lane` (+ `laneSecundaria`, `nickname` opcionais): critérios explícitos —
 *   usado pelo modal de cadastro ANTES de o free agent existir.
 * - sem `lane`: usa o cadastro de free agent do usuário logado (aba Equipes).
 * - `elo=1`: habilita o enriquecimento com elo.
 */

const MAX_RESULTADOS = 8;
/** Capitães consultados no op.gg (o jogador consome a outra consulta do teto). */
const MAX_ELO_CAPITAES = 5;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const comElo = params.get('elo') === '1';

  const session = await getServerSession(authOptions);
  const usuarioId = session?.user?.id ?? null;

  let lane = params.get('lane');
  let laneSecundaria = params.get('laneSecundaria');
  let nickname = params.get('nickname');
  let origem: 'PARAMS' | 'CADASTRO' = 'PARAMS';

  if (!lane) {
    // Sem critérios explícitos: usa o cadastro de free agent do usuário logado.
    if (!usuarioId) {
      return NextResponse.json(
        { erro: 'Informe a rota (lane) ou entre na sua conta com um free agent cadastrado.' },
        { status: 400 }
      );
    }
    const meuFA = await prisma.freeAgent.findFirst({
      where: { userId: usuarioId },
      orderBy: { createdAt: 'desc' },
      select: { nickname: true, lanePrincipal: true, laneSecundaria: true },
    });
    if (!meuFA) {
      return NextResponse.json({ equipes: [], motivo: 'SEM_CADASTRO' });
    }
    lane = meuFA.lanePrincipal;
    laneSecundaria = meuFA.laneSecundaria;
    nickname = meuFA.nickname;
    origem = 'CADASTRO';
  }

  if (!isLane(lane) || (laneSecundaria && !isLane(laneSecundaria))) {
    return NextResponse.json({ erro: 'Rota (lane) inválida.' }, { status: 400 });
  }

  const equipes = await prisma.equipe.findMany({
    where: {
      status: 'ABERTA',
      vagasLanes: { isEmpty: false },
      // Não recomenda a própria equipe nem times onde já há candidatura ativa.
      ...(usuarioId
        ? {
            NOT: { userId: usuarioId },
            candidaturas: {
              none: { userId: usuarioId, status: { in: ['PENDENTE', 'ACEITA'] } },
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      nome: true,
      nicknameCapitao: true,
      vagasLanes: true,
      createdAt: true,
      userId: true,
      user: { select: { discordUsername: true } },
      _count: { select: { candidaturas: true } },
    },
  });

  const jogador = {
    lanePrincipal: lane,
    laneSecundaria: isLane(laneSecundaria) ? laneSecundaria : null,
  };

  // 1º passe: só encaixe de rota (sem rede) para escolher os finalistas.
  let ranking = rankearEquipes(equipes, jogador).slice(0, MAX_RESULTADOS);
  let eloJogador: EloInfo | null = null;

  // 2º passe (opcional): enriquece com elo e reordena os finalistas.
  if (comElo && eloHabilitado() && ranking.length > 0) {
    const capitaes = ranking.slice(0, MAX_ELO_CAPITAES).map((r) => r.equipe.nicknameCapitao);
    const [eloProprio, elosCapitaes] = await Promise.all([
      nickname ? buscarElo(nickname) : Promise.resolve(null),
      buscarElos(capitaes, MAX_ELO_CAPITAES),
    ]);
    eloJogador = eloProprio;
    ranking = rankearEquipes(
      ranking.map((r) => r.equipe),
      jogador,
      eloJogador,
      elosCapitaes
    );
  }

  return NextResponse.json({
    criterios: { lane, laneSecundaria: jogador.laneSecundaria, nickname, origem },
    eloJogador,
    equipes: ranking.map(({ equipe, vaga, encaixe, eloCapitao }) => ({
      id: equipe.id,
      nome: equipe.nome,
      nicknameCapitao: equipe.nicknameCapitao,
      discordUsername: equipe.user?.discordUsername ?? null,
      vagasLanes: equipe.vagasLanes as Lane[],
      candidaturasCount: equipe._count.candidaturas,
      createdAt: equipe.createdAt,
      userId: equipe.userId,
      vaga,
      encaixe,
      eloCapitao,
    })),
  });
}
