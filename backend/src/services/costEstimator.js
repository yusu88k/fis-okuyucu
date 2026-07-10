// Maliyet tahmini: model + token kullanımından yaklaşık USD hesaplar.
// NOT: Bu bir TAHMİNDİR (fiyatlar 1M token başına USD). Kesin bakiye/fatura
// sağlayıcının panelindedir (Moonshot: platform.moonshot.ai). Fiyatları
// .env'deki AI_PRICES (JSON) ile güncelleyebilirsin.

// 1.000.000 token başına USD (giriş / çıkış). Yaklaşık değerler.
const DEFAULT_PRICES = {
  'kimi-k2.5': { in: 0.15, out: 2.50 },
  'kimi-k2.6': { in: 0.60, out: 2.50 },
  'kimi-k2.7-code': { in: 1.00, out: 3.00 },
  'moonshot': { in: 0.60, out: 2.50 },
  'gemini-2.5-flash': { in: 0.30, out: 2.50 },
  'gemini-2.5-flash-lite': { in: 0.10, out: 0.40 },
  'gemini-2.5-pro': { in: 1.25, out: 10.0 },
  'gemini-3-flash-preview': { in: 0.30, out: 2.50 },
  'gemini-3.5-flash': { in: 0.30, out: 2.50 },
  // NVIDIA NIM bedava geliştirici kotasında ücretsizdir (token izlenir, maliyet 0).
  // Ücretli DGX Cloud'a geçilirse .env'deki AI_PRICES ile fiyat verilebilir.
  'nvidia': { in: 0.0, out: 0.0 },
  '_default': { in: 0.50, out: 2.50 },
};

let cachedPrices = null;
function getPrices() {
  if (cachedPrices) return cachedPrices;
  cachedPrices = { ...DEFAULT_PRICES };
  // .env'de AI_PRICES varsa üstüne yaz (JSON: {"kimi-k2.5":{"in":0.2,"out":2.5}})
  if (process.env.AI_PRICES) {
    try {
      const custom = JSON.parse(process.env.AI_PRICES);
      for (const [k, v] of Object.entries(custom)) {
        if (v && typeof v.in === 'number' && typeof v.out === 'number') cachedPrices[k] = v;
      }
    } catch {
      console.warn('[cost] AI_PRICES çözümlenemedi, varsayılan fiyatlar kullanılıyor.');
    }
  }
  return cachedPrices;
}

// Model adına en uygun fiyatı bul (tam eşleşme yoksa önek/aile bazlı)
function priceFor(model) {
  const prices = getPrices();
  const m = String(model || '').toLowerCase();
  if (prices[m]) return prices[m];
  if (m.startsWith('kimi') || m.startsWith('moonshot')) return prices['moonshot'];
  if (m.startsWith('gemini')) return prices['gemini-2.5-flash'];
  // NVIDIA modelleri: "nvidia:" ön eki veya "org/model" biçimi (Gemini/Kimi hariç)
  if (m.startsWith('nvidia:') || m.includes('/')) return prices['nvidia'];
  return prices['_default'];
}

// usage: OpenAI biçimi { prompt_tokens, completion_tokens } veya Gemini biçimi
// { promptTokenCount, candidatesTokenCount }. Normalize edip USD döndürür.
export function estimateCost(model, usage) {
  if (!usage) return { usd: 0, tokensIn: 0, tokensOut: 0, model: String(model || 'bilinmiyor') };
  const tokensIn = Number(usage.prompt_tokens ?? usage.promptTokenCount ?? 0) || 0;
  const tokensOut = Number(usage.completion_tokens ?? usage.candidatesTokenCount ?? 0) || 0;
  const p = priceFor(model);
  const usd = (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
  // model: analytics'te model bazlı maliyet dökümü için taşınır
  return { usd, tokensIn, tokensOut, model: String(model || 'bilinmiyor') };
}
