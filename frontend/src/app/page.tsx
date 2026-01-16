"use client";

import { useEffect, useMemo, useState } from "react";

type VersionItem = {
  sk: string;
  createdAt?: string;
  createdBy?: string;
  action?: string;
  text?: string;
  status?: string;
};

export default function Home() {
  const backend = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  const backendBase = (backend || "").replace(/\/+$/, "");

  const [contentId, setContentId] = useState<string>("");
  const [inputText, setInputText] = useState<string>(
    "Escribe aquí tu texto. Luego prueba Corregir o Resumir."
  );
  const [status, setStatus] = useState<string>("DRAFT");
  const [result, setResult] = useState<string>("");
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const canCall = useMemo(() => !!backend, [backend]);

  async function apiHello() {
    setError("");
    setResult("Llamando /hello...");
    try {
      if (!backend) throw new Error("Falta NEXT_PUBLIC_BACKEND_BASE_URL");
      const r = await fetch(`${backendBase}/hello`, { cache: "no-store" });
      const j = await r.text();
      setResult(j);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function loadContent(id: string) {
    setError("");
    try {
      if (!backend) throw new Error("Falta NEXT_PUBLIC_BACKEND_BASE_URL");
      const r = await fetch(`${backendBase}/content/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "load_failed");
      setVersions(j.versions || []);
      const st = j.latest?.status || "DRAFT";
      setStatus(st);
      // si hay versión, carga el último texto
      if (j.versions?.[0]?.text) setInputText(j.versions[0].text);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function runClaude(action: string) {
    setError("");
    setLoading(true);
    try {
      if (!backend) throw new Error("Falta NEXT_PUBLIC_BACKEND_BASE_URL");
      const r = await fetch(`${backendBase}/content/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          inputText,
          userEmail: "test@example.com",
          contentId: contentId || undefined,
        }),
      });
      let j: any = null;
      const text = await r.text();
      try { j = JSON.parse(text); } catch { /* ignore */ }
      
      if (!r.ok) {
        throw new Error(`HTTP_${r.status}: ${text}`);
      }
      if (!j?.ok) {
        throw new Error(j?.error ? `${j.error}: ${j.detail || ""}`.trim() : `generate_failed: ${text}`);
      }
      setContentId(j.contentId);
      setInputText(j.text || "");
      setStatus(j.status || "DRAFT");
      setResult(`OK: ${action}`);
      await loadContent(j.contentId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(newStatus: string) {
    setError("");
    setLoading(true);
    try {
      if (!backend) throw new Error("Falta NEXT_PUBLIC_BACKEND_BASE_URL");
      if (!contentId) throw new Error("Primero genera contenido (necesitas contentId)");
      const r = await fetch(`${backendBase}/content/${encodeURIComponent(contentId)}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "status_failed");
      setStatus(j.status);
      setResult(`Estado cambiado a ${j.status}`);
      await loadContent(contentId);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function revertTo(version: VersionItem) {
    if (version?.text) setInputText(version.text);
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 1000 }}>
      <h1>Bedrock Studio – MVP</h1>
<div
  style={{
    marginTop: 12,
    marginBottom: 16,
    padding: 12,
    background: "#fff7e6",
    border: "1px solid #ffd591",
    borderRadius: 6,
    fontSize: 14,
  }}
>
  ⚠️ <b>Aviso importante</b>: el modelo de IA no admite peticiones seguidas.
  <br />
  Tras cada acción (Resumir, Corregir, Variaciones…), espera{" "}
  <b>5–10 segundos</b> antes de lanzar otra petición para evitar errores.
</div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={apiHello} disabled={!canCall || loading} style={{ padding: 8 }}>
          Probar backend (/hello)
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <label>
          <b>contentId:</b>{" "}
          <input
            value={contentId}
            onChange={(e) => setContentId(e.target.value)}
            placeholder="Se rellena al generar"
            style={{ width: 360, padding: 6 }}
          />
        </label>
        <button
          onClick={() => contentId && loadContent(contentId)}
          disabled={!canCall || loading || !contentId}
          style={{ padding: 8 }}
        >
          Cargar historial
        </button>
        <span>
          <b>Estado:</b> {status}
        </span>
      </div>

      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        rows={10}
        style={{ width: "100%", padding: 10 }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button disabled={!canCall || loading} onClick={() => runClaude("summarize")} style={{ padding: 8 }}>
          Resumir
        </button>
        <button disabled={!canCall || loading} onClick={() => runClaude("expand")} style={{ padding: 8 }}>
          Expandir
        </button>
        <button disabled={!canCall || loading} onClick={() => runClaude("fix")} style={{ padding: 8 }}>
          Corregir
        </button>
        <button disabled={!canCall || loading} onClick={() => runClaude("variations")} style={{ padding: 8 }}>
          Variaciones (3)
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button disabled={loading || !contentId} onClick={() => changeStatus("DRAFT")} style={{ padding: 8 }}>
          DRAFT
        </button>
        <button disabled={loading || !contentId} onClick={() => changeStatus("IN_REVIEW")} style={{ padding: 8 }}>
          IN_REVIEW
        </button>
        <button disabled={loading || !contentId} onClick={() => changeStatus("APPROVED")} style={{ padding: 8 }}>
          APPROVED
        </button>
        <button disabled={loading || !contentId} onClick={() => changeStatus("PUBLISHED")} style={{ padding: 8 }}>
          PUBLISHED
        </button>
      </div>

      {loading && (
        <p style={{ marginTop: 12 }}>
          Procesando… recuerda esperar unos segundos entre peticiones.
        </p>
      )}
      {result && <pre style={{ marginTop: 12, background: "#f5f5f5", padding: 12 }}>{result}</pre>}
      {error && <pre style={{ marginTop: 12, background: "#fff0f0", padding: 12 }}>{error}</pre>}

      <h2 style={{ marginTop: 24 }}>Historial (últimas 20 versiones)</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {versions.map((v) => (
          <div key={v.sk} style={{ border: "1px solid #ddd", padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <b>{v.action}</b> — <span>{v.createdAt}</span>
              </div>
              <button onClick={() => revertTo(v)} style={{ padding: 6 }}>
                Revertir a esta versión
              </button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{v.text}</pre>
          </div>
        ))}
        {versions.length === 0 && <p>No hay versiones aún.</p>}
      </div>
    </main>
  );
}
