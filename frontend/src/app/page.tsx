"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://fdlyaer6g6.execute-api.us-east-1.amazonaws.com";

type ImgStyle = "realista" | "anime" | "oleo";

type VersionItem = {
  sk: string;
  createdAt?: string;
  createdBy?: string;
  action?: string;
  text?: string;
  status?: string;
};

type GalleryItem = { key: string; url: string };

const WARNING_BOX_STYLE: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 16,
  padding: 12,
  background: "#fff7e6",
  border: "1px solid #ffd591",
  borderRadius: 6,
  fontSize: 14,
};

export default function Home() {
  // Backend base (Claude + DDB)
  const backend = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  const backendBase = (backend || "").replace(/\/+$/, "");
  const canCall = useMemo(() => !!backend, [backend]);

  // Content states
  const [contentId, setContentId] = useState<string>("");
  const [inputText, setInputText] = useState<string>(
    "Escribe aquí tu texto. Luego prueba Corregir o Resumir."
  );
  const [status, setStatus] = useState<string>("DRAFT");
  const [result, setResult] = useState<string>("");
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Image states
  const [imgPrompt, setImgPrompt] = useState<string>("");
  const [imgStyle, setImgStyle] = useState<ImgStyle>("realista");
  const [imgLoading, setImgLoading] = useState<boolean>(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  // ----------------- Helpers -----------------
  async function safeJson<T = any>(r: Response): Promise<T | null> {
    const raw = await r.text();
    try {
      return JSON.parse(raw) as T;
    } catch {
      // para depuración, devuelve null y el caller decide
      return null;
    }
  }

  function requireBackend() {
    if (!backend) throw new Error("Falta NEXT_PUBLIC_BACKEND_BASE_URL");
  }

  // ----------------- Gallery -----------------
  async function refreshGallery() {
    try {
      const r = await fetch(`${API_BASE}/image/recent`, { cache: "no-store" });
      const j: any = await r.json();
      if (j?.ok) setGallery(j.images || []);
    } catch {
      // no bloqueamos UI por galería
    }
  }

  useEffect(() => {
    refreshGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------- Image generation -----------------
  async function generateImage() {
    setImgError(null);
    setImgLoading(true);

    try {
      const r = await fetch(`${API_BASE}/image/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt, style: imgStyle }),
      });

      const raw = await r.text();
      let j: any = null;
      try {
        j = JSON.parse(raw);
      } catch {
        // ignore
      }

      if (!r.ok || !j?.ok) {
        throw new Error(j?.detail || j?.message || j?.error || raw || "generate_failed");
      }

      setLastImageUrl(j.url);
      await refreshGallery();
    } catch (e: any) {
      setImgError(e?.message || "generate_failed");
    } finally {
      setImgLoading(false);
    }
  }

  // ----------------- Backend: hello -----------------
  async function apiHello() {
    setError("");
    setResult("Llamando /hello...");

    try {
      requireBackend();
      const r = await fetch(`${backendBase}/hello`, { cache: "no-store" });
      const t = await r.text();
      setResult(t);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  // ----------------- Backend: load content -----------------
  async function loadContent(id: string) {
    setError("");

    try {
      requireBackend();

      const r = await fetch(`${backendBase}/content/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });

      const j: any = await r.json();
      if (!j.ok) throw new Error(j.error || "load_failed");

      setVersions(j.versions || []);
      const st = j.latest?.status || "DRAFT";
      setStatus(st);

      // si hay versión, carga el último texto (orden viene del backend: más reciente primero)
      if (j.versions?.[0]?.text) setInputText(j.versions[0].text);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  // ----------------- Backend: generate (Claude) -----------------
  async function runClaude(action: string) {
    setError("");
    setLoading(true);

    try {
      requireBackend();

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

      const text = await r.text();
      let j: any = null;
      try {
        j = JSON.parse(text);
      } catch {
        // ignore
      }

      if (!r.ok) throw new Error(`HTTP_${r.status}: ${text}`);
      if (!j?.ok) {
        throw new Error(
          j?.error ? `${j.error}: ${j.detail || ""}`.trim() : `generate_failed: ${text}`
        );
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

  // ----------------- Backend: status change -----------------
  async function changeStatus(newStatus: string) {
    setError("");
    setLoading(true);

    try {
      requireBackend();
      if (!contentId) throw new Error("Primero genera contenido (necesitas contentId)");

      const r = await fetch(`${backendBase}/content/${encodeURIComponent(contentId)}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const j: any = await r.json();
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

  // ----------------- UI -----------------
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 1000 }}>
      <h1>Bedrock Studio – MVP</h1>

      <div style={WARNING_BOX_STYLE}>
        ⚠️ <b>Aviso importante</b>: el modelo de IA no admite peticiones seguidas.
        <br />
        Tras cada acción (Resumir, Corregir, Variaciones…), espera <b>5–10 segundos</b> antes de
        lanzar otra petición para evitar errores.
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
        <p style={{ marginTop: 12 }}>Procesando… recuerda esperar unos segundos entre peticiones.</p>
      )}
      {result && <pre style={{ marginTop: 12, background: "#f5f5f5", padding: 12 }}>{result}</pre>}
      {error && <pre style={{ marginTop: 12, background: "#fff0f0", padding: 12 }}>{error}</pre>}

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Generación de imágenes (Titan)</h2>

      <div style={WARNING_BOX_STYLE}>
        ⚠️ <b>Aviso</b>: evita lanzar peticiones seguidas. Espera <b>5–10 segundos</b> entre
        generaciones para evitar saturación.
      </div>

      <div style={{ display: "grid", gap: 12, maxWidth: 900 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Prompt (descripción)</div>
          <input
            value={imgPrompt}
            onChange={(e) => setImgPrompt(e.target.value)}
            placeholder='Ej: "un robot simpático en una oficina moderna"'
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Estilo</div>
          <select
            value={imgStyle}
            onChange={(e) => setImgStyle(e.target.value as ImgStyle)}
            style={{ width: 220, padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="realista">Realista</option>
            <option value="anime">Anime</option>
            <option value="oleo">Óleo</option>
          </select>
        </label>

        <button
          onClick={generateImage}
          disabled={imgLoading || !imgPrompt.trim()}
          style={{
            width: 220,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #222",
            background: imgLoading ? "#ddd" : "#111",
            color: "#fff",
            cursor: imgLoading ? "not-allowed" : "pointer",
          }}
        >
          {imgLoading ? "Generando..." : "Generar imagen"}
        </button>

        {imgError && <div style={{ color: "crimson" }}>Error: {imgError}</div>}

        {lastImageUrl && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Última imagen</div>
            <a href={lastImageUrl} target="_blank" rel="noreferrer">
              Abrir / Descargar
            </a>
            <div style={{ marginTop: 10 }}>
              <img
                src={lastImageUrl}
                alt="Última imagen generada"
                style={{
                  maxWidth: 520,
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
              />
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Galería (últimas)</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {gallery.map((it) => (
              <div key={it.key} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 8 }}>
                <a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                  Abrir / Descargar
                </a>
                <div style={{ marginTop: 8 }}>
                  <img src={it.url} alt={it.key} style={{ width: "100%", borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
