# Observabilidade com OpenTelemetry

Este projeto está instrumentado com **OpenTelemetry (OTel)**: ele emite *traces*,
*métricas* e *logs* sobre o que faz em execução, para investigarmos lentidão e
erros sem chutar. Este documento explica **o que foi feito**, **como rodar** e
**como cada entregável da disciplina é atendido**.

> Contexto: o projeto é **Next.js** (App Router). Por isso **não** usamos o
> `node --require .../register` do tutorial genérico de Node — o mecanismo
> correto no Next é o arquivo `instrumentation.ts`, que o framework chama uma vez
> no start do servidor. Referência: `node_modules/next/dist/docs/01-app/02-guides/open-telemetry.md`.

---

## O que foi implementado

| Arquivo | Papel |
|---------|-------|
| [`src/instrumentation.ts`](src/instrumentation.ts) | Hook do Next: chama o setup só no runtime Node (o SDK não roda no Edge). |
| [`src/instrumentation.node.ts`](src/instrumentation.node.ts) | Sobe o `NodeSDK` com a **instrumentação automática** (HTTP, `pg`/SQL, fetch de saída). |
| [`src/lib/candidaturas.ts`](src/lib/candidaturas.ts) | **Instrumentação manual**: spans `candidatura.aceitar` e `candidatura.recusar` com atributos de negócio. |
| `.env` / [`.env.example`](.env.example) | Variáveis `OTEL_*` que controlam para onde a telemetria vai. |
| [`docker-compose.yml`](docker-compose.yml) | Repassa as `OTEL_*` para o container `app` + serviço opcional `otel-lgtm` (backend local). |

### Instrumentação automática (Passo 2)

O `getNodeAutoInstrumentations` intercepta bibliotecas que já usamos e gera spans
sozinho. Como o `@prisma/adapter-pg` usa o driver **`pg`** por baixo, **toda query
SQL vira um span** automaticamente. O próprio Next.js também emite spans internos
(requisição, render, api route), exportados assim que registramos o SDK.

Desligamos a instrumentação de *filesystem* (`instrumentation-fs`) por ser muito
ruidosa (um span por leitura de arquivo).

### Instrumentação manual (Passo 4)

A auto-instrumentação enxerga HTTP e SQL, mas não sabe o que é "aceitar uma
candidatura". Em `src/lib/candidaturas.ts` envolvemos a regra de negócio em spans:

- **`candidatura.aceitar`** e **`candidatura.recusar`** (o fluxo de "fechar vaga").
- Atributos de negócio: `candidatura.id`, `equipe.id`, `candidatura.lane`,
  `ator.isAdmin`, `candidatura.recusados`, `equipe.vagasRestantes`, `equipe.status`.
- Em erro, o span é marcado em vermelho (`recordException` + `setStatus(ERROR)`).

Como usamos `startActiveSpan`, tudo que roda dentro (inclusive as queries do
Prisma) aparece **aninhado** sob esses spans na cascata.

---

## Como rodar

As variáveis `OTEL_*` já vêm no `.env`. Há duas opções de backend:

### Opção A — backend remoto da disciplina (padrão)

Já configurado no `.env` (`OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.dsc.rodrigor.com`
+ o header `Authorization`). Basta rodar a aplicação normalmente:

```bash
npm run dev
```

### Opção B — otel-lgtm local (Grafana na sua máquina)

Sobe um único container com o Grafana + Tempo/Prometheus/Loki (Passo 1 do tutorial):

```bash
docker compose --profile observability up -d otel-lgtm
```

Depois, no `.env`, aponte para ele e **remova/comente** o header de auth:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
# dentro do Docker (container app), use http://otel-lgtm:4318
```

Grafana em **http://localhost:3000** (usuário/senha: `admin` / `admin`).

---

## Vendo os dados (Passo 3)

1. Com a app no ar, **use o sistema**: cadastre uma equipe, candidate-se a uma
   vaga, e **aceite/recuse** uma candidatura (esse é o fluxo instrumentado).
2. No Grafana → **Explore** → fonte **Tempo** → **Search** pelo *service name*
   (`dsc-eq16`). Abra um trace para ver a **cascata (waterfall)**.
3. Em **Dashboards** você vê as **métricas** (latência, throughput, memória).

---

## Como demonstrar o diagnóstico de lentidão (Entregável 5)

Para provocar uma operação lenta de propósito e vê-la na cascata, adicione um
atraso temporário dentro de um handler ou de um span manual, por exemplo em
`aceitarCandidatura`:

```ts
await new Promise((r) => setTimeout(r, 500)); // 500 ms artificiais — REMOVER depois
```

Gere tráfego, abra o trace e mostre o span inchado. Na explicação do relatório,
aponte **onde** o tempo foi gasto (o span longo) e **o que** faria para resolver
(ex.: índice no banco, evitar N+1, cache). Lembre de remover o atraso ao final.

---

## Mapa dos entregáveis

| # | Entregável | Onde/como |
|---|------------|-----------|
| 1 | Backend no ar com o `service.name` | `dsc-eq16` aparece no Tempo (print do Grafana). |
| 2 | Trace de uma operação real | Fluxo "aceitar candidatura" (`PATCH /api/candidaturas/[id]`). |
| 3 | Query SQL visível | Spans do driver `pg` (ex.: `UPDATE candidatura`, `SELECT ... equipe`). |
| 4 | ≥ 2 spans manuais | `candidatura.aceitar` e `candidatura.recusar`. |
| 5 | Diagnóstico de lentidão | Ver seção acima (atraso temporário → cascata). |
| 6 | Atributo de negócio | `equipe.id`, `candidatura.lane`, `candidatura.recusados`, etc. |
