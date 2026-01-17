"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const API_BASE = "https://fdlyaer6g6.execute-api.us-east-1.amazonaws.com";

/**
 * Cognito Hosted UI
 * Tu requisito: al “cerrar sesión” quieres limpiar cliente y redirigir a /login.
 */
const COGNITO_DOMAIN =
  "https://iep-bedrock-studio-803443341700.auth.us-east-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "1k1atbtrk6kivft5geoic5i9bj";
const APP_BASE_URL = "https://main.d2ggbldh6tpspj.amplifyapp.com";
const REDIRECT_URI = `${APP_BASE_URL}/`;

function buildCognitoLoginUrl() {
  const u = new URL(`${COGNITO_DOMAIN}/login`);
  u.searchParams.set("client_id", COGNITO_CLIENT_ID);
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "email openid phone profile");
  return u.toString();
}

function clearClientSession() {
  try {
    localStorage.clear();
  } catch {}
  try {
    sessionStorage.clear();
  } catch {}

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
    document.cookie = `${name}=; Max-Age=0; path=${location.pathname}; samesite=lax`;
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

async function fetchJsonOrThrow<T = any>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const r = await fetch(url, init);
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
    neutral: {
      bg: "rgba(255,255,255,0.08)",
      border: "rgba(255,255,255,0.14)",
      color: UI.text2,
    },
    primary: {
      bg: "rgba(99,102,241,0.18)",
      border: "rgba(99,102,241,0.40)",
      color: "rgba(209,213,255,0.95)",
    },
    success: {
      bg: "rgba(34,197,94,0.15)",
      border: "rgba(34,197,94,0.35)",
      color: "rgba(187,255,210,0.95)",
    },
    danger: {
      bg: "rgba(239,68,68,0.16)",
      border: "rgba(239,68,68,0.40)",
      color: "rgba(255,205,205,0.95)",
    },
    warning: {
      bg: "rgba(245,158,11,0.18)",
      border: "rgba(245,158,11,0.40)",
      color: "rgba(255,236,196,0.95)",
    },
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

function buttonStyle(
  variant: "primary" | "secondary" | "ghost",
  disabled?: boolean
): CSSProperties {
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
    transition:
      "transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease",
  };

  if (variant === "primary") {
    return {
      ...base,
      color: "white",
      background:
        "linear-gradient(135deg, rgba(99,102,241,0.95), rgba(168,85,247,0.90))",
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
  // Backend “texto”
  const backend = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "";
  const backendBase = useMemo(() => stripTrailingSlashes(backend), [backend]);
  const canCall = !!backendBase;

  const [tab, setTab] = useState<TabKey>("images");
  const [authError, setAuthError] = useState<string | null>(null);


  // Auth / grupos
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const isCreator =
    userGroups.includes("designers") || userGroups.includes("writers");
  const isApprover = userGroups.includes("approvers");

  // Workflow board
  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    null
  );
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
  const [inputText, setInputText] = useState<string>(
    "Escribe aquí tu texto. Luego prueba Corregir o Resumir."
  );
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

  // ✅ SOLO UNO: “logout” = limpiar y redirigir a /login (como pediste)
  const logout = useCallback(() => {
    clearClientSession();
    window.location.assign(buildCognitoLoginUrl());
  }, []);

  /**
   * =========================
   * Auth: obtener grupos
   * =========================
   */
  useEffect(() => {
  let alive = true;
  setAuthLoading(true);
  setAuthError(null);

  (async () => {
    try {
      const r = await fetch(`${API_BASE}/me`, { cache: "no-store" });

      // ✅ Si no está autorizado, lo reflejamos en UI
      if (!r.ok) {
        if (r.status === 401) throw new Error("401");
        if (r.status === 403) throw new Error("403");
        throw new Error(`HTTP_${r.status}`);
      }

      const j = await r.json();

      if (!alive) return;
      setUserGroups(j?.ok && Array.isArray(j.groups) ? j.groups : []);
    } catch (e: any) {
      if (!alive) return;

      setUserGroups([]);

      if (e?.message === "401") setAuthError("No autenticado (401). Inicia sesión.");
      else if (e?.message === "403") setAuthError("Acceso denegado (403). No tienes permisos.");
      else setAuthError("Error de autenticación. Revisa sesión o conexión.");
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
    <div style={{ color: UI.text3, fontSize: 12, lineHeight: 1.4 }}>
      {children}
    </div>
  );

  const SectionTitle = ({
    title,
    right,
  }: {
    title: string;
    right?: ReactNode;
  }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 950,
          letterSpacing: -0.2,
          color: UI.text,
        }}
      >
        {title}
      </div>
      {right}
    </div>
  );

  // ----------------- Gallery -----------------
  const refreshGallery = useCallback(async () => {
    try {
      const j: any = await fetchJsonOrThrow(`${API_BASE}/image/recent`, {
        cache: "no-store",
      });
      if (j?.ok) setGallery(j.images || []);
    } catch {}
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

      if (!j?.ok)
        throw new Error(
          j?.detail || j?.message || j?.error || "generate_failed"
        );

      setLastImageUrl(j.url);
      await refreshGallery();
    } catch (e: any) {
      setImgError(e?.message || "generate_failed");
    } finally {
      setImgLoading(false);
    }
  }, [imgPrompt, imgStyle, refreshGallery]);

  // ----------------- Backend helpers -----------------
  const loadContent = useCallback(
    async (id: string) => {
      setError("");
      try {
        requireBackend();
        const j: any = await fetchJsonOrThrow(
          `${backendBase}/content/${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );

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

        if (!j?.ok)
          throw new Error(
            j?.error ? `${j.error}: ${j.detail || ""}`.trim() : "generate_failed"
          );

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

  const changeContentStatus = useCallback(
    async (newStatus: Status) => {
      setError("");
      setLoading(true);
      try {
        requireBackend();
        if (!contentId)
          throw new Error("Primero genera contenido (necesitas contentId)");

        const j: any = await fetchJsonOrThrow(
          `${backendBase}/content/${encodeURIComponent(contentId)}/status`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          }
        );

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

  // ----------------- Workflow board -----------------
  const loadByStatus = useCallback(async (st: Status) => {
    const j: any = await fetchJsonOrThrow(
      `${API_BASE}/content/by-status?status=${st}`,
      { cache: "no-store" }
    );
    if (j?.ok)
      setByStatus((prev) => ({
        ...prev,
        [st]: (j.items || []) as ByStatusItem[],
      }));
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

  const changeStatus = useCallback(
    async (id: string, nextStatus: Status) => {
      setStatusError(null);
      try {
        const j: any = await fetchJsonOrThrow(
          `${API_BASE}/content/${encodeURIComponent(id)}/status`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          }
        );

        if (!j?.ok)
          throw new Error(j?.error || j?.message || "status_change_failed");

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
    if (currentStatus === "DRAFT")
      return { next: "IN_REVIEW" as Status, label: "Enviar a revisión" };
    if (currentStatus === "IN_REVIEW")
      return { next: "APPROVED" as Status, label: "Aprobar" };
    if (currentStatus === "APPROVED")
      return { next: "PUBLISHED" as Status, label: "Publicar" };
    return null;
  }, [selectedContentId, currentStatus]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: PAGE_BG,
        color: UI.text,
      }}
    >
      {/* ... el resto de tu JSX no necesita cambios ... */}
      {/* Solo asegúrate de que el botón use el logout único: onClick={logout} */}
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
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
    <button
      onClick={() => window.location.assign(buildCognitoLoginUrl())}
      style={buttonStyle("secondary", false)}
    >
      Iniciar sesión
    </button>
  </div>
)}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {authLoading ? (
              <span style={badgeStyle("neutral")}>Cargando permisos…</span>
            ) : (
              <>
                <span style={badgeStyle(isCreator ? "success" : "neutral")}>
                  Creator: {isCreator ? "sí" : "no"}
                </span>
                <span style={badgeStyle(isApprover ? "success" : "neutral")}>
                  Approver: {isApprover ? "sí" : "no"}
                </span>
              </>
            )}

            <button
              onClick={logout}
              style={buttonStyle("ghost", false)}
              title="Cerrar sesión"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Aquí pegarías el resto de tu UI tal cual la tenías */}
      </div>
    </main>
  );
}
