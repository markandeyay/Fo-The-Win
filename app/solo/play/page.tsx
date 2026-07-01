import { Suspense } from "react";
import SoloPlayClient from "./SoloPlayClient";

export default function SoloPlayPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center text-ftw-muted">
          Loading session...
        </main>
      }
    >
      <SoloPlayClient />
    </Suspense>
  );
}
