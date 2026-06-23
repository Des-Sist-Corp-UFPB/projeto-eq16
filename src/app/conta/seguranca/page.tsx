'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';

export default function SegurancaPage() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  // null = ainda carregando; true/false = se a conta tem senha local.
  const [temSenha, setTemSenha] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/usuarios/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTemSenha(data ? !!data.hasPassword : true))
      .catch(() => setTemSenha(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setMensagem('');

    if (novaSenha !== confirmarNovaSenha) {
      setErro('As novas senhas não coincidem');
      return;
    }

    if (novaSenha.length < 6) {
      setErro('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch('/api/usuarios/mudar-senha', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.erro || 'Erro ao alterar senha');
        return;
      }

      setMensagem(data.mensagem);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
    } catch {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Esqueleto de carregamento enquanto verifica se a conta tem senha */}
      {temSenha === null && (
        <div className="rounded-2xl border border-cyan/10 bg-navy-light p-6 shadow-lg animate-pulse">
          <div className="h-4 w-32 rounded bg-navy-lighter mb-3" />
          <div className="h-3 w-56 rounded bg-navy-lighter mb-5" />
          <div className="space-y-3">
            <div className="h-9 w-full rounded-lg bg-navy-lighter" />
            <div className="h-9 w-full rounded-lg bg-navy-lighter" />
            <div className="h-9 w-full rounded-lg bg-navy-lighter" />
          </div>
        </div>
      )}

      {/* Conta sem senha local (entra pelo Discord) */}
      {temSenha === false && (
        <div className="rounded-2xl border border-[#5865F2]/30 bg-navy-light p-6 shadow-lg">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-text-main">Senha</h2>
          <p className="mt-1 text-sm font-light text-text-muted">
            Sua conta entra pelo <span className="text-[#a5abf5]">Discord</span> e não tem senha local — não há nada para alterar aqui.
          </p>
        </div>
      )}

      {/* Alterar senha */}
      {temSenha === true && (
      <div className="rounded-2xl border border-cyan/10 bg-navy-light p-6 shadow-lg">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-text-main">Alterar senha</h2>
        <p className="mt-1 text-sm font-light text-text-muted">Altere sua senha de acesso.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="senha-atual" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-text-muted">Senha Atual</label>
            <input
              id="senha-atual"
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
              className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-text-main placeholder-text-muted/50 transition-colors focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nova-senha" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-text-muted">Nova Senha</label>
            <input
              id="nova-senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-text-main placeholder-text-muted/50 transition-colors focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirmar-nova-senha" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-text-muted">Confirmar Nova Senha</label>
            <input
              id="confirmar-nova-senha"
              type="password"
              value={confirmarNovaSenha}
              onChange={(e) => setConfirmarNovaSenha(e.target.value)}
              required
              className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-text-main placeholder-text-muted/50 transition-colors focus:outline-none"
            />
          </div>

          {erro && (
            <p className="rounded-lg border border-pink-subtle/20 bg-pink-subtle/10 px-3 py-2 text-sm text-pink-subtle">{erro}</p>
          )}

          {mensagem && (
            <p className="rounded-lg border border-cyan/20 bg-cyan-dim px-3 py-2 text-sm text-cyan">{mensagem}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-cyan py-2.5 text-sm font-bold uppercase tracking-widest text-navy transition-colors hover:bg-cyan-hover disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {carregando ? 'ALTERANDO...' : 'ALTERAR SENHA'}
          </button>
        </form>
      </div>
      )}

      {/* Sessão */}
      <div className="rounded-2xl border border-cyan/10 bg-navy-light p-6 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-text-main">Sessão</h2>
            <p className="mt-1 text-sm font-light text-text-muted">Encerrar a sessão neste dispositivo.</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/inicio' })}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-pink-subtle/30 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-pink-subtle transition-colors hover:bg-pink-subtle/10"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
