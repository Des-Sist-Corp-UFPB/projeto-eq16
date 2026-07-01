# Relatório de Cobertura de Testes

Relatório gerado para a avaliação final (prazo 30/06/2026).

- **Stack:** Node / TypeScript (Next.js 16) — testes com **Vitest** + provider **v8**.
- **Relatório HTML:** [`coverage/index.html`](coverage/index.html)
- **Como reproduzir:** `npx prisma generate && npm run test:cov`
  (os testes usam mocks de Prisma/Discord/fetch — **não** precisam de banco).

## Percentual total (camada crítica)

| Métrica      | Cobertura | Contagem   |
| ------------ | --------- | ---------- |
| **Linhas**   | **97.5%** | 469 / 481  |
| Statements   | 96.9%     | 501 / 517  |
| Funções      | 94.36%    | 67 / 71    |
| Branches     | 89.59%    | 310 / 346  |

**22 arquivos de teste · 157 testes · todos passando.** Todas as métricas ficam
acima da meta de **85%** (thresholds configurados em `vitest.config.mts`).

## Escopo medido

A meta de cobertura foca na **camada crítica** (regras de negócio, rotas da API e
constantes), conforme `include` em `vitest.config.mts`:

- `src/lib/**` — núcleo (auditoria, candidaturas, Discord, cripto, apiAuth)
- `src/app/api/**` — rotas REST (equipes, free-agents, candidaturas, discord, usuários, admin)
- `src/constants/**`

Glue de infraestrutura sem lógica testável de unidade (`src/lib/prisma.ts`,
`src/lib/auth.ts`, catch-all do NextAuth) fica fora da medição — ver os `exclude`
em `vitest.config.mts`.

> Este relatório é uma cópia estática de `coverage/` (que está no `.gitignore`),
> preservada aqui em `cobertura/` para ficar versionada.
