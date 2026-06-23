'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Lane } from '@/types';
import { PositionSelector } from '@/components/PositionSelector';
import { PLAYER_POSITIONS } from '@/constants/positions';
import { ModalSucesso } from '@/components/modals/ModalSucesso';
import { isNicknameValido, NICKNAME_HINT } from '@/constants/links';

interface EditarEquipeProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipe: {
    id: string;
    nome: string;
    nicknameCapitao: string;
    vagasLanes: Lane[];
  };
}

const MAX_VAGAS = 5;

export function EditarEquipe({ open, onClose, onSuccess, equipe }: EditarEquipeProps) {
  const [nome, setNome] = useState(equipe.nome);
  const [nicknameCapitao, setNicknameCapitao] = useState(equipe.nicknameCapitao);
  const [vagasLanes, setVagasLanes] = useState<Lane[]>([...equipe.vagasLanes]);
  const [adicionandoVaga, setAdicionandoVaga] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);

  if (!open && !mostrarSucesso) return null;

  const lanesOcupadas: Lane[] = vagasLanes.filter((lane) => lane !== 'FILL');

  const handleAdicionarVaga = (lane: Lane) => { setVagasLanes((prev) => [...prev, lane]); setAdicionandoVaga(false); };
  const handleRemoverVaga = (index: number) => { setVagasLanes((prev) => prev.filter((_, i) => i !== index)); };

  const handleSubmit = async () => {
    setErro('');
    if (!nome.trim() || !nicknameCapitao.trim()) { setErro('Preencha todos os campos obrigatórios.'); return; }
    if (!isNicknameValido(nicknameCapitao)) { setErro('Nickname do capitão inválido. Use o formato Nome#TAG (ex.: Chico kit lasca#Chico).'); return; }
    if (vagasLanes.length === 0) { setErro('Adicione ao menos uma vaga aberta.'); return; }

    setEnviando(true);
    try {
      const res = await fetch(`/api/equipes/${equipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), nicknameCapitao: nicknameCapitao.trim(), vagasLanes }),
      });
      if (!res.ok) { const data = await res.json(); setErro(data.erro || 'Erro ao atualizar.'); return; }

      onSuccess(); setMostrarSucesso(true);
    } catch { setErro('Erro de conexão.'); } finally { setEnviando(false); }
  };

  if (mostrarSucesso) {
    return <ModalSucesso open={mostrarSucesso} onClose={() => setMostrarSucesso(false)} titulo="Equipe atualizada!" mensagem="As alterações foram salvas com sucesso." />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans">
      <div className="bg-navy-light border border-pink-subtle/15 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-main transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 className="font-display text-2xl font-extrabold uppercase tracking-[-0.04em] text-text-main mb-6">Editar Equipe</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1.5">Nome da Equipe</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da Equipe"
              className="w-full px-4 py-2.5 rounded-lg bg-input-bg border border-input-border text-text-main placeholder-text-muted/50 focus:outline-none transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1.5">Nickname do Capitão</label>
            <input type="text" value={nicknameCapitao} onChange={(e) => setNicknameCapitao(e.target.value)} placeholder="Chico kit lasca#Chico"
              className="w-full px-4 py-2.5 rounded-lg bg-input-bg border border-input-border text-text-main placeholder-text-muted/50 focus:outline-none transition-colors" />
            <p className="mt-1.5 text-[11px] text-text-muted/70 font-light">{NICKNAME_HINT}</p>
          </div>

          <div className="border-t border-pink-subtle/10 pt-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Vagas Abertas</label>
            <p className="text-xs text-text-muted/60 mb-3 font-light">Remova vagas que já foram preenchidas ou adicione novas.</p>

            <div className="space-y-2">
              {vagasLanes.map((lane, index) => {
                const pos = PLAYER_POSITIONS.find((p) => p.key === lane);
                return (
                  <div key={`${lane}-${index}`} className="flex items-center gap-3 bg-navy rounded-lg px-3 py-2 border border-pink-subtle/10">
                    {pos && <div className="relative w-6 h-6 shrink-0"><Image src={pos.icon} alt={pos.label} fill style={{ objectFit: 'contain' }} /></div>}
                    <span className="text-text-main text-sm font-semibold flex-1 uppercase tracking-wide">{pos?.label}</span>
                    <button onClick={() => handleRemoverVaga(index)} className="text-pink-subtle hover:text-pink-subtle/70 transition-colors" title="Remover vaga (já preenchida)">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {vagasLanes.length < MAX_VAGAS && (
              <div className="mt-3">
                {adicionandoVaga ? (
                  <div className="flex justify-center"><PositionSelector value={null} onChange={handleAdicionarVaga} disabledLanes={lanesOcupadas} variant="radial" accent="pink" /></div>
                ) : (
                  <button onClick={() => setAdicionandoVaga(true)} className="flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-lg border border-dashed border-pink-subtle/20 text-text-muted hover:text-pink-subtle hover:border-pink-subtle/40 hover:bg-pink-subtle/10 transition-all text-xs font-bold uppercase tracking-widest">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Adicionar Vaga
                  </button>
                )}
              </div>
            )}
          </div>

          {erro && <p className="text-pink-subtle text-sm bg-pink-subtle/10 border border-pink-subtle/20 rounded-lg px-3 py-2">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-pink-subtle/30 text-text-main font-bold uppercase tracking-widest text-xs transition-colors hover:bg-pink-subtle/10">CANCELAR</button>
            <button onClick={handleSubmit} disabled={enviando} className="flex-1 py-3 rounded-lg bg-pink-subtle hover:bg-pink-subtle/85 text-navy font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {enviando ? 'SALVANDO...' : 'SALVAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
