import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { ContaSidebar } from '@/components/conta/ContaSidebar';

export default async function ContaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login?redirect=/conta/perfil');

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 pt-16 sm:pt-20">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-text-main sm:text-3xl">
          Minha Conta
        </h1>
        <p className="mt-2 text-sm font-light text-text-muted">
          Gerencie seu perfil, contas vinculadas e segurança.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <ContaSidebar />
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}
