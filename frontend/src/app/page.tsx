"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const API_BASE = "https://fdlyaer6g6.execute-api.us-east-1.amazonaws.com";

/**
 * Cognito Hosted UI (Implicit flow)
 * - Login: response_type=token => vuelve con #id_token=...
 * - Logout real: /logout + client_id + logout_uri
 *
 * IMPORTANTE:
 * - REDIRECT_URI debe estar en Allowed callback URLs (Cognito)
 * - LOGOUT_URI debe estar en Allowed sign-out URLs (Cognito)
 */
const COGNITO_DOMAIN =
  "https://iep-bedrock-studio-803443341700.auth.us-east-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "1k1atbtrk6kivft5geoic5i9bj";
const APP_BASE_URL = "https://main.d2ggbldh6tpspj.amplifyapp.com";
const REDIRECT_URI = `${APP_BASE_URL}/`;
const LOGOUT_URI = `${APP_BASE_URL}/`;

function buildCognitoLoginUrl() {
  const u = new URL(`${COGNITO_DOMAIN}/login`);
  u.searchParams.set("client_id", COGNITO_CLIENT_ID);
  u.searchParams.set("response_type", "token"); // implicit
  u.searchParams.set("scope", "email openid phone");
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  return u.toString();
}

function buildCognitoLogoutUrl() {
  const u = new URL(`${COGNITO_DOMAIN}/logout`);
  u.searchParams.set("client_id", COGNITO_CLIENT_ID);
  u.searchParams.set("logout_uri", LOGOUT_URI);
  return u.toString();
}

function saveTokenFromHash() {
  if (typeof window === "undefined") return;

  const hash = window.location.hash; // #id_token=...&access_token=...&...
  if (!hash || !hash.startsWith("#")) return;

  const params = new URLSearchParams(hash.slice(1));
  const idToken = params.get("id_token");

  if (idToken) {
    localStorage.setItem("id_token", idToken);
    // limpia la URL para que no quede el token visible
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function getIdToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("id_token");
}

function clearClientSession() {
  try {
    localStorage.removeItem("id_token");
  } catch {}

  try {
    sessionStorage.clear();
  } catch {}

  // Cookies “típicas” (best-effort). HttpOnly no se pueden borrar por JS.
  const cookies = [
    "CognitoIdentityServiceProvider",
    "CognitoIdentityServiceProvider." + COGNITO_CLIENT_ID,
    "amplify-signin-with-hostedUI",
    "csrfToken",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
  ];

  const parts = document.cookie.split(";").map((c) => c.trim());
  const existingNames = parts.map((p) => p.split("=")[0]).filter(Boolean);

  for (const name of [...cookies, ...existingNames]) {
    document.cookie = `${name}=; Max-Age=0; path=/; samesite=lax`;
  }
}

/* ------------------------------ Tipos ------------------------------ */
type ImgStyle = "realista" | "anime" | "oleo";
type Status = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED";

type VersionItem = {
  sk: string;
  createdAt?: string;
  createdBy?: string;
  action?: string;
  text?: string;
  status?: string;
};

type GalleryItem = { key: string; url: string };
type ByStatusItem = { contentId: string; versionId?: string; sk?: string };

const STATUSES: Status[] = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED"];

function stripTrailingSlashes(s: string) {
  return (s || "").replace(/\/+$/, "");
}

async function fetchJsonOrThrow<T = any>(url: string, init?: RequestInit): Promise<T> {
  const token = getIdToken();

  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const r = await fetch(url, { ...init, headers });
  const raw = await r.text();

  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // Respuesta no JSON
  }

  if (!r.ok) {
    const msg =
      parsed?.message ||
      parsed?.error ||
      parsed?.detail ||
      (raw ? String(raw).slice(0, 300) : "");
    throw new Error(`HTTP_${r.status}${msg ? `: ${msg}` : ""}`);
  }

  return (parsed ?? (raw as any)) as T;
}

/* ------------------------------ UI tokens ------------------------------ */
type Tone = "neutral" | "primary" | "danger" | "success" | "warning";

const UI = {
  bg: "#0b1020",
  surface: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.12)",
  text: "rgba(255,255,255,0.92)",
  text2: "rgba(255,255,255,0.72)",
  text3: "rgba(255,255,255,0.55)",
  shadow: "0 18px 55px rgba(0,0,0,0.35)",
  radius: 16,
};

const PAGE_BG =
  "radial-gradient(1200px 800px at 20% 0%, rgba(99,102,241,0.35), transparent 55%)," +
  "radial-gradient(900px 600px at 85% 20%, rgba(168,85,247,0.25), transparent 55%)," +
  "radial-gradient(900px 600px at 50% 100%, rgba(34,197,94,0.12), transparent 55%)," +
  UI.bg;

function badgeStyle(tone: Tone): CSSProperties {
  const map: Record<Tone, { bg: string; border: string; color: string }> = {
    neutral: { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.14)", color: UI.text2 },
    primary: { bg: "rgba(99,102,241,0.18)", border: "rgba(99,102,241,0.40)", color: "rgba(209,213,255,0.95)" },
    success: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.35)", color: "rgba(187,255,210,0.95)" },
    danger: { bg: "rgba(239,68,68,0.16)", border: "rgba(239,68,68,0.40)", color: "rgba(255,205,205,0.95)" },
    warning: { bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.40)", color: "rgba(255,236,196,0.95)" },
  };
  const c = map[tone];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${c.border}`,
    background: c.bg,
    color: c.color,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  };
}

function buttonStyle(variant: "primary" | "secondary" | "ghost", disabled?: boolean): CSSProperties {
  const base: CSSProperties = {
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid transparent",
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: 0.2,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    userSelect: "none",
    transition: "transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease",
  };

  if (variant === "primary") {
    return {
      ...base,
      color: "white",
      background: "linear-gradient(135deg, rgba(99,102,241,0.95), rgba(168,85,247,0.90))",
      borderColor: "rgba(255,255,255,0.14)",
      boxShadow: "0 12px 30px rgba(99,102,241,0.18)",
    };
  }
  if (variant === "secondary") {
    return {
      ...base,
      color: UI.text,
      background: "rgba(255,255,255,0.08)",
      borderColor: "rgba(255,255,255,0.14)",
    };
  }
  return {
    ...base,
    color: UI.text2,
    background: "transparent",
    borderColor: "rgba(255,255,255,0.14)",
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${UI.border}`,
    background: "rgba(0,0,0,0.25)",
    color: UI.text,
    outline: "none",
  };
}

function softCardStyle(): CSSProperties {
  return {
    borderRadius: UI.radius,
    border: `1px solid ${UI.border}`,
    background: UI.surface,
    boxShadow: UI.shadow,
  };
}

function statusTone(s: Status): Tone {
  if (s === "PUBLISHED") return "success";
  if (s === "APPROVED") return "primary";
  return "neutral";
}

type TabKey = "editor" | "workflow" | "images" | "history";

export default function Home() {
  // Backend “texto” (lambda de contenido). Mantengo tu patrón env var.
  const backend = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
  const backendBase = useMemo(() => stripTrailingSlashes(backend), [backend]);
  const canCall = !!backendBase;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [tab, setTab] = useState<TabKey>("images");

  // Auth / grupos
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const isCreator = userGroups.includes("designers") || userGroups.includes("writers");
  const isApprover = userGroups.includes("approvers");

  // Workflow board
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState<boolean>(false);
  const [byStatus, setByStatus] = useState<Record<Status, ByStatusItem[]>>({
    DRAFT: [],
    IN_REVIEW: [],
    APPROVED: [],
    PUBLISHED: [],
  });

  // Content states (editor)
  const [contentId, setContentId] = useState<string>("");
  const [inputText, setInputText] = useState<string>("Escribe aquí tu texto. Luego prueba Corregir o Resumir.");
  const [status, setStatus] = useState<Status>("DRAFT");
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

  const requireBackend = useCallback(() => {
    if (!backendBase) throw new Error("Falta NEXT_PUBLIC_BACKEND_BASE_URL");
  }, [backendBase]);

  // ✅ Logout real: limpia cliente y redirige a Cognito /logout
  const logout = useCallback(() => {
    clearClientSession();
    window.location.assign(buildCognitoLogoutUrl());
  }, []);

  /**
   * =========================
   * Auth: obtener grupos (con token)
   * =========================
   */
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("code")) {
      console.warn("Has vuelto con ?code=. Estás usando Authorization Code. Usa login con response_type=token.");
    }

    let alive = true;
    setAuthLoading(true);
    setAuthError(null);

    // ✅ Captura id_token al volver de Cognito
    saveTokenFromHash();

    (async () => {
      try {
        const token = getIdToken();
        if (!token) {
          setUserGroups([]);
          setAuthError("No autenticado. Falta token. Inicia sesión.");
          return;
        }

        const j: any = await fetchJsonOrThrow(`${API_BASE}/me`, { cache: "no-store" });

        if (!alive) return;
        setUserGroups(j?.ok && Array.isArray(j.groups) ? j.groups : []);
      } catch (e: any) {
        if (!alive) return;

        const msg = String(e?.message || "");
        if (msg.startsWith("HTTP_401")) setAuthError("No autenticado (401). Inicia sesión.");
        else if (msg.startsWith("HTTP_403")) setAuthError("Acceso denegado (403). No tienes permisos.");
        else setAuthError(msg || "Error de autenticación.");

        setUserGroups([]);
      } finally {
        if (!alive) return;
        setAuthLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const SubtleHint = ({ children }: { children: ReactNode }) => (
    <div style={{ color: UI.text3, fontSize: 12, lineHeight: 1.4 }}>{children}</div>
  );

  const SectionTitle = ({ title, right }: { title: string; right?: ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: -0.2, color: UI.text }}>{title}</div>
      {right}
    </div>
  );

  // ----------------- Gallery -----------------
  const refreshGallery = useCallback(async () => {
    try {
      const j: any = await fetchJsonOrThrow(`${API_BASE}/image/recent`, { cache: "no-store" });
      if (j?.ok) setGallery(j.images || []);
    } catch {
      // no bloqueamos UI
    }
  }, []);

  useEffect(() => {
    refreshGallery();
  }, [refreshGallery]);

  // ----------------- Image generation -----------------
  const generateImage = useCallback(async () => {
    setImgError(null);
    setImgLoading(true);
    try {
      const j: any = await fetchJsonOrThrow(`${API_BASE}/image/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt, style: imgStyle }),
      });

      if (!j?.ok) throw new Error(j?.detail || j?.message || j?.error || "generate_failed");

      setLastImageUrl(j.url);
      await refreshGallery();
    } catch (e: any) {
      setImgError(e?.message || "generate_failed");
    } finally {
      setImgLoading(false);
    }
  }, [imgPrompt, imgStyle, refreshGallery]);

  // ----------------- Backend: load content -----------------
  const loadContent = useCallback(
    async (id: string) => {
      setError("");
      try {
        requireBackend();
        const j: any = await fetchJsonOrThrow(`${backendBase}/content/${encodeURIComponent(id)}`, { cache: "no-store" });

        if (!j.ok) throw new Error(j.error || "load_failed");

        setVersions(j.versions || []);
        const st: Status = j.latest?.status || "DRAFT";
        setStatus(st);

        if (j.versions?.[0]?.text) setInputText(j.versions[0].text);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    },
    [backendBase, requireBackend]
  );

  // ----------------- Backend: generate (Claude) -----------------
  const runClaude = useCallback(
    async (action: string) => {
      setError("");
      setLoading(true);
      try {
        requireBackend();

        const j: any = await fetchJsonOrThrow(`${backendBase}/content/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            inputText,
            userEmail: "test@example.com",
            contentId: contentId || undefined,
          }),
        });

        if (!j?.ok) throw new Error(j?.error ? `${j.error}: ${j.detail || ""}`.trim() : "generate_failed");

        setContentId(j.contentId);
        setInputText(j.text || "");
        setStatus((j.status as Status) || "DRAFT");
        setResult(`OK: ${action}`);

        await loadContent(j.contentId);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    },
    [backendBase, requireBackend, inputText, contentId, loadContent]
  );

  // ----------------- Backend: status change (editor) -----------------
  const changeContentStatus = useCallback(
    async (newStatus: Status) => {
      setError("");
      setLoading(true);
      try {
        requireBackend();
        if (!contentId) throw new Error("Primero genera contenido (necesitas contentId)");

        const j: any = await fetchJsonOrThrow(`${backendBase}/content/${encodeURIComponent(contentId)}/status`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!j.ok) throw new Error(j.error || "status_failed");

        setStatus(j.status as Status);
        setResult(`Estado cambiado a ${j.status}`);
        await loadContent(contentId);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    },
    [backendBase, requireBackend, contentId, loadContent]
  );

  const revertTo = useCallback((version: VersionItem) => {
    if (version?.text) setInputText(version.text);
  }, []);

  // ----------------- Workflow board (by status) -----------------
  const loadByStatus = useCallback(async (st: Status) => {
    const j: any = await fetchJsonOrThrow(`${API_BASE}/content/by-status?status=${st}`, { cache: "no-store" });
    if (j?.ok) setByStatus((prev) => ({ ...prev, [st]: (j.items || []) as ByStatusItem[] }));
  }, []);

  const refreshAllStatuses = useCallback(async () => {
    setStatusError(null);
    setBoardLoading(true);
    try {
      await Promise.all(STATUSES.map((st) => loadByStatus(st)));
    } catch (e: any) {
      setStatusError(e?.message || "board_refresh_failed");
    } finally {
      setBoardLoading(false);
    }
  }, [loadByStatus]);

  // Board: cambiar estado (botones workflow)
  const changeStatus = useCallback(
    async (id: string, nextStatus: Status) => {
      setStatusError(null);
      try {
        const j: any = await fetchJsonOrThrow(`${API_BASE}/content/${encodeURIComponent(id)}/status`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!j?.ok) throw new Error(j?.error || j?.message || "status_change_failed");

        setSelectedContentId(id);
        setCurrentStatus(nextStatus);
        await refreshAllStatuses();
      } catch (e: any) {
        setStatusError(e?.message || "status_change_failed");
      }
    },
    [refreshAllStatuses]
  );

  useEffect(() => {
    refreshAllStatuses();
  }, [refreshAllStatuses]);

  const nextActionLabel = useMemo(() => {
    if (!selectedContentId || !currentStatus) return null;
    if (currentStatus === "DRAFT") return { next: "IN_REVIEW" as Status, label: "Enviar a revisión" };
    if (currentStatus === "IN_REVIEW") return { next: "APPROVED" as Status, label: "Aprobar" };
    if (currentStatus === "APPROVED") return { next: "PUBLISHED" as Status, label: "Publicar" };
    return null;
  }, [selectedContentId, currentStatus]);

  // ✅ Evita mismatch SSR/CSR y errores tipo "mounted"
  if (!mounted) {
    return (
      <main style={{ minHeight: "100vh", padding: 24, background: PAGE_BG, color: UI.text }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>Cargando…</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: PAGE_BG, color: UI.text }}>
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background: ${UI.bg};
        }
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
        .appGrid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
        }
        .imgControlsGrid {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 12px;
          align-items: end;
        }
        .tabRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        @media (max-width: 980px) {
          .appGrid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 820px) {
          .imgControlsGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 950, letterSpacing: -0.2 }}>
              IEP - Caso Práctico 3 - Pérez Suárez, Ángel M.
            </div>
          </div>

          {/* Roles (debug visual) + Logout/Login */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {authLoading ? (
              <span style={badgeStyle("neutral")}>Cargando permisos…</span>
            ) : (
              <>
                <span style={badgeStyle(isCreator ? "success" : "neutral")}>Creator: {isCreator ? "sí" : "no"}</span>
                <span style={badgeStyle(isApprover ? "success" : "neutral")}>Approver: {isApprover ? "sí" : "no"}</span>
              </>
            )}

            {getIdToken() ? (
              <button onClick={logout} style={buttonStyle("ghost", false)} title="Cerrar sesión">
                Cerrar sesión
              </button>
            ) : (
              <button
                onClick={() => window.location.assign(buildCognitoLoginUrl())}
                style={buttonStyle("secondary", false)}
                title="Iniciar sesión"
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>

        {/* Banner auth error visible */}
        {authError && (
          <div
            style={{
              ...softCardStyle(),
              padding: 12,
              marginBottom: 14,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.10)",
              color: "rgba(255,214,214,0.95)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900 }}>{authError}</div>
            <button onClick={() => window.location.assign(buildCognitoLoginUrl())} style={buttonStyle("secondary", false)}>
              Iniciar sesión
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="tabRow" style={{ marginBottom: 14 }}>
          {(
            [
              { key: "editor", label: "Editor" },
              { key: "workflow", label: "Workflow" },
              { key: "images", label: "Imágenes" },
              { key: "history", label: "Historial" },
            ] as { key: TabKey; label: string }[]
          ).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  ...buttonStyle(active ? "primary" : "ghost", false),
                  padding: "9px 12px",
                  transform: active ? "translateY(-1px)" : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Aviso */}
        <div
          style={{
            ...softCardStyle(),
            padding: 14,
            marginBottom: 16,
            border: "1px solid rgba(245,158,11,0.55)",
            background:
              "linear-gradient(180deg, rgba(245,158,11,0.22), rgba(239,68,68,0.10)), rgba(255,255,255,0.04)",
            boxShadow: "0 18px 55px rgba(245,158,11,0.10)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 14 }}>⚠️ Ritmo de peticiones (IMPORTANTE)</div>
              <div style={{ marginTop: 6, color: "rgba(255,244,214,0.95)", fontSize: 13, lineHeight: 1.45 }}>
                Evita disparar acciones seguidas. Entre llamadas al modelo espera <b>5–10s</b>. Si fuerzas el API, fallará.
              </div>
              {!canCall && (
                <div style={{ marginTop: 10 }}>
                  <span style={badgeStyle("danger")}>Falta NEXT_PUBLIC_BACKEND_BASE_URL</span>
                  <div style={{ marginTop: 6, color: UI.text3, fontSize: 12 }}>
                    Sin backend no podrás generar texto ni cargar historial del editor.
                  </div>
                </div>
              )}
            </div>
            <span style={badgeStyle("warning")}>No spamear el endpoint</span>
          </div>
        </div>

        {/* Botones de transición por rol */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {currentStatus === "DRAFT" && selectedContentId && isCreator && (
            <button
              style={buttonStyle("primary", boardLoading)}
              onClick={() => changeStatus(selectedContentId, "IN_REVIEW")}
              disabled={boardLoading}
            >
              Enviar a revisión
            </button>
          )}

          {currentStatus === "IN_REVIEW" && selectedContentId && isApprover && (
            <button
              style={buttonStyle("primary", boardLoading)}
              onClick={() => changeStatus(selectedContentId, "APPROVED")}
              disabled={boardLoading}
            >
              Aprobar
            </button>
          )}

          {currentStatus === "APPROVED" && selectedContentId && isApprover && (
            <button
              style={buttonStyle("primary", boardLoading)}
              onClick={() => changeStatus(selectedContentId, "PUBLISHED")}
              disabled={boardLoading}
            >
              Publicar
            </button>
          )}

          {selectedContentId && currentStatus && !authLoading && !isCreator && !isApprover && (
            <span style={badgeStyle("danger")}>No tienes permisos para cambiar estado</span>
          )}
        </div>

        <div className="appGrid">
          {/* Left panel */}
          <aside style={{ ...softCardStyle(), padding: 14 }}>
            <SectionTitle title="Contenido" right={<span style={badgeStyle(statusTone(status))}>{status}</span>} />

            <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              <span style={{ color: UI.text2, fontSize: 12, fontWeight: 900 }}>contentId</span>
              <input
                value={contentId}
                onChange={(e) => setContentId(e.target.value)}
                placeholder="Se rellena al generar"
                style={inputStyle()}
              />
              <SubtleHint>Usa “Cargar historial” si ya tienes un contentId.</SubtleHint>
            </label>

            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => contentId && loadContent(contentId)}
                disabled={!canCall || loading || !contentId}
                style={buttonStyle("secondary", !canCall || loading || !contentId)}
              >
                Cargar historial
              </button>

              <button
                onClick={() => {
                  setResult("");
                  setError("");
                }}
                style={buttonStyle("ghost", false)}
              >
                Limpiar mensajes
              </button>
            </div>

            <SectionTitle title="Acciones (Claude)" />
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button disabled={!canCall || loading} onClick={() => runClaude("summarize")} style={buttonStyle("primary", !canCall || loading)}>
                  Resumir
                </button>
                <button disabled={!canCall || loading} onClick={() => runClaude("expand")} style={buttonStyle("secondary", !canCall || loading)}>
                  Expandir
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button disabled={!canCall || loading} onClick={() => runClaude("fix")} style={buttonStyle("secondary", !canCall || loading)}>
                  Corregir
                </button>
                <button disabled={!canCall || loading} onClick={() => runClaude("variations")} style={buttonStyle("ghost", !canCall || loading)}>
                  Variaciones
                </button>
              </div>
            </div>

            <div style={{ height: 14 }} />

            <SectionTitle title="Estado (Editor)" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {STATUSES.map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    disabled={loading || !contentId || !canCall}
                    onClick={() => changeContentStatus(s)}
                    style={{ ...buttonStyle(active ? "primary" : "secondary", loading || !contentId || !canCall), padding: "10px 10px" }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 14, color: UI.text3, fontSize: 12 }}>{loading ? "Procesando…" : "Listo."}</div>
          </aside>

          {/* Right panel */}
          <section style={{ display: "grid", gap: 16 }}>
            {tab === "editor" && (
              <div style={{ ...softCardStyle(), padding: 14 }}>
                <SectionTitle title="Editor de texto" right={<span style={badgeStyle("neutral")}>{inputText.length} chars</span>} />

                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={14}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 14,
                    border: `1px solid ${UI.border}`,
                    background: "rgba(0,0,0,0.25)",
                    color: UI.text,
                    outline: "none",
                    lineHeight: 1.5,
                    resize: "vertical",
                    fontSize: 14,
                  }}
                />

                {(result || error) && (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {result && (
                      <div style={{ borderRadius: 14, border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.10)", padding: 12, color: "rgba(209,255,225,0.95)", fontSize: 13 }}>
                        <div style={{ fontWeight: 950, marginBottom: 6 }}>Resultado</div>
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "inherit" }}>{result}</pre>
                      </div>
                    )}

                    {error && (
                      <div style={{ borderRadius: 14, border: "1px solid rgba(239,68,68,0.30)", background: "rgba(239,68,68,0.12)", padding: 12, color: "rgba(255,214,214,0.95)", fontSize: 13 }}>
                        <div style={{ fontWeight: 950, marginBottom: 6 }}>Error</div>
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "inherit" }}>{error}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "workflow" && (
              <div style={{ ...softCardStyle(), padding: 14 }}>
                <SectionTitle
                  title="Workflow (Kanban)"
                  right={
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {statusError && <span style={badgeStyle("danger")}>Error: {statusError}</span>}
                      <button onClick={refreshAllStatuses} disabled={boardLoading} style={buttonStyle("secondary", boardLoading)}>
                        {boardLoading ? "Actualizando..." : "Refrescar"}
                      </button>
                    </div>
                  }
                />

                {selectedContentId && currentStatus && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={badgeStyle("primary")}>Seleccionado: {selectedContentId}</span>
                    <span style={badgeStyle(statusTone(currentStatus))}>Estado: {currentStatus}</span>
                    {nextActionLabel && (
                      <button
                        onClick={() => changeStatus(selectedContentId, nextActionLabel.next)}
                        disabled={!selectedContentId || boardLoading}
                        style={buttonStyle("primary", !selectedContentId || boardLoading)}
                      >
                        {nextActionLabel.label}
                      </button>
                    )}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                  {STATUSES.map((st) => (
                    <div key={st} style={{ borderRadius: 14, border: `1px solid ${UI.border}`, background: "rgba(0,0,0,0.18)", padding: 10, minHeight: 260, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={badgeStyle(statusTone(st))}>{st}</span>
                        <span style={{ color: UI.text3, fontSize: 12, fontWeight: 900 }}>{byStatus[st].length}</span>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        {byStatus[st].map((it) => {
                          const active = it.contentId === selectedContentId;
                          return (
                            <button
                              key={`${it.contentId}-${it.versionId || it.sk || st}`}
                              onClick={() => {
                                setSelectedContentId(it.contentId);
                                setCurrentStatus(st);
                              }}
                              title={it.contentId}
                              style={{
                                textAlign: "left",
                                borderRadius: 12,
                                padding: "10px 10px",
                                border: `1px solid ${active ? "rgba(99,102,241,0.45)" : UI.border}`,
                                background: active ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.06)",
                                color: UI.text,
                                cursor: "pointer",
                                minWidth: 0,
                              }}
                            >
                              <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: 0.2 }}>contentId</div>
                              <div style={{ fontSize: 12, color: UI.text2, marginTop: 4, wordBreak: "break-all" }}>{it.contentId}</div>
                            </button>
                          );
                        })}

                        {byStatus[st].length === 0 && (
                          <div style={{ color: UI.text3, fontSize: 12, padding: 10, borderRadius: 12, border: `1px dashed ${UI.border}` }}>— vacío —</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "images" && (
              <div style={{ ...softCardStyle(), padding: 14 }}>
                <SectionTitle title="Generación de imágenes" right={<span style={badgeStyle("neutral")}>Titan</span>} />

                <div className="imgControlsGrid">
                  <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                    <span style={{ color: UI.text2, fontSize: 12, fontWeight: 900 }}>Prompt</span>
                    <input
                      value={imgPrompt}
                      onChange={(e) => setImgPrompt(e.target.value)}
                      placeholder='Ej: "un robot simpático en una oficina moderna"'
                      style={inputStyle()}
                    />
                    <SubtleHint>Cuanto más específico (luz, cámara, contexto), mejor.</SubtleHint>
                  </label>

                  <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                    <span style={{ color: UI.text2, fontSize: 12, fontWeight: 900 }}>Estilo</span>
                    <select
                      value={imgStyle}
                      onChange={(e) => setImgStyle(e.target.value as ImgStyle)}
                      style={{ ...inputStyle(), cursor: "pointer" }}
                    >
                      <option value="realista">Realista</option>
                      <option value="anime">Anime</option>
                      <option value="oleo">Óleo</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={generateImage} disabled={imgLoading || !imgPrompt.trim()} style={buttonStyle("primary", imgLoading || !imgPrompt.trim())}>
                    {imgLoading ? "Generando…" : "Generar imagen"}
                  </button>
                  {imgError && <span style={badgeStyle("danger")}>{imgError}</span>}
                  <span style={badgeStyle("warning")}>Espera 5–10s entre generaciones</span>
                </div>

                {lastImageUrl && (
                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <span style={badgeStyle("primary")}>Última imagen</span>
                      <a
                        href={lastImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "rgba(209,213,255,0.95)", fontSize: 13, fontWeight: 950, textDecoration: "none" }}
                      >
                        Abrir / Descargar
                      </a>
                    </div>

                    <img
                      src={lastImageUrl}
                      alt="Última imagen generada"
                      style={{ width: "100%", maxWidth: 720, borderRadius: 16, border: `1px solid ${UI.border}`, boxShadow: UI.shadow }}
                    />
                  </div>
                )}

                <div style={{ marginTop: 18 }}>
                  <SectionTitle title="Galería" right={<span style={badgeStyle("neutral")}>{gallery.length} items</span>} />

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
                    {gallery.map((it) => (
                      <div key={it.key} style={{ borderRadius: 16, border: `1px solid ${UI.border}`, background: "rgba(255,255,255,0.06)", padding: 10 }}>
                        <a href={it.url} target="_blank" rel="noreferrer" style={{ color: UI.text2, fontSize: 12, fontWeight: 950, textDecoration: "none" }}>
                          Abrir / Descargar
                        </a>
                        <img src={it.url} alt={it.key} style={{ width: "100%", borderRadius: 12, marginTop: 10, border: `1px solid ${UI.border}` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "history" && (
              <div style={{ ...softCardStyle(), padding: 14 }}>
                <SectionTitle title="Historial (últimas 20 versiones)" right={<span style={badgeStyle("neutral")}>{versions.length}</span>} />

                <div style={{ display: "grid", gap: 10 }}>
                  {versions.map((v) => (
                    <div key={v.sk} style={{ borderRadius: 16, border: `1px solid ${UI.border}`, background: "rgba(255,255,255,0.06)", padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={{ fontWeight: 950, fontSize: 13 }}>
                            {v.action || "—"} <span style={{ color: UI.text3, fontWeight: 900, marginLeft: 6 }}>{v.createdAt || ""}</span>
                          </div>
                          {v.status && <span style={badgeStyle(statusTone(v.status as Status))}>{v.status}</span>}
                        </div>

                        <button onClick={() => revertTo(v)} style={buttonStyle("secondary", false)}>
                          Revertir
                        </button>
                      </div>

                      <pre style={{ whiteSpace: "pre-wrap", marginTop: 10, color: UI.text2, fontSize: 13, lineHeight: 1.45 }}>{v.text}</pre>
                    </div>
                  ))}

                  {versions.length === 0 && (
                    <div style={{ color: UI.text3, fontSize: 13, padding: 12, borderRadius: 14, border: `1px dashed ${UI.border}` }}>
                      No hay versiones aún.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
