import { NextRequest, NextResponse } from 'next/server';
import { verifyInteractionSignature, handleInteraction } from '@/lib/discordInteractions';

// Roda no runtime Node (padrão das Route Handlers) — necessário para a verificação
// Ed25519 com o módulo `crypto`.

// POST /api/discord/interactions — webhook de interações do Discord (botões).
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');

  // Precisamos do corpo CRU (bytes exatos) para conferir a assinatura — por isso
  // lemos como texto antes de qualquer parse.
  const rawBody = await req.text();

  if (!verifyInteractionSignature({ rawBody, signature, timestamp })) {
    return new NextResponse('invalid request signature', { status: 401 });
  }

  let interaction: unknown;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new NextResponse('bad request', { status: 400 });
  }

  const resposta = await handleInteraction(interaction as Parameters<typeof handleInteraction>[0]);
  return NextResponse.json(resposta);
}
