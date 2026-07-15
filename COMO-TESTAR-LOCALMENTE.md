# Como usar e testar localmente — EQ16

Guia prático das funcionalidades adicionadas nesta branch:

1. **Servidor MCP `teamfinder-mcp`** — expõe o sistema para assistentes de IA,
   com estatísticas de LoL vindas do MCP público do op.gg (provisório, até a
   Riot liberar nossa chave de API).
2. **Testes de carga (k6)** com nível de carga configurável.
3. **Otimizações de performance** (índices, cache do vínculo Discord, pool).

> Documentação detalhada de cada parte: [`mcp/README.md`](mcp/README.md),
> [`loadtest/README.md`](loadtest/README.md) e
> [`loadtest/RESULTADOS.md`](loadtest/RESULTADOS.md).
> Conceitos de MCP: [`MCP-TUTORIAL.md`](MCP-TUTORIAL.md) e [`MCP-IDEIA.md`](MCP-IDEIA.md).

---

## 0. Pré-requisitos

| Ferramenta | Para quê | Obrigatória? |
|---|---|---|
| **Node.js 20+** | rodar o site e o MCP | sim |
| **PostgreSQL** | banco (Docker **ou** instalação nativa) | sim |
| **Docker** | subir o banco e/ou rodar o k6 sem instalar nada | opcional |
| **k6** | testes de carga (alternativa ao Docker) | opcional |

---

## 1. O que configurar (uma vez só)

### 1.1 Dependências

```bash
npm install
```

### 1.2 Variáveis de ambiente

```bash
cp .env.example .env          # Linux/Mac
Copy-Item .env.example .env   # PowerShell
```

Abra o `.env` e ajuste **apenas o essencial** para rodar local:

| Variável | O que colocar |
|---|---|
| `DATABASE_URL` | connection string do **seu** Postgres local |
| `NEXTAUTH_SECRET` | qualquer string longa aleatória (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `http://localhost:3000` |

> ⚠️ O `.env` é **ignorado pelo Git** (não versione segredos). O `.env.example`
> só tem placeholders.

**Nada do Discord é obrigatório** para testar o MCP e a carga: sem essas
variáveis o site funciona normal e as ações do Discord viram *no-op*.

**Nada do MCP precisa ser configurado**: `TEAMFINDER_API_URL`, `OPGG_MCP_URL` e
`OPGG_REGION` já têm defaults bons para local (o MCP do op.gg é **público, sem
chave de API**).

### 1.3 Banco de dados

Com Docker:
```bash
docker compose up -d
```

Com Postgres nativo: crie um banco e aponte a `DATABASE_URL` para ele.

Depois, aplique as migrations (inclui a nova, de índices de performance):

```bash
npx prisma generate
npx prisma migrate dev
```

(Opcional) usuário admin: `npx prisma db seed`

### 1.4 Suba o site

```bash
npm run dev     # desenvolvimento → http://localhost:3000
```

Para **medir performance**, use o build de produção (o modo dev compila sob
demanda e distorce as medições):

```bash
npm run build
npm start
```

---

## 2. Testes unitários (não precisam de banco)

Usam mocks — rodam sozinhos:

```bash
npm test          # 170 testes (inclui 13 novos, do MCP)
npm run test:cov  # + relatório de cobertura (meta: 85% de linhas)
```

Os testes da lógica de composição do MCP ficam em
[`mcp/compose.test.ts`](mcp/compose.test.ts) — cobrem o ranking de candidatos
(principal > secundária > fill), o desempate por ordem de cadastro e a regra de
não repetir jogador na escalação.

---

## 3. Servidor MCP (`teamfinder-mcp`)

### 3.1 O que ele expõe

| Tool | O que faz | Fonte dos dados |
|---|---|---|
| `buscar_free_agents(lane?)` | jogadores disponíveis (FILL atende qualquer rota) | API local |
| `listar_equipes(lane?, apenas_abertas?)` | equipes e vagas abertas | API local |
| `perfil_invocador(nickname, regiao?)` | elo, LP, winrate, campeões mais jogados | op.gg |
| `partidas_recentes(nickname, quantidade?, regiao?)` | histórico (campeão, KDA, resultado) | op.gg |
| `sugerir_composicao(equipeId \| vagas, incluir_stats?)` | rankeia candidatos por vaga + escalação sugerida | API local + op.gg |

Também expõe 2 **resources** (`teamfinder://free-agents`, `teamfinder://equipes`)
e 1 **prompt** (`montar_time`). Todas as tools são **somente leitura**.

> **Pré-requisito:** o site precisa estar no ar (passo 1.4) para as tools da API
> local responderem. As tools do op.gg funcionam mesmo com o site desligado.

### 3.2 Rodar o servidor

```bash
npm run mcp
```

Ele fala **stdio** (o protocolo do MCP), então "não acontece nada visível" — é
esperado. Quem dá vida a ele é um cliente MCP (Claude Desktop, Claude Code ou o
Inspector). Logs vão para o stderr, ex.:

```
[teamfinder-mcp] API local: http://localhost:3000
[teamfinder-mcp] op.gg MCP: https://mcp-api.op.gg/mcp (região BR)
[teamfinder-mcp] pronto (stdio).
```

### 3.3 Testar com o MCP Inspector (debug visual)

```bash
npm run mcp:inspector
```

Abra **a URL que o terminal imprimir** — ela já vem com o token da sessão:

```
http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=<token-gerado-na-hora>
```

Na tela: **Transport = STDIO**, **Command = `node`**, **Arguments =
`mcp/server.ts`** → **Connect** → aba **Tools** → **List Tools**.

**Notas para Windows** (aprendidas na marra):

- O Command **precisa ser `node`**, não `npx` — o Inspector não consegue
  executar `npx` no Windows e o Connect falha em silêncio. (O script
  `mcp:inspector` já usa `node`; o Node 20+ roda TypeScript nativamente.)
- Cada `npm run mcp:inspector` gera um **token novo**: use sempre a URL recém-
  impressa, não uma aba antiga nem `localhost:6274` digitado à mão.
- O Inspector guarda a última config no navegador — se o campo Command aparecer
  com `npx` de uma tentativa anterior, troque para `node` na própria tela.
- Se o Connect não engatar no seu navegador padrão, o **Simple Browser do VS
  Code** funciona (`Ctrl+Shift+P` → "Simple Browser: Show" → cole a URL).
- Portas ocupadas (`PORT IS IN USE`): feche instâncias antigas ou rode
  `CLIENT_PORT=6280 SERVER_PORT=6281 npx @modelcontextprotocol/inspector node mcp/server.ts`.

**Sugestões do que testar:**

| Tool | Argumentos | Esperado |
|---|---|---|
| `buscar_free_agents` | `lane = MID` | lista de jogadores de mid (+ os FILL) |
| `listar_equipes` | `lane = SUPPORT` | equipes com vaga de suporte |
| `perfil_invocador` | `nickname = Hide on bush#KR1`, `regiao = KR` | perfil do Faker — bom para validar o op.gg |
| `sugerir_composicao` | `equipeId` (pegue um id via `listar_equipes`) | escalação por vaga |

> Os nicknames de teste do seed são fictícios e **não existem no op.gg** — para
> validar as tools de estatística use um Riot ID real (ex.: `Hide on bush#KR1`
> na região `KR`).

### 3.4 Usar no Claude Desktop

**Settings → Developer → Edit Config**, e adicione (ajustando o caminho):

```json
{
  "mcpServers": {
    "teamfinder": {
      "command": "npx",
      "args": ["tsx", "C:/caminho/para/projeto-eq16/mcp/server.ts"],
      "env": { "TEAMFINDER_API_URL": "http://localhost:3000" }
    }
  }
}
```

Reinicie o Claude Desktop (com o site no ar) e pergunte:

- "Quais free agents de mid estão disponíveis?"
- "Liste as equipes com vaga de suporte."
- "Qual o elo do jogador `Fulano#TAG`?"
- "Monte um time equilibrado para a equipe X, com stats, e justifique as escolhas."
  → o assistente chama `sugerir_composicao` com `incluir_stats=true`.

### 3.5 Usar no Claude Code

```bash
claude mcp add teamfinder -- npx tsx mcp/server.ts
```

---

## 4. Testes de carga (k6)

> ⚠️ **Somente contra o ambiente LOCAL.** Não aponte para
> `https://eqNN.dsc.rodrigor.com` — servidor e PostgreSQL são **compartilhados**
> com as outras equipes.

### 4.1 (Recomendado) Popule o banco

Listagens vazias respondem rápido demais e escondem gargalos:

```bash
npx tsx loadtest/seed-carga.ts              # 150 free agents + 40 equipes
AGENTS=500 EQUIPES=100 npx tsx loadtest/seed-carga.ts
```

O script é idempotente (limpa os `carga_*` da rodada anterior). Use um **banco
separado** do seu banco de desenvolvimento — basta apontar a `DATABASE_URL` para
outro banco antes de rodar.

### 4.2 Rodar

Com o **k6 instalado** (`winget install k6` / `brew install k6`):

```bash
npm run loadtest          # media — 20 VUs (~3 min)
npm run loadtest:smoke    # 1 VU (~30s) — valida o script
npm run loadtest:leve     # 5 VUs
npm run loadtest:pesada   # 50 VUs
npm run loadtest:stress   # rampa até 100 VUs
npm run loadtest:report   # media + exporta loadtest/resultado.json
```

Com **Docker** (sem instalar o k6):

```bash
# Windows/macOS (o app roda no host)
docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 -e LEVEL=media \
  grafana/k6 run - < loadtest/carga.js
# Linux
docker run --rm -i --network host -e LEVEL=media grafana/k6 run - < loadtest/carga.js
```

Carga **customizada** (ignora o nível):

```bash
k6 run -e VUS=35 -e DURATION=2m loadtest/carga.js
```

### 4.3 O que o cenário exercita

- **Navegação pública**: `/ping`, `/api/free-agents`, `/api/equipes`.
- **Fluxo autenticado**: login NextAuth completo (csrf → credentials → cookie),
  1x por usuário virtual, depois `GET /api/usuarios/me`.
- O `setup()` cria sozinho o usuário de teste (`loadtest_k6`); se já existir,
  reaproveita.

### 4.4 Como ler o resultado

- **`http_req_duration`** → olhe o **`p(95)`**. As linhas `{name:...}` quebram
  por rota (`ping`, `free-agents`, `equipes`, `login`, `me`) — é aí que se
  enxerga **qual** rota é o gargalo.
- **`http_req_failed`** → taxa de erro. **`http_reqs`** → total e RPS.
- Cada **threshold** aparece com `✓`/`✗`; se algum falhar, o k6 sai com código ≠ 0.

Metas padrão: erros < **1%**, p95 < **500 ms** (login: p95 < 2 s — o `bcrypt` é
caro **de propósito**, é proteção contra força bruta). Ajuste com
`-e P95_MS=...` / `-e ERR_MAX=...`.

---

## 5. Performance — o que mudou

Detalhes e números medidos: [`loadtest/RESULTADOS.md`](loadtest/RESULTADOS.md).

| Mudança | Onde | Efeito |
|---|---|---|
| Cache (TTL 60s) do vínculo do Discord no callback JWT | `src/lib/auth.ts` | **medido**: `/api/usuarios/me` com avg −12%, p95 −14%, máx −51% (era 1 query no banco por requisição autenticada) |
| Índices de FK e de `createdAt` | migration `add_indices_performance` | estrutural: com ~150 linhas o planner ainda prefere *seq scan*; evita degradação conforme a base cresce |
| 1 query a menos no `POST /api/free-agents` | `src/app/api/free-agents/route.ts` | 2 roundtrips viraram 1 |
| Pool de conexões explícito (`DATABASE_POOL_MAX`) | `src/lib/prisma.ts` | corrige `maximum_pool_size` da URL, que o adapter **ignorava em silêncio** |

Resultados de referência (build de produção, banco com 150 free agents + 40 equipes):

- **20 VUs**: ~11.200 requisições, **0 falhas**, p95 geral **~21 ms**.
- **50 VUs**: ~42.200 requisições (~156 req/s), **0 falhas**, p95 geral **~54 ms**.

---

## 6. Resumo: roteiro mínimo de teste

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL e NEXTAUTH_SECRET
docker compose up -d          # ou use seu Postgres local
npx prisma migrate dev
npm test                      # 1) unitários — não precisa de banco

npx tsx loadtest/seed-carga.ts  # 2) popula dados p/ teste
npm run build && npm start      # 3) site em produção (outro terminal)

npm run mcp:inspector         # 4) testa o MCP visualmente
npm run loadtest              # 5) teste de carga (k6 instalado ou via Docker)
```
