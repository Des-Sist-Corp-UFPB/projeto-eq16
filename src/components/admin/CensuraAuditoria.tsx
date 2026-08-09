'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * Censura dos dados pessoais no log de auditoria.
 *
 * Duas colunas carregam dado pessoal e ficam ocultas por padrão:
 * - **Origem** — IP e User-Agent (identificam o titular e o dispositivo);
 * - **Detalhes** — chaves sensíveis do `metadata`, hoje o par
 *   `discordId`/`discordUsername`, que amarra a conta do site a uma conta real
 *   do Discord (ver `redigirMetadata` em `lib/mascarar`).
 *
 * O admin revela sob demanda, no botão de olho, como nos clientes de banco. O
 * estado é só de UI (nada é persistido) e volta a "oculto" a cada carregamento
 * da página, para que os dados não fiquem expostos por inércia.
 */

interface CensuraCtx {
  /** Revela tudo de uma vez (botão do topo da tabela). */
  revelarTudo: boolean;
  alternarTudo: () => void;
}

const Ctx = createContext<CensuraCtx>({ revelarTudo: false, alternarTudo: () => {} });

export function CensuraProvider({ children }: { children: ReactNode }) {
  const [revelarTudo, setRevelarTudo] = useState(false);
  return (
    <Ctx.Provider value={{ revelarTudo, alternarTudo: () => setRevelarTudo((v) => !v) }}>
      {children}
    </Ctx.Provider>
  );
}

function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {!aberto && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** Botão de olho reutilizado pelas células e pelo controle global. */
function BotaoOlho({
  revelado,
  onClick,
  desabilitado,
  rotulo,
  titulo,
  children,
}: {
  revelado: boolean;
  onClick: () => void;
  desabilitado?: boolean;
  rotulo: string;
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={revelado}
      aria-label={rotulo}
      title={titulo}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border p-1 transition-colors ${
        children ? 'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider' : ''
      } ${
        revelado
          ? 'border-purple-light/50 bg-purple-dim text-purple-light'
          : 'border-input-border bg-input-bg text-text-muted hover:border-purple-light/30 hover:text-text-main'
      } ${desabilitado ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <IconeOlho aberto={revelado} />
      {children}
    </button>
  );
}

/** Controle global: revela/oculta os dados pessoais de todas as linhas da página. */
export function CensuraToggleGlobal() {
  const { revelarTudo, alternarTudo } = useContext(Ctx);
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-light/10 bg-navy-light/50 px-4 py-2.5">
      <p className="text-[11px] font-light text-text-muted">
        {revelarTudo
          ? 'Dados pessoais revelados — IP, dispositivo e identificadores do Discord estão visíveis.'
          : 'Dados pessoais censurados — IP, dispositivo e identificadores do Discord estão ocultos.'}
      </p>
      <BotaoOlho
        revelado={revelarTudo}
        onClick={alternarTudo}
        rotulo={revelarTudo ? 'Ocultar dados pessoais' : 'Revelar dados pessoais'}
        titulo={
          revelarTudo
            ? 'Ocultar os dados pessoais de todas as linhas'
            : 'Revelar os dados pessoais de todas as linhas'
        }
      >
        {revelarTudo ? 'Ocultar tudo' : 'Revelar tudo'}
      </BotaoOlho>
    </div>
  );
}

/** Estado de revelação de uma célula: global OU alternado na própria linha. */
function useRevelacao() {
  const { revelarTudo } = useContext(Ctx);
  const [revelarLinha, setRevelarLinha] = useState(false);
  return {
    revelado: revelarTudo || revelarLinha,
    travadoPeloGlobal: revelarTudo,
    alternar: () => setRevelarLinha((v) => !v),
  };
}

interface OrigemCelulaProps {
  /** IP completo — só é exibido quando revelado. */
  ip: string | null;
  /** IP já mascarado no servidor (ex.: `189.45.•••.•••`). */
  ipMascarado: string | null;
  /** User-Agent completo. */
  userAgent: string | null;
  /** Resumo do UA exibido no estado oculto (ex.: `Chrome · Windows`). */
  userAgentResumo: string | null;
}

/** Coluna Origem: IP e dispositivo, mascarados por padrão. */
export function OrigemCelula({ ip, ipMascarado, userAgent, userAgentResumo }: OrigemCelulaProps) {
  const { revelado, travadoPeloGlobal, alternar } = useRevelacao();

  if (!ip && !userAgent) return <span className="text-text-muted/50">—</span>;

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0">
        <p
          className={`font-mono text-[12px] ${revelado ? 'text-text-main' : 'select-none text-text-muted'}`}
        >
          {revelado ? (ip ?? '—') : (ipMascarado ?? '—')}
        </p>
        {revelado
          ? userAgent && (
              <p className="mt-0.5 max-w-[220px] break-words text-[11px] font-light text-text-muted">
                {userAgent}
              </p>
            )
          : userAgentResumo && (
              <p className="mt-0.5 text-[11px] font-light text-text-muted/70">{userAgentResumo}</p>
            )}
      </div>

      <BotaoOlho
        revelado={revelado}
        onClick={alternar}
        desabilitado={travadoPeloGlobal}
        rotulo={revelado ? 'Ocultar origem' : 'Revelar origem'}
        titulo={
          travadoPeloGlobal
            ? 'Todos os dados pessoais estão revelados'
            : revelado
              ? 'Ocultar origem'
              : 'Revelar origem (dado pessoal)'
        }
      />
    </div>
  );
}

interface DetalhesCelulaProps {
  /** Metadata revelável (já sem segredos) — só chega à tela quando revelado. */
  metadata: unknown;
  /** Metadata com os valores sensíveis já trocados por "••••••" no servidor. */
  metadataCensurado: unknown;
  /** Se havia algo a censurar (define se o olho aparece). */
  temSensivel: boolean;
}

/** Coluna Detalhes: chips dos valores simples + JSON completo sob demanda. */
export function DetalhesCelula({ metadata, metadataCensurado, temSensivel }: DetalhesCelulaProps) {
  const { revelado, travadoPeloGlobal, alternar } = useRevelacao();

  if (metadata == null) return <span className="text-text-muted/50">—</span>;

  // Enquanto oculto, TUDO vem da versão censurada — inclusive o JSON, senão
  // bastaria abrir o "ver JSON" para contornar a censura dos chips.
  const exibido = revelado || !temSensivel ? metadata : metadataCensurado;

  const objeto =
    typeof exibido === 'object' && exibido !== null && !Array.isArray(exibido)
      ? (exibido as Record<string, unknown>)
      : null;
  const simples = objeto
    ? Object.entries(objeto).filter(
        ([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v)
      )
    : [];
  const visiveis = simples.slice(0, 3);
  const ocultos = objeto ? Object.keys(objeto).length - visiveis.length : 0;

  return (
    <div className="flex max-w-[320px] items-start gap-2">
      <div className="min-w-0 flex-1">
        {visiveis.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visiveis.map(([chave, valor]) => (
              <span
                key={chave}
                className="inline-flex max-w-full items-baseline gap-1 rounded border border-cyan/10 bg-navy px-1.5 py-0.5 text-[11px]"
              >
                <span className="shrink-0 text-text-muted">{chave}:</span>
                <span className="truncate text-text-main">{String(valor ?? '—')}</span>
              </span>
            ))}
            {ocultos > 0 && <span className="px-1 text-[11px] text-text-muted">+{ocultos}</span>}
          </div>
        )}
        <details className="group mt-1">
          <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wider text-text-muted/70 transition-colors hover:text-cyan">
            <span className="group-open:hidden">ver JSON ▾</span>
            <span className="hidden group-open:inline">ocultar ▴</span>
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-cyan/10 bg-navy px-2 py-1.5 text-[11px] leading-relaxed text-text-muted">
            {JSON.stringify(exibido, null, 2)}
          </pre>
        </details>
      </div>

      {temSensivel && (
        <BotaoOlho
          revelado={revelado}
          onClick={alternar}
          desabilitado={travadoPeloGlobal}
          rotulo={revelado ? 'Ocultar detalhes sensíveis' : 'Revelar detalhes sensíveis'}
          titulo={
            travadoPeloGlobal
              ? 'Todos os dados pessoais estão revelados'
              : revelado
                ? 'Ocultar detalhes sensíveis'
                : 'Revelar detalhes sensíveis (dado pessoal)'
          }
        />
      )}
    </div>
  );
}
