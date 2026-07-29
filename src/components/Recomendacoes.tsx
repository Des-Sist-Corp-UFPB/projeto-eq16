'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Lane } from '@/types';
import { PLAYER_POSITIONS } from '@/constants/positions';
import { buildLeagueOfGraphsUrl } from '@/constants/links';
import { SolicitarEntrada } from '@/components/modals/SolicitarEntrada';
import { VincularDiscordGate } from '@/components/modals/VincularDiscordGate';
import {
  formatarElo,
  ROTULO_ENCAIXE,
  type EloInfo,
  type Encaixe,
} from '@/lib/recomendacao';

/**
 * Recomendações de equipes/free agents — consome /api/recomendacoes/*.
 *
 * Dois modos:
 * - SEM `params` (abas): usa o cadastro do usuário logado como critério; a
 *   seção some em silêncio se não há sessão, cadastro ou resultados.
 * - COM `params` (modais): critérios explícitos definidos no formulário; o
 *   estado (carregando/vazio/erro) é sempre visível.
 *
 * Cada resultado traz a MESMA ação das listagens, com os mesmos gates
 * (login → Discord vinculado → modal): "Solicitar entrada" nas equipes e
 * "Convidar" nos free agents.
 */

type StatusCandidatura = 'PENDENTE' | 'ACEITA' | 'RECUSADA';

interface EquipeRecomendada {
  id: string;
  nome: string;
  nicknameCapitao: string;
  vagasLanes: Lane[];
  candidaturasCount: number;
  userId: string;
  vaga: Lane;
  encaixe: Encaixe;
  eloCapitao: EloInfo | null;
}

interface FreeAgentRecomendado {
  id: string;
  nickname: string;
  lanePrincipal: Lane;
  laneSecundaria: Lane | null;
  userId: string;
  vaga: Lane;
  encaixe: Encaixe;
  elo: EloInfo | null;
  convite: StatusCandidatura | null;
}

function laneInfo(lane: Lane) {
  return PLAYER_POSITIONS.find((p) => p.key === lane);
}

function LaneIcon({ lane }: { lane: Lane }) {
  const pos = laneInfo(lane);
  if (!pos) return null;
  return (
    <span className="relative h-5 w-5 shrink-0" title={pos.label}>
      <Image src={pos.icon} alt={pos.label} fill style={{ objectFit: 'contain' }} />
    </span>
  );
}

/** Chip roxo de elo (a cor de "destaque secundário" do site). */
function EloChip({ elo }: { elo: EloInfo | null }) {
  const texto = formatarElo(elo);
  if (!texto) return null;
  const winrate =
    elo && elo.wins != null && elo.losses != null && elo.wins + elo.losses > 0
      ? Math.round((elo.wins / (elo.wins + elo.losses)) * 100)
      : null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-purple-light/30 bg-purple-dim px-2 py-0.5 text-[11px] font-semibold text-purple-light"
      title={winrate !== null ? `Winrate ${winrate}% (${elo!.wins}V ${elo!.losses}D)` : 'Elo via op.gg'}
    >
      {texto}
    </span>
  );
}

function EncaixeChip({ encaixe, accent }: { encaixe: Encaixe; accent: 'cyan' | 'pink' }) {
  const cls =
    accent === 'pink'
      ? 'border-pink-subtle/30 bg-pink-subtle/10 text-pink-subtle'
      : 'border-cyan/30 bg-cyan-dim text-cyan';
  return (
    <span className={`hidden shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex ${cls}`}>
      {ROTULO_ENCAIXE[encaixe]}
    </span>
  );
}

/** Selo de estado quando a ação já foi feita (mesma linguagem das listagens). */
function StatusChip({ status }: { status: StatusCandidatura }) {
  const estilo: Record<StatusCandidatura, string> = {
    PENDENTE: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    ACEITA: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    RECUSADA: 'border-pink-subtle/30 bg-pink-subtle/10 text-pink-subtle',
  };
  const texto: Record<StatusCandidatura, string> = {
    PENDENTE: 'Convidado',
    ACEITA: 'Aceito',
    RECUSADA: 'Recusado',
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${estilo[status]}`}>
      {texto[status]}
    </span>
  );
}

function Mensagem({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-navy px-3 py-2.5 text-center text-xs text-text-muted">{children}</p>;
}

// ─── Equipes recomendadas (para um jogador) ──────────────────────────────────

interface RecomendacoesEquipesProps {
  /** Critérios explícitos (modal). Sem eles, usa o cadastro do usuário logado. */
  params?: { lane: Lane; laneSecundaria: Lane | null; nickname: string };
}

export function RecomendacoesEquipes({ params }: RecomendacoesEquipesProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const verbose = !!params;
  const [equipes, setEquipes] = useState<EquipeRecomendada[] | null>(null);
  const [eloJogador, setEloJogador] = useState<EloInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [modalSolicitar, setModalSolicitar] = useState<EquipeRecomendada | null>(null);
  const [modalVincular, setModalVincular] = useState(false);

  const deveBuscar = verbose || status === 'authenticated';

  const buscar = useCallback(async () => {
    const sp = new URLSearchParams({ elo: '1' });
    if (params) {
      sp.set('lane', params.lane);
      if (params.laneSecundaria) sp.set('laneSecundaria', params.laneSecundaria);
      if (params.nickname) sp.set('nickname', params.nickname);
    }
    const res = await fetch(`/api/recomendacoes/equipes?${sp}`);
    if (!res.ok) throw new Error('falha ao buscar recomendações');
    return res.json();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!deveBuscar) return;
    let ativo = true;
    buscar()
      .then((data) => {
        if (!ativo) return;
        setEquipes(data.equipes ?? []);
        setEloJogador(data.eloJogador ?? null);
      })
      .catch(() => ativo && setErro(true))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [deveBuscar, buscar]);

  // Após solicitar, a equipe sai da lista (a API exclui quem já tem candidatura ativa).
  const recarregar = () => {
    buscar()
      .then((data) => setEquipes(data.equipes ?? []))
      .catch(() => {});
  };

  const solicitar = (equipe: EquipeRecomendada) => {
    if (!session?.user) {
      router.push(`/auth/login?redirect=${pathname}`);
      return;
    }
    if (!session.user.discordLinked) {
      setModalVincular(true);
      return;
    }
    setModalSolicitar(equipe);
  };

  // Nas abas a seção é silenciosa: sem sessão/cadastro/resultados, some.
  if (!verbose && (!deveBuscar || carregando || erro || !equipes || equipes.length === 0)) {
    return null;
  }

  const lista = (
    <div className="space-y-2">
      {carregando ? (
        <Mensagem>Buscando equipes recomendadas...</Mensagem>
      ) : erro ? (
        <Mensagem>Não foi possível buscar recomendações agora. Tente novamente.</Mensagem>
      ) : !equipes || equipes.length === 0 ? (
        <Mensagem>Nenhuma equipe com vaga para sua rota no momento.</Mensagem>
      ) : (
        equipes.map((eq) => {
          const vaga = laneInfo(eq.vaga);
          const ehMinhaEquipe = session?.user?.id === eq.userId;
          return (
            <div
              key={eq.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-pink-subtle/15 bg-navy px-3 py-2.5 transition-colors hover:border-pink-subtle/40"
            >
              <LaneIcon lane={eq.vaga} />
              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-sm font-bold uppercase tracking-wide text-text-main">
                  {eq.nome}
                </p>
                <p className="truncate text-[11px] font-light text-text-muted">
                  Vaga de {vaga?.label ?? eq.vaga} · Capitão: {eq.nicknameCapitao}
                  {eq.candidaturasCount > 0 &&
                    ` · ${eq.candidaturasCount} candidatura${eq.candidaturasCount === 1 ? '' : 's'}`}
                </p>
              </div>
              <EloChip elo={eq.eloCapitao} />
              <EncaixeChip encaixe={eq.encaixe} accent="pink" />
              {!ehMinhaEquipe && (
                <button
                  onClick={() => solicitar(eq)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-pink-subtle px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-navy transition-colors hover:bg-pink-subtle/85"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Solicitar
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const modais = (
    <>
      {modalSolicitar && (
        <SolicitarEntrada
          open
          onClose={() => {
            setModalSolicitar(null);
            recarregar();
          }}
          equipe={{
            id: modalSolicitar.id,
            nome: modalSolicitar.nome,
            // Só a vaga recomendada: é dela que estamos falando aqui.
            vagasLanes: [modalSolicitar.vaga],
          }}
        />
      )}
      {modalVincular && (
        <VincularDiscordGate onClose={() => setModalVincular(false)} acao="solicitar entrada em uma equipe" />
      )}
    </>
  );

  // Modal: só a lista (o formulário já dá o contexto).
  if (verbose) {
    return (
      <div>
        {eloJogador && (
          <p className="mb-2 text-[11px] font-light text-text-muted">
            Seu elo: <span className="font-semibold text-purple-light">{formatarElo(eloJogador)}</span>{' '}
            — priorizamos equipes do seu nível.
          </p>
        )}
        {lista}
        {modais}
      </div>
    );
  }

  // Aba: seção destacada acima da listagem.
  return (
    <section className="mb-6 rounded-2xl border border-pink-subtle/20 bg-navy-light/60 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-pink-subtle">
          ✦ Recomendadas para você
        </h2>
        <span className="text-[11px] font-light text-text-muted">
          Com base no seu cadastro de free agent
          {eloJogador ? ` · seu elo: ${formatarElo(eloJogador)}` : ''}
        </span>
      </div>
      {lista}
      {modais}
    </section>
  );
}

// ─── Free agents recomendados (para vagas de equipe) ─────────────────────────

interface RecomendacoesFreeAgentsProps {
  /** Vagas explícitas (modal). Sem elas, usa a equipe aberta do usuário logado. */
  params?: { lanes: Lane[] };
}

export function RecomendacoesFreeAgents({ params }: RecomendacoesFreeAgentsProps) {
  const { data: session, status } = useSession();
  const verbose = !!params;
  const [agentes, setAgentes] = useState<FreeAgentRecomendado[] | null>(null);
  const [equipeNome, setEquipeNome] = useState<string | null>(null);
  const [equipeId, setEquipeId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [convidando, setConvidando] = useState<string | null>(null);
  const [modalVincular, setModalVincular] = useState(false);
  const [aviso, setAviso] = useState('');

  const deveBuscar = verbose || status === 'authenticated';

  useEffect(() => {
    if (!deveBuscar) return;
    let ativo = true;
    const sp = new URLSearchParams({ elo: '1' });
    if (params) sp.set('lanes', params.lanes.join(','));
    fetch(`/api/recomendacoes/free-agents?${sp}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ativo) return;
        if (!data) {
          setErro(true);
        } else {
          setAgentes(data.freeAgents ?? []);
          setEquipeNome(data.criterios?.equipeNome ?? null);
          setEquipeId(data.criterios?.equipeId ?? null);
        }
      })
      .catch(() => ativo && setErro(true))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deveBuscar]);

  const convidar = async (agente: FreeAgentRecomendado) => {
    if (!equipeId) return;
    if (!session?.user?.discordLinked) {
      setModalVincular(true);
      return;
    }
    setAviso('');
    setConvidando(agente.id);
    try {
      const res = await fetch(`/api/equipes/${equipeId}/convidar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: agente.userId, lane: agente.vaga }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAviso(data.erro || 'Não foi possível enviar o convite.');
        return;
      }
      setAgentes((prev) =>
        prev?.map((a) => (a.id === agente.id ? { ...a, convite: data.status } : a)) ?? prev
      );
      setAviso(data.mensagem ?? '');
    } catch {
      setAviso('Erro de conexão.');
    } finally {
      setConvidando(null);
    }
  };

  if (!verbose && (!deveBuscar || carregando || erro || !agentes || agentes.length === 0)) {
    return null;
  }

  const lista = (
    <div className="space-y-2">
      {carregando ? (
        <Mensagem>Buscando free agents recomendados...</Mensagem>
      ) : erro ? (
        <Mensagem>Não foi possível buscar recomendações agora. Tente novamente.</Mensagem>
      ) : !agentes || agentes.length === 0 ? (
        <Mensagem>Nenhum free agent disponível para essas vagas no momento.</Mensagem>
      ) : (
        agentes.map((fa) => {
          const vaga = laneInfo(fa.vaga);
          const url = buildLeagueOfGraphsUrl(fa.nickname);
          return (
            <div
              key={fa.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-cyan/15 bg-navy px-3 py-2.5 transition-colors hover:border-cyan/40"
            >
              <LaneIcon lane={fa.vaga} />
              <div className="min-w-0 flex-1">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display block truncate text-sm font-bold tracking-wide text-text-main transition-colors hover:text-cyan"
                    title="Ver perfil no League of Graphs"
                  >
                    {fa.nickname}
                  </a>
                ) : (
                  <p className="font-display truncate text-sm font-bold tracking-wide text-text-main">{fa.nickname}</p>
                )}
                <p className="truncate text-[11px] font-light text-text-muted">
                  Para a vaga de {vaga?.label ?? fa.vaga}
                </p>
              </div>
              <EloChip elo={fa.elo} />
              <EncaixeChip encaixe={fa.encaixe} accent="cyan" />
              {fa.convite ? (
                <StatusChip status={fa.convite} />
              ) : (
                <button
                  onClick={() => convidar(fa)}
                  disabled={!equipeId || convidando !== null}
                  title={
                    equipeId
                      ? `Convidar ${fa.nickname} para a vaga de ${vaga?.label ?? fa.vaga}`
                      : 'Cadastre a equipe para poder convidar'
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-cyan px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-navy transition-colors hover:bg-cyan-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {convidando === fa.id ? '...' : 'Convidar'}
                </button>
              )}
            </div>
          );
        })
      )}
      {!carregando && !erro && !equipeId && agentes && agentes.length > 0 && (
        <p className="text-center text-[11px] font-light text-text-muted/70">
          Cadastre a equipe para liberar o convite — depois eles aparecem aqui na aba Free Agents.
        </p>
      )}
      {aviso && (
        <p className="rounded-lg border border-cyan/20 bg-cyan-dim px-3 py-2 text-xs text-cyan">{aviso}</p>
      )}
      {modalVincular && (
        <VincularDiscordGate onClose={() => setModalVincular(false)} acao="convidar jogadores" />
      )}
    </div>
  );

  if (verbose) return lista;

  return (
    <section className="mb-6 rounded-2xl border border-cyan/20 bg-navy-light/60 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-cyan">
          ✦ Recomendados para sua equipe
        </h2>
        <span className="text-[11px] font-light text-text-muted">
          {equipeNome ? `Com base nas vagas de ${equipeNome}` : 'Com base nas vagas da sua equipe'}
        </span>
      </div>
      {lista}
    </section>
  );
}
