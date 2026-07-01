import Link from "next/link";
import { SettingsForm } from "@/components/profile/SettingsForm";

export default function SettingsPage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm text-ftw-muted">
          <Link href="/" className="hover:text-ftw-text">Home</Link>
          <div className="flex gap-4">
            <Link href="/profile" className="hover:text-ftw-text">Profile</Link>
            <Link href="/solo" className="hover:text-ftw-text">Solo</Link>
          </div>
        </nav>
        <SettingsForm />
      </div>
    </main>
  );
}
