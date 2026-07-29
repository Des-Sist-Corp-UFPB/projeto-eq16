/**
 * Iluminação de fundo (estilo vinheta) das páginas de listagem.
 * Reproduz as "orbes" borradas da home, na cor da persona:
 * ciano (jogador), rosa (equipe) ou roxo (admin). Fica atrás do conteúdo.
 */
const ORBES: Record<'cyan' | 'pink' | 'purple', [string, string, string]> = {
  cyan: ['bg-cyan/15', 'bg-cyan/10', 'bg-cyan/5'],
  pink: ['bg-pink-subtle/15', 'bg-pink-subtle/10', 'bg-pink-subtle/5'],
  purple: ['bg-purple-light/15', 'bg-purple-light/10', 'bg-purple-light/5'],
};

export function PageGlow({ accent }: { accent: 'cyan' | 'pink' | 'purple' }) {
  const [orb1, orb2, orb3] = ORBES[accent];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className={`absolute -left-40 -top-32 h-[420px] w-[420px] rounded-full ${orb1} blur-[150px]`} />
      <div className={`absolute -right-40 top-8 h-[380px] w-[380px] rounded-full ${orb2} blur-[150px]`} />
      <div className={`absolute -bottom-32 left-1/2 h-[320px] w-[520px] -translate-x-1/2 rounded-full ${orb3} blur-[160px]`} />
    </div>
  );
}
