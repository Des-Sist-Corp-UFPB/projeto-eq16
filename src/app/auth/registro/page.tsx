'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DiscordLoginButton } from '@/components/auth/DiscordLoginButton';

export default function RegistroPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (password !== confirmarSenha) {
      setErro('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch('/api/usuarios/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.erro || 'Erro ao registrar');
        return;
      }

      router.push('/auth/login');
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
          Criar Conta
        </h1>
        <p className="text-text-muted text-center mb-8 text-sm font-light">Registre-se para participar</p>

        <form onSubmit={handleSubmit} className="bg-navy-light border border-cyan/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label htmlFor="register-username" className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1.5">Usuário</label>
            <input
              id="register-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Escolha um nome de usuário"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-input-bg border border-input-border text-text-main placeholder-text-muted/50 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1.5">Senha</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              className="w-full px-4 py-2.5 rounded-lg bg-input-bg border border-input-border text-text-main placeholder-text-muted/50 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="register-confirm" className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-1.5">Confirmar Senha</label>
            <input
              id="register-confirm"
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="Repita a senha"
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
            {carregando ? 'CRIANDO...' : 'CRIAR CONTA'}
          </button>

          <DiscordLoginButton label="Criar conta com Discord" />

          <p className="text-center text-sm text-text-muted pt-2">
            Já tem conta?{' '}
            <Link href="/auth/login" className="text-cyan font-semibold hover:text-cyan-hover transition-colors">
              Fazer login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
