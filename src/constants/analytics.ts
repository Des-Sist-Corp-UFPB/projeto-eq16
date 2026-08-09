/**
 * Umami — métricas de acesso (visitas, páginas, referências).
 *
 * Painel da disciplina: https://umami.dsc.rodrigor.com (conta dsc-eq16).
 * O script é injetado no layout raiz (`src/app/layout.tsx`) e conta as
 * navegações do App Router sozinho — o tracker do Umami escuta o history,
 * então trocar de página no site já vira pageview sem código extra.
 *
 * Por que o id fica no código e não numa env: ele é PÚBLICO (vai no HTML de
 * toda página, qualquer visitante lê no "ver código-fonte"), e o build roda
 * dentro do Dockerfile — uma env de runtime no docker-compose não chegaria às
 * páginas estáticas. Mesma escolha já feita para os links em `links.ts`.
 */

/** Endereço do tracker no painel da disciplina. */
export const UMAMI_SCRIPT_URL = 'https://umami.dsc.rodrigor.com/script.js';

// `data-website-id` do painel (conta dsc-eq16). Se estiver vazio, nenhum
// script é carregado e nada é enviado.
const ID_NO_PAINEL = '5bb89046-e8c6-4446-8869-512cbaef3664';

/** Id do site no Umami. Pode ser sobrescrito no build por NEXT_PUBLIC_UMAMI_WEBSITE_ID. */
export const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? ID_NO_PAINEL;

/**
 * Só mede em produção e com o site configurado.
 *
 * O corte por ambiente evita poluir o painel do professor com acessos de
 * `npm run dev` na máquina de cada um. Para conferir localmente, rode um build
 * de produção (`npm run build && npm start`).
 */
export function umamiHabilitado(
  websiteId: string = UMAMI_WEBSITE_ID,
  ambiente: string | undefined = process.env.NODE_ENV
): boolean {
  return ambiente === 'production' && websiteId.trim().length > 0;
}
