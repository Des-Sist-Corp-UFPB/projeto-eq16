import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Trilha de auditoria — ponto ÚNICO de escrita de eventos sensíveis.
 *
 * Princípios:
 * - **Best-effort:** `logAudit` NUNCA lança. Uma falha ao auditar não pode
 *   derrubar a operação de negócio que a originou (a auditoria é um efeito
 *   colateral, não parte da transação principal).
 * - **Imutável:** só inserimos; nunca atualizamos/apagamos um log.
 * - **Resiliente à remoção do ator:** guardamos `actorLabel` (username no
 *   momento do evento) além do `actorId`, então o histórico sobrevive mesmo
 *   que a conta seja deletada (FK `onDelete: SetNull`).
 */

/** Ações auditáveis (namespaced por recurso). Use estas constantes, não strings cruas. */
export const AuditAction = {
  USER_REGISTER: 'user.register',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  PASSWORD_CHANGE: 'password.change',
  DISCORD_LINK: 'discord.link',
  DISCORD_UNLINK: 'discord.unlink',
  EQUIPE_CREATE: 'equipe.create',
  EQUIPE_UPDATE: 'equipe.update',
  EQUIPE_DELETE: 'equipe.delete',
  FREEAGENT_CREATE: 'freeagent.create',
  FREEAGENT_DELETE: 'freeagent.delete',
  CANDIDATURA_CREATE: 'candidatura.create',
  CANDIDATURA_INVITE: 'candidatura.invite',
  CANDIDATURA_ACCEPT: 'candidatura.accept',
  CANDIDATURA_REJECT: 'candidatura.reject',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntry {
  action: AuditAction;
  /** Quem executou. `null`/ausente = sistema ou anônimo. */
  actorId?: string | null;
  /** Username no momento do evento (preservado mesmo após remoção da conta). */
  actorLabel?: string | null;
  /** Recurso afetado: "Equipe" | "FreeAgent" | "Candidatura" | "User". */
  targetType?: string | null;
  targetId?: string | null;
  /** Detalhes contextuais (lane, status, mudanças, etc.). */
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Registra um evento de auditoria. Best-effort: engole erros (apenas loga no console). */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorLabel: entry.actorLabel ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata:
          entry.metadata == null
            ? Prisma.JsonNull
            : (entry.metadata as Prisma.InputJsonValue),
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    // Nunca propaga: auditoria não pode quebrar o fluxo principal.
    console.error(`[audit] falha ao registrar "${entry.action}":`, err);
  }
}

/**
 * Extrai IP de origem e User-Agent de uma requisição, para anexar ao log.
 * Considera os headers de proxy (a app roda atrás de proxy reverso no servidor).
 */
export function requestMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const xff = req.headers.get('x-forwarded-for');
  const ip = xff ? xff.split(',')[0]!.trim() : req.headers.get('x-real-ip');
  return { ip: ip ?? null, userAgent: req.headers.get('user-agent') };
}

// ─── Consulta (área administrativa) ──────────────────────────────────────────

export const AUDIT_PAGE_SIZE = 50;

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  /** Filtra por ação exata (ex.: "equipe.create"). */
  action?: string;
  /** Filtra por ator. */
  actorId?: string;
}

/** Campos retornados na listagem (sem expor nada além do necessário). */
const AUDIT_LIST_SELECT = {
  id: true,
  action: true,
  actorId: true,
  actorLabel: true,
  targetType: true,
  targetId: true,
  metadata: true,
  ip: true,
  userAgent: true,
  createdAt: true,
  actor: { select: { username: true } },
} satisfies Prisma.AuditLogSelect;

/** Lista paginada de logs (mais recentes primeiro). Usada pela API e pela página admin. */
export async function listAuditLogs(query: AuditLogQuery = {}) {
  const pageSize = query.pageSize ?? AUDIT_PAGE_SIZE;
  const page = Math.max(1, query.page ?? 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: AUDIT_LIST_SELECT,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    logs,
  };
}

/** Lista distinta de ações já registradas (para popular o filtro na UI). */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ['action'],
    select: { action: true },
    orderBy: { action: 'asc' },
  });
  return rows.map((r) => r.action);
}

/** Ações já registradas com o total de eventos de cada uma (chips do filtro admin). */
export async function listAuditActionCounts(): Promise<{ action: string; total: number }[]> {
  const rows = await prisma.auditLog.groupBy({
    by: ['action'],
    _count: { _all: true },
    orderBy: { action: 'asc' },
  });
  return rows.map((r) => ({ action: r.action, total: r._count._all }));
}
