import Link from "next/link";

const modeTiles = [
  {
    href: "/solo",
    label: "Solo",
    kicker: "Practice route",
    metric: "10",
    metricLabel: "default rounds",
  },
  {
    href: "/party",
    label: "Multiplayer",
    kicker: "Party arena",
    metric: "8",
    metricLabel: "player rooms",
  },
  {
    href: "/race",
    label: "Speed Race",
    kicker: "Multiplication sprint",
    metric: "60",
    metricLabel: "second sprint",
  },
  {
    href: "/profile",
    label: "Profile",
    kicker: "Progress ledger",
    metric: "1200",
    metricLabel: "start rating",
  },
];

export default function Home() {
  return (
    <main className="ftw-page-shell min-h-screen px-5 py-8 text-ftw-text md:px-8 md:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl content-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(28rem,1fr)] lg:gap-12">
        <section className="rounded-ftw border border-ftw-line bg-ftw-panel p-7 shadow-ftw shadow-ftw-inset md:p-10">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div className="ftw-label text-ftw-accent">Fo The Win</div>
            <nav className="flex flex-wrap gap-2 text-sm font-semibold text-ftw-muted" aria-label="Account navigation">
              <Link href="/signin" className="rounded-full px-3 py-2 transition hover:bg-ftw-accent hover:text-ftw-panel focus-visible:bg-ftw-accent focus-visible:text-ftw-panel">Sign in</Link>
              <Link href="/signup" className="rounded-full px-3 py-2 transition hover:bg-ftw-accent hover:text-ftw-panel focus-visible:bg-ftw-accent focus-visible:text-ftw-panel">Sign up</Link>
              <Link href="/settings" className="rounded-full px-3 py-2 transition hover:bg-ftw-accent hover:text-ftw-panel focus-visible:bg-ftw-accent focus-visible:text-ftw-panel">Settings</Link>
            </nav>
          </div>

          <div className="max-w-3xl">
            <h1 className="ftw-display text-7xl text-ftw-text md:text-8xl lg:text-9xl">
              Fo The Win
            </h1>
          </div>

          <div className="mt-10 grid gap-3 border-t border-ftw-line pt-6 sm:grid-cols-3">
            <Stat value="98" label="topic leaves" />
            <Stat value="14,700" label="validated problems" />
            <Stat value="500" label="base points" />
          </div>
        </section>

        <section className="grid gap-4">
          {modeTiles.map((mode) => (
            <Link
              key={mode.href}
              href={mode.href}
              className="group grid rounded-ftw-sm border border-ftw-line bg-ftw-raised p-5 shadow-ftw-sm transition duration-200 hover:-translate-y-0.5 hover:border-ftw-accent hover:shadow-ftw focus-visible:-translate-y-0.5 focus-visible:border-ftw-accent md:grid-cols-[1fr_auto] md:items-end md:p-6"
            >
              <span>
                <span className="ftw-label text-ftw-muted transition group-hover:text-ftw-accent">
                  {mode.kicker}
                </span>
                <span className="mt-2 block font-serif text-3xl font-semibold leading-tight tracking-[-0.03em] text-ftw-text md:text-4xl">
                  {mode.label}
                </span>
              </span>
              <span className="mt-5 rounded-2xl border border-ftw-line bg-ftw-canvas px-4 py-3 text-left md:mt-0 md:text-right">
                <span className="ftw-tabular block text-2xl font-black text-ftw-accent">
                  {mode.metric}
                </span>
                <span className="ftw-label text-ftw-muted">{mode.metricLabel}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="ftw-tabular text-3xl font-black text-ftw-text">{value}</div>
      <div className="ftw-label mt-1 text-ftw-muted">{label}</div>
    </div>
  );
}
