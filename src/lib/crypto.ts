import crypto from 'crypto';

/**
 * Cifragem simétrica (AES-256-GCM) para guardar os tokens OAuth do Discord no banco.
 *
 * A chave é derivada de `DISCORD_TOKEN_ENC_KEY` (recomendado) ou, na ausência dela,
 * de `NEXTAUTH_SECRET`. Em ambos os casos um SHA-256 garante 32 bytes.
 *
 * Formato do payload: `ivHex:authTagHex:cipherHex`.
 */

function getKey(): Buffer {
  const secret = process.env.DISCORD_TOKEN_ENC_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'Defina DISCORD_TOKEN_ENC_KEY (ou ao menos NEXTAUTH_SECRET) para cifrar os tokens do Discord.'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Payload cifrado em formato inválido.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
