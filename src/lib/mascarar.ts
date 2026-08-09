/**
 * Máscaras para dados pessoais exibidos na área administrativa.
 *
 * O IP e o User-Agent registrados na auditoria são dado pessoal (identificam
 * indiretamente o titular). Eles continuam sendo gravados — a trilha precisa
 * deles para investigação —, mas na tela ficam ocultos por padrão: o admin
 * revela sob demanda, no botão de olho, como nos clientes de banco.
 */

/** Caractere de censura (o mesmo usado nos "•••" da UI). */
const PONTO = '•';

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

  return PONTO.repeat(6);
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
