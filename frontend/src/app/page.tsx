"use client";

import { useState } from "react";

export default function Home() {
  const [result, setResult] = useState<string>("");

  async function callHello() {
    setResult("Llamando al backend...");
    try {
      const res = await fetch("/api/hello", { cache: "no-store" });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResult("ERROR: " + (e?.message ?? String(e)));
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Bedrock Studio – MVP</h1>
      <p>Prueba: /api/hello (proxy hacia tu API Gateway)</p>

      <button onClick={callHello} style={{ padding: 8, marginTop: 16 }}>
        Llamar backend /api/hello
      </button>

      <pre style={{ marginTop: 16, background: "#f5f5f5", padding: 12 }}>
        {result || "Sin respuesta"}
      </pre>
    </main>
  );
}
