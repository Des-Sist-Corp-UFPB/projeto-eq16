import http from 'k6/http';
import { check, group, sleep } from 'k6';

// ─────────────────────────────────────────────────────────────────────────────
// Teste de carga e performance — k6 — Rinha Team Finder (EQ16)
//
// IMPORTANTE: rode contra o SEU AMBIENTE LOCAL. NÃO aponte para
// https://eqNN.dsc.rodrigor.com — o servidor e o PostgreSQL são compartilhados
// com as outras equipes.
//
// Uso básico (níveis prontos — veja loadtest/README.md):
//   k6 run -e LEVEL=smoke  loadtest/carga.js   # 1 VU, valida o script
//   k6 run -e LEVEL=leve   loadtest/carga.js   # 5 VUs
//   k6 run -e LEVEL=media  loadtest/carga.js   # 20 VUs (padrão)
//   k6 run -e LEVEL=pesada loadtest/carga.js   # 50 VUs
//   k6 run -e LEVEL=stress loadtest/carga.js   # rampa até 100 VUs
//
// Carga customizada (ignora LEVEL):
//   k6 run -e VUS=35 -e DURATION=2m loadtest/carga.js
//
// Outras variáveis:
//   BASE_URL  (default http://localhost:3000)
//   AUTH=off  desliga o fluxo autenticado (login NextAuth + /api/usuarios/me)
//   P95_MS / ERR_MAX  ajustam as metas (default 500 ms / 1%)
// ─────────────────────────────────────────────────────────────────────────────

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_ON = (__ENV.AUTH || 'on') !== 'off';

// Usuário dedicado do teste (criado no setup; não usa dados reais).
const LOAD_USER = __ENV.LOAD_USER || 'loadtest_k6';
const LOAD_PASS = __ENV.LOAD_PASS || 'loadtest123';

// ─── Níveis de carga ─────────────────────────────────────────────────────────

const NIVEIS = {
  //           validação do script, sem estressar nada
  smoke: { stages: [{ duration: '30s', target: 1 }] },
  //           uso casual (poucos alunos navegando)
  leve: {
    stages: [
      { duration: '15s', target: 5 },
      { duration: '1m', target: 5 },
      { duration: '10s', target: 0 },
    ],
  },
  //           horário de pico esperado (inscrições abertas)
  media: {
    stages: [
      { duration: '30s', target: 20 },
      { duration: '2m', target: 20 },
      { duration: '20s', target: 0 },
    ],
  },
  //           pico agressivo (divulgação da rinha no Discord)
  pesada: {
    stages: [
      { duration: '1m', target: 50 },
      { duration: '3m', target: 50 },
      { duration: '30s', target: 0 },
    ],
  },
  //           procura o limite: sobe em degraus até 100 VUs
  stress: {
    stages: [
      { duration: '1m', target: 25 },
      { duration: '1m', target: 50 },
      { duration: '1m', target: 75 },
      { duration: '2m', target: 100 },
      { duration: '30s', target: 0 },
    ],
  },
};

function montarStages() {
  // VUS/DURATION customizados têm prioridade sobre LEVEL.
  if (__ENV.VUS) {
    const vus = Number(__ENV.VUS);
    const dur = __ENV.DURATION || '1m';
    return [
      { duration: '30s', target: vus },
      { duration: dur, target: vus },
      { duration: '20s', target: 0 },
    ];
  }
  const nivel = (__ENV.LEVEL || 'media').toLowerCase();
  if (!NIVEIS[nivel]) {
    throw new Error(`LEVEL desconhecido: "${nivel}". Use: ${Object.keys(NIVEIS).join(', ')}`);
  }
  return NIVEIS[nivel].stages;
}

const P95 = Number(__ENV.P95_MS || 500);
const ERR = Number(__ENV.ERR_MAX || 0.01);

export const options = {
  stages: montarStages(),
  // Mantém o cookie de sessão entre iterações (logamos 1x por VU, como um
  // usuário real). Sem isso o k6 zera o cookie jar a cada iteração.
  noCookiesReset: true,
  thresholds: {
    http_req_failed: [`rate<${ERR}`],
    http_req_duration: [`p(95)<${P95}`],
    // Metas por rota (aparecem separadas no resumo — facilita achar o gargalo).
    'http_req_duration{name:ping}': [`p(95)<${P95}`],
    'http_req_duration{name:free-agents}': [`p(95)<${P95}`],
    'http_req_duration{name:equipes}': [`p(95)<${P95}`],
    'http_req_duration{name:me}': [`p(95)<${P95}`],
    // Login envolve bcrypt (caro por definição) — meta própria, mais folgada.
    'http_req_duration{name:login}': [`p(95)<${P95 * 4}`],
  },
};

// ─── Setup: garante o usuário de teste (roda 1x, antes da carga) ─────────────

export function setup() {
  const res = http.post(
    `${BASE}/api/usuarios/registro`,
    JSON.stringify({ username: LOAD_USER, password: LOAD_PASS }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'registro' },
      // 409 = usuário sobrou de uma rodada anterior — não é falha.
      responseCallback: http.expectedStatuses(201, 409),
    }
  );
  // 201 = criado agora; 409 = já existia de uma rodada anterior. Ambos servem.
  if (res.status !== 201 && res.status !== 409) {
    throw new Error(
      `Não consegui preparar o usuário de teste (HTTP ${res.status}). O app está no ar em ${BASE}?`
    );
  }
}

// ─── Fluxo autenticado (NextAuth Credentials) ────────────────────────────────

// Login 1x por VU; o cookie de sessão fica no cookie jar do VU.
let logado = false;

function loginNextAuth() {
  const csrfRes = http.get(`${BASE}/api/auth/csrf`, { tags: { name: 'csrf' } });
  const okCsrf = check(csrfRes, { 'csrf 200': (r) => r.status === 200 });
  if (!okCsrf) return false;

  const csrfToken = csrfRes.json('csrfToken');
  const loginRes = http.post(
    `${BASE}/api/auth/callback/credentials`,
    {
      csrfToken,
      username: LOAD_USER,
      password: LOAD_PASS,
      callbackUrl: `${BASE}/inicio`,
      json: 'true',
    },
    { tags: { name: 'login' } }
  );

  return check(loginRes, {
    'login 200': (r) => r.status === 200,
    'sessão criada': () => {
      const jar = http.cookieJar().cookiesForURL(BASE);
      return Object.keys(jar).some((c) => c.includes('next-auth.session-token'));
    },
  });
}

// ─── Cenário principal (o que cada usuário virtual faz em loop) ──────────────

export default function () {
  group('navegacao publica', () => {
    const ping = http.get(`${BASE}/ping`, { tags: { name: 'ping' } });
    check(ping, { 'ping 200': (r) => r.status === 200 });

    // As duas listagens públicas — o coração do site (rotas mais quentes).
    const agents = http.get(`${BASE}/api/free-agents`, { tags: { name: 'free-agents' } });
    check(agents, {
      'free-agents 200': (r) => r.status === 200,
      'free-agents é lista': (r) => Array.isArray(r.json()),
    });

    const equipes = http.get(`${BASE}/api/equipes`, { tags: { name: 'equipes' } });
    check(equipes, {
      'equipes 200': (r) => r.status === 200,
      'equipes é lista': (r) => Array.isArray(r.json()),
    });
  });

  if (AUTH_ON) {
    group('fluxo autenticado', () => {
      if (!logado) logado = loginNextAuth();
      if (logado) {
        const me = http.get(`${BASE}/api/usuarios/me`, { tags: { name: 'me' } });
        check(me, { 'me 200': (r) => r.status === 200 });
      }
    });
  }

  sleep(1); // "think time" de um usuário real entre cliques
}
