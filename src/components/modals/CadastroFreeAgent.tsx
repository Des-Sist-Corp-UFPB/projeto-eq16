'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Lane } from '@/types';
import { PositionSelector } from '@/components/PositionSelector';
import { ModalSucesso } from '@/components/modals/ModalSucesso';
import { VincularDiscordGate } from '@/components/modals/VincularDiscordGate';
import { isNicknameValido, NICKNAME_HINT } from '@/constants/links';

interface CadastroFreeAgentProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CadastroFreeAgent({ open, onClose, onSuccess }: CadastroFreeAgentProps) {
  const { data: session } = useSession();
  const [nickname, setNickname] = useState('');
  const [lanePrincipal, setLanePrincipal] = useState<Lane | null>(null);
  const [laneSecundaria, setLaneSecundaria] = useState<Lane | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);

  if (!open && !mostrarSucesso) return null;

  // Vincular o Discord é pré-requisito para se cadastrar.
  if (open && session?.user && !session.user.discordLinked) {
    return <VincularDiscordGate onClose={onClose} acao="se cadastrar como Free Agent" />;
  }

  const ehFill = lanePrincipal === 'FILL';

  const handleSubmit = async () => {
    setErro('');

    if (!nickname.trim() || !lanePrincipal) {
      setErro('Todos os campos são obrigatórios.');
      return;
    }

    if (!ehFill && !laneSecundaria) {
      setErro('Selecione a lane secundária.');
      return;
    }

    if (!isNicknameValido(nickname)) {
      setErro('Nickname inválido. Use o formato Nome#TAG (ex.: Chico kit lasca#Chico).');
      return;
    }

    if (!ehFill && lanePrincipal === laneSecundaria) {
      setErro('A lane principal deve ser diferente da lane secundária.');
      return;
    }

    const secundaria = ehFill ? null : laneSecundaria;

    setEnviando(true);
    try {
      const res = await fetch('/api/free-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), lanePrincipal, laneSecundaria: secundaria }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErro(data.erro || 'Erro ao cadastrar.');
        return;
      }

      setNickname('');
      setLanePrincipal(null);
      setLaneSecundaria(null);
      onSuccess();
      onClose();
      setMostrarSucesso(true);
    } catch {
      setErro('Erro de conexão.');
    } finally {
      setEnviando(false);
    }
  };

  if (mostrarSucesso) {
    return (
      <ModalSucesso
        open={mostrarSucesso}
        onClose={() => setMostrarSucesso(false)}
        titulo="Free Agent cadastrado!"
        mensagem="Você agora está visível para equipes que buscam jogadores."
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans">
      <div className="bg-navy-light border border-cyan/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl relative overflow-visible">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-main transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 className="font-display text-2xl font-extrabold uppercase tracking-[-0.04em] text-text-main mb-6">Cadastrar-se como Free Agent</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1.5">Nickname</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Chico kit lasca#Chico"
              className="w-full px-4 py-2.5 rounded-lg bg-input-bg border border-input-border text-text-main placeholder-text-muted/50 focus:outline-none transition-colors" />
            <p className="mt-1.5 text-[11px] text-text-muted/70 font-light">{NICKNAME_HINT}</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-3 text-center">Lanes</label>
            <div className="flex justify-center items-start gap-10">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Principal</span>
                <PositionSelector
                  value={lanePrincipal}
                  onChange={(lane) => { setLanePrincipal(lane); if (lane === 'FILL') setLaneSecundaria(null); }}
                  disabledLanes={laneSecundaria ? [laneSecundaria] : []}
                  variant="radial"
                />
              </div>
              {!ehFill && (
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Secundária</span>
                  <PositionSelector value={laneSecundaria} onChange={setLaneSecundaria} disabledLanes={lanePrincipal ? [lanePrincipal] : []} variant="radial" />
                </div>
              )}
            </div>
            {ehFill && (
              <p className="mt-2 text-center text-[11px] font-light text-text-muted/70">
                Como Fill, você joga qualquer rota — sem necessidade de secundária.
              </p>
            )}
          </div>

          {erro && <p className="text-pink-subtle text-sm bg-pink-subtle/10 border border-pink-subtle/20 rounded-lg px-3 py-2">{erro}</p>}

          <button onClick={handleSubmit} disabled={enviando}
            className="w-full py-3 rounded-lg bg-cyan hover:bg-cyan-hover text-navy font-bold uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {enviando ? 'CADASTRANDO...' : 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  );
}
