import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { readDB, writeDB, Expense } from '@/lib/db';

// POST: Cadastra uma nova despesa
export async function POST(request: Request) {
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

    const { description, value, quantity, type } = await request.json();

    // Validações rigorosas de dados
    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'A identificação do gasto é obrigatória.' }, { status: 400 });
    }
    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      return NextResponse.json({ error: 'O valor deve ser um número positivo.' }, { status: 400 });
    }
    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0 || !Number.isInteger(numQty)) {
      return NextResponse.json({ error: 'A quantidade deve ser um número inteiro positivo.' }, { status: 400 });
    }
    const validTypes = ['comida', 'higiene', 'utilitários', 'outros'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Tipo de despesa inválido.' }, { status: 400 });
    }

    const house = db.houses[dbUser.houseId];
    if (!house) {
      return NextResponse.json({ error: 'Casa não encontrada.' }, { status: 404 });
    }

    const expenseId = 'e_' + Math.random().toString(36).substring(2, 11);

    const newExpense: Expense = {
      id: expenseId,
      userId: dbUser.id,
      userName: dbUser.name,
      description: description.trim(),
      value: numValue,
      quantity: numQty,
      type: type as any,
      date: new Date().toISOString(),
    };

    house.currentExpenses.push(newExpense);
    writeDB(db);

    return NextResponse.json(newExpense, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao cadastrar despesa: ' + error.message }, { status: 500 });
  }
}

// DELETE: Exclui uma despesa existente
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const expenseId = searchParams.get('id');

    if (!expenseId) {
      return NextResponse.json({ error: 'ID da despesa não fornecido.' }, { status: 400 });
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

    const expenseIndex = house.currentExpenses.findIndex((e) => e.id === expenseId);
    if (expenseIndex === -1) {
      return NextResponse.json({ error: 'Despesa não encontrada.' }, { status: 404 });
    }

    const expense = house.currentExpenses[expenseIndex];

    // Autorização: Apenas quem criou a despesa ou o ADMIN da casa pode deletar
    const isCreator = expense.userId === dbUser.id;
    const isAdmin = dbUser.role === 'ADMIN';

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Você não tem permissão para excluir esta despesa.' }, { status: 403 });
    }

    house.currentExpenses.splice(expenseIndex, 1);
    writeDB(db);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao excluir despesa: ' + error.message }, { status: 500 });
  }
}
