import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { readDB, writeDB, MonthlyHistory, Transaction } from '@/lib/db';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const db = readDB();
    const dbUser = db.users[user.email];

    if (!dbUser.houseId) {
      return NextResponse.json({ error: 'Você não faz parte de nenhuma casa.' }, { status: 400 });
    }

    const house = db.houses[dbUser.houseId];
    if (!house) {
      return NextResponse.json({ error: 'Casa não encontrada.' }, { status: 404 });
    }

    // Autorização: Apenas o ADMIN da casa pode fechar o mês
    if (dbUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas administradores podem fechar o mês.' }, { status: 403 });
    }

    const residents = Object.values(db.users).filter((u) => u.houseId === house.id);
    const N = residents.length;

    if (N === 0) {
      return NextResponse.json({ error: 'A casa não possui moradores para ratear despesas.' }, { status: 400 });
    }

    // Calcular o total gasto por morador
    const spentMap: Record<string, number> = {};
    residents.forEach((r) => {
      spentMap[r.id] = 0;
    });

    house.currentExpenses.forEach((exp) => {
      const expTotal = exp.value * exp.quantity;
      if (spentMap[exp.userId] !== undefined) {
        spentMap[exp.userId] += expTotal;
      } else {
        // Fallback de segurança caso o morador tenha sido removido/saído da casa
        spentMap[exp.userId] = expTotal;
      }
    });

    const totalSpent = Object.values(spentMap).reduce((sum, val) => sum + val, 0);
    const sharePerPerson = Number((totalSpent / N).toFixed(2));

    // Calcular o saldo individual (gasto - cota)
    const balances = residents.map((r) => {
      const spent = spentMap[r.id] || 0;
      return {
        id: r.id,
        name: r.name,
        balance: Number((spent - sharePerPerson).toFixed(2)),
      };
    });

    // Dividir em devedores (saldo negativo) e credores (saldo positivo)
    const debtors = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance); // devedores mais extremos primeiro
    const creditors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance); // credores que devem receber mais primeiro

    const transactions: Transaction[] = [];
    
    // Arrays mutáveis para o algoritmo guloso
    const tempDebtors = debtors.map((d) => ({ ...d }));
    const tempCreditors = creditors.map((c) => ({ ...c }));

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < tempDebtors.length && cIdx < tempCreditors.length) {
      const d = tempDebtors[dIdx];
      const c = tempCreditors[cIdx];

      // Quantidade a pagar é o mínimo entre o saldo devedor e credor
      const amountToPay = Math.min(-d.balance, c.balance);
      
      if (amountToPay > 0.01) {
        transactions.push({
          fromUser: d.id,
          fromUserName: d.name,
          toUser: c.id,
          toUserName: c.name,
          amount: Number(amountToPay.toFixed(2)),
        });
      }

      d.balance += amountToPay;
      c.balance -= amountToPay;

      if (Math.abs(d.balance) < 0.02) {
        dIdx++;
      }
      if (Math.abs(c.balance) < 0.02) {
        cIdx++;
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    const historyRecord: MonthlyHistory = {
      id: 'm_' + Math.random().toString(36).substring(2, 11),
      year,
      month,
      expenses: [...house.currentExpenses],
      totalSpent: Number(totalSpent.toFixed(2)),
      sharePerPerson,
      transactions,
    };

    // Salvar no histórico e limpar correntes
    house.history.push(historyRecord);
    house.currentExpenses = [];
    writeDB(db);

    return NextResponse.json(historyRecord, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao fechar o mês de despesas: ' + error.message }, { status: 500 });
  }
}
