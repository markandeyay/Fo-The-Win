import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-4xl rounded-[2rem] border border-gray-800 bg-ftw-panel/80 p-8 text-center shadow-2xl shadow-black/30">
        <div className="mb-6 flex flex-wrap justify-center gap-3 text-sm text-ftw-muted">
          <Link href="/signin" className="hover:text-ftw-text">Sign in</Link>
          <Link href="/signup" className="hover:text-ftw-text">Sign up</Link>
          <Link href="/settings" className="hover:text-ftw-text">Settings</Link>
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight text-ftw-accent md:text-7xl">
          Fo The Win
        </h1>
        <p className="mt-4 text-lg text-ftw-muted">
          Competitive and solo math practice.
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
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
