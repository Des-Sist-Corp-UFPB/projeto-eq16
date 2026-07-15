# Resultados do Teste de Carga e Otimizações — 2026-07-13

## Metodologia

- **Ambiente:** máquina local (Windows 11), app em **build de produção**
  (`npm run build && npm start`, porta 3000), PostgreSQL 16/18 local, banco
  **dedicado** ao teste (`eq16_loadtest`) — separado do banco de desenvolvimento.
- **Dados:** 150 free agents + 40 equipes + usuários donos (via
  `npx tsx loadtest/seed-carga.ts`) — listagens vazias mascarariam gargalos.
- **Ferramenta:** k6 (imagem Docker `grafana/k6`), cenário
  [`carga.js`](carga.js) nível **media** (20 VUs, ~2m50s): a cada iteração,
  navegação pública (`/ping`, `/api/free-agents`, `/api/equipes`) + fluxo
  autenticado (login NextAuth 1x por VU, depois `/api/usuarios/me`).
- Duas rodadas idênticas: **baseline** (código original) e **otimizado**
  (após as mudanças abaixo). ~11.200 requisições por rodada, 0 falhas,
  100% dos checks — todos os thresholds passaram nas duas.

## Números (nível media — 20 VUs)

p95 por rota, em ms (baseline → otimizado):

| Rota | p95 antes | p95 depois | avg antes | avg depois | máx antes | máx depois |
|------|----------:|-----------:|----------:|-----------:|----------:|-----------:|
| `GET /api/usuarios/me` 🔒 | 16,23 | **14,02** | 10,78 | **9,44** | 44,42 | **21,69** |
| `GET /api/free-agents` | 24,62 | 23,57 | 16,88 | 17,43 | 62,82 | 98,77 |
| `GET /api/equipes` | 18,16 | 18,12 | 11,92 | 12,60 | 28,04 | 26,29 |
| `GET /ping` | 6,21 | 5,97 | 4,47 | 4,84 | 96,13 | 110,47 |
| login (NextAuth) | 297,38 | 296,07 | 260,52 | 262,55 | 303,86 | 309,24 |
| **geral** | 21,00 | 20,64 | 11,44 | 11,51 | — | — |

Vazão nas duas rodadas: **~65,7 req/s** com 20 VUs (limitada pelo *think time*
de 1s do cenário, como usuários reais — o servidor tinha folga).

## Nível pesada (50 VUs) — build otimizado

Rodada adicional para verificar folga sob pico agressivo: **42.229 requisições
em ~4m30s (~156 req/s), 0 falhas, 100% dos checks** — todos os thresholds
passaram.

| Rota | p95 (ms) | avg (ms) |
|------|---------:|---------:|
| `GET /api/usuarios/me` 🔒 | 36,39 | 13,52 |
| `GET /api/free-agents` | 64,86 | 24,09 |
| `GET /api/equipes` | 52,86 | 19,05 |
| `GET /ping` | 95,11* | 12,84 |
| login (NextAuth) | 349,47 | 289,47 |
| **geral** | **54,33** | 17,68 |

\* o p95 alto do `/ping` sob 50 VUs reflete contenção do event loop do Node
durante os picos de login (bcrypt é CPU-bound e roda na thread pool) — as
rotas de banco continuam saudáveis.

## Otimizações aplicadas

1. **Cache (TTL 60s) do vínculo do Discord no callback JWT**
   ([`src/lib/auth.ts`](../src/lib/auth.ts)) — *a otimização com efeito medido*.
   Antes, todo usuário **sem** Discord vinculado disparava 1 query no banco em
   **cada requisição autenticada**: o token guarda `discordId: null`, a condição
   `!token.discordId` ficava sempre verdadeira e a recarga rodava de novo (a
   mutação do token não persiste no cookie em leituras). Resultado no `/me`:
   avg **−12%**, p95 **−14%**, máx **−51%** (metade das queries da rota). A
   autocorreção de sessões defasadas continua funcionando (em até 60s), e
   login/`update()` seguem lendo direto do banco.

2. **Índices de FK e de ordenação**
   ([migration `add_indices_performance`](../prisma/migrations/)) —
   `FreeAgent(userId)`, `FreeAgent(createdAt)`, `Equipe(userId)`,
   `Equipe(createdAt)`, `Candidatura(userId)`. O Postgres **não** indexa FKs
   automaticamente; essas colunas atendem as checagens de dono, os cascades de
   deleção e o `orderBy createdAt` das listagens públicas.
   **Honestidade metodológica:** com 150 linhas o planner ainda prefere
   *seq scan* (verificado com `EXPLAIN ANALYZE`), então o ganho não aparece
   nos números acima — é uma correção **estrutural**, que evita degradação
   conforme a base cresce (na escala de milhares de linhas, listagem e
   checagens passam a usar os índices).

3. **Uma query a menos no `POST /api/free-agents`**
   ([route.ts](../src/app/api/free-agents/route.ts)) — as duas pré-validações
   (Discord vinculado + "1 free agent por conta") eram 2 roundtrips em série;
   viraram 1 `findUnique` com `select` aninhado.

4. **Pool de conexões configurável**
   ([`src/lib/prisma.ts`](../src/lib/prisma.ts), `DATABASE_POOL_MAX`) — o
   parâmetro `maximum_pool_size=5` que estava na URL do docker-compose é
   sintaxe do Prisma clássico e era **silenciosamente ignorado** pelo adapter
   `pg` (que usava o default 10). Agora o tamanho do pool é explícito e o
   compose foi corrigido.

## Gargalos conhecidos (e por que não "corrigimos")

- **Login (~260ms)**: dominado pelo `bcrypt.compare` com custo 12 — **é
  intencional** (proteção contra força bruta). Como usuários reais logam 1x por
  sessão, o cenário loga 1x por VU e a meta do login é separada (p95 < 2s).
  Se um dia o throughput de login importar: `bcrypt` nativo (C++) ou Argon2
  com parâmetros calibrados — **não** reduzir o custo abaixo de 10.
- **Listagens sem paginação**: `GET /api/free-agents` e `GET /api/equipes`
  retornam **tudo** (aqui, ~150/40 registros ≈ 30KB/9KB por resposta). Na
  escala do torneio isso é adequado; se a base crescer muito, paginação
  (`take`/`cursor`) e/ou cache HTTP curto nas listagens públicas são os
  próximos passos — os índices de `createdAt` já deixam o terreno pronto.

## Como reproduzir

```bash
# 1. banco dedicado + dados
npx prisma migrate deploy          # com DATABASE_URL apontando p/ banco de teste
npx tsx loadtest/seed-carga.ts

# 2. app em modo produção
npm run build && npm start

# 3. carga (escolha o nível)
npm run loadtest                   # media (20 VUs)
npm run loadtest:pesada            # 50 VUs
npm run loadtest:report            # exporta loadtest/resultado.json
```
