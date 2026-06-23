export type Lane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'FILL';
export type Role = 'USER' | 'ADMIN';
export type StatusEquipe = 'ABERTA' | 'COMPLETA';

export interface LaneOption {
  key: Lane;
  label: string;
  icon: string;
}

export interface FreeAgentData {
  id: string;
  nickname: string;
  lanePrincipal: Lane;
  laneSecundaria: Lane | null;
  /** Usuário do Discord vinculado pelo dono (null se ainda não vinculou). */
  discordUsername: string | null;
  createdAt: string;
  userId: string;
}

export interface EquipeData {
  id: string;
  nome: string;
  nicknameCapitao: string;
  /** Usuário do Discord vinculado pelo capitão (null se ainda não vinculou). */
  discordUsername: string | null;
  vagasLanes: Lane[];
  status?: StatusEquipe;
  candidaturasCount?: number;
  createdAt: string;
  userId: string;
}

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
  discordId: string | null;
  discordUsername: string | null;
  discordLinked: boolean;
}
