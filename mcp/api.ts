/**
 * Cliente fino da API do Rinha Team Finder.
 *
 * O servidor MCP NÃO reimplementa regra de negócio: toda leitura passa pelos
 * Route Handlers já existentes (`/api/free-agents`, `/api/equipes`), exatamente
 * como o front faz. A URL base vem de TEAMFINDER_API_URL (default: dev local).
 */

import type { FreeAgentDTO, Lane } from './compose.ts';

export const API_BASE = (process.env.TEAMFINDER_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Shape retornado por GET /api/equipes. */
export interface EquipeDTO {
  id: string;
  nome: string;
  nicknameCapitao: string;
  vagasLanes: Lane[];
  status: 'ABERTA' | 'COMPLETA';
  createdAt: string;
  userId: string;
  discordUsername: string | null;
  candidaturasCount: number;
}

async function apiGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(
      `Não consegui falar com a API em ${API_BASE}${path}. ` +
        'O site está rodando (npm run dev / docker compose up)? ' +
        'Se a URL for outra, ajuste a env TEAMFINDER_API_URL.'
    );
  }
  if (!res.ok) {
    throw new Error(`API respondeu ${res.status} em GET ${path} — o site está no ar em ${API_BASE}?`);
  }
  return (await res.json()) as T;
}

export function listarFreeAgents(): Promise<FreeAgentDTO[]> {
  return apiGet<FreeAgentDTO[]>('/api/free-agents');
}

export function listarEquipes(): Promise<EquipeDTO[]> {
  return apiGet<EquipeDTO[]>('/api/equipes');
}
