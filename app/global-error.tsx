"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: 24, fontFamily: "sans-serif" }}>
          <section style={{ maxWidth: 560, textAlign: "center" }}>
            <h1>FieldForce kon niet worden geladen</h1>
            <p>Probeer opnieuw. Als het probleem blijft terugkomen, meld je opnieuw aan.</p>
            <button type="button" onClick={reset}>Opnieuw proberen</button>
            <Link href="/login" style={{ marginLeft: 16 }}>Naar login</Link>
          </section>
        </main>
      </body>
    </html>
  );
}
