'use client';

import { Expense, MonthlyHistory } from '@/lib/db';
import HistoryCharts from './HistoryCharts';

interface ExportPdfButtonProps {
  houseName: string;
  expenses: Expense[];
  residents: { id: string; name: string; email: string; role: 'ADMIN' | 'USER' }[];
  history: MonthlyHistory[];
}

export default function ExportPdfButton({ houseName, expenses, residents, history }: ExportPdfButtonProps) {
  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  // Re-calcular rateios atuais para o relatório PDF
  const N = residents.length;
  const spentMap: Record<string, number> = {};
  residents.forEach((r) => { spentMap[r.id] = 0; });
  expenses.forEach((e) => {
    const total = e.value * e.quantity;
    if (spentMap[e.userId] !== undefined) {
      spentMap[e.userId] += total;
    } else {
      spentMap[e.userId] = total;
    }
  });

  const totalSpent = Object.values(spentMap).reduce((sum, val) => sum + val, 0);
  const sharePerPerson = N > 0 ? Number((totalSpent / N).toFixed(2)) : 0;

  // Algoritmo guloso para exibir transferências no relatório PDF
  const balances = residents.map((r) => {
    const spent = spentMap[r.id] || 0;
    return {
      id: r.id,
      name: r.name,
      balance: Number((spent - sharePerPerson).toFixed(2)),
    };
  });

  const debtors = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance);
  const creditors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);

  const transactions: { fromName: string; toName: string; amount: number }[] = [];
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

  return (
    <>
      {/* Botão visível na Tela */}
      <button onClick={handlePrint} className="btn btn-accent no-print">
        📄 Exportar Relatório PDF
      </button>

      {/* ÁREA DE IMPRESSÃO (Escondida na tela por CSS padrão, visível apenas na impressão/PDF) */}
      <div className="print-area" style={{ display: 'none' }}>
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
          
          {/* Cabeçalho do Relatório */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #000', paddingBottom: '1rem', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '24pt', fontWeight: 'bold', margin: 0 }}>RELATÓRIO DE DESPESAS DOMÉSTICAS</h1>
              <h2 style={{ fontSize: '14pt', color: '#555', margin: '5px 0 0 0' }}>Casa: {houseName}</h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '10pt', color: '#666' }}>Data de Exportação: {new Date().toLocaleDateString('pt-BR')}</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '10pt', color: '#666' }}>Moradores Ativos: {N}</p>
            </div>
          </div>

          {/* Tabela de Despesas */}
          <h2 style={{ fontSize: '14pt', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '1rem' }}>
            1. Detalhamento dos Gastos do Mês
          </h2>
          {expenses.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#666' }}>Nenhuma despesa ativa lançada neste mês.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Data</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Item / Gasto</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Categoria</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Comprador</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Valor Unit.</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Qtd</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatDate(exp.date)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{exp.description}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textTransform: 'capitalize' }}>{exp.type}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{exp.userName}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatCurrency(exp.value)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{exp.quantity}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(exp.value * exp.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Resumo de Rateio */}
          <h2 style={{ fontSize: '14pt', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '1rem', pageBreakBefore: 'avoid' }}>
            2. Resumo de Rateio Financeiro
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', background: '#fafafa' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '9pt', color: '#666' }}>Gasto Total da Casa</p>
              <p style={{ margin: 0, fontSize: '18pt', fontWeight: 'bold', color: '#2e7d32' }}>{formatCurrency(totalSpent)}</p>
            </div>
            <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', background: '#fafafa' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '9pt', color: '#666' }}>Cota Individual (Por Morador)</p>
              <p style={{ margin: 0, fontSize: '18pt', fontWeight: 'bold' }}>{formatCurrency(sharePerPerson)}</p>
            </div>
          </div>

          {/* Saldos dos Moradores */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Morador</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Total Pago (R$)</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Diferença / Saldo (R$)</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{b.name}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatCurrency(spentMap[b.id] || 0)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', color: b.balance > 0 ? '#2e7d32' : b.balance < 0 ? '#c62828' : '#333' }}>
                    {b.balance > 0 ? '+' : ''}{formatCurrency(b.balance)}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', color: b.balance > 0 ? '#2e7d32' : b.balance < 0 ? '#c62828' : '#666' }}>
                    {b.balance > 0 ? 'A receber' : b.balance < 0 ? 'A pagar' : 'Quitado'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Transferências de Acerto */}
          <h2 style={{ fontSize: '14pt', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '1rem' }}>
            3. Transferências Recomendadas (Acerto de Contas)
          </h2>
          {transactions.length === 0 ? (
            <p style={{ color: '#2e7d32', fontStyle: 'italic', fontWeight: 'bold', marginBottom: '2rem' }}>
              ✓ Todas as contas estão perfeitamente equilibradas! Nenhuma transferência necessária.
            </p>
          ) : (
            <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', background: '#fafafa', marginBottom: '3rem' }}>
              {transactions.map((t, idx) => (
                <div key={idx} style={{ padding: '8px 0', borderBottom: idx < transactions.length - 1 ? '1px solid #eee' : 'none', fontSize: '10pt' }}>
                  Morador <strong>{t.fromName}</strong> deve transferir <strong>{formatCurrency(t.amount)}</strong> para <strong>{t.toName}</strong>.
                </div>
              ))}
            </div>
          )}

          {/* Quebra de página para os gráficos históricos comparativos */}
          <div style={{ pageBreakBefore: 'always', paddingTop: '2rem' }}>
            <h2 style={{ fontSize: '14pt', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '1.5rem' }}>
              4. Gráficos Comparativos Históricos (Últimos 3 Meses)
            </h2>
            <p style={{ fontSize: '9pt', color: '#666', marginBottom: '1.5rem' }}>
              O gráfico abaixo ilustra a evolução dos gastos e a divisão de categorias nos meses anteriores para acompanhamento financeiro da casa.
            </p>
            {/* Reusar o componente de gráficos que é SVG puro, assim imprime com vetor perfeito no PDF! */}
            <HistoryCharts history={history} />
          </div>

        </div>
      </div>
    </>
  );
}
