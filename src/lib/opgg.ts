import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { isNicknameValido } from '@/constants/links';
import type { EloInfo } from './recomendacao';

/**
 * Consulta de elo no MCP público do op.gg — versão para o SERVIDOR do site.
 *
 * É o mesmo serviço usado por `mcp/opgg.ts` (gratuito, sem chave de API e sem
 * custo por chamada), mas aqui devolvemos o elo ESTRUTURADO para o ranking de
 * recomendações, em vez de texto para um assistente.
 *
 * Proteções (não há custo em dinheiro, mas há custo de latência/cortesia com
 * o serviço externo):
 * - `eloHabilitado()`: desliga tudo com RECOMENDACAO_ELO=off (sem rede).
 * - Cache em memória com TTL (acertos 10 min; falhas 2 min).
 * - Timeout por chamada e teto de consultas por requisição.
 * - NUNCA lança: qualquer falha vira `null` e a recomendação segue sem elo.
 */

export const OPGG_MCP_URL = process.env.OPGG_MCP_URL ?? 'https://mcp-api.op.gg/mcp';
export const REGIAO_PADRAO = process.env.OPGG_REGION ?? 'BR';

/** Teto de consultas remotas disparadas por uma única requisição da API. */
export const MAX_CONSULTAS_POR_REQUISICAO = 6;

const TTL_ACERTO_MS = 10 * 60_000;
const TTL_FALHA_MS = 2 * 60_000;
const TIMEOUT_MS = 8_000;

/** Enriquecimento com elo pode ser desligado por env (RECOMENDACAO_ELO=off). */
export function eloHabilitado(): boolean {
  return process.env.RECOMENDACAO_ELO !== 'off';
}

let clientPromise: Promise<Client> | null = null;

/** Conexão preguiçosa e reaproveitada; em erro, a próxima chamada reconecta. */
function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new Client({ name: 'teamfinder-web', version: '0.1.0' });
      const transport = new StreamableHTTPClientTransport(new URL(OPGG_MCP_URL));
      await client.connect(transport);
      return client;
    })().catch((err) => {
      clientPromise = null; // permite nova tentativa na próxima chamada
      throw err;
    });
  }
  return clientPromise;
}

// Só o necessário para elo/winrate (o protocolo do op.gg exige campos explícitos).
const CAMPOS_ELO = [
  'data.summoner.league_stats[].{game_type,win,lose}',
  'data.summoner.league_stats[].tier_info.{tier,division,lp}',
];

interface CacheEntry {
  valor: EloInfo | null;
  expira: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Decodifica o formato compacto do op.gg MCP para um objeto JS.
 *
 * A resposta NÃO é JSON — é um cabeçalho de "classes" + uma expressão:
 *
 *   class Summoner: league_stats
 *   class LeagueStat: game_type,tier_info,win,lose
 *   class TierInfo: tier,division,lp
 *
 *   Summoner([LeagueStat("SOLORANKED",TierInfo("GOLD",2,45),10,5)])
 *
 * Cada `Classe(args)` vira um objeto com os campos nomeados pelo cabeçalho.
 * Devolve null se o texto não seguir o formato (best-effort).
 */
export function decodificarOpgg(texto: string): unknown {
  const classes = new Map<string, string[]>();
  for (const m of texto.matchAll(/^class (\w+): *(.+)$/gm)) {
    classes.set(m[1], m[2].split(',').map((c) => c.trim()));
  }
  if (classes.size === 0) return null;

  const expr = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('class '))
    .join('');

  let i = 0;
  const pular = () => {
    while (i < expr.length && /\s/.test(expr[i])) i++;
  };
  const parseValor = (): unknown => {
    pular();
    const ch = expr[i];
    if (ch === '[') {
      i++;
      const arr: unknown[] = [];
      pular();
      if (expr[i] === ']') {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(parseValor());
        pular();
        if (expr[i] === ',') {
          i++;
          continue;
        }
        if (expr[i] === ']') {
          i++;
          return arr;
        }
        throw new Error('array malformado');
      }
    }
    if (ch === '"') {
      i++;
      let s = '';
      while (i < expr.length && expr[i] !== '"') {
        if (expr[i] === '\\') {
          s += expr[i + 1];
          i += 2;
        } else {
          s += expr[i];
          i++;
        }
      }
      i++;
      return s;
    }
    if (/[-0-9]/.test(ch)) {
      const m = /^-?\d+(\.\d+)?/.exec(expr.slice(i))!;
      i += m[0].length;
      return Number(m[0]);
    }
    const m = /^[A-Za-z_]\w*/.exec(expr.slice(i));
    if (!m) throw new Error('token inesperado');
    i += m[0].length;
    const nome = m[0];
    if (nome === 'null') return null;
    if (nome === 'true') return true;
    if (nome === 'false') return false;
    if (expr[i] !== '(') throw new Error('esperava "("');
    i++;
    const args: unknown[] = [];
    pular();
    if (expr[i] === ')') {
      i++;
    } else {
      for (;;) {
        args.push(parseValor());
        pular();
        if (expr[i] === ',') {
          i++;
          continue;
        }
        if (expr[i] === ')') {
          i++;
          break;
        }
        throw new Error('chamada malformada');
      }
    }
    const campos = classes.get(nome);
    if (!campos) return args;
    const obj: Record<string, unknown> = {};
    campos.forEach((campo, idx) => {
      obj[campo] = args[idx] ?? null;
    });
    return obj;
  };

  try {
    return parseValor();
  } catch {
    return null;
  }
}

/** Extrai o elo estruturado do texto devolvido pelo op.gg (formato compacto ou JSON). */
export function extrairElo(texto: string): EloInfo | null {
  try {
    let dados: unknown;
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = decodificarOpgg(texto);
    }
    // O shape final é o mesmo nos dois formatos: data.summoner.league_stats[].
    const raiz = dados as {
      data?: { summoner?: { league_stats?: unknown } };
      summoner?: { league_stats?: unknown };
    } | null;
    const stats = (raiz?.data?.summoner?.league_stats ??
      raiz?.summoner?.league_stats) as
      | {
          game_type?: unknown;
          win?: number | null;
          lose?: number | null;
          tier_info?: { tier?: unknown; division?: number | null; lp?: number | null };
        }[]
      | undefined;
    if (!Array.isArray(stats) || stats.length === 0) return null;
    // Prioriza a fila ranqueada solo; senão, a primeira fila com tier.
    const comTier = stats.filter((s) => s?.tier_info?.tier);
    const solo = comTier.find((s) => String(s?.game_type ?? '').toUpperCase().includes('SOLO'));
    const fila = solo ?? comTier[0];
    if (!fila?.tier_info?.tier) return null;
    return {
      tier: String(fila.tier_info.tier).toUpperCase(),
      division: fila.tier_info.division ?? null,
      lp: fila.tier_info.lp ?? null,
      wins: fila.win ?? null,
      losses: fila.lose ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Busca o elo de um invocador (`Nome#TAG`). Best-effort: nickname inválido,
 * rede fora ou resposta inesperada devolvem `null` (nunca lança).
 */
export async function buscarElo(nickname: string, regiao = REGIAO_PADRAO): Promise<EloInfo | null> {
  if (!eloHabilitado()) return null;

  const valor = nickname.trim();
  if (!isNicknameValido(valor)) return null;
  const [gameName, tagLine] = valor.split('#');

  const chave = `${regiao}:${valor.toLowerCase()}`;
  const agora = Date.now();
  const cacheado = cache.get(chave);
  if (cacheado && cacheado.expira > agora) return cacheado.valor;

  let elo: EloInfo | null = null;
  try {
    const client = await getClient();
    const result = await client.callTool(
      {
        name: 'lol_get_summoner_profile',
        arguments: {
          game_name: gameName.trim(),
          tag_line: tagLine,
          region: regiao,
          lang: 'pt_BR',
          desired_output_fields: CAMPOS_ELO,
        },
      },
      undefined,
      { timeout: TIMEOUT_MS }
    );
    if (!result.isError) {
      const blocos = (result.content ?? []) as { type: string; text?: string }[];
      const texto = blocos
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text)
        .join('\n');
      elo = extrairElo(texto);
    }
  } catch {
    elo = null; // best-effort: recomendação segue sem elo
  }

  cache.set(chave, { valor: elo, expira: agora + (elo ? TTL_ACERTO_MS : TTL_FALHA_MS) });
  return elo;
}

/**
 * Busca o elo de vários nicknames em paralelo, respeitando o teto de
 * consultas por requisição (os excedentes ficam sem elo).
 */
export async function buscarElos(
  nicknames: string[],
  max = MAX_CONSULTAS_POR_REQUISICAO
): Promise<Map<string, EloInfo | null>> {
  const unicos = [...new Set(nicknames)].slice(0, Math.max(0, max));
  const resultados = await Promise.all(
    unicos.map(async (n) => [n, await buscarElo(n)] as const)
  );
  return new Map(resultados);
}
