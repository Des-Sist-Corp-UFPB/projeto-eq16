'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { EquipeData, Lane } from '@/types';
import { PLAYER_POSITIONS } from '@/constants/positions';
import { buildLeagueOfGraphsUrl } from '@/constants/links';
import { ModalConfirmacao } from '@/components/modals/ModalConfirmacao';
import { EditarEquipe } from '@/components/modals/EditarEquipe';
import { SolicitarEntrada } from '@/components/modals/SolicitarEntrada';
import { CandidaturasRecebidas } from '@/components/modals/CandidaturasRecebidas';
import { VincularDiscordGate } from '@/components/modals/VincularDiscordGate';
import { DiscordChip } from '@/components/DiscordChip';

type StatusCandidatura = 'PENDENTE' | 'ACEITA' | 'RECUSADA';

interface EquipeInfoResumeProps extends EquipeData {
  onDelete?: () => void;
  onUpdate?: () => void;
}

function getPosition(lane: Lane) {
  return PLAYER_POSITIONS.find((position) => position.key === lane);
}

export function EquipeInfoResume({
  id,
  nome,
  nicknameCapitao,
  discordUsername,
  vagasLanes,
  candidaturasCount,
  userId,
  onDelete,
  onUpdate,
}: EquipeInfoResumeProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [deletando, setDeletando] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalSolicitar, setModalSolicitar] = useState(false);
  const [modalVincular, setModalVincular] = useState(false);
  const [modalCandidaturas, setModalCandidaturas] = useState(false);
  const [statusCandidatura, setStatusCandidatura] = useState<StatusCandidatura | null>(null);

  const vagasVisiveis = vagasLanes.map(getPosition).filter(Boolean);
  const capitaoUrl = buildLeagueOfGraphsUrl(nicknameCapitao);

  const isLoggedIn = !!session?.user;
  const isOwner = session?.user?.id === userId;
  const isAdmin = session?.user?.role === 'ADMIN';
  const canDelete = isOwner || isAdmin;
  const canEdit = isOwner;
  const podeSolicitar = !isOwner && vagasVisiveis.length > 0;

  // Verifica se o usuário já tem candidatura aceita nesta equipe.
  useEffect(() => {
    if (!isLoggedIn || isOwner) return;
    fetch(`/api/equipes/${id}/solicitar`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const lista: { lane: Lane; status: StatusCandidatura }[] = data?.candidaturas ?? [];
        if (lista.some((c) => c.status === 'ACEITA')) setStatusCandidatura('ACEITA');
        else if (lista.length > 0) setStatusCandidatura(lista[lista.length - 1].status);
        else setStatusCandidatura(null);
      })
      .catch(() => setStatusCandidatura(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, isOwner, id]);

  const irParaLogin = () => router.push(`/auth/login?redirect=${pathname}`);

  const handleSolicitar = () => {
    if (!isLoggedIn) {
      irParaLogin();
      return;
    }
    if (!session?.user?.discordLinked) {
      setModalVincular(true);
      return;
    }
    setModalSolicitar(true);
  };

  const handleDelete = async () => {
    setDeletando(true);
    try {
      const res = await fetch(`/api/equipes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setModalConfirmar(false);
        onDelete?.();
      }
    } finally {
      setDeletando(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-pink-subtle/10 bg-navy-light p-4 shadow-lg transition-colors hover:border-pink-subtle/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-display mb-2 truncate text-xl font-bold uppercase tracking-wide text-text-main">{nome}</p>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {/* Chip do capitão — clicável (League of Graphs) */}
              {capitaoUrl ? (
                <a
                  href={capitaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-purple-light/30 bg-purple-dim px-2.5 py-1 text-xs font-semibold text-purple-light transition-colors hover:border-purple-light/60 hover:text-white"
                  title="Ver perfil no League of Graphs"
                >
                  Capitão: {nicknameCapitao}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-purple-light/30 bg-purple-dim px-2.5 py-1 text-xs font-semibold text-purple-light">
                  Capitão: {nicknameCapitao}
                </span>
              )}

              {/* Chip do Discord — copiável quando logado (clique copia o usuário). */}
              <DiscordChip username={discordUsername} isLoggedIn={isLoggedIn} onRequireLogin={irParaLogin} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Vagas Disponíveis:</span>
              {vagasVisiveis.length === 0 ? (
                <span className="rounded-lg border border-cyan/10 bg-navy px-3 py-1.5 text-xs font-medium text-text-muted">
                  Sem vagas abertas
                </span>
              ) : (
                vagasVisiveis.map((posicao, index) => {
                  if (!posicao) return null;
                  return (
                    <span key={`${posicao.key}-${index}`} className="inline-flex items-center gap-2 rounded-lg border border-pink-subtle/30 bg-pink-subtle/10 px-3 py-1.5 text-xs font-bold text-pink-subtle">
                      <span className="relative h-4 w-4 shrink-0">
                        <Image src={posicao.icon} alt={posicao.label} fill style={{ objectFit: 'contain' }} />
                      </span>
                      {posicao.label}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {(canEdit || canDelete || podeSolicitar) && (
            <div className="flex gap-2 sm:flex-col sm:items-end">
              {podeSolicitar && statusCandidatura === 'ACEITA' && (
                <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  Aceita
                </span>
              )}
              {podeSolicitar && statusCandidatura !== 'ACEITA' && (
                <button
                  onClick={handleSolicitar}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-pink-subtle px-3 py-2 text-xs font-bold uppercase tracking-wider text-navy transition-colors hover:bg-pink-subtle/85"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Solicitar entrada
                </button>
              )}

              {canEdit && (
                <button
                  onClick={() => setModalCandidaturas(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-cyan transition-colors hover:bg-cyan/20"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-2a3 3 0 10-3-3" /></svg>
                  Candidaturas
                  {!!candidaturasCount && candidaturasCount > 0 && (
                    <span className="ml-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-cyan px-1 text-[10px] font-extrabold text-navy">
                      {candidaturasCount}
                    </span>
                  )}
                </button>
              )}

              {canEdit && (
                <button
                  onClick={() => setModalEditar(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan/20 bg-cyan-dim px-3 py-2 text-xs font-bold uppercase tracking-wider text-cyan transition-colors hover:bg-cyan/20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Editar
                </button>
              )}

              {canDelete && (
                <button
                  onClick={() => setModalConfirmar(true)}
                  disabled={deletando}
                  className="inline-flex items-center justify-center rounded-lg border border-pink-subtle/20 bg-pink-subtle/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-pink-subtle transition-colors hover:bg-pink-subtle/20 disabled:opacity-50"
                >
                  {deletando ? '...' : 'Excluir'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ModalConfirmacao
        open={modalConfirmar}
        onClose={() => setModalConfirmar(false)}
        onConfirm={handleDelete}
        titulo="Remover Equipe"
        mensagem={`Tem certeza que deseja remover a equipe "${nome}"? Esta ação não pode ser desfeita.`}
        textoBotaoConfirmar="Remover"
        loading={deletando}
      />

      <EditarEquipe
        open={modalEditar}
        onClose={() => setModalEditar(false)}
        onSuccess={() => {
          setModalEditar(false);
          onUpdate?.();
        }}
        equipe={{ id, nome, nicknameCapitao, vagasLanes }}
      />

      <SolicitarEntrada
        open={modalSolicitar}
        onClose={() => setModalSolicitar(false)}
        equipe={{ id, nome, vagasLanes }}
      />

      {modalVincular && (
        <VincularDiscordGate onClose={() => setModalVincular(false)} acao="solicitar entrada em uma equipe" />
      )}

      <CandidaturasRecebidas
        open={modalCandidaturas}
        onClose={() => setModalCandidaturas(false)}
        equipe={{ id, nome }}
        onChange={onUpdate}
      />
    </>
  );
}
