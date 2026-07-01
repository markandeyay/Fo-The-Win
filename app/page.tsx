import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-5xl font-extrabold tracking-tight text-ftw-accent">
        Fo The Win
      </h1>
      <p className="text-ftw-muted text-lg">
        Competitive and solo math practice.
      </p>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <Link
          href="/solo"
          className="rounded-xl bg-ftw-panel border border-ftw-accent px-8 py-4 text-center font-semibold hover:bg-ftw-accent hover:text-ftw-dark transition"
        >
          Solo
        </Link>
        <Link
          href="/party"
          className="rounded-xl bg-ftw-panel border border-ftw-info px-8 py-4 text-center font-semibold hover:bg-ftw-info hover:text-white transition"
        >
          Multiplayer
        </Link>
        <Link
          href="/race"
          className="rounded-xl bg-ftw-panel border border-ftw-success px-8 py-4 text-center font-semibold hover:bg-ftw-success hover:text-ftw-dark transition"
        >
          Speed Race
        </Link>
        <Link
          href="/profile"
          className="rounded-xl bg-ftw-panel border border-ftw-muted px-8 py-4 text-center font-semibold hover:bg-ftw-muted hover:text-ftw-dark transition"
        >
          Profile
        </Link>
      </div>
    </main>
  );
}
