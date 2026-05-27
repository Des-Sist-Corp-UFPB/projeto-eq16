'use client';

import { useState } from 'react';

interface HouseManagerProps {
  onHouseSuccess: () => void;
  onLogout: () => void;
  userName: string;
}

export default function HouseManager({ onHouseSuccess, onLogout, userName }: HouseManagerProps) {
  const [houseName, setHouseName] = useState('');
  const [houseCode, setHouseCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseName.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/house/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: houseName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar casa.');
      }

      onHouseSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseCode.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/house/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: houseCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao entrar na casa.');
      }

      onHouseSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '0 1rem' }}>
      <div className="glass-card" style={{ animation: 'fadeInUp 0.5s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Olá, {userName}!</h3>
            <h1 style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>Configuração de Moradia</h1>
          </div>
          <button className="btn btn-secondary" onClick={onLogout} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Sair da Conta
          </button>
        </div>

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

        {mode === 'select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1rem' }}>
              Para gerenciar despesas, você precisa criar uma casa nova ou entrar em uma casa existente compartilhada por seus amigos/moradores.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setMode('create')} style={{ padding: '1.5rem 1rem', flexDirection: 'column', height: 'auto' }}>
                <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🏠 Criar Nova Casa</span>
                <span style={{ fontSize: '0.8rem', fontWeight: '400', opacity: '0.8' }}>Você será o administrador</span>
              </button>
              <button className="btn btn-accent" onClick={() => setMode('join')} style={{ padding: '1.5rem 1rem', flexDirection: 'column', height: 'auto' }}>
                <span style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>🔑 Entrar com Código</span>
                <span style={{ fontSize: '0.8rem', fontWeight: '400', opacity: '0.8' }}>Participar de casa existente</span>
              </button>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Crie uma casa e compartilhe o código gerado para que outros moradores possam se cadastrar e ratear as contas com você.
            </p>
            <div className="form-group">
              <label className="form-label">Nome da Casa / República</label>
              <input
                type="text"
                className="form-input"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                placeholder="Ex: República dos Pinheiros, Casa da Serra"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setMode('select')} style={{ flex: 1 }}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                {loading ? 'Criando...' : 'Confirmar e Criar'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Insira o código de 6 caracteres compartilhado pelo administrador da sua casa para entrar e começar a cadastrar gastos.
            </p>
            <div className="form-group">
              <label className="form-label">Código de Convite</label>
              <input
                type="text"
                className="form-input"
                value={houseCode}
                onChange={(e) => setHouseCode(e.target.value.toUpperCase())}
                placeholder="Ex: AB3D7G"
                maxLength={6}
                required
                style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setMode('select')} style={{ flex: 1 }}>
                Voltar
              </button>
              <button type="submit" className="btn btn-accent" style={{ flex: 2 }} disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar na Casa'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
