/**
 * Ponto de entrada da instrumentação (OpenTelemetry).
 *
 * O Next.js chama `register()` UMA vez, no start de cada instância do servidor,
 * antes de atender qualquer requisição. É aqui que ligamos a telemetria.
 *
 * O SDK do OpenTelemetry usa APIs de Node (async_hooks, etc.) que NÃO existem no
 * Edge Runtime — por isso só carregamos o setup pesado quando estamos no Node.
 * Ver docs do Next: node_modules/next/dist/docs/01-app/02-guides/open-telemetry.md
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}
