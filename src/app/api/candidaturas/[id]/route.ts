import { NextRequest, NextResponse } from 'next/server';
import { getSessionOrUnauthorized } from '@/lib/apiAuth';
import { aceitarCandidatura, recusarCandidatura, CandidaturaError } from '@/lib/candidaturas';

// PATCH /api/candidaturas/[id] — capitão aceita ou recusa ({ acao: 'aceitar' | 'recusar' }).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;
  const isAdmin = session!.user.role === 'ADMIN';

  let acao: string;
  try {
    ({ acao } = await req.json());
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida' }, { status: 400 });
  }

  try {
    if (acao === 'aceitar') {
      return NextResponse.json(await aceitarCandidatura(id, session!.user.id, isAdmin));
    }
    if (acao === 'recusar') {
      return NextResponse.json(await recusarCandidatura(id, session!.user.id, isAdmin));
    }
    return NextResponse.json({ erro: 'Ação inválida' }, { status: 400 });
  } catch (e) {
    if (e instanceof CandidaturaError) {
      return NextResponse.json({ erro: e.message }, { status: e.status });
    }
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}
