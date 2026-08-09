'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * Coluna "Origem" do log de auditoria (IP + User-Agent), censurada por padrão.
 *
 * IP e User-Agent são dado pessoal: identificam indiretamente o titular e, no
 * caso do UA, formam uma impressão digital do dispositivo. Ficam ocultos até
 * que o admin peça para ver — no botão de olho, como nos clientes de banco.
 *
 * O estado é só de UI (nada é persistido) e sempre volta a "oculto" a cada
 * carregamento da página, para que os dados não fiquem expostos por inércia.
 */

interface OrigemCtx {
  /** Revela tudo de uma vez (botão do cabeçalho). */
  revelarTudo: boolean;
  alternarTudo: () => void;
}

const Ctx = createContext<OrigemCtx>({ revelarTudo: false, alternarTudo: () => {} });

export function OrigemProvider({ children }: { children: ReactNode }) {
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

/** Botão global: revela/oculta a origem de todas as linhas da página. */
export function OrigemToggleGlobal() {
  const { revelarTudo, alternarTudo } = useContext(Ctx);
  return (
    <button
      type="button"
      onClick={alternarTudo}
      aria-pressed={revelarTudo}
      title={
        revelarTudo
          ? 'Ocultar IP e dispositivo de todas as linhas'
          : 'Revelar IP e dispositivo de todas as linhas (dado pessoal)'
      }
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
        revelarTudo
          ? 'border-purple-light/50 bg-purple-dim text-purple-light'
          : 'border-input-border bg-input-bg text-text-muted hover:border-purple-light/30 hover:text-text-main'
      }`}
    >
      <IconeOlho aberto={revelarTudo} />
      {revelarTudo ? 'Ocultar' : 'Revelar'}
    </button>
  );
}

interface OrigemCelulaProps {
  /** IP completo — só chega ao DOM quando revelado. */
  ip: string | null;
  /** IP já mascarado no servidor (ex.: `189.45.•••.•••`). */
  ipMascarado: string | null;
  /** User-Agent completo. */
  userAgent: string | null;
  /** Resumo do UA exibido no estado oculto (ex.: `Chrome · Windows`). */
  userAgentResumo: string | null;
}

/** Célula da coluna Origem: mascarada por padrão, com olho para revelar a linha. */
export function OrigemCelula({ ip, ipMascarado, userAgent, userAgentResumo }: OrigemCelulaProps) {
  const { revelarTudo } = useContext(Ctx);
  const [revelarLinha, setRevelarLinha] = useState(false);
  const revelado = revelarTudo || revelarLinha;

  if (!ip && !userAgent) return <span className="text-text-muted/50">—</span>;

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0">
        <p
          className={`font-mono text-[12px] ${revelado ? 'text-text-main' : 'select-none text-text-muted'}`}
        >
          {revelado ? (ip ?? '—') : (ipMascarado ?? '—')}
        </p>
        {revelado ? (
          userAgent && (
            <p className="mt-0.5 max-w-[220px] break-words text-[11px] font-light text-text-muted">
              {userAgent}
            </p>
          )
        ) : (
          userAgentResumo && (
            <p className="mt-0.5 text-[11px] font-light text-text-muted/70">{userAgentResumo}</p>
          )
        )}
      </div>

      <button
        type="button"
        onClick={() => setRevelarLinha((v) => !v)}
        disabled={revelarTudo}
        aria-pressed={revelado}
        aria-label={revelado ? 'Ocultar origem' : 'Revelar origem'}
        title={
          revelarTudo
            ? 'Todas as origens estão reveladas'
            : revelado
              ? 'Ocultar origem'
              : 'Revelar origem (dado pessoal)'
        }
        className={`mt-0.5 shrink-0 rounded-md border p-1 transition-colors ${
          revelado
            ? 'border-purple-light/40 bg-purple-dim text-purple-light'
            : 'border-input-border bg-input-bg text-text-muted hover:border-purple-light/30 hover:text-text-main'
        } ${revelarTudo ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <IconeOlho aberto={revelado} />
      </button>
    </div>
  );
}
