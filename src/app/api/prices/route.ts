import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const Query = z.string().trim().min(3).max(120);

type Result = { title: string; store: string; price: number; condition: string; shipping: string | null; url: string; match: number };
type SourceReport = { name: string; ok: boolean; count: number; reason?: string };
type MercadoLivreItem = { title: string; price: number; condition: string; permalink: string; seller?: { nickname?: string }; shipping?: { free_shipping?: boolean } };

const resultSchema = z.object({
  title: z.string().min(1),
  store: z.string().min(1),
  price: z.coerce.number().positive().max(1_000_000),
  condition: z.string().default("Não informado"),
  shipping: z.string().nullable().default(null),
  url: z.string().url().refine((value) => value.startsWith("https://"), "url must be https"),
});

const words = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\W+/).filter((word) => word.length > 1);
const score = (query: string, title: string) => { const queryWords = words(query); const titleWords = new Set(words(title)); return queryWords.filter((word) => titleWords.has(word)).length / Math.max(queryWords.length, 1); };

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}

/** Never let a source-specific failure leak the API key into the response. */
const safeReason = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/key=[^&\s]+/gi, "key=***").slice(0, 120);
};

// ---------------------------------------------------------------- cache + limit
// Both are per-instance only. Serverless recycles instances, so treat these as a
// courtesy layer that protects the free Gemini quota, not as a hard guarantee.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { at: number; body: unknown }>();

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  cache.delete(key); cache.set(key, hit); // refresh LRU position
  return hit.body;
}

function cacheSet(key: string, body: unknown) {
  cache.set(key, { at: Date.now(), body });
  while (cache.size > CACHE_MAX) { const oldest = cache.keys().next().value; if (oldest === undefined) break; cache.delete(oldest); }
}

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

// ---------------------------------------------------------------- sources
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

function rank(query: string, rows: z.infer<typeof resultSchema>[]): Result[] {
  const scored = rows.map((item) => ({ ...item, match: score(query, item.title) })).sort((a, b) => b.match - a.match || a.price - b.price);
  const relevant = scored.filter((item) => item.match >= 0.35);
  // The model sometimes paraphrases titles. Rather than answering "nothing found",
  // fall back to the best-scoring rows so the user still sees real offers.
  return (relevant.length > 0 ? relevant : scored).slice(0, 8);
}

/**
 * Google buries the useful part — which quota ran out, which model went away —
 * inside a nested error envelope. Pulling it up front makes the `sources` field
 * enough to diagnose a failure from one HTTP call, without echoing the key.
 */
async function describeError(response: Response) {
  const raw = (await response.text().catch(() => "")).replace(/\s+/g, " ");
  let out = raw;
  try {
    const body = JSON.parse(raw) as { error?: { message?: string; details?: Array<{ violations?: Array<{ quotaId?: string; quotaValue?: string }> }> } };
    const violations = body.error?.details?.flatMap((entry) => entry.violations ?? []) ?? [];
    const quota = violations.map((v) => [v.quotaId, v.quotaValue].filter(Boolean).join("=")).filter(Boolean).join(", ");
    out = `${body.error?.message ?? raw}${quota ? ` [${quota}]` : ""}`;
  } catch {
    // Not JSON (HTML error page, proxy blurb) — the raw text is the best we have.
  }
  return out.replace(/key=[^&\s]+/gi, "key=***").slice(0, 260);
}

const GEMINI_MODEL = "gemini-3.5-flash-lite";

function callGemini(model: string, key: string, prompt: string, grounded = true) {
  return fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(grounded ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: { temperature: 0.1 },
      }),
    },
    22_000,
  );
}

/**
 * A 429 from Google does not say which quota ran out. Asking the same model one
 * more time without the search tool splits the two cases that matter: if the
 * plain call succeeds the model is fine and only grounding is capped, which is
 * a different problem with a different fix.
 */
async function probeWithoutGrounding(model: string, key: string) {
  try {
    const response = await callGemini(model, key, "Responda apenas: ok", false);
    return response.ok ? "model-ok-grounding-capped" : `model-also-${response.status}`;
  } catch {
    return "probe-failed";
  }
}

async function searchWithGemini(query: string): Promise<{ results: Result[]; report: SourceReport }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { results: [], report: { name: "gemini-google-search", ok: false, count: 0, reason: "missing-key" } };

  const prompt = [
    `Pesquise na web ofertas brasileiras atuais para: ${query}.`,
    `Responda SOMENTE com JSON válido no formato {"results":[{"title":"","store":"","price":0,"condition":"Novo","shipping":null,"url":"https://..."}]}.`,
    `Inclua até 12 produtos realmente encontrados na busca, com a URL direta da oferta e o preço numérico em reais (sem "R$" e sem separador de milhar).`,
    `Nunca invente lojas, preços ou links.`,
  ].join(" ");

  try {
    let response = await callGemini(GEMINI_MODEL, key, prompt);
    // A retired model answers 404 and names its successor. Following that pointer
    // once keeps search alive through a retirement instead of going dark until
    // somebody notices and edits this file.
    if (response.status === 404) {
      const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ");
      const successor = detail.match(/models\/([a-z0-9.-]+)/gi)?.pop()?.replace(/^models\//i, "");
      if (!successor || successor === GEMINI_MODEL) {
        return { results: [], report: { name: "gemini-google-search", ok: false, count: 0, reason: `http-404 ${detail.slice(0, 200)}` } };
      }
      response = await callGemini(successor, key, prompt);
    }

    if (!response.ok) {
      const detail = await describeError(response);
      const probe = response.status === 429 ? ` | probe: ${await probeWithoutGrounding(GEMINI_MODEL, key)}` : "";
      return { results: [], report: { name: "gemini-google-search", ok: false, count: 0, reason: `http-${response.status} ${detail}${probe}` } };
    }

    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text) return { results: [], report: { name: "gemini-google-search", ok: false, count: 0, reason: "empty-candidate" } };

    const json = extractJson(text);
    if (!json) return { results: [], report: { name: "gemini-google-search", ok: false, count: 0, reason: "no-json-in-answer" } };

    const parsed = z.object({ results: z.array(resultSchema) }).safeParse(json);
    if (!parsed.success) return { results: [], report: { name: "gemini-google-search", ok: false, count: 0, reason: "schema-mismatch" } };

    const results = rank(query, parsed.data.results);
    return { results, report: { name: "gemini-google-search", ok: true, count: results.length } };
  } catch (error) {
    return { results: [], report: { name: "gemini-google-search", ok: false, count: 0, reason: safeReason(error) } };
  }
}

/**
 * Mercado Livre kept as a fallback on purpose, but their public search API has
 * been returning 403 for anonymous callers (every path, including /sites/MLB).
 * It stays wired so it starts working again the moment access is restored or an
 * app token is added — it just must never take the whole route down.
 */
async function searchMercadoLivre(query: string): Promise<{ results: Result[]; report: SourceReport }> {
  try {
    const response = await fetchWithTimeout(
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=24`,
      { headers: { "user-agent": "GabieWorld/1.0", accept: "application/json" }, cache: "no-store" },
      8_000,
    );
    if (!response.ok) return { results: [], report: { name: "mercado-livre-fallback", ok: false, count: 0, reason: `http-${response.status}` } };

    const data = (await response.json()) as { results?: MercadoLivreItem[] };
    const results = (data.results ?? [])
      .map((item) => ({
        title: item.title,
        store: item.seller?.nickname || "Mercado Livre",
        price: Number(item.price),
        condition: item.condition === "new" ? "Novo" : "Usado",
        shipping: item.shipping?.free_shipping ? "Frete grátis" : null,
        url: item.permalink,
        match: score(query, item.title),
      }))
      .filter((item) => item.price > 0 && item.url && item.match >= 0.45)
      .sort((a, b) => b.match - a.match || a.price - b.price)
      .slice(0, 8);
    return { results, report: { name: "mercado-livre-fallback", ok: true, count: results.length } };
  } catch (error) {
    return { results: [], report: { name: "mercado-livre-fallback", ok: false, count: 0, reason: safeReason(error) } };
  }
}

async function classify(query: string, results: Result[]) {
  const url = process.env.CLOUDFLARE_CLASSIFIER_URL;
  const secret = process.env.CLOUDFLARE_WORKER_SECRET;
  if (!url || !secret || results.length === 0) return results;
  try {
    const response = await fetchWithTimeout(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${secret}` }, body: JSON.stringify({ query, results }) }, 8_000);
    if (!response.ok) return results;
    return ((await response.json()) as { results?: Result[] }).results ?? results;
  } catch { return results; }
}

// ---------------------------------------------------------------- handler
export async function GET(request: NextRequest) {
  const parsed = Query.safeParse(request.nextUrl.searchParams.get("q"));
  if (!parsed.success) return NextResponse.json({ error: "Digite pelo menos 3 letras para buscar.", results: [] }, { status: 400 });
  const query = parsed.data;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Muitas buscas seguidas. Respira um pouquinho e tenta de novo.", results: [] }, { status: 429, headers: { "retry-after": "60" } });
  }

  const cacheKey = query.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json({ ...(cached as object), cached: true }, { headers: { "cache-control": "no-store" } });

  const sources: SourceReport[] = [];
  const gemini = await searchWithGemini(query);
  sources.push(gemini.report);

  let source = "gemini-google-search";
  let results = gemini.results;

  if (results.length === 0) {
    const meli = await searchMercadoLivre(query);
    sources.push(meli.report);
    if (meli.results.length > 0) { source = "mercado-livre-fallback"; results = meli.results; }
  }

  if (results.length === 0) {
    const geminiMissing = gemini.report.reason === "missing-key";
    const body = {
      query,
      source: "unavailable",
      searchedAt: new Date().toISOString(),
      results: [],
      sources,
      notice: geminiMissing
        ? "A busca de preços ainda não está ligada: falta configurar a chave do Gemini."
        : "Nenhuma oferta encontrada agora. Tenta escrever o modelo de outro jeito?",
    };
    // 200 on purpose: "no offers" is a normal outcome, not a server error.
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  }

  results = await classify(query, results);
  const body = { query, source, searchedAt: new Date().toISOString(), results, sources, cached: false };
  cacheSet(cacheKey, body);
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
