import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve o alias `@/*` lendo o tsconfig do projeto (suporte nativo do Vite).
  resolve: { tsconfigPaths: true },
  test: {
    // Camada de lógica/rotas roda no Node (sem DOM). Componentes React, se um dia
    // forem testados, podem usar jsdom por arquivo (`// @vitest-environment jsdom`).
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'mcp/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      // Foco na camada crítica (regras de negócio + rotas + constantes). Componentes
      // e páginas React ficam fora da meta de cobertura por ora (ver E3 no roadmap).
      include: ['src/lib/**', 'src/constants/**', 'src/app/api/**'],
      exclude: [
        // Glue de infraestrutura (sem lógica testável de unidade).
        'src/lib/prisma.ts',
        // Config do NextAuth: callbacks dependem do framework; cobertos por e2e no futuro.
        'src/lib/auth.ts',
        // Rota de catch-all do NextAuth (handler gerado pela lib).
        'src/app/api/auth/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 80,
      },
    },
  },
});
