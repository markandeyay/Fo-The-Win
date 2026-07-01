import { Suspense } from "react";
import RacePlayClient from "./RacePlayClient";

export default function RacePlayPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center text-ftw-muted">
          Loading race...
        </main>
      }
    >
      <RacePlayClient />
    </Suspense>
  );
}
