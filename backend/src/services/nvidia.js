// NVIDIA NIM (build.nvidia.com) entegrasyonu: OpenAI uyumlu chat completions API
// integrate.api.nvidia.com üzerinden çalışır; anahtar nvapi-... ile başlar (bedava kota: ~1000 kredi, 40 istek/dk).
// Model adı bir "org/model" biçimindeyse (örn. meta/llama-3.2-90b-vision-instruct) veya
// "nvidia:" ön ekiyle geliyorsa istekler bu servise yönlendirilir.
import { config } from '../config.js';
import { RECEIPT_PROMPT, parseReceiptJson } from './gemini.js';

const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

// NVIDIA modeli mi? "nvidia:" ön eki VEYA "org/model" biçimi (içinde / var) ve Kimi/Gemini değilse.
// Not: Gemini modelleri (gemini-2.5-flash) / içermez; Kimi modelleri kimi/moonshot ile başlar.
export function isNvidiaModel(name) {
  const s = String(name || '');
  if (/^nvidia:/i.test(s)) return true;
  if (/^(kimi|moonshot|gemini)/i.test(s)) return false;
  return s.includes('/');
}

// "nvidia:meta/llama-..." -> "meta/llama-..." (API'ye gerçek model adı gider)
function normalizeModel(name) {
  return String(name || '').replace(/^nvidia:/i, '');
}

// OpenAI uyumlu chat completion çağrısı (görsel + araç/function-calling destekli)
// NVIDIA modelleri temperature kabul eder; deterministik çıktı için düşük tutulur.
// `thinking` parametresi uyumluluk için kabul edilir ama NVIDIA'da kullanılmaz (no-op).
export async function nvidiaChatCompletion(messages, { model, maxTokens = 4096, apiKeyOverride = null, temperature = undefined, tools = undefined } = {}) {
  const apiKey = apiKeyOverride || config.nvidiaApiKey;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }

  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: normalizeModel(model),
      messages,
      max_tokens: maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
      // Araç (function calling) desteği: sohbet ajanı fişleri düzenleyebilsin diye
      ...(tools && tools.length ? { tools } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`NVIDIA API hatası (${res.status}): ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const msg = json.choices?.[0]?.message || {};
  return {
    text: String(msg.content || ''),
    // Bazı NVIDIA akıl yürütme modelleri reasoning_content döndürür
    thinking: msg.reasoning_content || null,
    toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
    message: msg,
    // Token kullanımı (maliyet tahmini için) — OpenAI biçimi
    usage: json.usage || null,
  };
}

// Tek bir fiş görselini (JPEG buffer) NVIDIA vision modeline gönderir ve ham JSON nesnesi döndürür
export async function extractReceiptNvidia(jpegBuffer, model) {
  const { text, thinking: thinkingSteps, usage } = await nvidiaChatCompletion(
    [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${jpegBuffer.toString('base64')}` },
          },
          { type: 'text', text: RECEIPT_PROMPT },
        ],
      },
    ],
    // Fiş JSON'ı küçüktür; çıkış tokenını sınırlamak kaçak maliyeti önler. Deterministik için temperature 0.
    { model, maxTokens: 2048, temperature: 0 }
  );
  return { ...parseReceiptJson(text), _thinking: thinkingSteps, _usage: usage };
}

// NVIDIA API anahtarını küçük bir metin çağrısıyla doğrular
export async function testNvidiaKey(apiKeyOverride = null, model = 'meta/llama-3.1-8b-instruct') {
  const { text } = await nvidiaChatCompletion(
    [{ role: 'user', content: 'Merhaba, bu bir testtir. Tek kelimeyle yanıtla.' }],
    { model, maxTokens: 64, apiKeyOverride, temperature: 0 }
  );
  return Boolean(text);
}
