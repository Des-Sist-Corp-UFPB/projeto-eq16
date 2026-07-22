/**
 * Setup do OpenTelemetry para o runtime Node.js.
 *
 * Usa a instrumentação AUTOMÁTICA (zero-code): o `getNodeAutoInstrumentations`
 * intercepta as bibliotecas que já usamos e gera spans sozinho —
 *   - o servidor HTTP do Next  → span raiz de cada requisição;
 *   - o driver `pg` (usado pelo @prisma/adapter-pg) → cada query SQL vira um span;
 *   - chamadas HTTP de saída (ex.: API do Discord) → spans de cliente.
 * Além disso, o próprio Next.js já emite spans internos (render, api route, fetch)
 * que passam a ser exportados assim que registramos o SDK global.
 *
 * Para onde os dados vão (endpoint, protocolo, headers, nome do serviço) é lido
 * das variáveis de ambiente OTEL_* — o NodeSDK as reconhece automaticamente.
 * Veja o .env / .env.example:
 *   OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_PROTOCOL,
 *   OTEL_EXPORTER_OTLP_HEADERS, OTEL_{TRACES,METRICS,LOGS}_EXPORTER.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      // A instrumentação de filesystem é extremamente ruidosa (um span por leitura
      // de arquivo) e polui a cascata; desligamos para enxergar o que importa.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

// Encerra o SDK de forma limpa (faz flush dos spans pendentes) ao derrubar o processo.
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .catch((err) => console.error('Erro ao encerrar o OpenTelemetry SDK', err))
    .finally(() => process.exit(0));
});
