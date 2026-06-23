/**
 * Iluminação de fundo (estilo vinheta) das páginas de listagem.
 * Reproduz as "orbes" borradas da home, na cor da persona:
 * ciano (jogador) ou rosa (equipe). Fica atrás do conteúdo.
 */
export function PageGlow({ accent }: { accent: 'cyan' | 'pink' }) {
  const isPink = accent === 'pink';
  const orb1 = isPink ? 'bg-pink-subtle/15' : 'bg-cyan/15';
  const orb2 = isPink ? 'bg-pink-subtle/10' : 'bg-cyan/10';
  const orb3 = isPink ? 'bg-pink-subtle/5' : 'bg-cyan/5';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className={`absolute -left-40 -top-32 h-[420px] w-[420px] rounded-full ${orb1} blur-[150px]`} />
      <div className={`absolute -right-40 top-8 h-[380px] w-[380px] rounded-full ${orb2} blur-[150px]`} />
      <div className={`absolute -bottom-32 left-1/2 h-[320px] w-[520px] -translate-x-1/2 rounded-full ${orb3} blur-[160px]`} />
    </div>
  );
}
