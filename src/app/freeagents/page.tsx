'use client';

import { useEffect, useState } from 'react';
import { FreeAgentData, Lane } from '@/types';
import { FreeAgentInfoResume } from '@/components/FreeAgentInfoResume';
import { LaneFilter } from '@/components/LaneFilter';
import { PageGlow } from '@/components/PageGlow';

export default function FreeAgentsPage() {
  const [freeAgents, setFreeAgents] = useState<FreeAgentData[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rotasFiltro, setRotasFiltro] = useState<Lane[]>([]);

  const toggleRota = (lane: Lane) =>
    setRotasFiltro((prev) =>
      prev.includes(lane) ? prev.filter((l) => l !== lane) : prev.length < 2 ? [...prev, lane] : prev
    );

  const freeAgentsFiltrados =
    rotasFiltro.length === 0
      ? freeAgents
      : freeAgents.filter((fa) =>
          [fa.lanePrincipal, fa.laneSecundaria].some((lane) => lane !== null && rotasFiltro.includes(lane))
        );

  const fetchFreeAgents = async () => {
    try {
      const res = await fetch('/api/free-agents');
      const data = await res.json();
      setFreeAgents(data);
    } catch {
      // erro silencioso
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // Carrega os dados na montagem (setState ocorre só após o await do fetch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFreeAgents();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 pt-16 sm:pt-20">
      <PageGlow accent="cyan" />
      <div className="mb-8">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-text-main sm:text-3xl">Free Agents Disponíveis</h1>
        <p className="mt-2 text-sm text-text-muted font-light">Veja os jogadores disponíveis e entre em contato.</p>
      </div>

      {!carregando && freeAgents.length > 0 && (
        <LaneFilter selected={rotasFiltro} onToggle={toggleRota} onClear={() => setRotasFiltro([])} />
      )}

      {carregando ? (
        <div className="py-12 text-center text-text-muted">Carregando...</div>
      ) : freeAgents.length === 0 ? (
        <div className="rounded-2xl border border-cyan/10 bg-navy-light/50 py-12 text-center">
          <p className="text-lg text-text-main">Nenhum free agent disponível no momento</p>
          <p className="mt-2 text-sm text-text-muted">Seja o primeiro a se cadastrar!</p>
        </div>
      ) : freeAgentsFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-cyan/10 bg-navy-light/50 py-12 text-center">
          <p className="text-lg text-text-main">Nenhum free agent nessas rotas</p>
          <p className="mt-2 text-sm text-text-muted">Tente outra rota ou limpe o filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {freeAgentsFiltrados.map((fa) => (
            <FreeAgentInfoResume
              key={fa.id}
              id={fa.id}
              nickname={fa.nickname}
              lanePrincipal={fa.lanePrincipal}
              laneSecundaria={fa.laneSecundaria}
              discordUsername={fa.discordUsername}
              userId={fa.userId}
              onDelete={fetchFreeAgents}
            />
          ))}
        </div>
      )}
    </main>
  );
}
