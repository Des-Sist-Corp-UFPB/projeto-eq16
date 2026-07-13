# Teste de Carga e Performance (k6)

Teste de carga do **Rinha Team Finder** usando o [k6](https://k6.io). O cenário
exercita as **rotas reais** do sistema, não só o healthcheck:

- **Navegação pública** (a cada iteração): `GET /ping`, `GET /api/free-agents`,
  `GET /api/equipes` — as rotas mais quentes do site.
- **Fluxo autenticado**: login NextAuth (Credentials: `/api/auth/csrf` +
  `/api/auth/callback/credentials`, 1x por usuário virtual) e
  `GET /api/usuarios/me` com o cookie de sessão.
- O `setup()` cria automaticamente o usuário de teste `loadtest_k6`
  (via `POST /api/usuarios/registro`; se já existir, reaproveita).

> ⚠️ **Rode SEMPRE contra o seu ambiente LOCAL.** **Não** aponte o teste para
> `https://eqNN.dsc.rodrigor.com`: o servidor e o **PostgreSQL são
> compartilhados** com todas as equipes e uma carga pesada derrubaria os
> projetos dos colegas.

---

## 1. Pré-requisitos

Suba o projeto localmente. Para medir performance de verdade, use o **build de
produção** (o `next dev` é bem mais lento e distorce os números):

```bash
npm run build
npm start          # app em http://localhost:3000 (banco precisa estar no ar)
```

Tenha o k6 disponível — escolha **uma** opção:

**Opção A — instalar o k6:**
```bash
winget install k6 --source winget   # Windows
brew install k6                     # macOS
sudo apt-get install -y k6          # Linux (veja k6.io/docs)
```

**Opção B — via Docker (sem instalar nada):**
```bash
# Windows / macOS (o app roda no host, então use host.docker.internal)
docker run --rm -i -e BASE_URL=http://host.docker.internal:3000 \
  -e LEVEL=media grafana/k6 run - < loadtest/carga.js
# Linux
docker run --rm -i --network host -e LEVEL=media grafana/k6 run - < loadtest/carga.js
```

---

## 2. Escolhendo o nível de carga

| Nível | Usuários virtuais | Duração | Para quê |
|-------|------------------|---------|----------|
| `smoke`  | 1        | 30s    | Validar que o script/app funcionam |
| `leve`   | 5        | ~1m30s | Uso casual (poucos alunos navegando) |
| `media`  | 20       | ~3m    | Pico esperado (inscrições abertas) — **padrão** |
| `pesada` | 50       | ~4m30s | Pico agressivo (divulgação no Discord) |
| `stress` | 25→100 em degraus | ~5m30s | Procurar o limite da aplicação |

```bash
npm run loadtest            # nível media
npm run loadtest:smoke
npm run loadtest:leve
npm run loadtest:pesada
npm run loadtest:stress
npm run loadtest:report     # media + exporta loadtest/resultado.json
```

**Carga customizada** (qualquer combinação, ignora o nível):

```bash
k6 run -e VUS=35 -e DURATION=2m loadtest/carga.js
```

Outras variáveis:

| Variável | Default | O que faz |
|----------|---------|-----------|
| `BASE_URL` | `http://localhost:3000` | URL local do app |
| `AUTH` | `on` | `off` desliga o fluxo autenticado (login + `/me`) |
| `P95_MS` | `500` | Meta de p95 em ms (o login usa 4x isso, por causa do bcrypt) |
| `ERR_MAX` | `0.01` | Meta de taxa máxima de falha (1%) |
| `LOAD_USER` / `LOAD_PASS` | `loadtest_k6` / `loadtest123` | Usuário dedicado do teste |

---

## 3. Como ler o resultado

No fim, o k6 imprime um resumo. Os campos importantes:

- **`http_req_duration`** — tempo de resposta; olhe o **`p(95)`**.
  As linhas `{name:...}` quebram por rota (`ping`, `free-agents`, `equipes`,
  `login`, `me`) — é aí que se enxerga **qual rota** é o gargalo.
- **`http_req_failed`** — percentual de requisições que falharam.
- **`http_reqs`** — total de requisições e taxa por segundo (**RPS**).
- **`checks`** — percentual das verificações que passaram.

Cada **threshold** aparece com `✓`/`✗`; se algum falhar o k6 sai com código ≠ 0.
Metas padrão: falhas < **1%** e p95 < **500 ms** (login: p95 < 2 s, pois o
bcrypt de propósito torna o login caro).

Para gerar o JSON de evidência da avaliação:

```bash
npm run loadtest:report     # grava loadtest/resultado.json
```

---

## 4. Observações de metodologia

1. **Build de produção** (`npm run build && npm start`) — o modo dev compila
   sob demanda e polui as medições.
2. **Popule o banco** com um volume realista antes de medir (listagens vazias
   respondem rápido demais): use `npx tsx loadtest/seed-carga.ts`.
3. O login roda **1x por VU** (como usuários reais, que mantêm sessão), então o
   custo do bcrypt aparece no início da rampa — é esperado.
4. Rode 2–3 vezes e descarte a primeira (aquecimento de connection pool/JIT).
5. Resultados medidos e as melhorias aplicadas estão documentados em
   [`loadtest/RESULTADOS.md`](RESULTADOS.md).
