'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DiscordLoginButton } from '@/components/auth/DiscordLoginButton';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setErro('Usuário ou senha incorretos');
      } else {
        const redirectParam = new URLSearchParams(window.location.search).get('redirect');
        const destino = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/inicio';
        router.push(destino);
      }
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="w-full flex-1 bg-navy flex items-center justify-center px-4 font-sans py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.04em] text-center mb-2 text-text-main">
          Rinha Team Finder
        </h1>
        <p className="text-text-muted text-center mb-8 text-sm font-light">Faça login para continuar</p>

        <form onSubmit={handleSubmit} className="bg-navy-light border border-cyan/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label htmlFor="login-username" className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1.5">Usuário</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Seu nome de usuário"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-input-bg border border-input-border text-text-main placeholder-text-muted/50 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1.5">Senha</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-input-bg border border-input-border text-text-main placeholder-text-muted/50 focus:outline-none transition-colors"
            />
          </div>

          {erro && (
            <p className="text-pink-subtle text-sm bg-pink-subtle/10 border border-pink-subtle/20 rounded-lg px-3 py-2">{erro}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-2.5 rounded-lg bg-cyan hover:bg-cyan-hover text-navy font-bold uppercase tracking-widest text-sm transition-colors disabled:opacity-50"
          >
            {carregando ? 'ENTRANDO...' : 'ENTRAR'}
          </button>

          <DiscordLoginButton />

          <p className="text-center text-sm text-text-muted pt-2">
            Não tem conta?{' '}
            <Link href="/auth/registro" className="text-cyan font-semibold hover:text-cyan-hover transition-colors">
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
