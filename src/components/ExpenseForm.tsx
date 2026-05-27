'use client';

import { useState } from 'react';

interface ExpenseFormProps {
  onExpenseAdded: () => void;
}

export default function ExpenseForm({ onExpenseAdded }: ExpenseFormProps) {
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState('comida');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const numValue = parseFloat(value);
    const numQty = parseInt(quantity, 10);

    if (!description.trim()) {
      setError('Por favor, informe a identificação do gasto.');
      return;
    }
    if (isNaN(numValue) || numValue <= 0) {
      setError('O valor deve ser maior que zero.');
      return;
    }
    if (isNaN(numQty) || numQty <= 0) {
      setError('A quantidade deve ser de pelo menos 1.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          value: numValue,
          quantity: numQty,
          type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cadastrar despesa.');
      }

      setSuccess(true);
      setDescription('');
      setValue('');
      setQuantity('1');
      setType('comida');
      
      // Auto ocultar mensagem de sucesso
      setTimeout(() => setSuccess(false), 3000);

      onExpenseAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ height: '100%' }}>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontFamily: 'var(--font-title)' }}>
        ➕ Lançar Despesa
      </h2>

      {error && (
        <div style={{
          background: 'var(--danger-glow)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'var(--success-glow)',
          border: '1px solid var(--success)',
          color: 'var(--success)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
          textAlign: 'center'
        }}>
          ✓ Despesa lançada com sucesso!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Identificação do Gasto</label>
          <input
            type="text"
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Sacolas de Supermercado, Botijão de gás"
            maxLength={60}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label">Valor Unitário (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Qtd.</label>
            <input
              type="number"
              min="1"
              step="1"
              className="form-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1.75rem' }}>
          <label className="form-label">Tipo de Gasto</label>
          <select
            className="form-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="comida">🍲 Comida</option>
            <option value="higiene">🧼 Higiene</option>
            <option value="utilitários">💡 Utilitários (Água, Luz, Internet, Gás)</option>
            <option value="outros">📦 Outros</option>
          </select>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Adicionando...' : 'Confirmar Lançamento'}
        </button>
      </form>
    </div>
  );
}
