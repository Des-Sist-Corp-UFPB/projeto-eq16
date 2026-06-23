'use client';

interface VincularDiscordGateProps {
  onClose: () => void;
  /** Texto da ação bloqueada, ex.: "cadastrar uma equipe". */
  acao: string;
}

/**
 * Bloqueio exibido quando o usuário tenta uma ação que exige Discord vinculado.
 * Mantém o visual dos demais modais e leva direto ao fluxo de vínculo.
 */
export function VincularDiscordGate({ onClose, acao }: VincularDiscordGateProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-[#5865F2]/30 bg-navy-light p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-text-muted transition-colors hover:text-text-main">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-4 flex items-center gap-3 text-[#a5abf5]">
          <svg className="h-8 w-8 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          <h2 className="font-display text-xl font-extrabold uppercase tracking-[-0.03em] text-text-main">
            Vincule seu Discord
          </h2>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-text-muted">
          Para {acao}, você precisa vincular sua conta do Discord. Assim seu contato vira sua
          identidade real e os times conseguem te encontrar.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-text-muted/30 py-3 text-xs font-bold uppercase tracking-widest text-text-main transition-colors hover:bg-navy-lighter"
          >
            Agora não
          </button>
          <a
            href="/api/discord/link"
            className="flex flex-1 items-center justify-center rounded-lg bg-[#5865F2] py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4752c4]"
          >
            Vincular agora
          </a>
        </div>
      </div>
    </div>
  );
}
