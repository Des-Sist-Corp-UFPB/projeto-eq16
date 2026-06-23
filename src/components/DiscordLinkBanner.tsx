'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ModalSucesso } from '@/components/modals/ModalSucesso';

const ERROS_MENSAGENS: Record<string, string> = {
  erro_login: 'Faça login antes de vincular o Discord.',
  erro_state: 'Sessão de vínculo expirada. Tente novamente.',
  ja_vinculado: 'Este Discord já está vinculado a outra conta do site. Cada conta do Discord só pode ser vinculada a um único usuário.',
  erro: 'Não foi possível vincular o Discord. Tente novamente.',
};

/**
 * Notificação que:
 * 1. processa o retorno do callback (`?discord=...`): atualiza a sessão e dá feedback;
 * 2. enquanto o usuário logado não vincular o Discord, lembra que é necessário.
 */
export function DiscordLinkBanner() {
  const { data: session, status, update } = useSession();
  const [dispensado, setDispensado] = useState(false);
  const [erroFeedback, setErroFeedback] = useState<string | null>(null);
  const [modalSucessoAberto, setModalSucessoAberto] = useState(false);
  // Suprime o lembrete "vincule seu Discord" imediatamente após vínculo bem-sucedido,
  // sem esperar a sessão ser reidratada.
  const [vinculouAgora, setVinculouAgora] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const statusDiscord = params.get('discord');
    if (!statusDiscord) return;

    // Limpa o parâmetro da URL antes de qualquer setState para não repetir ao recarregar.
    params.delete('discord');
    const novaQuery = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (novaQuery ? `?${novaQuery}` : ''));

    if (statusDiscord === 'ok') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVinculouAgora(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalSucessoAberto(true);
      update(); // reidrata o JWT para refletir discordLinked = true
    } else {
      const mensagem = ERROS_MENSAGENS[statusDiscord] ?? ERROS_MENSAGENS.erro;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErroFeedback(mensagem);
      // Erros mais importantes ficam mais tempo na tela.
      const duracao = statusDiscord === 'ja_vinculado' ? 10000 : 6000;
      const timer = setTimeout(() => setErroFeedback(null), duracao);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const precisaVincular =
    status === 'authenticated' &&
    session?.user &&
    !session.user.discordLinked &&
    !vinculouAgora;

  const mostraBanner = !!erroFeedback || (precisaVincular && !dispensado);

  return (
    <>
      {/* Modal de sucesso ao vincular o Discord */}
      <ModalSucesso
        open={modalSucessoAberto}
        onClose={() => setModalSucessoAberto(false)}
        titulo="Discord vinculado!"
        mensagem="Sua conta do Discord foi vinculada com sucesso. Agora você pode cadastrar equipes e se inscrever como free agent."
        autoCloseMs={0}
      />

      {/* Banner de erro ou lembrete de vínculo */}
      {mostraBanner && (
        <div className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-3 font-sans">
          {erroFeedback && (
            <div className="flex items-start gap-2 rounded-xl border border-pink-subtle/40 bg-pink-subtle/15 px-4 py-3 text-sm text-pink-subtle shadow-2xl backdrop-blur">
              <span className="flex-1">{erroFeedback}</span>
              <button onClick={() => setErroFeedback(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Fechar">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {precisaVincular && !dispensado && (
            <div className="rounded-xl border border-[#5865F2]/40 bg-navy-light/95 p-4 shadow-2xl backdrop-blur">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-[#a5abf5]">
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <p className="text-sm font-bold uppercase tracking-wide">Vincule seu Discord</p>
                </div>
                <button onClick={() => setDispensado(true)} className="shrink-0 text-text-muted hover:text-text-main" aria-label="Dispensar">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-text-muted">
                Vincular o Discord é necessário para usufruir 100% do site: cadastrar equipe ou virar
                free agent, e ser encontrado pelo seu Discord real.
              </p>
              <a
                href="/api/discord/link"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4752c4]"
              >
                Vincular agora
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
