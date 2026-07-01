import Link from "next/link";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";

export default function ProfilePage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm text-ftw-muted">
          <Link href="/" className="hover:text-ftw-text">Home</Link>
          <div className="flex gap-4">
            <Link href="/solo" className="hover:text-ftw-text">Solo</Link>
            <Link href="/settings" className="hover:text-ftw-text">Settings</Link>
            <Link href="/signin" className="hover:text-ftw-text">Sign in</Link>
          </div>
        </nav>
        <ProfileDashboard />
      </div>
    </main>
  );
}
