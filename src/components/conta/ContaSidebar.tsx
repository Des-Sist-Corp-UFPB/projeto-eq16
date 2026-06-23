'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  {
    href: '/conta/perfil',
    label: 'Perfil',
    descricao: 'Seus dados',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    ),
  },
  {
    href: '/conta/contas-vinculadas',
    label: 'Contas Vinculadas',
    descricao: 'Discord e mais',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m6.156-1.328a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
    ),
  },
  {
    href: '/conta/seguranca',
    label: 'Segurança',
    descricao: 'Senha e acesso',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    ),
  },
];

export function ContaSidebar() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 md:w-60">
      <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
        {ITENS.map((item) => {
          const ativo = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0 md:shrink">
              <Link
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  ativo
                    ? 'border-cyan/40 bg-cyan-dim text-cyan'
                    : 'border-transparent text-text-muted hover:border-cyan/20 hover:bg-navy-light hover:text-text-main'
                }`}
              >
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon}
                </svg>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold uppercase tracking-wide">{item.label}</span>
                  <span className="hidden text-[11px] font-light text-text-muted md:block">{item.descricao}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
