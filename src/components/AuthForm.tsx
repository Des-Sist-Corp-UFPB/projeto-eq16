'use client';

import { useState } from 'react';

interface AuthFormProps {
  onAuthSuccess: (user: { id: string; name: string; email: string; role: 'ADMIN' | 'USER'; houseId: string | null }) => void;
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Algo deu errado.');
      }

      if (isLogin) {
        onAuthSuccess(data);
      } else {
        // Após registro bem sucedido, logar automaticamente
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginResponse.json();
        if (loginResponse.ok) {
          onAuthSuccess(loginData);
        } else {
          setIsLogin(true);
          setError('Cadastro realizado! Faça login para continuar.');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '450px', margin: '4rem auto', animation: 'fadeInUp 0.5s ease' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
        <button
          className="btn"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            borderRadius: '0',
            borderBottom: isLogin ? '2px solid var(--primary)' : 'none',
            color: isLogin ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '1rem',
          }}
          onClick={() => { setIsLogin(true); setError(null); }}
        >
          Entrar
        </button>
        <button
          className="btn"
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            borderRadius: '0',
            borderBottom: !isLogin ? '2px solid var(--primary)' : 'none',
            color: !isLogin ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '1rem',
          }}
          onClick={() => { setIsLogin(false); setError(null); }}
        >
          Cadastrar
        </button>
      </div>

      <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: '1.5rem', textAlign: 'center' }}>
        {isLogin ? 'Bem-vindo de volta!' : 'Criar nova conta'}
      </h2>

      {error && (
        <div style={{
          background: 'var(--danger-glow)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="form-group">
            <label className="form-label">Nome Completo</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@exemplo.com"
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label">Senha</label>
          <input
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Processando...' : isLogin ? 'Entrar no Sistema' : 'Criar Conta'}
        </button>
      </form>
    </div>
  );
}
