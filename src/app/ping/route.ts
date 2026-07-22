import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function GET() {
  const now = new Date();
  const timestamp = now.toISOString().split('.')[0] + 'Z';

  try {
    // SELECT vazio: não lê tabela nenhuma, só confirma que o banco responde.
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    // Detalhe do erro fica no log; a resposta pública não expõe infra.
    console.error('[ping] banco não respondeu:', err);
    return NextResponse.json(
      { status: 'error', service: 'eq16', database: 'error', timestamp },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  }

  return NextResponse.json(
    { status: 'ok', service: 'eq16', database: 'ok', timestamp },
    {
      status: 200,
      headers: CORS_HEADERS,
    }
  );
}

export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}