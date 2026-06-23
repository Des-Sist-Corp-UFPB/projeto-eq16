/**
 * Links e regras centralizados.
 *
 * Edite estes valores quando os destinos finais mudarem (ex.: trocar o convite
 * do Discord, ou substituir o League of Graphs por uma API oficial da Riot).
 */

// Convite fixo do servidor do Discord (botão dos cards e menu da home).
// TODO: futuramente isso pode virar um link individual gerado por bot.
export const DISCORD_INVITE_URL = 'https://discord.gg/DGVwHrgt4Y';

// Grupo do WhatsApp da comunidade (apenas link de convite do grupo — não expõe
// números individuais dos usuários). Exibido no menu da home.
export const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/LRSVVOsbRae3i1uRHC2xpl';

// Base de busca de invocador no League of Graphs (região BR).
export const LEAGUE_OF_GRAPHS_BASE = 'https://www.leagueofgraphs.com/summoner/br/';

/**
 * Regex do nickname no formato `Nome#TAG`.
 * - Nome: qualquer coisa sem `#` (pode conter espaços).
 * - TAG: de 1 a 5 caracteres alfanuméricos.
 *
 * Ex. válido: `Chico kit lasca#Chico`
 */
export const NICKNAME_REGEX = /^[^#]+#[A-Za-z0-9]{1,5}$/;

export const NICKNAME_HINT =
  'Formato: Nome#TAG (a TAG após o # pode ter até 5 caracteres). Ex.: Chico kit lasca#Chico';

/** Valida se o nickname segue o formato `Nome#TAG`. */
export function isNicknameValido(nickname: string): boolean {
  return NICKNAME_REGEX.test(nickname.trim());
}

/**
 * Monta a URL do League of Graphs a partir do nickname `Nome#TAG`.
 *
 * `Chico kit lasca#Chico` -> `https://www.leagueofgraphs.com/summoner/br/Chico+kit+lasca-Chico`
 *
 * Retorna `null` se o nickname não seguir o formato esperado.
 */
export function buildLeagueOfGraphsUrl(nickname: string): string | null {
  const valor = nickname.trim();
  if (!isNicknameValido(valor)) return null;

  const [nome, tag] = valor.split('#');
  const nomeSlug = nome.trim().replace(/\s+/g, '+');
  const slug = `${nomeSlug}-${tag}`;
  return `${LEAGUE_OF_GRAPHS_BASE}${encodeURI(slug)}`;
}
