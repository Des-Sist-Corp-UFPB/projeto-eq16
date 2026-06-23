'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CadastroFreeAgent } from '@/components/modals/CadastroFreeAgent';
import { CadastroEquipeVaga } from '@/components/modals/CadastroEquipeVaga';
import { DISCORD_INVITE_URL, WHATSAPP_GROUP_URL } from '@/constants/links';
import Image from 'next/image';

const TORNEIO_URL = 'https://rinhacampusiv.org/lol/torneios/rinha-do-campus-iv-edicao-ii';

function GamepadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

export default function InicioPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [modalFreeAgent, setModalFreeAgent] = useState(false);
  const [modalEquipe, setModalEquipe] = useState(false);

  const handleAbrirModal = (tipo: 'freeagent' | 'equipe') => {
    if (!session?.user) {
      router.push('/auth/login?redirect=/inicio');
      return;
    }
    if (tipo === 'freeagent') setModalFreeAgent(true);
    else setModalEquipe(true);
  };

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-4 pb-10 pt-8 sm:pt-10">
      {/* Orbes de luz no fundo */}
      <div aria-hidden className="pointer-events-none absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-cyan/15 blur-[160px]" />
      <div aria-hidden className="pointer-events-none absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-pink-subtle/15 blur-[160px]" />

      {/* ── Cabeçalho compacto: logo + título + badge lado a lado no desktop ── */}
      <header className="relative z-10 mb-8 w-full max-w-5xl sm:mb-10">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          {/* Logo */}
          <div className="shrink-0">
            <Image
              src="/assets/imgs/rinhaLogoNew.png"
              alt="Rinha do Campus IV"
              width={88}
              height={88}
              className="sm:h-[100px] sm:w-[100px]"
              priority
            />
          </div>

          {/* Título + badge + descrição */}
          <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-[-0.04em] text-text-main sm:text-5xl">
              Team Finder
            </h1>
            <a
              href={TORNEIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan-dim px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan transition-colors hover:border-cyan/60 hover:bg-cyan/20"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
              </span>
              Inscrições Abertas — Edição II
            </a>
            <p className="text-sm font-light text-text-muted">
              A ferramenta oficial para conectar jogadores e equipes na{' '}
              <strong className="font-medium text-text-main">Rinha do Campus IV</strong>.
            </p>
          </div>
        </div>
      </header>

      {/* ── Split Paths — ocupam a maior parte da tela ── */}
      <section className="relative z-10 grid w-full max-w-5xl flex-1 grid-cols-1 gap-5 md:grid-cols-2 md:gap-0">
        {/* Fio de luz vertical (desktop) */}
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 top-0 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-input-border to-transparent md:block" />

        {/* Jornada do Jogador (Ciano) */}
        <div className="flex flex-col gap-3 md:pr-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan-dim text-cyan">
              <GamepadIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold uppercase tracking-[-0.02em] text-text-main sm:text-2xl">Sou um Jogador</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">Buscando uma equipe</p>
            </div>
          </div>

          {/* Ação primária */}
          <button
            onClick={() => handleAbrirModal('freeagent')}
            className="group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-cyan/20 bg-navy-light/60 p-5 text-left shadow-lg shadow-cyan/5 transition-all duration-200 hover:border-cyan/50 hover:bg-navy-light"
          >
            <h3 className="font-display text-lg font-bold text-text-main sm:text-xl">Cadastre-se como Free Agent</h3>
            <p className="mt-2 flex-1 text-sm font-light leading-relaxed text-text-muted">
              Informe suas melhores rotas e mostre que você está pronto para receber propostas de equipes.
            </p>
            <span className="mt-5 inline-flex items-center justify-center rounded-lg bg-cyan-dim px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-cyan transition-colors group-hover:bg-cyan group-hover:text-navy">
              Cadastrar Free Agent
            </span>
          </button>

          {/* Ação secundária */}
          <button
            onClick={() => router.push('/equipes')}
            className="group flex items-center justify-between gap-4 rounded-xl border border-cyan/10 bg-navy-light/40 px-5 py-3.5 text-left transition-all duration-200 hover:border-cyan/30 hover:bg-cyan-dim"
          >
            <div className="min-w-0">
              <h4 className="font-display text-sm font-bold uppercase tracking-wide text-text-main">Explorar Equipes</h4>
              <p className="text-xs font-light text-text-muted">Veja quem está recrutando</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan/20 bg-navy text-cyan transition-colors group-hover:bg-cyan group-hover:text-navy">
              <SearchIcon className="h-4 w-4" />
            </div>
          </button>
        </div>

        {/* Jornada da Equipe (Rosa) */}
        <div className="flex flex-col gap-3 md:pl-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-pink-subtle/20 bg-pink-subtle/10 text-pink-subtle">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold uppercase tracking-[-0.02em] text-text-main sm:text-2xl">Sou uma Equipe</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pink-subtle">Buscando jogadores</p>
            </div>
          </div>

          {/* Ação primária */}
          <button
            onClick={() => handleAbrirModal('equipe')}
            className="group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-pink-subtle/20 bg-navy-light/60 p-5 text-left shadow-lg shadow-pink-subtle/5 transition-all duration-200 hover:border-pink-subtle/50 hover:bg-navy-light"
          >
            <h3 className="font-display text-lg font-bold text-text-main sm:text-xl">Registrar Line-up e Vagas</h3>
            <p className="mt-2 flex-1 text-sm font-light leading-relaxed text-text-muted">
              Cadastre sua equipe, publique as posições que faltam e encontre jogadores com a sinergia perfeita.
            </p>
            <span className="mt-5 inline-flex items-center justify-center rounded-lg bg-pink-subtle/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-pink-subtle transition-colors group-hover:bg-pink-subtle group-hover:text-navy">
              Cadastrar Equipe
            </span>
          </button>

          {/* Ação secundária */}
          <button
            onClick={() => router.push('/freeagents')}
            className="group flex items-center justify-between gap-4 rounded-xl border border-pink-subtle/10 bg-navy-light/40 px-5 py-3.5 text-left transition-all duration-200 hover:border-pink-subtle/30 hover:bg-pink-subtle/10"
          >
            <div className="min-w-0">
              <h4 className="font-display text-sm font-bold uppercase tracking-wide text-text-main">Buscar Free Agents</h4>
              <p className="text-xs font-light text-text-muted">Encontre jogadores disponíveis</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-pink-subtle/20 bg-navy text-pink-subtle transition-colors group-hover:bg-pink-subtle group-hover:text-navy">
              <SearchIcon className="h-4 w-4" />
            </div>
          </button>
        </div>
      </section>

      {/* Comunidades */}
      <section className="relative z-10 mt-8 w-full max-w-3xl">
        <div className="mb-4 flex items-center gap-4">
          <div className="h-px flex-1 bg-input-border" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-muted/60">Comunidades oficiais</span>
          <div className="h-px flex-1 bg-input-border" />
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#5865F2]/40 bg-[#5865F2]/10 px-6 py-3 text-sm font-bold text-[#8b93f8] transition-all duration-200 hover:bg-[#5865F2] hover:text-white sm:w-auto"
          >
            <DiscordIcon className="h-5 w-5" />
            Rinha do Campus IV
          </a>
          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 px-6 py-3 text-sm font-bold text-[#3ddc7f] transition-all duration-200 hover:bg-[#25D366] hover:text-navy sm:w-auto"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Grupo de Free Agents
          </a>
        </div>
      </section>

      {/* Modais */}
      <CadastroFreeAgent open={modalFreeAgent} onClose={() => setModalFreeAgent(false)} onSuccess={() => {}} />
      <CadastroEquipeVaga open={modalEquipe} onClose={() => setModalEquipe(false)} onSuccess={() => {}} />
    </main>
  );
}
