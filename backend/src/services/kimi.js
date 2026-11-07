// Kimi (Moonshot AI) entegrasyonu: OpenAI uyumlu chat completions API
// Model adı "kimi" veya "moonshot" ile başlıyorsa istekler bu servise yönlendirilir.
import { config } from '../config.js';
import { RECEIPT_PROMPT, parseReceiptJson } from './gemini.js';

const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';

export function isKimiModel(name) {
  return /^(kimi|moonshot)/i.test(String(name || ''));
}

// OpenAI uyumlu chat completion çağrısı (görsel destekli)
// NOT: kimi-k2.6 sadece temperature=1 kabul ediyor; bu yüzden temperature hiç gönderilmez.
// Maliyet/hız optimizasyonu: düşünme (thinking) modu varsayılan kapalı.
// `thinking: true` parametresiyle çağrı bazında açılır (eskalasyon denemeleri böyle çalışır);
// .env'de KIMI_THINKING=1 ile her çağrıda açılabilir (daha yavaş ve pahalı ama daha titiz).
export async function kimiChatCompletion(messages, { model, maxTokens = 4096, apiKeyOverride = null, thinking = undefined, tools = undefined } = {}) {
  const apiKey = apiKeyOverride || config.kimiApiKey;
  if (!apiKey) {
    throw new Error('KIMI_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }

  // Açık parametre her şeyi ezer; yoksa çalışma zamanı ayarına bakılır ('on' -> açık)
  const thinkingEnabled = thinking ?? (config.thinkingMode === 'on');
  const res = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      ...(thinkingEnabled ? {} : { thinking: { type: 'disabled' } }),
      // Araç (function calling) desteği: sohbet ajanı fişleri düzenleyebilsin diye
      ...(tools && tools.length ? { tools } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Kimi API hatası (${res.status}): ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  const msg = json.choices?.[0]?.message || {};
  return {
    text: String(msg.content || ''),
    // Düşünme (reasoning) adımları varsa yakala; sağ panelde gösterilir
    thinking: msg.reasoning_content || null,
    // Modelin çağırmak istediği araçlar (ajan döngüsü bunları çalıştırıp devam eder)
    toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
    // Ajan döngüsünde geçmişe aynen eklenebilsin diye ham mesaj
    message: msg,
    // Token kullanımı (maliyet tahmini için) — OpenAI biçimi
    usage: json.usage || null,
  };
}

// Tek bir fiş görselini (JPEG buffer) Kimi'ye gönderir ve ham JSON nesnesi döndürür
export async function extractReceiptKimi(jpegBuffer, model, { thinking = undefined } = {}) {
  const { text, thinking: thinkingSteps, usage } = await kimiChatCompletion(
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
    // Fiş JSON'ı küçüktür; çıkış tokenını sınırlamak kaçak maliyeti önler (kalite etkilenmez)
    { model, thinking, maxTokens: 2048 }
  );
  return { ...parseReceiptJson(text), _thinking: thinkingSteps, _usage: usage };
}

// Kimi API anahtarını küçük bir metin çağrısıyla doğrular
export async function testKimiKey(apiKeyOverride = null, model = 'kimi-k2.6') {
  const { text } = await kimiChatCompletion(
    [{ role: 'user', content: 'Merhaba, bu bir testtir. Tek kelimeyle yanıtla.' }],
    { model, maxTokens: 512, apiKeyOverride }
  );
  return Boolean(text);
}
