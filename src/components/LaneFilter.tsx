'use client';

import Image from 'next/image';
import { Lane } from '@/types';
import { PLAYER_POSITIONS } from '@/constants/positions';

interface LaneFilterProps {
  /** Rotas atualmente marcadas (vazio = sem filtro, mostra tudo). */
  selected: Lane[];
  onToggle: (lane: Lane) => void;
  onClear: () => void;
  /** Máximo de rotas selecionáveis ao mesmo tempo. */
  max?: number;
  /** Cor de destaque: ciano (jogador) ou rosa (equipe). */
  accent?: 'cyan' | 'pink';
}

export function LaneFilter({ selected, onToggle, onClear, max = 2, accent = 'cyan' }: LaneFilterProps) {
  const atMax = selected.length >= max;
  const isPink = accent === 'pink';

  const containerBorder = isPink ? 'border-pink-subtle/10' : 'border-cyan/10';
  const selectedCls = isPink
    ? 'border-pink-subtle bg-pink-subtle/10 text-pink-subtle'
    : 'border-cyan bg-cyan-dim text-cyan';
  const hoverCls = isPink
    ? 'border-input-border bg-input-bg text-text-muted hover:border-pink-subtle/40 hover:text-text-main'
    : 'border-input-border bg-input-bg text-text-muted hover:border-cyan/40 hover:text-text-main';

  return (
    <div className={`mb-6 rounded-2xl border ${containerBorder} bg-navy-light/50 p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
          Filtrar por rota <span className="font-light normal-case tracking-normal text-text-muted/60">(até {max})</span>
        </span>
        {selected.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] font-bold uppercase tracking-wider text-pink-subtle transition-colors hover:text-pink-subtle/70"
          >
            Limpar
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {PLAYER_POSITIONS.map((pos) => {
          const isSelected = selected.includes(pos.key);
          const isDisabled = !isSelected && atMax;

          return (
            <button
              key={pos.key}
              type="button"
              onClick={() => !isDisabled && onToggle(pos.key)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              title={isDisabled ? `Máximo de ${max} rotas` : pos.label}
              className={`
                inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150
                ${isSelected
                  ? selectedCls
                  : isDisabled
                    ? 'cursor-not-allowed border-input-border bg-input-bg text-text-muted/40 opacity-50'
                    : hoverCls}
              `}
            >
              <span className="relative h-4 w-4 shrink-0">
                <Image
                  src={pos.icon}
                  alt={pos.label}
                  fill
                  style={{ objectFit: 'contain', filter: isDisabled ? 'grayscale(100%)' : 'none' }}
                />
              </span>
              {pos.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
