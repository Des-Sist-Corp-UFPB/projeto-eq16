'use client';

import { useState, useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import HouseManager from '@/components/HouseManager';
import ExpenseForm from '@/components/ExpenseForm';
import ExpenseList from '@/components/ExpenseList';
import BalanceSplit from '@/components/BalanceSplit';
import HistoryCharts from '@/components/HistoryCharts';
import ExportPdfButton from '@/components/ExportPdfButton';
import { Expense, MonthlyHistory } from '@/lib/db';

interface UserSession {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  houseId: string | null;
}

interface HouseDetails {
  id: string;
  name: string;
  code: string;
  adminId: string;
  residents: string[];
  currentExpenses: Expense[];
  history: MonthlyHistory[];
}

export default function Home() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [house, setHouse] = useState<HouseDetails | null>(null);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega a sessão do usuário
  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        if (userData.houseId) {
          await loadHouseStatus();
        }
      } else {
        setUser(null);
        setHouse(null);
        setResidents([]);
      }
    } catch (err) {
      console.error('Erro de sessão:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega status da casa, despesas, moradores e histórico
  const loadHouseStatus = async () => {
    try {
      const res = await fetch('/api/house/status');
      if (res.ok) {
        const data = await res.json();
        if (data.house) {
          setHouse(data.house);
          setResidents(data.residents);
          // Caso o role do usuário tenha mudado no backend (ex: virou Admin ou User)
          if (data.currentUser && user) {
            setUser((prev) => prev ? { ...prev, role: data.currentUser.role, houseId: data.currentUser.houseId } : null);
          }
        } else {
          setHouse(null);
          setResidents([]);
          if (user) {
            setUser((prev) => prev ? { ...prev, houseId: null } : null);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar status da casa:', err);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleAuthSuccess = (userData: UserSession) => {
    setUser(userData);
    if (userData.houseId) {
      loadHouseStatus();
    }
  };

  const handleLogout = async () => {
    if (!confirm('Deseja realmente sair?')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setHouse(null);
      setResidents([]);
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'var(--font-title)',
        gap: '1rem'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid var(--border)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style jsx global>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ color: 'var(--text-secondary)' }}>Carregando dados seguros...</span>
      </div>
    );
  }

  // 1. Tela de Login e Cadastro (Sem Usuário Logado)
  if (!user) {
    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(to right, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            República Fácil
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Controle financeiro e divisão justa de despesas domésticas.
          </p>
        </div>
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  // 2. Tela de Criação/Entrada na Casa (Logado, sem Casa vinculada)
  if (!house || !user.houseId) {
    return (
      <HouseManager
        userName={user.name}
        onHouseSuccess={loadHouseStatus}
        onLogout={handleLogout}
      />
    );
  }

  // 3. Dashboard da Casa Compartilhada
  return (
    <div className="container" style={{ animation: 'fadeInUp 0.6s ease' }}>
      
      {/* Cabeçalho do Painel */}
      <header className="glass-card no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem',
        padding: '1.5rem 2rem'
      }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Painel da Casa
          </span>
          <h1 style={{ fontSize: '1.8rem', marginTop: '0.25rem' }}>🏠 {house.name}</h1>
        </div>
        
        {/* Informações de Conexão */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CÓDIGO DE CONVITE</div>
            <div style={{
              fontSize: '1.15rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              letterSpacing: '0.1em',
              background: 'hsla(224, 71%, 3%, 0.4)',
              padding: '0.25rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              display: 'inline-block',
              marginTop: '0.25rem'
            }}>
              {house.code}
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FUNÇÃO</div>
            <span className={`badge ${user.role === 'ADMIN' ? 'badge-outros' : 'badge-higiene'}`} style={{ marginTop: '0.4rem' }}>
              {user.role === 'ADMIN' ? '👑 Admin' : '👤 Morador'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <ExportPdfButton
              houseName={house.name}
              expenses={house.currentExpenses}
              residents={residents}
              history={house.history}
            />
            <button className="btn btn-secondary" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Grid Principal do Dashboard */}
      <main className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Bloco 1: Lançador e Rateio de Despesas (Duas colunas lado a lado no desktop) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          <div>
            <ExpenseForm onExpenseAdded={loadHouseStatus} />
          </div>
          <div>
            <BalanceSplit
              expenses={house.currentExpenses}
              residents={residents}
              currentUserRole={user.role}
              onMonthClosed={loadHouseStatus}
            />
          </div>
        </div>

        {/* Bloco 2: Lista Completa de Despesas */}
        <div>
          <ExpenseList
            expenses={house.currentExpenses}
            currentUserId={user.id}
            currentUserRole={user.role}
            onExpenseDeleted={loadHouseStatus}
          />
        </div>

        {/* Bloco 3: Painel de Histórico e Gráficos Comparativos */}
        <div>
          <HistoryCharts history={house.history} />
        </div>
      </main>

      {/* RENDERIZADOR DO PDF PARA IMPRESSÃO (Será injetado invisível na tela e capturado na impressão) */}
      <div className="print-area" style={{ display: 'none' }}>
        <ExportPdfButton
          houseName={house.name}
          expenses={house.currentExpenses}
          residents={residents}
          history={house.history}
        />
      </div>

    </div>
  );
}
