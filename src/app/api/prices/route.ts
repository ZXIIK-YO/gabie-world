import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const Query = z.string().trim().min(3).max(120);
type Result = { title: string; store: string; price: number; condition: string; shipping: string | null; url: string; match: number };
type MercadoLivreItem = { title: string; price: number; condition: string; permalink: string; seller?: { nickname?: string }; shipping?: { free_shipping?: boolean } };
const resultSchema = z.object({ title: z.string().min(1), store: z.string().min(1), price: z.coerce.number().positive(), condition: z.string().default("Não informado"), shipping: z.string().nullable().default(null), url: z.string().url() });

const words = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\W+/).filter((word) => word.length > 1);
const score = (query: string, title: string) => { const queryWords = words(query); const titleWords = new Set(words(title)); return queryWords.filter((word) => titleWords.has(word)).length / Math.max(queryWords.length, 1); };

async function classify(query: string, results: Result[]) {
  const url = process.env.CLOUDFLARE_CLASSIFIER_URL;
  const secret = process.env.CLOUDFLARE_WORKER_SECRET;
  if (!url || !secret || results.length === 0) return results;
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${secret}` }, body: JSON.stringify({ query, results }) });
    if (!response.ok) return results;
    return ((await response.json()) as { results?: Result[] }).results ?? results;
  } catch { return results; }
}

async function searchWithGemini(query: string): Promise<Result[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Pesquise na web ofertas brasileiras atuais para: ${query}. Retorne SOMENTE JSON válido no formato {"results":[{"title":"","store":"","price":0,"condition":"Novo ou Usado","shipping":null,"url":"https://..."}]}. Inclua até 12 produtos realmente encontrados, use a URL direta da oferta, preço numérico em reais e nunca invente dados.` }] }],
      tools: [{ google_search: {} }], generationConfig: { temperature: 0.1 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini ${response.status}`);
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  const parsed = z.object({ results: z.array(resultSchema) }).safeParse(JSON.parse(json));
  if (!parsed.success) return [];
  return parsed.data.results.map((item) => ({ ...item, match: score(query, item.title) })).filter((item) => item.match >= 0.35).sort((a, b) => b.match - a.match || a.price - b.price).slice(0, 8);
}

async function searchMercadoLivre(query: string): Promise<Result[]> {
  const response = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=24`, { headers: { "user-agent": "GabieWorld/1.0" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Mercado Livre ${response.status}`);
  const data = (await response.json()) as { results?: MercadoLivreItem[] };
  return (data.results ?? []).map((item) => ({ title: item.title, store: item.seller?.nickname || "Mercado Livre", price: Number(item.price), condition: item.condition === "new" ? "Novo" : "Usado", shipping: item.shipping?.free_shipping ? "Frete grátis" : null, url: item.permalink, match: score(query, item.title) })).filter((item) => item.price > 0 && item.url && item.match >= 0.45).sort((a, b) => b.match - a.match || a.price - b.price).slice(0, 8);
}

export async function GET(request: NextRequest) {
  const parsed = Query.safeParse(request.nextUrl.searchParams.get("q"));
  if (!parsed.success) return NextResponse.json({ error: "Busca inválida" }, { status: 400 });
  const query = parsed.data;
  try {
    let source = "gemini-google-search";
    let results = await searchWithGemini(query);
    if (results.length === 0) { source = "mercado-livre-fallback"; results = await searchMercadoLivre(query); }
    results = await classify(query, results);
    return NextResponse.json({ query, source, searchedAt: new Date().toISOString(), results }, { headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ error: "As fontes gratuitas não responderam agora.", results: [] }, { status: 502 }); }
}
