"use client";

import { useState } from "react";

export default function Home() {
  const [result, setResult] = useState<string>("");

  async function callHello() {
    setResult("Llamando al backend...");
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      if (!base) throw new Error("Falta NEXT_PUBLIC_BACKEND_BASE_URL en Amplify");

      const res = await fetch(`${base}/hello`, { cache: "no-store" });
      const text = await res.text();
      setResult(text);
    } catch (e: any) {
      setResult("ERROR: " + (e?.message ?? String(e)));
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Bedrock Studio – MVP</h1>
      <p>Frontend estático (Amplify) + Backend (API Gateway + Lambda)</p>

      <button onClick={callHello} style={{ padding: 8, marginTop: 16 }}>
        Llamar backend /hello
      </button>

      <pre style={{ marginTop: 16, background: "#f5f5f5", padding: 12 }}>
        {result || "Sin respuesta"}
      </pre>
    </main>
  );
}
