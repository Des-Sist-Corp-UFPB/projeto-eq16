import { Prisma } from '@prisma/client';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { prisma } from './prisma';
import { removeMemberFromChannel, postChannelMessage } from './discord';
import { PLAYER_POSITIONS } from '@/constants/positions';
import { Lane } from '@/types';

// Instrumentação manual (Passo 4): spans do NOSSO domínio ("fechar vaga").
// A auto-instrumentação enxerga HTTP e SQL, mas não sabe o que significa
// "aceitar uma candidatura" — este tracer é quem enriquece o trace com isso.
const tracer = trace.getTracer('feche-seu-time/candidaturas');

/**
 * Núcleo de "fechar vaga" — compartilhado pelo site (agora) e, futuramente,
 * pelos botões do Discord (Interactions Endpoint). Toda a regra de negócio mora aqui;
 * cada interface (rota HTTP / interação Discord) é só uma casca que chama estas funções.
 */

export class CandidaturaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function labelDaLane(lane: Lane): string {
  return PLAYER_POSITIONS.find((p) => p.key === lane)?.label ?? lane;
}

async function carregarCandidatura(candidaturaId: string) {
  const cand = await prisma.candidatura.findUnique({
    where: { id: candidaturaId },
    select: {
      id: true,
      lane: true,
      status: true,
      equipeId: true,
      userId: true,
      equipe: { select: { userId: true, vagasLanes: true, discordChannelId: true } },
      user: { select: { discordId: true, discordUsername: true } },
    },
  });
  if (!cand) throw new CandidaturaError('Candidatura não encontrada', 404);
  return cand;
}

function assertCapitao(
  cand: Awaited<ReturnType<typeof carregarCandidatura>>,
  atorId: string,
  atorIsAdmin: boolean
) {
  if (cand.equipe.userId !== atorId && !atorIsAdmin) {
    throw new CandidaturaError('Sem permissão', 403);
  }
}

/**
 * Capitão aceita um candidato para uma vaga:
 * - remove UMA ocorrência da lane de vagasLanes (a equipe pode ter +de 1 slot da mesma lane);
 * - marca a candidatura como ACEITA;
 * - se a lane fechou de vez, recusa os demais candidatos àquela vaga e revoga o acesso deles ao canal;
 * - se zerou as vagas, status da equipe vira COMPLETA.
 * Idempotente: reprocessar uma candidatura já decidida não quebra.
 */
export async function aceitarCandidatura(candidaturaId: string, atorId: string, atorIsAdmin: boolean) {
  // startActiveSpan torna este span o "atual": tudo que rodar dentro do callback
  // (inclusive as queries do Prisma) fica aninhado sob ele na cascata do trace.
  return tracer.startActiveSpan('candidatura.aceitar', async (span) => {
    // Atributos de negócio (Passo 4 / entregável 6): ajudam a filtrar e investigar
    // traces no Grafana — ex.: "mostre as aceitações da equipe X" ou "por admin".
    span.setAttribute('candidatura.id', candidaturaId);
    span.setAttribute('ator.isAdmin', atorIsAdmin);
    try {
      const cand = await carregarCandidatura(candidaturaId);
      assertCapitao(cand, atorId, atorIsAdmin);

      span.setAttribute('equipe.id', cand.equipeId);
      span.setAttribute('candidatura.lane', cand.lane);

      if (cand.status !== 'PENDENTE') {
        span.setAttribute('candidatura.jaProcessada', true);
        return { status: cand.status, jaProcessada: true };
      }
      if (!cand.equipe.vagasLanes.includes(cand.lane)) {
        throw new CandidaturaError('Essa vaga já foi preenchida.', 409);
      }

      // Remove só uma ocorrência da lane.
      const novasVagas = [...cand.equipe.vagasLanes];
      novasVagas.splice(novasVagas.indexOf(cand.lane), 1);
      const laneFechou = !novasVagas.includes(cand.lane);

      // Se a lane fechou de vez, os outros pedidos àquela vaga são recusados.
      const outros = laneFechou
        ? await prisma.candidatura.findMany({
            where: {
              equipeId: cand.equipeId,
              lane: cand.lane,
              status: 'PENDENTE',
              NOT: { id: cand.id },
            },
            select: { id: true, user: { select: { discordId: true } } },
          })
        : [];

      const novoStatusEquipe = novasVagas.length === 0 ? 'COMPLETA' : 'ABERTA';

      const ops: Prisma.PrismaPromise<unknown>[] = [
        prisma.candidatura.update({ where: { id: cand.id }, data: { status: 'ACEITA' } }),
        prisma.equipe.update({
          where: { id: cand.equipeId },
          data: { vagasLanes: novasVagas, status: novoStatusEquipe },
        }),
        // O jogador aceito não fica mais "pendente" em outras vagas da MESMA equipe.
        prisma.candidatura.deleteMany({
          where: {
            equipeId: cand.equipeId,
            userId: cand.userId,
            status: 'PENDENTE',
            NOT: { id: cand.id },
          },
        }),
      ];
      if (outros.length) {
        ops.push(
          prisma.candidatura.updateMany({
            where: { id: { in: outros.map((o) => o.id) } },
            data: { status: 'RECUSADA' },
          })
        );
      }
      await prisma.$transaction(ops);

      // Resultado da regra vira atributo — dá pra ver na cascata quantas vagas
      // sobraram e quantos concorrentes foram recusados, sem abrir o banco.
      span.setAttribute('equipe.vagasRestantes', novasVagas.length);
      span.setAttribute('equipe.status', novoStatusEquipe);
      span.setAttribute('candidatura.recusados', outros.length);

      // Discord best-effort (só roda com o bot configurado).
      const channelId = cand.equipe.discordChannelId;
      if (channelId) {
        await postChannelMessage(
          channelId,
          `✅ ${cand.user.discordUsername ?? 'Jogador'} foi aceito para ${labelDaLane(cand.lane)}!`
        ).catch(() => {});
        for (const o of outros) {
          if (o.user.discordId) {
            await removeMemberFromChannel(channelId, o.user.discordId).catch(() => {});
          }
        }
      }

      return {
        status: 'ACEITA' as const,
        vagasRestantes: novasVagas,
        equipeStatus: novoStatusEquipe,
        recusados: outros.length,
      };
    } catch (e) {
      // Marca o span em vermelho e anexa a exceção — é assim que um erro fica
      // visível na cascata do Grafana (entregável de diagnóstico).
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
      throw e;
    } finally {
      span.end();
    }
  });
}

/** Capitão recusa um candidato. A vaga continua aberta; o recusado perde acesso ao canal. */
export async function recusarCandidatura(candidaturaId: string, atorId: string, atorIsAdmin: boolean) {
  return tracer.startActiveSpan('candidatura.recusar', async (span) => {
    span.setAttribute('candidatura.id', candidaturaId);
    span.setAttribute('ator.isAdmin', atorIsAdmin);
    try {
      const cand = await carregarCandidatura(candidaturaId);
      assertCapitao(cand, atorId, atorIsAdmin);

      span.setAttribute('equipe.id', cand.equipeId);
      span.setAttribute('candidatura.lane', cand.lane);

      if (cand.status !== 'PENDENTE') {
        span.setAttribute('candidatura.jaProcessada', true);
        return { status: cand.status, jaProcessada: true };
      }

      await prisma.candidatura.update({ where: { id: cand.id }, data: { status: 'RECUSADA' } });

      if (cand.equipe.discordChannelId && cand.user.discordId) {
        await removeMemberFromChannel(cand.equipe.discordChannelId, cand.user.discordId).catch(() => {});
      }

      return { status: 'RECUSADA' as const };
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
      throw e;
    } finally {
      span.end();
    }
  });
}
