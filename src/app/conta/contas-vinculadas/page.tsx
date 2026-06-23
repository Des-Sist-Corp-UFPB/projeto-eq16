'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ModalConfirmacao } from '@/components/modals/ModalConfirmacao';

export default function ContasVinculadasPage() {
  const { data: session, update } = useSession();
  const [confirmando, setConfirmando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [aviso, setAviso] = useState('');
  // null = carregando, true/false = resultado da API
  const [temSenha, setTemSenha] = useState<boolean | null>(null);

  const vinculado = !!session?.user?.discordLinked;
  const discordUsername = session?.user?.discordUsername ?? null;

  useEffect(() => {
    fetch('/api/usuarios/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTemSenha(data ? !!data.hasPassword : true))
      .catch(() => setTemSenha(true));
  }, []);

  // Contas criadas exclusivamente pelo Discord não têm senha local —
  // desvincular o Discord as deixaria sem nenhuma forma de autenticação.
  const podeDesvincular = temSenha === true;

  const desvincular = async () => {
    setDesvinculando(true);
    try {
      const res = await fetch('/api/discord/unlink', { method: 'POST' });
      if (res.ok) {
        await update(); // reidrata a sessão (discordLinked = false)
        setConfirmando(false);
        setAviso('Discord desvinculado. Vincule novamente para cadastrar equipes ou virar free agent.');
      }
    } finally {
      setDesvinculando(false);
    }
  };

  return (
    <div className="space-y-4">
      {aviso && (
        <p className="rounded-lg border border-pink-subtle/20 bg-pink-subtle/10 px-3 py-2 text-sm text-pink-subtle">
          {aviso}
        </p>
      )}

      {/* Discord */}
      <div className="rounded-2xl border border-[#5865F2]/30 bg-navy-light p-5 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#a5abf5]">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold uppercase tracking-wide text-text-main">Discord</p>
              {vinculado ? (
                <p className="mt-0.5 text-sm text-[#a5abf5]">
                  Vinculado como <span className="font-semibold">{discordUsername}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-text-muted">
                  Não vinculado <span className="text-pink-subtle">· obrigatório para cadastrar</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {vinculado ? (
              <>
                <button
                  onClick={() => podeDesvincular && setConfirmando(true)}
                  disabled={!podeDesvincular}
                  title={
                    !podeDesvincular
                      ? 'Sua conta usa apenas o Discord para entrar. Desvincular te deixaria sem acesso.'
                      : undefined
                  }
                  className="inline-flex items-center justify-center rounded-lg border border-pink-subtle/30 px-3 py-2 text-xs font-bold uppercase tracking-widest text-pink-subtle transition-colors hover:bg-pink-subtle/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Desvincular
                </button>
                {!podeDesvincular && temSenha !== null && (
                  <p className="max-w-[200px] text-right text-[10px] leading-tight text-text-muted/70">
                    Não é possível desvincular — esta conta usa apenas o Discord para entrar.
                  </p>
                )}
              </>
            ) : (
              <a
                href="/api/discord/link"
                className="inline-flex items-center justify-center rounded-lg bg-[#5865F2] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4752c4]"
              >
                Vincular
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Riot / League of Graphs — placeholder de evolução futura */}
      <div className="rounded-2xl border border-cyan/10 bg-navy-light/60 p-5 opacity-70">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-dim text-cyan">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-wide text-text-main">Conta Riot</p>
              <p className="mt-0.5 text-sm text-text-muted">Integração com a API da Riot</p>
            </div>
          </div>
          <span className="rounded-md border border-cyan/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Em breve
          </span>
        </div>
      </div>

      <ModalConfirmacao
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={desvincular}
        titulo="Desvincular Discord"
        mensagem="Tem certeza? Você precisará vincular novamente para cadastrar equipes ou se cadastrar como free agent."
        textoBotaoConfirmar="Desvincular"
        loading={desvinculando}
      />
    </div>
  );
}
