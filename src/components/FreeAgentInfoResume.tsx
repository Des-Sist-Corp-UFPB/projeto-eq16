'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Lane } from '@/types';
import { PLAYER_POSITIONS } from '@/constants/positions';
import { buildLeagueOfGraphsUrl } from '@/constants/links';
import { useSession } from 'next-auth/react';
import { ModalConfirmacao } from '@/components/modals/ModalConfirmacao';
import { DiscordChip } from '@/components/DiscordChip';

interface FreeAgentInfoResumeProps {
  id: string;
  nickname: string;
  lanePrincipal: Lane;
  laneSecundaria: Lane | null;
  discordUsername: string | null;
  userId: string;
  onDelete?: () => void;
}

export function FreeAgentInfoResume({
  id,
  nickname,
  lanePrincipal,
  laneSecundaria,
  discordUsername,
  userId,
  onDelete,
}: FreeAgentInfoResumeProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [deletando, setDeletando] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(false);

  const iconPrincipal = PLAYER_POSITIONS.find((p) => p.key === lanePrincipal);
  const iconSecundaria = PLAYER_POSITIONS.find((p) => p.key === laneSecundaria);
  const nicknameUrl = buildLeagueOfGraphsUrl(nickname);

  const isLoggedIn = !!session?.user;
  const isOwner = session?.user?.id === userId;
  const isAdmin = session?.user?.role === 'ADMIN';
  const canDelete = isOwner || isAdmin;

  const irParaLogin = () => router.push(`/auth/login?redirect=${pathname}`);

  const handleDelete = async () => {
    setDeletando(true);
    try {
      const res = await fetch(`/api/free-agents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setModalConfirmar(false);
        onDelete?.();
      }
    } catch {
      // erro silencioso
    } finally {
      setDeletando(false);
    }
  };

  return (
    <>
      <div className="group flex items-start gap-4 rounded-xl border border-cyan/10 bg-navy-light p-4 transition-colors duration-200 hover:border-cyan/30">
        <div className="min-w-0 flex-1">
          {/* Nickname (clicável -> League of Graphs) */}
          {nicknameUrl ? (
            <a
              href={nicknameUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display block truncate text-lg font-bold tracking-wide text-text-main transition-colors hover:text-cyan"
              title="Ver perfil no League of Graphs"
            >
              {nickname}
            </a>
          ) : (
            <p className="font-display truncate text-lg font-bold tracking-wide text-text-main">{nickname}</p>
          )}

          {/* Chips: rotas (ciano) + Discord (blurple) */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {iconPrincipal && (
              <span
                className="inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan-dim px-3 py-1.5 text-xs font-bold text-cyan"
                title={`Principal: ${iconPrincipal.label}`}
              >
                <span className="relative h-4 w-4 shrink-0">
                  <Image src={iconPrincipal.icon} alt={iconPrincipal.label} fill style={{ objectFit: 'contain' }} />
                </span>
                {iconPrincipal.label}
              </span>
            )}
            {iconSecundaria && (
              <span
                className="inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan-dim px-3 py-1.5 text-xs font-bold text-cyan"
                title={`Secundária: ${iconSecundaria.label}`}
              >
                <span className="relative h-4 w-4 shrink-0">
                  <Image src={iconSecundaria.icon} alt={iconSecundaria.label} fill style={{ objectFit: 'contain' }} />
                </span>
                {iconSecundaria.label}
              </span>
            )}

            {/* Chip do Discord — copiável quando logado (clique copia o usuário). */}
            <DiscordChip username={discordUsername} isLoggedIn={isLoggedIn} onRequireLogin={irParaLogin} />
          </div>
        </div>

        {canDelete && (
          <button
            onClick={() => setModalConfirmar(true)}
            disabled={deletando}
            className="shrink-0 rounded-lg p-1.5 text-pink-subtle transition-all hover:bg-pink-subtle/10 disabled:opacity-50"
            title="Remover"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
      </div>

      <ModalConfirmacao
        open={modalConfirmar}
        onClose={() => setModalConfirmar(false)}
        onConfirm={handleDelete}
        titulo="Remover Free Agent"
        mensagem={`Tem certeza que deseja remover "${nickname}"? Esta ação não pode ser desfeita.`}
        textoBotaoConfirmar="Remover"
        loading={deletando}
      />
    </>
  );
}
