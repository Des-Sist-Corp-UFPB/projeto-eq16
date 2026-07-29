import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocka o SDK do MCP: nada de rede — controlamos o que o "op.gg" responde.
const { connectMock, callToolMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  callToolMock: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = connectMock;
    callTool = callToolMock;
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {},
}));

/** Import fresco por teste: zera o cache em memória e a conexão preguiçosa. */
async function carregar() {
  return await import('@/lib/opgg');
}

// Formato compacto REAL do op.gg MCP (observado ao vivo): cabeçalho de
// "classes" + expressão aninhada — NÃO é JSON.
const PERFIL = `class LolGetSummonerProfile: data
class Data: summoner
class Summoner: league_stats
class LeagueStat: game_type,tier_info,win,lose
class TierInfo: tier,division,lp

LolGetSummonerProfile(Data(Summoner([LeagueStat("SOLORANKED",TierInfo("GOLD",2,45),10,5),LeagueStat("FLEXRANKED",TierInfo(null,null,null),null,null)])))`;

// Variante JSON (fallback aceito pelo parser).
const PERFIL_JSON = JSON.stringify({
  data: {
    summoner: {
      league_stats: [
        { game_type: 'SOLORANKED', win: 10, lose: 5, tier_info: { tier: 'GOLD', division: 2, lp: 45 } },
        { game_type: 'FLEXRANKED', win: 1, lose: 1, tier_info: { tier: 'SILVER', division: 1, lp: 10 } },
      ],
    },
  },
});

function respostaOk(texto = PERFIL) {
  return { isError: false, content: [{ type: 'text', text: texto }] };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  connectMock.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.RECOMENDACAO_ELO;
});

describe('decodificarOpgg', () => {
  it('decodifica o formato compacto em objeto (classes → campos nomeados)', async () => {
    const { decodificarOpgg } = await carregar();
    const dados = decodificarOpgg(PERFIL) as {
      data: { summoner: { league_stats: { game_type: string; tier_info: { tier: string } }[] } };
    };
    expect(dados.data.summoner.league_stats).toHaveLength(2);
    expect(dados.data.summoner.league_stats[0]).toEqual({
      game_type: 'SOLORANKED',
      tier_info: { tier: 'GOLD', division: 2, lp: 45 },
      win: 10,
      lose: 5,
    });
  });

  it('devolve null para texto sem cabeçalho de classes ou expressão malformada', async () => {
    const { decodificarOpgg } = await carregar();
    expect(decodificarOpgg('qualquer coisa')).toBeNull();
    expect(decodificarOpgg('class A: x\n\nA(')).toBeNull();
  });
});

describe('extrairElo', () => {
  it('prioriza a fila ranqueada solo (formato compacto real)', async () => {
    const { extrairElo } = await carregar();
    expect(extrairElo(PERFIL)).toEqual({ tier: 'GOLD', division: 2, lp: 45, wins: 10, losses: 5 });
  });

  it('também aceita a variante JSON', async () => {
    const { extrairElo } = await carregar();
    expect(extrairElo(PERFIL_JSON)).toEqual({ tier: 'GOLD', division: 2, lp: 45, wins: 10, losses: 5 });
  });

  it('cai na primeira fila com tier quando não há solo', async () => {
    const { extrairElo } = await carregar();
    const texto = JSON.stringify({
      data: {
        summoner: {
          league_stats: [
            { game_type: 'FLEXRANKED', win: 3, lose: 4, tier_info: { tier: 'BRONZE', division: 1, lp: 7 } },
          ],
        },
      },
    });
    expect(extrairElo(texto)).toMatchObject({ tier: 'BRONZE', division: 1, lp: 7 });
  });

  it('devolve null para unranked, shape inesperado ou texto irreconhecível', async () => {
    const { extrairElo } = await carregar();
    expect(extrairElo(JSON.stringify({ data: { summoner: { league_stats: [] } } }))).toBeNull();
    expect(
      extrairElo(JSON.stringify({ data: { summoner: { league_stats: [{ game_type: 'SOLORANKED' }] } } }))
    ).toBeNull();
    expect(extrairElo('não sou json nem formato compacto')).toBeNull();
    expect(extrairElo(JSON.stringify({}))).toBeNull();
    // Todas as filas sem tier (conta unranked) no formato compacto:
    expect(
      extrairElo(`class Summoner: league_stats
class LeagueStat: game_type,tier_info,win,lose
class TierInfo: tier,division,lp

Summoner([LeagueStat("SOLORANKED",TierInfo(null,null,null),null,null)])`)
    ).toBeNull();
  });
});

describe('buscarElo', () => {
  it('consulta o op.gg com timeout e devolve o elo estruturado', async () => {
    const { buscarElo } = await carregar();
    callToolMock.mockResolvedValue(respostaOk());
    const elo = await buscarElo('Faker#KR1');
    expect(elo).toMatchObject({ tier: 'GOLD', division: 2, lp: 45 });
    expect(callToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'lol_get_summoner_profile',
        arguments: expect.objectContaining({ game_name: 'Faker', tag_line: 'KR1', region: 'BR' }),
      }),
      undefined,
      { timeout: 8000 }
    );
  });

  it('nickname fora do formato Nome#TAG: null sem chamada remota', async () => {
    const { buscarElo } = await carregar();
    expect(await buscarElo('sem-tag')).toBeNull();
    expect(callToolMock).not.toHaveBeenCalled();
  });

  it('usa o cache na segunda consulta do mesmo nickname', async () => {
    const { buscarElo } = await carregar();
    callToolMock.mockResolvedValue(respostaOk());
    await buscarElo('Faker#KR1');
    await buscarElo('faker#kr1'); // chave é case-insensitive
    expect(callToolMock).toHaveBeenCalledTimes(1);
  });

  it('falha de rede vira null (best-effort) e também entra no cache', async () => {
    const { buscarElo } = await carregar();
    callToolMock.mockRejectedValue(new Error('rede fora'));
    expect(await buscarElo('Faker#KR1')).toBeNull();
    expect(await buscarElo('Faker#KR1')).toBeNull();
    expect(callToolMock).toHaveBeenCalledTimes(1); // cache negativo
  });

  it('resposta isError do op.gg vira null', async () => {
    const { buscarElo } = await carregar();
    callToolMock.mockResolvedValue({ isError: true, content: [{ type: 'text', text: 'boom' }] });
    expect(await buscarElo('Faker#KR1')).toBeNull();
  });

  it('RECOMENDACAO_ELO=off desliga tudo (sem rede)', async () => {
    process.env.RECOMENDACAO_ELO = 'off';
    const { buscarElo, eloHabilitado } = await carregar();
    expect(eloHabilitado()).toBe(false);
    expect(await buscarElo('Faker#KR1')).toBeNull();
    expect(callToolMock).not.toHaveBeenCalled();
  });
});

describe('buscarElos', () => {
  it('deduplica e respeita o teto de consultas por requisição', async () => {
    const { buscarElos } = await carregar();
    callToolMock.mockResolvedValue(respostaOk());
    const mapa = await buscarElos(['A#BR1', 'A#BR1', 'B#BR1', 'C#BR1'], 2);
    expect(callToolMock).toHaveBeenCalledTimes(2); // A e B; C ficou de fora do teto
    expect(mapa.size).toBe(2);
    expect(mapa.get('A#BR1')).toMatchObject({ tier: 'GOLD' });
    expect(mapa.has('C#BR1')).toBe(false);
  });
});
