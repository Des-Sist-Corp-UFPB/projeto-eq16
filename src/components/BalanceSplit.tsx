'use client';

import { useState } from 'react';
import { Expense, User } from '@/lib/db';

interface BalanceSplitProps {
  expenses: Expense[];
  residents: { id: string; name: string; email: string; role: 'ADMIN' | 'USER' }[];
  currentUserRole: 'ADMIN' | 'USER';
  onMonthClosed: () => void;
}

interface ComputedTransaction {
  fromName: string;
  toName: string;
  amount: number;
}

export default function BalanceSplit({ expenses, residents, currentUserRole, onMonthClosed }: BalanceSplitProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const N = residents.length;

  // 1. Calcular o total gasto por morador
  const spentMap: Record<string, number> = {};
  residents.forEach((r) => {
    spentMap[r.id] = 0;
  });

  expenses.forEach((exp) => {
    const expTotal = exp.value * exp.quantity;
    if (spentMap[exp.userId] !== undefined) {
      spentMap[exp.userId] += expTotal;
    } else {
      spentMap[exp.userId] = expTotal;
    }
  });

  const totalSpent = Object.values(spentMap).reduce((sum, val) => sum + val, 0);
  const sharePerPerson = N > 0 ? Number((totalSpent / N).toFixed(2)) : 0;

  // 2. Calcular saldos individuais
  const individualBalances = residents.map((r) => {
    const spent = spentMap[r.id] || 0;
    return {
      id: r.id,
      name: r.name,
      spent,
      balance: Number((spent - sharePerPerson).toFixed(2)),
    };
  });

  // 3. Algoritmo Guloso (Client-side para Preview em Tempo Real)
  const debtors = individualBalances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance);
  const creditors = individualBalances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);

  const transactions: ComputedTransaction[] = [];
  const tempDebtors = debtors.map((d) => ({ ...d }));
  const tempCreditors = creditors.map((c) => ({ ...c }));

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < tempDebtors.length && cIdx < tempCreditors.length) {
    const d = tempDebtors[dIdx];
    const c = tempCreditors[cIdx];

    const amountToPay = Math.min(-d.balance, c.balance);

    if (amountToPay > 0.01) {
      transactions.push({
        fromName: d.name,
        toName: c.name,
        amount: Number(amountToPay.toFixed(2)),
      });
    }

    d.balance += amountToPay;
    c.balance -= amountToPay;

    if (Math.abs(d.balance) < 0.02) dIdx++;
    if (Math.abs(c.balance) < 0.02) cIdx++;
  }

  const handleCloseMonth = async () => {
    if (expenses.length === 0) {
      alert('Não há despesas no mês corrente para fechar.');
      return;
    }
    if (!confirm('Deseja realmente FECHAR O MÊS? Esta ação salvará o rateio no histórico e limpará os gastos atuais de todos os moradores. Apenas o ADMIN pode fazer isso.')) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/house/close-month', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fechar o mês.');
      }

      alert('Mês fechado e arquivado com sucesso!');
      onMonthClosed();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="glass-card" style={{ height: '100%' }}>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontFamily: 'var(--font-title)' }}>
        ⚖️ Rateio e Acertos (Tempo Real)
      </h2>

      {error && (
        <div style={{
          background: 'var(--danger-glow)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {/* Resumo da Casa */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'hsla(224, 71%, 5%, 0.4)',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TOTAL GASTO DA CASA</span>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--accent)', marginTop: '0.25rem' }}>
            {formatCurrency(totalSpent)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>COTA POR MORADOR ({N})</span>
          <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {formatCurrency(sharePerPerson)}
          </div>
        </div>
      </div>

      {/* Balanço de Cada Morador */}
      <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        Saldos dos Moradores
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {individualBalances.map((item) => {
          const isCreditor = item.balance > 0;
          const isDebtor = item.balance < 0;
          return (
            <div key={item.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              background: 'hsla(224, 71%, 3%, 0.4)',
              border: '1px solid var(--border)',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontWeight: '500', fontSize: '0.95rem' }}>{item.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gastou: {formatCurrency(item.spent)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontWeight: '600',
                  color: isCreditor ? 'var(--success)' : isDebtor ? 'var(--danger)' : 'var(--text-secondary)',
                  fontSize: '0.95rem'
                }}>
                  {isCreditor ? '+' : ''}{formatCurrency(item.balance)}
                </div>
                <div style={{ fontSize: '0.7rem', color: isCreditor ? 'var(--success)' : isDebtor ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {isCreditor ? 'A receber' : isDebtor ? 'A pagar' : 'Quitado'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transações Recomendadas ("Quem paga quem") */}
      <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        Transferências Necessárias
      </h3>

      {transactions.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '1.5rem',
          background: 'hsla(142, 70%, 45%, 0.05)',
          border: '1px dashed var(--success)',
          borderRadius: '8px',
          color: 'var(--success)',
          fontSize: '0.85rem',
          marginBottom: '2rem'
        }}>
          ✨ Contas perfeitamente equilibradas! Ninguém precisa transferir nada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          {transactions.map((t, idx) => (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'hsla(263, 70%, 50%, 0.04)',
              border: '1px solid hsla(263, 70%, 50%, 0.15)',
              borderRadius: '8px',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '600', color: 'var(--danger)' }}>{t.fromName}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>transfere para</span>
                <span style={{ fontWeight: '600', color: 'var(--success)' }}>{t.toName}</span>
              </div>
              <div style={{ fontWeight: '700', color: 'var(--accent)' }}>
                {formatCurrency(t.amount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão de Fechamento de Mês exclusivo ADMIN */}
      {currentUserRole === 'ADMIN' ? (
        <button
          onClick={handleCloseMonth}
          className="btn btn-accent"
          style={{ width: '100%', padding: '0.85rem 1.5rem' }}
          disabled={loading || expenses.length === 0}
        >
          {loading ? 'Processando Fechamento...' : '🔒 Fechar Mês Atual e Ratear'}
        </button>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: 'hsla(224, 71%, 3%, 0.2)'
        }}>
          💡 Apenas o administrador da casa pode fechar e arquivar o mês.
        </div>
      )}
    </div>
  );
}
