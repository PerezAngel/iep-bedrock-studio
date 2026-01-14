export const runtime = "nodejs";

export async function GET() {
  const base = process.env.BACKEND_BASE_URL;
  if (!base) {
    return new Response(JSON.stringify({ ok: false, error: "BACKEND_BASE_URL not set" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const res = await fetch(`${base}/hello`, { cache: "no-store" });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
