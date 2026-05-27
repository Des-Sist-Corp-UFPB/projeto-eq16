'use client';

import { MonthlyHistory } from '@/lib/db';

interface HistoryChartsProps {
  history: MonthlyHistory[];
}

export default function HistoryCharts({ history }: HistoryChartsProps) {
  // Obter os últimos 3 meses fechados em ordem cronológica
  const last3Months = [...history]
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })
    .slice(-3);

  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  const formatMonthLabel = (hist: MonthlyHistory) => {
    return `${monthNames[hist.month - 1]}/${String(hist.year).substring(2)}`;
  };

  // Garante que tenhamos pelo menos 3 posições para exibir no gráfico, mesmo que vazias
  const displayData = [...Array(3)].map((_, idx) => {
    // Alinha pela direita: se temos 1 item, fica na última posição, etc.
    const historyIndex = last3Months.length - (3 - idx);
    if (historyIndex >= 0 && last3Months[historyIndex]) {
      const data = last3Months[historyIndex];
      // Somar gastos por categoria neste mês do histórico
      const categoryTotals = { comida: 0, higiene: 0, utilitários: 0, outros: 0 };
      data.expenses.forEach((e) => {
        const total = e.value * e.quantity;
        if (categoryTotals[e.type] !== undefined) {
          categoryTotals[e.type] += total;
        } else {
          categoryTotals.outros += total;
        }
      });
      return {
        label: formatMonthLabel(data),
        total: data.totalSpent,
        categories: categoryTotals,
        empty: false,
      };
    }
    return {
      label: `Mês -${3 - idx}`,
      total: 0,
      categories: { comida: 0, higiene: 0, utilitários: 0, outros: 0 },
      empty: true,
    };
  });

  const maxSpent = Math.max(...displayData.map((d) => d.total), 100); // Evita divisão por zero
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  // Cores HSL correspondentes às badges para consistência visual
  const categoryColors = {
    comida: 'hsl(142, 70%, 45%)',      // Green
    higiene: 'hsl(190, 80%, 45%)',     // Blue/Cyan
    utilitários: 'hsl(48, 96%, 53%)',  // Amber
    outros: 'hsl(263, 70%, 65%)',     // Violet
  };

  return (
    <div className="glass-card" style={{ height: '100%' }}>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontFamily: 'var(--font-title)' }}>
        📊 Histórico & Comparativo (Últimos 3 Meses)
      </h2>

      {history.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 1rem',
          color: 'var(--text-muted)',
          fontSize: '0.95rem'
        }}>
          💡 Nenhum histórico disponível. Após fechar o primeiro mês, os gráficos comparativos aparecerão aqui!
        </div>
      ) : (
        <div className="print-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flexWrap: 'wrap' }}>
          
          {/* Gráfico 1: Evolução dos Gastos Totais */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Evolução do Gasto Total (R$)
            </h3>
            
            {/* SVG Bar Chart */}
            <div style={{ background: 'hsla(224, 71%, 3%, 0.3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem' }}>
              <svg viewBox="0 0 300 200" style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* Linhas de Grade e Eixo Y */}
                <line x1="40" y1="20" x2="40" y2="160" stroke="var(--border)" strokeWidth="1" />
                <line x1="40" y1="160" x2="280" y2="160" stroke="var(--border)" strokeWidth="1" />
                
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 160 - ratio * 130;
                  const val = maxSpent * ratio;
                  return (
                    <g key={idx}>
                      <line x1="40" y1={y} x2="280" y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                      <text x="35" y={y + 4} textAnchor="end" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-body)">
                        {formatCurrency(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Colunas */}
                {displayData.map((d, idx) => {
                  const colWidth = 40;
                  const colGap = 40;
                  const x = 70 + idx * (colWidth + colGap);
                  const barHeight = d.empty ? 5 : (d.total / maxSpent) * 130;
                  const y = 160 - barHeight;

                  return (
                    <g key={idx} style={{ transition: 'all 0.5s ease' }}>
                      {/* Gradiente sutil nas barras */}
                      <defs>
                        <linearGradient id={`barGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.4" />
                        </linearGradient>
                      </defs>

                      <rect
                        x={x}
                        y={y}
                        width={colWidth}
                        height={barHeight}
                        fill={d.empty ? 'var(--border)' : `url(#barGrad-${idx})`}
                        rx="4"
                        style={{ cursor: 'pointer' }}
                      />
                      
                      {!d.empty && (
                        <text x={x + colWidth / 2} y={y - 8} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--accent)" fontFamily="var(--font-body)">
                          {formatCurrency(d.total)}
                        </text>
                      )}

                      <text x={x + colWidth / 2} y="175" textAnchor="middle" fontSize="9" fontWeight="500" fill="var(--text-secondary)" fontFamily="var(--font-title)">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Gráfico 2: Divisão por Categorias */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Comparativo por Categorias (R$)
            </h3>
            
            {/* SVG Grouped Category Chart */}
            <div style={{ background: 'hsla(224, 71%, 3%, 0.3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem' }}>
              <svg viewBox="0 0 300 200" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <line x1="40" y1="20" x2="40" y2="160" stroke="var(--border)" strokeWidth="1" />
                <line x1="40" y1="160" x2="280" y2="160" stroke="var(--border)" strokeWidth="1" />

                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 160 - ratio * 130;
                  const val = maxSpent * ratio;
                  return (
                    <g key={idx}>
                      <line x1="40" y1={y} x2="280" y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                    </g>
                  );
                })}

                {/* Barras agrupadas por categoria (Comida, Higiene, Util., Outros) por Mês */}
                {displayData.map((d, idx) => {
                  const groupWidth = 60;
                  const groupGap = 20;
                  const startX = 55 + idx * (groupWidth + groupGap);
                  
                  const cats = ['comida', 'higiene', 'utilitários', 'outros'] as const;
                  const subBarWidth = 10;
                  const subBarGap = 2;

                  return (
                    <g key={idx}>
                      {cats.map((cat, catIdx) => {
                        const amount = d.categories[cat] || 0;
                        const barHeight = d.empty ? 2 : (amount / maxSpent) * 130;
                        const y = 160 - barHeight;
                        const x = startX + catIdx * (subBarWidth + subBarGap);

                        return (
                          <rect
                            key={cat}
                            x={x}
                            y={y}
                            width={subBarWidth}
                            height={barHeight}
                            fill={d.empty ? 'var(--border)' : categoryColors[cat]}
                            rx="1.5"
                          />
                        );
                      })}

                      <text x={startX + groupWidth / 2} y="175" textAnchor="middle" fontSize="9" fontWeight="500" fill="var(--text-secondary)" fontFamily="var(--font-title)">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              
              {/* Legenda do Gráfico */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.7rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: categoryColors.comida, borderRadius: '2px' }}></span>
                  <span style={{ color: 'var(--text-muted)' }}>Comida</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: categoryColors.higiene, borderRadius: '2px' }}></span>
                  <span style={{ color: 'var(--text-muted)' }}>Higiene</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: categoryColors.utilitários, borderRadius: '2px' }}></span>
                  <span style={{ color: 'var(--text-muted)' }}>Utilitários</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: categoryColors.outros, borderRadius: '2px' }}></span>
                  <span style={{ color: 'var(--text-muted)' }}>Outros</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
