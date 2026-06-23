'use client';

import { useState } from 'react';

interface DiscordChipProps {
  /** Usuário do Discord vinculado pelo dono (null = não vinculado). */
  username: string | null;
  isLoggedIn: boolean;
  /** Chamado quando um visitante deslogado clica no chip. */
  onRequireLogin: () => void;
}

function DiscordIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const CHIP_BASE =
  'inline-flex items-center gap-1.5 rounded-md border border-[#5865F2]/40 bg-[#5865F2]/15 px-2.5 py-1 text-xs font-semibold text-[#a5abf5] transition-colors';

/** Chip do Discord. Para logados com vínculo, é copiável (clique copia o usuário). */
export function DiscordChip({ username, isLoggedIn, onRequireLogin }: DiscordChipProps) {
  const [copiado, setCopiado] = useState(false);

  // Visitante deslogado: gate de login.
  if (!isLoggedIn) {
    return (
      <button onClick={onRequireLogin} className={`${CHIP_BASE} hover:bg-[#5865F2]/25`} title="Faça login para ver o contato">
        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        entre para ver
      </button>
    );
  }

  // Logado, mas o dono ainda não vinculou o Discord.
  if (!username) {
    return (
      <span className={`${CHIP_BASE} opacity-60`} title="Este usuário ainda não vinculou o Discord">
        <DiscordIcon />
        não vinculado
      </span>
    );
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(username);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // navegador sem permissão de clipboard — ignora silenciosamente.
    }
  };

  return (
    <button
      onClick={copiar}
      className={`${CHIP_BASE} hover:bg-[#5865F2]/25`}
      title="Clique para copiar o usuário do Discord"
    >
      <DiscordIcon />
      {username}
      {copiado ? (
        <>
          <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-400">Copiado!</span>
        </>
      ) : (
        <svg className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
