import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { listAuditLogs, listAuditActionCounts } from '@/lib/audit';
import { mascararIp, resumirUserAgent, redigirMetadata } from '@/lib/mascarar';
import { PageGlow } from '@/components/PageGlow';
import {
  CensuraProvider,
  CensuraToggleGlobal,
  OrigemCelula,
  DetalhesCelula,
} from '@/components/admin/CensuraAuditoria';

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
  'candidatura.invite': 'Convite enviado',
  'candidatura.accept': 'Candidatura aceita',
  'candidatura.reject': 'Candidatura recusada',
};

function rotulo(action: string): string {
  return ROTULO_ACAO[action] ?? action;
}

/** Categoria visual da ação — define a cor do chip/badge (paleta do site). */
type Categoria = 'conta' | 'equipe' | 'freeagent' | 'candidatura';

function categoriaDaAcao(action: string): Categoria {
  if (action.startsWith('equipe.')) return 'equipe';
  if (action.startsWith('freeagent.')) return 'freeagent';
  if (action.startsWith('candidatura.')) return 'candidatura';
  return 'conta'; // user.*, auth.*, password.*, discord.*
}

/** Classes por categoria: badge da tabela, chip selecionado e hover do filtro. */
const COR_CATEGORIA: Record<Categoria, { badge: string; chipAtivo: string; chipHover: string }> = {
  conta: {
    badge: 'border-purple-light/30 bg-purple-dim text-purple-light',
    chipAtivo: 'border-purple-light/50 bg-purple-dim text-purple-light',
    chipHover: 'hover:border-purple-light/30 hover:text-purple-light',
  },
  equipe: {
    badge: 'border-pink-subtle/30 bg-pink-subtle/10 text-pink-subtle',
    chipAtivo: 'border-pink-subtle/50 bg-pink-subtle/10 text-pink-subtle',
    chipHover: 'hover:border-pink-subtle/30 hover:text-pink-subtle',
  },
  freeagent: {
    badge: 'border-cyan/30 bg-cyan-dim text-cyan',
    chipAtivo: 'border-cyan/50 bg-cyan-dim text-cyan',
    chipHover: 'hover:border-cyan/30 hover:text-cyan',
  },
  candidatura: {
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    chipAtivo: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
    chipHover: 'hover:border-emerald-500/30 hover:text-emerald-400',
  },
};

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}

/** "há 5 min", "há 3 h", ... (página é force-dynamic: renderiza a cada acesso). */
function tempoRelativo(data: Date): string {
  const seg = Math.floor((Date.now() - data.getTime()) / 1000);
  if (seg < 60) return 'agora mesmo';
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d === 1 ? '' : 's'}`;
  const m = Math.floor(d / 30);
  if (m < 12) return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
  const a = Math.floor(m / 12);
  return `há ${a} ano${a === 1 ? '' : 's'}`;
}

/** Janela de páginas para a paginação numerada: 1 … atual-1 atual atual+1 … última. */
function paginasVisiveis(atual: number, total: number): (number | '…')[] {
  const candidatas = [1, atual - 1, atual, atual + 1, total];
  const paginas = [...new Set(candidatas)].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const saida: (number | '…')[] = [];
  let anterior = 0;
  for (const p of paginas) {
    if (p - anterior > 1) saida.push('…');
    saida.push(p);
    anterior = p;
  }
  return saida;
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
    listAuditActionCounts(),
  ]);

  const totalGeral = acoes.reduce((soma, a) => soma + a.total, 0);

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
      <PageGlow accent="purple" />

      {/* Cabeçalho */}
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-light">
          Área administrativa
        </p>
        <h1 className="font-display mt-1 text-2xl font-extrabold uppercase tracking-[-0.02em] text-text-main sm:text-3xl">
          Log de Auditoria
        </h1>
        <p className="mt-2 text-sm font-light text-text-muted">
          Trilha imutável de ações sensíveis: quem fez o quê, quando e de onde. Os dados pessoais
          ficam censurados por padrão — use o olho para revelar.
        </p>
      </div>

      {/* Resumo */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-purple-light/15 bg-navy-light p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Eventos registrados</p>
          <p className="font-display mt-1 text-2xl font-extrabold text-purple-light">{totalGeral}</p>
        </div>
        <div className="rounded-xl border border-cyan/15 bg-navy-light p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Tipos de ação</p>
          <p className="font-display mt-1 text-2xl font-extrabold text-cyan">{acoes.length}</p>
        </div>
        <div className="rounded-xl border border-pink-subtle/15 bg-navy-light p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
            {action ? `Filtro: ${rotulo(action)}` : 'Exibindo'}
          </p>
          <p className="font-display mt-1 text-2xl font-extrabold text-pink-subtle">
            {total}
            <span className="ml-2 align-middle text-xs font-normal normal-case tracking-normal text-text-muted">
              evento{total === 1 ? '' : 's'} · pág. {paginaAtual}/{totalPages}
            </span>
          </p>
        </div>
      </div>

      {/* Filtro por ação */}
      <div className="mb-5 rounded-2xl border border-purple-light/10 bg-navy-light/50 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-muted">
          Filtrar por ação
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/auditoria"
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              !action
                ? 'border-purple-light/50 bg-purple-dim text-purple-light'
                : 'border-input-border bg-input-bg text-text-muted hover:border-purple-light/30 hover:text-text-main'
            }`}
          >
            Todas <span className="ml-1 font-normal opacity-70">{totalGeral}</span>
          </Link>
          {acoes.map(({ action: a, total: n }) => {
            const cor = COR_CATEGORIA[categoriaDaAcao(a)];
            return (
              <Link
                key={a}
                href={`/admin/auditoria${queryComAcao(a)}`}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  action === a
                    ? cor.chipAtivo
                    : `border-input-border bg-input-bg text-text-muted ${cor.chipHover}`
                }`}
              >
                {rotulo(a)} <span className="ml-1 font-normal opacity-70">{n}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tabela — o provider controla o "revelar tudo" dos dados pessoais. */}
      <CensuraProvider>
      <CensuraToggleGlobal />
      <div className="overflow-x-auto rounded-xl border border-purple-light/10 bg-navy-light">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-purple-light/10 text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 font-bold">Quando</th>
              <th className="px-4 py-3 font-bold">Ação</th>
              <th className="px-4 py-3 font-bold">Ator</th>
              <th className="px-4 py-3 font-bold">Alvo</th>
              <th className="px-4 py-3 font-bold">Detalhes</th>
              <th className="px-4 py-3 font-bold">Origem</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <p className="text-base text-text-main">Nenhum evento por aqui.</p>
                  <p className="mt-1 text-sm font-light text-text-muted">
                    {action
                      ? 'Nada registrado para esse tipo de ação ainda.'
                      : 'As ações sensíveis da plataforma aparecerão aqui.'}
                  </p>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const nomeAtor = log.actor?.username ?? log.actorLabel;
                const { revelavel, censurado, temSensivel } = redigirMetadata(log.metadata);
                return (
                  <tr
                    key={log.id}
                    className="border-b border-purple-light/5 align-top last:border-0 hover:bg-navy-lighter/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-text-main">{formatarData(log.createdAt)}</p>
                      <p className="text-[11px] font-light text-text-muted">{tempoRelativo(log.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${COR_CATEGORIA[categoriaDaAcao(log.action)].badge}`}
                        title={log.action}
                      >
                        {rotulo(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {nomeAtor ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-purple-light/30 bg-purple-dim text-[11px] font-bold uppercase text-purple-light">
                            {nomeAtor.charAt(0)}
                          </span>
                          <span className="text-text-main">{nomeAtor}</span>
                          {!log.actor && (
                            <span
                              className="text-[10px] uppercase tracking-wider text-text-muted/60"
                              title="A conta foi removida; o nome ficou preservado no log."
                            >
                              (conta removida)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="italic text-text-muted">sistema</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {log.targetType ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="rounded border border-cyan/15 bg-navy px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                            {log.targetType}
                          </span>
                          {log.targetId && (
                            <span className="font-mono text-[11px] text-text-muted/70" title={log.targetId}>
                              #{log.targetId.slice(0, 8)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-text-muted/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DetalhesCelula
                        metadata={revelavel}
                        metadataCensurado={censurado}
                        temSensivel={temSensivel}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <OrigemCelula
                        ip={log.ip}
                        ipMascarado={mascararIp(log.ip)}
                        userAgent={log.userAgent}
                        userAgentResumo={resumirUserAgent(log.userAgent)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </CensuraProvider>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <PaginacaoLink href={queryComPagina(paginaAtual - 1)} desabilitado={paginaAtual <= 1}>
            ← Anterior
          </PaginacaoLink>

          <div className="flex items-center gap-1.5">
            {paginasVisiveis(paginaAtual, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="px-1 text-xs text-text-muted/50">
                  …
                </span>
              ) : p === paginaAtual ? (
                <span
                  key={p}
                  className="rounded-lg border border-purple-light/50 bg-purple-dim px-3 py-1.5 text-xs font-bold text-purple-light"
                >
                  {p}
                </span>
              ) : (
                <Link
                  key={p}
                  href={queryComPagina(p)}
                  className="rounded-lg border border-input-border bg-input-bg px-3 py-1.5 text-xs font-bold text-text-muted transition-colors hover:border-purple-light/40 hover:text-text-main"
                >
                  {p}
                </Link>
              )
            )}
          </div>

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
      className="rounded-lg border border-purple-light/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-text-main transition-colors hover:border-purple-light/50 hover:bg-navy-light"
    >
      {children}
    </Link>
  );
}
