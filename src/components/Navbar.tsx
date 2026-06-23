'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/inicio', label: 'INICIO' },
  { href: '/equipes', label: 'EQUIPES' },
  { href: '/freeagents', label: 'AGENTES' },
];

export function Navbar() {
  const { data: session } = useSession();
  const [menuAberto, setMenuAberto] = useState(false);
  const pathname = usePathname();

  const handleSair = () => {
    setMenuAberto(false);
    signOut({ callbackUrl: '/inicio' });
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-cyan/10 bg-navy font-sans">
      {/* Container principal — justify-between + items-center */}
      <div className="flex items-center justify-between px-6 py-8 md:px-12">

        {/* Lado esquerdo: Logo + Nav links */}
        <div className="flex items-center gap-6 lg:gap-12">
          <Link
            href="/inicio"
            className="shrink-0 font-display text-base font-bold uppercase tracking-[0.25em] text-text-main transition-opacity hover:opacity-80 sm:text-lg"
          >
            Rinha Team Finder
          </Link>

          {/* Links — desktop (visível a partir de md) */}
          <div className="hidden items-center gap-6 md:flex lg:gap-10">
            {NAV_LINKS.map((link) => {
              const ehEquipe = link.href === '/equipes';
              const cls = isActive(link.href)
                ? (ehEquipe ? 'text-pink-subtle' : 'text-cyan')
                : (ehEquipe ? 'text-text-muted hover:text-pink-subtle' : 'text-text-muted hover:text-cyan');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-colors lg:px-3 ${cls}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Hamburger mobile (visível até md) */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-cyan/20 p-2 text-text-muted transition-colors hover:border-cyan/40 hover:text-text-main md:hidden"
          aria-label="Abrir menu de navegação"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((v) => !v)}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Lado direito: User info + botões — desktop (lg+) */}
        <div className="hidden items-center gap-4 lg:flex lg:gap-6">
          {session?.user ? (
            <>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted">Conectado como</p>
                <p className="text-sm font-semibold text-cyan">{session.user.username}</p>
              </div>
              <Link
                href="/conta/perfil"
                className="rounded border border-cyan/30 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted transition-colors hover:border-cyan/60 hover:text-text-main"
              >
                Minha Conta
              </Link>
              <button
                onClick={handleSair}
                className="rounded bg-cyan px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-navy transition-colors hover:bg-cyan-hover"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded bg-cyan px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-navy transition-colors hover:bg-cyan-hover"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* Botão compacto de auth — só em md (entre mobile e lg) */}
        <div className="hidden items-center md:flex lg:hidden">
          {session?.user ? (
            <button
              onClick={() => setMenuAberto((v) => !v)}
              className="inline-flex items-center justify-center rounded-lg border border-cyan/20 p-2 text-text-muted transition-colors hover:border-cyan/40 hover:text-text-main"
              aria-label="Menu do usuário"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="rounded bg-cyan px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-navy transition-colors hover:bg-cyan-hover"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>

      {/* Menu mobile/tablet (visível até lg) */}
      <div className={`${menuAberto ? 'max-h-96 border-t border-cyan/10' : 'max-h-0'} overflow-hidden transition-all duration-200 lg:hidden`}>
        <div className="flex flex-col gap-2 px-6 py-4">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const ehEquipe = link.href === '/equipes';
              const cls = isActive(link.href)
                ? (ehEquipe
                    ? 'bg-pink-subtle/10 text-pink-subtle border border-pink-subtle/20'
                    : 'bg-cyan-dim text-cyan border border-cyan/20')
                : 'text-text-muted hover:bg-navy-light border border-transparent';
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuAberto(false)}
                  className={`rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${cls}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-1 rounded-xl border border-cyan/10 bg-navy-light p-3">
            {session?.user ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-text-muted">Olá, <strong className="text-cyan">{session.user.username}</strong></p>
                <Link href="/conta/perfil" onClick={() => setMenuAberto(false)} className="rounded-lg border border-cyan/20 px-4 py-2 text-center text-xs font-bold tracking-[0.1em] text-text-main transition-colors hover:bg-navy-lighter">MINHA CONTA</Link>
                <button onClick={handleSair} className="rounded-lg bg-cyan px-4 py-2 text-xs font-bold tracking-[0.1em] text-navy transition-colors hover:bg-cyan-hover">SAIR</button>
              </div>
            ) : (
              <Link href="/auth/login" onClick={() => setMenuAberto(false)} className="block rounded-lg bg-cyan px-4 py-2 text-center text-xs font-bold tracking-[0.1em] text-navy transition-colors hover:bg-cyan-hover">ENTRAR</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
