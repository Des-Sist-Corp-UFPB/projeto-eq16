/**
 * teamfinder-mcp — servidor MCP do Rinha Team Finder (EQ16).
 *
 * Expõe as operações centrais do sistema como tools/resources para assistentes
 * de IA (Claude Desktop, Claude Code, Cursor, MCP Inspector...):
 *
 *   ┌──────────────┐   stdio    ┌────────────────┐  HTTP   ┌─────────────────┐
 *   │ Assistente   │ ◄────────► │ teamfinder-mcp │ ──────► │ API do site     │
 *   │ de IA        │            │ (este arquivo) │         │ (/api/...)      │
 *   └──────────────┘            │                │  MCP    ┌─────────────────┐
 *                               │                │ ──────► │ op.gg MCP       │
 *                               └────────────────┘         │ (stats — prov.) │
 *                                                          └─────────────────┘
 *
 * Princípios (MCP-IDEIA.md):
 * - Casca fina: as tools chamam a API existente, nunca o banco direto.
 * - Escopo mínimo: apenas LEITURA — nenhuma tool altera dados (mutações
 *   exigiriam sessão autenticada; ficam para uma iteração futura).
 * - Stats de jogador vêm do MCP público do op.gg enquanto não temos a chave
 *   de API da Riot (ver mcp/opgg.ts).
 *
 * Rodar: npm run mcp   (ou: npx tsx mcp/server.ts | node mcp/server.ts no Node 23+)
 * Debug: npm run mcp:inspector
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { LANES, sugerirComposicao, type Lane } from './compose.ts';
import { API_BASE, listarEquipes, listarFreeAgents } from './api.ts';
import { OPGG_MCP_URL, REGIAO_PADRAO, partidasRecentes, perfilInvocador } from './opgg.ts';

const server = new McpServer({ name: 'teamfinder-mcp', version: '0.1.0' });

const laneSchema = z.enum(LANES);

/** Resposta de sucesso: JSON legível para o modelo. */
function ok(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

/** Resposta de erro amigável (isError permite ao modelo se recuperar). */
function falha(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: `Erro: ${msg}` }], isError: true };
}

// ─── Tools de leitura da API local ───────────────────────────────────────────

server.registerTool(
  'buscar_free_agents',
  {
    title: 'Buscar free agents',
    description:
      'Lista os jogadores (free agents) disponíveis no Rinha Team Finder, com nickname, ' +
      'lane principal/secundária e Discord de contato. Filtre por lane para achar jogador ' +
      'de uma rota específica (jogadores FILL atendem qualquer rota).',
    inputSchema: {
      lane: laneSchema.optional().describe('Filtra por rota (TOP, JUNGLE, MID, ADC, SUPPORT, FILL)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ lane }) => {
    try {
      const todos = await listarFreeAgents();
      const filtrados = lane
        ? todos.filter(
            (fa) =>
              fa.lanePrincipal === lane || fa.laneSecundaria === lane || fa.lanePrincipal === 'FILL'
          )
        : todos;
      return ok({ total: filtrados.length, freeAgents: filtrados });
    } catch (err) {
      return falha(err);
    }
  }
);

server.registerTool(
  'listar_equipes',
  {
    title: 'Listar equipes',
    description:
      'Lista as equipes do Rinha Team Finder com nome, capitão, vagas abertas por lane e ' +
      'status (ABERTA/COMPLETA). Filtre por lane para achar equipes com vaga em uma rota.',
    inputSchema: {
      lane: laneSchema.optional().describe('Somente equipes com vaga aberta nesta rota'),
      apenas_abertas: z
        .boolean()
        .optional()
        .describe('true (padrão) = somente equipes com vagas; false = inclui completas'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ lane, apenas_abertas }) => {
    try {
      const todas = await listarEquipes();
      const filtradas = todas
        .filter((eq) => (apenas_abertas ?? true ? eq.status === 'ABERTA' : true))
        .filter((eq) => (lane ? eq.vagasLanes.includes(lane) : true));
      return ok({ total: filtradas.length, equipes: filtradas });
    } catch (err) {
      return falha(err);
    }
  }
);

// ─── Tools de estatísticas (op.gg — fonte provisória) ────────────────────────

server.registerTool(
  'perfil_invocador',
  {
    title: 'Perfil ranqueado do invocador',
    description:
      'Consulta o perfil competitivo de um jogador de League of Legends pelo nickname ' +
      'Nome#TAG (mesmo formato usado nos cadastros do site): tier/elo, LP, vitórias e ' +
      'derrotas por fila e campeões mais jogados. Dados do op.gg (região padrão BR). ' +
      'Use para avaliar free agents antes de recomendá-los a uma equipe.',
    inputSchema: {
      nickname: z.string().describe('Riot ID no formato Nome#TAG (ex.: Chico kit lasca#Chico)'),
      regiao: z.string().optional().describe(`Região do servidor (padrão: ${REGIAO_PADRAO})`),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ nickname, regiao }) => {
    try {
      return ok({ fonte: 'op.gg (provisório até a chave da Riot)', perfil: await perfilInvocador(nickname, regiao) });
    } catch (err) {
      return falha(err);
    }
  }
);

server.registerTool(
  'partidas_recentes',
  {
    title: 'Partidas recentes do invocador',
    description:
      'Histórico recente de partidas de um jogador (campeão, posição, KDA, resultado), ' +
      'pelo nickname Nome#TAG. Dados do op.gg. Use quando quiser avaliar a forma atual ' +
      'do jogador, não o rank (para rank use perfil_invocador).',
    inputSchema: {
      nickname: z.string().describe('Riot ID no formato Nome#TAG'),
      quantidade: z.number().int().min(5).max(20).optional().describe('Nº de partidas (5–20, padrão 5)'),
      regiao: z.string().optional().describe(`Região do servidor (padrão: ${REGIAO_PADRAO})`),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ nickname, quantidade, regiao }) => {
    try {
      return ok({ fonte: 'op.gg (provisório até a chave da Riot)', partidas: await partidasRecentes(nickname, quantidade ?? 5, regiao) });
    } catch (err) {
      return falha(err);
    }
  }
);

// ─── Tool de recomendação (combina API local + op.gg) ────────────────────────

server.registerTool(
  'sugerir_composicao',
  {
    title: 'Sugerir composição de time',
    description:
      'Monta uma sugestão de time com os free agents disponíveis: para cada vaga, ' +
      'rankeia candidatos (lane principal > secundária > fill, desempate por ordem de ' +
      'cadastro) e propõe uma escalação sem repetir jogador. Passe equipeId para usar ' +
      'as vagas reais de uma equipe, OU uma lista de vagas. Com incluir_stats=true, ' +
      'anexa o rank atual (op.gg) dos jogadores escalados para uma decisão mais rica.',
    inputSchema: {
      equipeId: z.string().optional().describe('Usa as vagas abertas desta equipe'),
      vagas: z.array(laneSchema).min(1).max(5).optional().describe('Alternativa: vagas desejadas (ex.: ["MID","SUPPORT"])'),
      incluir_stats: z.boolean().optional().describe('Anexa rank/winrate (op.gg) dos escalados — mais lento'),
      max_por_vaga: z.number().int().min(1).max(10).optional().describe('Candidatos listados por vaga (padrão 3)'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ equipeId, vagas, incluir_stats, max_por_vaga }) => {
    try {
      let vagasAlvo: Lane[] | undefined = vagas;
      let equipeAlvo: { id: string; nome: string } | undefined;

      if (equipeId) {
        const equipe = (await listarEquipes()).find((eq) => eq.id === equipeId);
        if (!equipe) return falha(new Error(`Equipe ${equipeId} não encontrada — confira com listar_equipes.`));
        if (equipe.vagasLanes.length === 0) {
          return falha(new Error(`A equipe "${equipe.nome}" está completa (sem vagas abertas).`));
        }
        vagasAlvo = equipe.vagasLanes;
        equipeAlvo = { id: equipe.id, nome: equipe.nome };
      }

      if (!vagasAlvo || vagasAlvo.length === 0) {
        return falha(new Error('Informe equipeId ou a lista de vagas desejadas.'));
      }

      const agentes = await listarFreeAgents();
      const composicao = sugerirComposicao(vagasAlvo, agentes, max_por_vaga ?? 3);

      // Enriquecimento opcional: rank dos escalados via op.gg (best-effort —
      // um perfil não encontrado não derruba a sugestão).
      let stats: Record<string, string> | undefined;
      if (incluir_stats) {
        stats = {};
        const escalados = composicao.escalacao.flatMap((e) => (e.candidato ? [e.candidato] : []));
        const resultados = await Promise.allSettled(
          escalados.map(async (c) => ({ nickname: c.nickname, perfil: await perfilInvocador(c.nickname) }))
        );
        for (const r of resultados) {
          if (r.status === 'fulfilled') stats[r.value.nickname] = r.value.perfil;
          else if (r.reason instanceof Error) stats[`(falha)`] = r.reason.message;
        }
      }

      return ok({
        equipe: equipeAlvo,
        ...composicao,
        ...(stats ? { statsOpgg: stats, fonteStats: 'op.gg (provisório até a chave da Riot)' } : {}),
      });
    } catch (err) {
      return falha(err);
    }
  }
);

// ─── Resources (contexto somente-leitura) ────────────────────────────────────

server.registerResource(
  'free-agents',
  'teamfinder://free-agents',
  {
    title: 'Free agents disponíveis',
    description: 'Lista atual de jogadores buscando equipe (JSON da API pública).',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [
      { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await listarFreeAgents(), null, 2) },
    ],
  })
);

server.registerResource(
  'equipes',
  'teamfinder://equipes',
  {
    title: 'Equipes cadastradas',
    description: 'Lista atual de equipes e suas vagas abertas (JSON da API pública).',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [
      { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await listarEquipes(), null, 2) },
    ],
  })
);

// ─── Prompt reutilizável ─────────────────────────────────────────────────────

server.registerPrompt(
  'montar_time',
  {
    title: 'Montar time equilibrado',
    description: 'Guia o assistente a montar um time para uma equipe usando as tools deste servidor.',
    argsSchema: { equipeId: z.string().optional().describe('Id da equipe (opcional)') },
  },
  ({ equipeId }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            `Monte a melhor composição possível para ${equipeId ? `a equipe ${equipeId}` : 'uma equipe nova com as 5 vagas'} ` +
            'do Rinha Team Finder. Use sugerir_composicao com incluir_stats=true, avalie o rank ' +
            'e os campeões dos candidatos (perfil_invocador / partidas_recentes quando precisar de detalhe) ' +
            'e justifique cada escolha em português. Aponte vagas sem candidato e alternativas.',
        },
      },
    ],
  })
);

// ─── Boot ────────────────────────────────────────────────────────────────────

async function main() {
  // stdout é o canal do protocolo — logs SEMPRE em stderr.
  console.error(`[teamfinder-mcp] API local: ${API_BASE}`);
  console.error(`[teamfinder-mcp] op.gg MCP: ${OPGG_MCP_URL} (região ${REGIAO_PADRAO})`);
  await server.connect(new StdioServerTransport());
  console.error('[teamfinder-mcp] pronto (stdio).');
}

main().catch((err) => {
  console.error('[teamfinder-mcp] erro fatal:', err);
  process.exit(1);
});
