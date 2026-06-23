'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Lane } from '@/types';
import { PLAYER_POSITIONS } from '@/constants/positions';
import { buildLeagueOfGraphsUrl } from '@/constants/links';
import { DiscordChip } from '@/components/DiscordChip';

interface CandidaturaItem {
  id: string;
  lane: Lane;
  status: 'PENDENTE' | 'ACEITA' | 'RECUSADA';
  createdAt: string;
  username: string;
  discordUsername: string | null;
  nickname: string | null;
}

interface CandidaturasRecebidasProps {
  open: boolean;
  onClose: () => void;
  equipe: { id: string; nome: string };
  /** Chamado após aceitar/recusar, para a listagem por trás se atualizar. */
  onChange?: () => void;
}

const STATUS_STYLE: Record<CandidaturaItem['status'], string> = {
  PENDENTE: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  ACEITA: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  RECUSADA: 'border-pink-subtle/30 bg-pink-subtle/10 text-pink-subtle',
};

function getPosition(lane: Lane) {
  return PLAYER_POSITIONS.find((p) => p.key === lane);
}

export function CandidaturasRecebidas({ open, onClose, equipe, onChange }: CandidaturasRecebidasProps) {
  const [candidaturas, setCandidaturas] = useState<CandidaturaItem[] | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  // Busca pura (não mexe em estado) — segura para chamar no efeito.
  const buscarCandidaturas = useCallback(async (): Promise<CandidaturaItem[]> => {
    try {
      const res = await fetch(`/api/equipes/${equipe.id}/candidaturas`);
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  }, [equipe.id]);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    buscarCandidaturas().then((data) => {
      if (ativo) {
        setCandidaturas(data);
        setErro('');
      }
    });
    return () => {
      ativo = false;
    };
  }, [open, buscarCandidaturas]);

  if (!open) return null;

  const decidir = async (id: string, acao: 'aceitar' | 'recusar') => {
    setErro('');
    setProcessando(id);
    try {
      const res = await fetch(`/api/candidaturas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErro(data.erro || 'Erro ao processar a candidatura.');
        return;
      }
      setCandidaturas(await buscarCandidaturas()); // atualiza a lista do modal
      onChange?.(); // atualiza a listagem por trás (vagas/contagem)
    } catch {
      setErro('Erro de conexão.');
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans backdrop-blur-sm">
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-cyan/15 bg-navy-light p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-text-muted transition-colors hover:text-text-main">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="font-display text-2xl font-extrabold uppercase tracking-[-0.04em] text-text-main">Candidaturas</h2>
        <p className="mt-1 text-sm font-light text-text-muted">
          Jogadores que solicitaram entrada em <span className="font-semibold text-text-main">{equipe.nome}</span>.
        </p>

        {erro && (
          <p className="mt-4 rounded-lg border border-pink-subtle/20 bg-pink-subtle/10 px-3 py-2 text-sm text-pink-subtle">{erro}</p>
        )}

        <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {candidaturas === null ? (
            <p className="py-8 text-center text-sm text-text-muted">Carregando...</p>
          ) : candidaturas.length === 0 ? (
            <div className="rounded-xl border border-cyan/10 bg-navy py-10 text-center">
              <p className="text-sm text-text-main">Nenhuma candidatura ainda</p>
              <p className="mt-1 text-xs text-text-muted">Quando alguém solicitar entrada, aparece aqui.</p>
            </div>
          ) : (
            candidaturas.map((c) => {
              const pos = getPosition(c.lane);
              const nickUrl = c.nickname ? buildLeagueOfGraphsUrl(c.nickname) : null;
              const pendente = c.status === 'PENDENTE';
              return (
                <div key={c.id} className="rounded-xl border border-cyan/10 bg-navy p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {pos && (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-pink-subtle/30 bg-pink-subtle/10 px-2.5 py-1 text-xs font-bold text-pink-subtle">
                        <span className="relative h-4 w-4 shrink-0">
                          <Image src={pos.icon} alt={pos.label} fill style={{ objectFit: 'contain' }} />
                        </span>
                        {pos.label}
                      </span>
                    )}
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {c.nickname && nickUrl ? (
                      <a
                        href={nickUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-display text-sm font-bold text-text-main transition-colors hover:text-cyan"
                        title="Ver perfil no League of Graphs"
                      >
                        {c.nickname}
                      </a>
                    ) : (
                      <span className="font-display text-sm font-bold text-text-main">{c.nickname ?? c.username}</span>
                    )}

                    <DiscordChip username={c.discordUsername} isLoggedIn onRequireLogin={() => {}} />
                  </div>

                  {pendente && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => decidir(c.id, 'aceitar')}
                        disabled={processando !== null}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        {processando === c.id ? '...' : 'Aceitar'}
                      </button>
                      <button
                        onClick={() => decidir(c.id, 'recusar')}
                        disabled={processando !== null}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-pink-subtle/30 bg-pink-subtle/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-pink-subtle transition-colors hover:bg-pink-subtle/20 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        {processando === c.id ? '...' : 'Recusar'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
