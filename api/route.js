export const runtime = "nodejs";
export const maxDuration = 30;

const REPO = process.env.GITHUB_REPO;
const PAT  = process.env.GITHUB_PAT;

const SUPA = process.env.SUPABASE_URL;
const SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supaHeaders = {
  apikey: SRK,
  Authorization: `Bearer ${SRK}`,
  "Content-Type": "application/json",
};

async function dispatch(eventType, payload) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `token ${PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event_type: eventType, client_payload: payload }),
  });
  if (!res.ok) throw new Error(`dispatch ${eventType}: ${await res.text()}`);
}

export async function POST(request) {
  try {
    const { action, url, format_id, job_id } = await request.json();

    if (!url || !/^https?:\/\//i.test(url)) {
      return Response.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (action === "info") {
      const r = await fetch(`${SUPA}/rest/v1/download_jobs`, {
        method: "POST",
        headers: { ...supaHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ url, status: "pending" }),
      });
      const [row] = await r.json();
      await dispatch("web-dl-info", { job_id: row.id });
      return Response.json({ job_id: row.id });
    }

    if (action === "download") {
      if (!job_id || !format_id) {
        return Response.json({ error: "Missing job_id/format_id" }, { status: 400 });
      }
      await fetch(`${SUPA}/rest/v1/download_jobs?id=eq.${job_id}`, {
        method: "PATCH",
        headers: supaHeaders,
        body: JSON.stringify({ status: "downloading", format_id }),
      });
      await dispatch("web-dl-download", { job_id, format_id });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("job_id");
  if (!id) return Response.json({ error: "Missing job_id" }, { status: 400 });

  const r = await fetch(
    `${SUPA}/rest/v1/download_jobs?id=eq.${id}&select=*`,
    { headers: supaHeaders }
  );
  const [row] = await r.json();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}
