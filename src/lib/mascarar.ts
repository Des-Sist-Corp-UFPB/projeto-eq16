/**
 * Máscaras para dados pessoais exibidos na área administrativa.
 *
 * O IP, o User-Agent e parte do `metadata` registrados na auditoria são dado
 * pessoal (identificam, direta ou indiretamente, o titular). Continuam sendo
 * gravados — a trilha precisa deles para investigação —, mas na tela ficam
 * ocultos por padrão: o admin revela sob demanda, no botão de olho, como nos
 * clientes de banco.
 */

/** Caractere de censura (o mesmo usado nos "•••" da UI). */
const PONTO = '•';

/** Texto que substitui um valor censurado. */
export const VALOR_CENSURADO = PONTO.repeat(6);

/**
 * Oculta a parte identificadora do IP, preservando a rede de origem.
 * - IPv4: mantém os 2 primeiros octetos (`189.45.•••.•••`).
 * - IPv6: mantém os 2 primeiros grupos (`2804:14d:•••`).
 * - Qualquer outro formato: censura por completo.
 */
export function mascararIp(ip: string | null | undefined): string | null {
  if (!ip) return null;

  const limpo = ip.trim();
  if (!limpo) return null;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(limpo);
  if (ipv4) return `${ipv4[1]}.${ipv4[2]}.${PONTO.repeat(3)}.${PONTO.repeat(3)}`;

  if (limpo.includes(':')) {
    const grupos = limpo.split(':').filter(Boolean);
    if (grupos.length > 2) return `${grupos[0]}:${grupos[1]}:${PONTO.repeat(3)}`;
  }

  return VALOR_CENSURADO;
}

/**
 * Reduz o User-Agent a navegador + sistema operacional — o suficiente para
 * contexto ("veio de um Chrome no Windows") sem expor a impressão digital
 * completa do dispositivo (versões exatas, build, modelo).
 */
export function resumirUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;

  const ua = userAgent.trim();
  if (!ua) return null;

  const navegadores: [RegExp, string][] = [
    [/\bEdg[eA]?\//i, 'Edge'],
    [/\bOPR\/|\bOpera\//i, 'Opera'],
    [/\bChrome\/|\bCriOS\//i, 'Chrome'],
    [/\bFirefox\/|\bFxiOS\//i, 'Firefox'],
    [/\bSafari\//i, 'Safari'],
    [/\bcurl\//i, 'curl'],
    [/\bbot\b|\bspider\b|\bcrawler\b/i, 'bot'],
  ];
  const sistemas: [RegExp, string][] = [
    [/\bWindows NT\b/i, 'Windows'],
    [/\bAndroid\b/i, 'Android'],
    [/\b(iPhone|iPad|iOS)\b/i, 'iOS'],
    [/\bMac OS X\b|\bMacintosh\b/i, 'macOS'],
    [/\bLinux\b/i, 'Linux'],
  ];

  const navegador = navegadores.find(([re]) => re.test(ua))?.[1];
  const sistema = sistemas.find(([re]) => re.test(ua))?.[1];

  if (navegador && sistema) return `${navegador} · ${sistema}`;
  return navegador ?? sistema ?? 'desconhecido';
}

// ─── Metadata da auditoria ───────────────────────────────────────────────────

/** Texto que substitui um valor removido de vez (segredo). */
export const VALOR_REMOVIDO = '[removido]';

/**
 * Chaves cujo valor é **dado pessoal**: censurado por padrão, revelável pelo
 * admin no botão de olho.
 *
 * A comparação é feita sobre a chave normalizada (minúscula, sem `_`/`-`/`.`),
 * então `discord_id`, `discordId` e `DISCORD-ID` caem todos aqui.
 *
 * Hoje quem de fato aparece na trilha é o par `discordId`/`discordUsername`
 * (ações `discord.link` e `discord.unlink`): eles amarram a conta do site a uma
 * conta real do Discord. O restante da lista é preventivo — se um dia alguém
 * incluir e-mail ou telefone no metadata de um `logAudit` novo, ele já nasce
 * censurado na tela em vez de vazar até alguém notar.
 */
const CHAVES_EXATAS = new Set([
  'ip',
  'ipaddress',
  'useragent',
  'discordid',
  'discorduserid',
  'discordusername',
  'discordtag',
  'discordchannelid',
  'discordchannel',
  'email',
  'cpf',
  'telefone',
  'celular',
  'phone',
]);

/**
 * Fragmentos que denunciam **segredo** em qualquer posição da chave: senha,
 * token, chave de API. Nada disso deveria chegar ao `metadata` de um log, mas
 * se chegar, o valor é destruído no servidor e nem sequer é enviado ao
 * navegador — não há olho que revele.
 *
 * Ficam fora daqui termos curtos e ambíguos (ex.: "ip", que casaria com
 * `equipeId`); esses entram por igualdade exata em CHAVES_EXATAS.
 */
const FRAGMENTOS_SECRETOS = [
  'token',
  'secret',
  'senha',
  'password',
  'apikey',
  'authorization',
  'credential',
  'hash',
];

function normalizarChave(chave: string): string {
  return chave.toLowerCase().replace(/[_\-.\s]/g, '');
}

/** `true` quando o valor daquela chave é dado pessoal (censurado, mas revelável). */
export function ehChaveSensivel(chave: string): boolean {
  return CHAVES_EXATAS.has(normalizarChave(chave));
}

/** `true` quando o valor daquela chave é segredo (removido de vez, nunca revelável). */
export function ehChaveSegredo(chave: string): boolean {
  const k = normalizarChave(chave);
  return FRAGMENTOS_SECRETOS.some((f) => k.includes(f));
}

/**
 * Prepara o `metadata` de um log para exibição, em duas versões.
 *
 * - `revelavel` — o que o admin vê ao clicar no olho: o original **sem** os
 *   segredos, que são apagados aqui e não chegam nem ao navegador.
 * - `censurado` — o estado padrão: `revelavel` com os dados pessoais também
 *   trocados por "••••••".
 * - `temSensivel` — se há dado pessoal a revelar; a UI usa esse sinal para só
 *   mostrar o olho onde ele faz diferença.
 *
 * Percorre objetos e arrays aninhados, então a censura vale em qualquer
 * profundidade — e alimenta tanto os chips quanto o "ver JSON", senão bastaria
 * abrir o JSON para contornar a censura dos chips.
 */
export function redigirMetadata(metadata: unknown): {
  revelavel: unknown;
  censurado: unknown;
  temSensivel: boolean;
} {
  let temSensivel = false;

  const visitar = (valor: unknown, censurarPessoal: boolean, chavePai?: string): unknown => {
    if (chavePai !== undefined && valor !== null && valor !== undefined) {
      if (ehChaveSegredo(chavePai)) return VALOR_REMOVIDO;
      if (ehChaveSensivel(chavePai)) {
        temSensivel = true;
        return censurarPessoal ? VALOR_CENSURADO : valor;
      }
    }

    if (Array.isArray(valor)) return valor.map((item) => visitar(item, censurarPessoal));

    if (valor !== null && typeof valor === 'object') {
      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
          k,
          visitar(v, censurarPessoal, k),
        ])
      );
    }

    return valor;
  };

  return {
    revelavel: visitar(metadata, false),
    censurado: visitar(metadata, true),
    temSensivel,
  };
}

