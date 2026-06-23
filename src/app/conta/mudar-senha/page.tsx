import { redirect } from 'next/navigation';

// A troca de senha agora vive em Segurança. Mantém o link antigo funcionando.
export default function MudarSenhaRedirect() {
  redirect('/conta/seguranca');
}
