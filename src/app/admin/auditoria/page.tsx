import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { listAuditLogs, listAuditActions } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** Rótulos amigáveis para as ações (fallback: a própria chave). */
const ROTULO_ACAO: Record<string, string> = {
  'user.register': 'Cadastro de usuário',
  'auth.login': 'Login',
  'auth.logout': 'Logout',
  'password.change': 'Troca de senha',
  'discord.link': 'Discord vinculado',
  'discord.unlink': 'Discord desvinculado',
  'equipe.create': 'Equipe criada',
  'equipe.update': 'Equipe editada',
  'equipe.delete': 'Equipe removida',
  'freeagent.create': 'Free agent criado',
  'freeagent.delete': 'Free agent removido',
  'candidatura.create': 'Solicitação enviada',
  'candidatura.accept': 'Candidatura aceita',
  'candidatura.reject': 'Candidatura recusada',
};

function rotulo(action: string): string {
  return ROTULO_ACAO[action] ?? action;
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}

interface PageProps {
  searchParams: Promise<{ page?: string; action?: string }>;
}

export default async function AuditoriaPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login?redirect=/admin/auditoria');
  if (session.user.role !== 'ADMIN') redirect('/inicio');

  const { page: pageParam, action: actionParam } = await searchParams;
  const page = Number(pageParam) || 1;
  const action = actionParam || undefined;

  const [{ logs, total, totalPages, page: paginaAtual }, acoes] = await Promise.all([
    listAuditLogs({ page, action }),
    listAuditActions(),
  ]);

  const queryComAcao = (a?: string) => {
    const sp = new URLSearchParams();
    if (a) sp.set('action', a);
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
  };
  const queryComPagina = (p: number) => {
    const sp = new URLSearchParams();
    if (action) sp.set('action', action);
    sp.set('page', String(p));
    return `?${sp.toString()}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 pt-16 sm:pt-20">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-text-main sm:text-3xl">
          Log de Auditoria
        </h1>
        <p className="mt-2 text-sm font-light text-text-muted">
          Trilha de ações sensíveis na plataforma. {total} evento{total === 1 ? '' : 's'} registrado
          {total === 1 ? '' : 's'}.
        </p>
      </div>

      {/* Filtro por ação */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/admin/auditoria"
          className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
            !action
              ? 'border-cyan/40 bg-cyan-dim text-cyan'
              : 'border-transparent text-text-muted hover:border-cyan/20 hover:text-text-main'
          }`}
        >
          Todas
        </Link>
        {acoes.map((a) => (
          <Link
            key={a}
            href={`/admin/auditoria${queryComAcao(a)}`}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              action === a
                ? 'border-cyan/40 bg-cyan-dim text-cyan'
                : 'border-transparent text-text-muted hover:border-cyan/20 hover:text-text-main'
            }`}
          >
            {rotulo(a)}
          </Link>
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-cyan/10 bg-navy-light">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-cyan/10 text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 font-bold">Quando</th>
              <th className="px-4 py-3 font-bold">Ação</th>
              <th className="px-4 py-3 font-bold">Ator</th>
              <th className="px-4 py-3 font-bold">Alvo</th>
              <th className="px-4 py-3 font-bold">Detalhes</th>
              <th className="px-4 py-3 font-bold">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                  Nenhum evento registrado ainda.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-cyan/5 align-top last:border-0 hover:bg-navy-lighter/40">
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">{formatarData(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-cyan-dim px-2 py-0.5 text-xs font-semibold text-cyan">
                      {rotulo(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-main">
                    {log.actor?.username ?? log.actorLabel ?? (
                      <span className="text-text-muted">sistema</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {log.targetType ? (
                      <span>
                        {log.targetType}
                        {log.targetId ? <span className="opacity-60"> · {log.targetId.slice(0, 8)}</span> : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.metadata ? (
                      <code className="block max-w-[280px] overflow-x-auto whitespace-pre-wrap break-words rounded bg-navy px-2 py-1 text-[11px] text-text-muted">
                        {JSON.stringify(log.metadata)}
                      </code>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">{log.ip ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-4">
          <PaginacaoLink href={queryComPagina(paginaAtual - 1)} desabilitado={paginaAtual <= 1}>
            ← Anterior
          </PaginacaoLink>
          <span className="text-xs text-text-muted">
            Página {paginaAtual} de {totalPages}
          </span>
          <PaginacaoLink href={queryComPagina(paginaAtual + 1)} desabilitado={paginaAtual >= totalPages}>
            Próxima →
          </PaginacaoLink>
        </div>
      )}
    </main>
  );
}

function PaginacaoLink({
  href,
  desabilitado,
  children,
}: {
  href: string;
  desabilitado: boolean;
  children: React.ReactNode;
}) {
  if (desabilitado) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wide text-text-muted/40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-cyan/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-text-main transition-colors hover:border-cyan/50 hover:bg-navy-light"
    >
      {children}
    </Link>
  );
}
