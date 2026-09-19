import Link from "next/link";
import { Logo } from "./logo";

/**
 * Shared shell for the privacy and terms pages. They are plain reading material,
 * so they stay outside the app shell: no tab bar, no state, just text.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 md:px-8">
        <Link href="/" aria-label="Voltar para o Gabie World"><Logo /></Link>
        <Link href="/" className="press rounded-full bg-[var(--neutral)] px-4 py-2 text-sm font-bold text-[var(--primary)]">Voltar</Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 md:px-8">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-[var(--subtle)]">Atualizado em {updated}</p>
        <div className="legal mt-8">{children}</div>
        <p className="mt-12 border-t border-[var(--border-soft)] pt-6 text-sm text-[var(--muted)]">
          Dúvidas? Escreva para <a href="mailto:emailgg00@gmail.com" className="font-bold text-[var(--primary)]">emailgg00@gmail.com</a>.
        </p>
      </main>
    </div>
  );
}
