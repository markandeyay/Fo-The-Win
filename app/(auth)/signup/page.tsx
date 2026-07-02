import { AuthPanel } from "@/components/auth/AuthPanel";

export default function SignUpPage() {
  return (
    <main className="ftw-page-shell min-h-screen px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <AuthPanel mode="signup" />
      </div>
    </main>
  );
}
