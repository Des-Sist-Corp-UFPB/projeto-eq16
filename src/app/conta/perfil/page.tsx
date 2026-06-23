'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface PerfilData {
  username: string;
  role: string;
  createdAt: string;
  discordUsername: string | null;
}

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function PerfilPage() {
  const { data: session } = useSession();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);

  useEffect(() => {
    fetch('/api/usuarios/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setPerfil)
      .catch(() => setPerfil(null));
  }, []);

  const username = perfil?.username ?? session?.user?.username ?? '—';
  const role = perfil?.role ?? session?.user?.role ?? 'USER';
  const discordUsername = perfil?.discordUsername ?? session?.user?.discordUsername ?? null;
  const inicial = username.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan/10 bg-navy-light p-6 shadow-lg">
        {/* Cabeçalho do perfil */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cyan-dim text-2xl font-extrabold text-cyan">
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="font-display truncate text-xl font-bold text-text-main">{username}</p>
            <span
              className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                role === 'ADMIN'
                  ? 'bg-pink-subtle/15 text-pink-subtle'
                  : 'bg-cyan-dim text-cyan'
              }`}
            >
              {role === 'ADMIN' ? 'Administrador' : 'Jogador'}
            </span>
          </div>
        </div>

        {/* Campos do perfil */}
        <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-cyan/10 bg-cyan/10 sm:grid-cols-2">
          <div className="bg-navy-light p-4">
            <dt className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Nome de usuário</dt>
            <dd className="mt-1 text-sm text-text-main">{username}</dd>
          </div>
          <div className="bg-navy-light p-4">
            <dt className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Membro desde</dt>
            <dd className="mt-1 text-sm text-text-main">{perfil ? formatarData(perfil.createdAt) : '...'}</dd>
          </div>
          <div className="bg-navy-light p-4 sm:col-span-2">
            <dt className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Discord</dt>
            <dd className="mt-1 text-sm">
              {discordUsername ? (
                <span className="text-[#a5abf5]">{discordUsername}</span>
              ) : (
                <Link href="/conta/contas-vinculadas" className="text-cyan hover:underline">
                  Não vinculado — vincular agora
                </Link>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <p className="text-xs font-light text-text-muted">
        O nome de usuário não pode ser alterado. Para mudar seu contato do Discord, vá em{' '}
        <Link href="/conta/contas-vinculadas" className="text-cyan hover:underline">
          Contas Vinculadas
        </Link>
        .
      </p>
    </div>
  );
}
