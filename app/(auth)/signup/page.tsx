import { AuthPanel } from "@/components/auth/AuthPanel";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#3b1f06_0,#0b0f19_45%,#05070d_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <AuthPanel mode="signup" />
      </div>
    </main>
  );
}
