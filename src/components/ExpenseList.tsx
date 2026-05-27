'use client';

import { useState } from 'react';
import { Expense } from '@/lib/db';

interface ExpenseListProps {
  expenses: Expense[];
  currentUserId: string;
  currentUserRole: 'ADMIN' | 'USER';
  onExpenseDeleted: () => void;
}

export default function ExpenseList({ expenses, currentUserId, currentUserRole, onExpenseDeleted }: ExpenseListProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta despesa?')) return;

    setError(null);
    setDeletingId(id);

    try {
      const response = await fetch(`/api/expenses?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao remover despesa.');
      }

      onExpenseDeleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredExpenses = filterType === 'all'
    ? expenses
    : expenses.filter((e) => e.type === filterType);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '-';
    }
  };

  return (
    <div className="glass-card" style={{ height: '100%' }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-title)' }}>
          📋 Despesas do Mês Atual
        </h2>

        {/* Filtro de Categorias */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filtrar:</span>
          <select
            className="form-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.85rem', width: 'auto' }}
          >
            <option value="all">📦 Todos</option>
            <option value="comida">🍲 Comida</option>
            <option value="higiene">🧼 Higiene</option>
            <option value="utilitários">💡 Utilitários</option>
            <option value="outros">📦 Outros</option>
          </select>
        </div>
      </div>

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

      {filteredExpenses.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: 'var(--text-muted)',
          fontSize: '0.95rem'
        }}>
          Nenhuma despesa cadastrada {filterType !== 'all' ? 'nesta categoria' : 'no momento'}.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Item</th>
                <th>Tipo</th>
                <th>Morador</th>
                <th style={{ textAlign: 'right' }}>Unit.</th>
                <th style={{ textAlign: 'center' }}>Qtd</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }} className="no-print">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => {
                const isOwner = exp.userId === currentUserId;
                const isAdmin = currentUserRole === 'ADMIN';
                const canDelete = isOwner || isAdmin;
                const totalExpense = exp.value * exp.quantity;

                return (
                  <tr key={exp.id}>
                    <td>{formatDate(exp.date)}</td>
                    <td style={{ fontWeight: '500' }}>{exp.description}</td>
                    <td>
                      <span className={`badge badge-${exp.type}`}>
                        {exp.type === 'comida' && '🍲 '}
                        {exp.type === 'higiene' && '🧼 '}
                        {exp.type === 'utilitários' && '💡 '}
                        {exp.type === 'outros' && '📦 '}
                        {exp.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{exp.userName}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(exp.value)}</td>
                    <td style={{ textAlign: 'center' }}>{exp.quantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(totalExpense)}
                    </td>
                    <td style={{ textAlign: 'center' }} className="no-print">
                      {canDelete ? (
                        <button
                          onClick={() => handleDelete(exp.id)}
                          disabled={deletingId === exp.id}
                          className="btn btn-danger"
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.75rem',
                            borderRadius: '4px'
                          }}
                        >
                          {deletingId === exp.id ? '...' : '🗑️'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🔒</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
