'use client';

import { useEffect, useState } from 'react';
import { EquipeData, Lane } from '@/types';
import { EquipeInfoResume } from '@/components/EquipeInfoResume';
import { LaneFilter } from '@/components/LaneFilter';
import { PageGlow } from '@/components/PageGlow';

export default function EquipesPage() {
  const [equipes, setEquipes] = useState<EquipeData[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rotasFiltro, setRotasFiltro] = useState<Lane[]>([]);

  const toggleRota = (lane: Lane) =>
    setRotasFiltro((prev) =>
      prev.includes(lane) ? prev.filter((l) => l !== lane) : prev.length < 2 ? [...prev, lane] : prev
    );

  const equipesFiltradas =
    rotasFiltro.length === 0
      ? equipes
      : equipes.filter((equipe) => equipe.vagasLanes.some((lane) => rotasFiltro.includes(lane)));

  const fetchEquipes = async () => {
    try {
      const res = await fetch('/api/equipes');
      const data = await res.json();
      setEquipes(data);
    } catch {
      setEquipes([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // Carrega os dados na montagem (setState ocorre só após o await do fetch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEquipes();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 pt-16 sm:pt-20">
      <PageGlow accent="pink" />
      <div className="mb-8">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-text-main sm:text-3xl">Equipes com vagas</h1>
        <p className="mt-2 text-sm text-text-muted font-light">Veja times procurando jogadores e entre em contato com o capitão.</p>
      </div>

      {!carregando && equipes.length > 0 && (
        <LaneFilter selected={rotasFiltro} onToggle={toggleRota} onClear={() => setRotasFiltro([])} accent="pink" />
      )}

      {carregando ? (
        <div className="py-12 text-center text-text-muted">Carregando...</div>
      ) : equipes.length === 0 ? (
        <div className="rounded-2xl border border-cyan/10 bg-navy-light/50 py-12 text-center">
          <p className="text-lg text-text-main">Nenhuma equipe disponível no momento</p>
          <p className="mt-2 text-sm text-text-muted">Quando algum time abrir vagas, ele aparecerá aqui.</p>
        </div>
      ) : equipesFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-cyan/10 bg-navy-light/50 py-12 text-center">
          <p className="text-lg text-text-main">Nenhuma equipe com essas vagas</p>
          <p className="mt-2 text-sm text-text-muted">Tente outra rota ou limpe o filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {equipesFiltradas.map((equipe) => (
            <EquipeInfoResume
              key={equipe.id}
              id={equipe.id}
              nome={equipe.nome}
              nicknameCapitao={equipe.nicknameCapitao}
              discordUsername={equipe.discordUsername}
              vagasLanes={equipe.vagasLanes}
              candidaturasCount={equipe.candidaturasCount}
              createdAt={equipe.createdAt}
              userId={equipe.userId}
              onDelete={fetchEquipes}
              onUpdate={fetchEquipes}
            />
          ))}
        </div>
      )}
    </main>
  );
}