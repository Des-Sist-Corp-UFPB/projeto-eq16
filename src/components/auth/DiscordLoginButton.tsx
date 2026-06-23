'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

interface DiscordLoginButtonProps {
  label?: string;
}

/** Botão "Entrar com Discord" + divisor "ou". Usado nas telas de login e registro. */
export function DiscordLoginButton({ label = 'ENTRAR COM DISCORD' }: DiscordLoginButtonProps) {
  const [carregando, setCarregando] = useState(false);

  const handleClick = () => {
    if (carregando) return;
    setCarregando(true);
    const redirectParam = new URLSearchParams(window.location.search).get('redirect');
    const callbackUrl = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/inicio';
    signIn('discord', { callbackUrl });
  };

  return (
    <>
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-input-border" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">ou</span>
        <span className="h-px flex-1 bg-input-border" />
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={carregando}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] py-2.5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-75"
      >
        {carregando ? (
          <>
            <svg className="h-5 w-5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            REDIRECIONANDO...
          </>
        ) : (
          <>
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            {label}
          </>
        )}
      </button>
    </>
  );
}
