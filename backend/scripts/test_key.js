// API anahtarlarını doğrulayan test scripti (aktif modele göre Kimi ve/veya Gemini)
// Kullanim: node scripts/test_key.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const model = process.env.AI_MODEL || process.env.GEMINI_MODEL || 'kimi-k2.5';
console.log(`Aktif model: ${model}\n`);

let hataVar = false;

// --- Kimi anahtarı ---
const kimiKey = process.env.KIMI_API_KEY;
if (kimiKey) {
  console.log(`[Kimi] Anahtar uzunluğu: ${kimiKey.length} karakter. Test ediliyor...`);
  try {
    const { testKimiKey } = await import('../src/services/kimi.js');
    await testKimiKey(kimiKey);
    console.log('[Kimi] ✅ API anahtarı ÇALIŞIYOR.\n');
  } catch (err) {
    hataVar = true;
    console.error('[Kimi] ❌ API anahtarı BAŞARISIZ:', err?.message || err);
    const msg = String(err?.message || err);
    if (/401|invalid|auth/i.test(msg)) {
      console.error('Sebep: Anahtar geçersiz. https://platform.moonshot.ai adresinden kontrol edin.\n');
    } else if (/402|balance|insufficient/i.test(msg)) {
      console.error('Sebep: Bakiye bitmiş olabilir. platform.moonshot.ai üzerinden bakiyenizi kontrol edin.\n');
    } else if (/429|rate|quota/i.test(msg)) {
      console.error('Sebep: Limit aşıldı, birkaç dakika bekleyin.\n');
    } else {
      console.error('');
    }
  }
} else {
  console.log('[Kimi] KIMI_API_KEY tanımlı değil, atlanıyor.\n');
}

// --- NVIDIA NIM anahtarı (bedava yedek/ana sağlayıcı) ---
const nvidiaKey = process.env.NVIDIA_API_KEY;
if (nvidiaKey && nvidiaKey !== 'your_nvidia_api_key_here') {
  console.log(`[NVIDIA] Anahtar uzunluğu: ${nvidiaKey.length} karakter. Test ediliyor...`);
  try {
    const { testNvidiaKey } = await import('../src/services/nvidia.js');
    await testNvidiaKey(nvidiaKey);
    console.log('[NVIDIA] ✅ API anahtarı ÇALIŞIYOR.\n');
  } catch (err) {
    hataVar = true;
    console.error('[NVIDIA] ❌ API anahtarı BAŞARISIZ:', err?.status || '', err?.message || err);
    const msg = String(err?.message || err);
    if (/401|invalid|auth|unauthor/i.test(msg)) {
      console.error('Sebep: Anahtar geçersiz. https://build.nvidia.com üzerinden nvapi- ile başlayan bir anahtar alın.\n');
    } else if (/402|credit|quota|insufficient/i.test(msg)) {
      console.error('Sebep: Bedava kredi bitmiş olabilir. build.nvidia.com üzerinden kontrol edin.\n');
    } else if (/429|rate|limit/i.test(msg)) {
      console.error('Sebep: Dakikalık limit (40 istek/dk) aşıldı, birkaç saniye bekleyin.\n');
    } else {
      console.error('');
    }
  }
} else {
  console.log('[NVIDIA] NVIDIA_API_KEY tanımlı değil, atlanıyor.\n');
}

// --- Gemini anahtarı (yedek modeller için) ---
const geminiKey = process.env.GEMINI_API_KEY;
if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
  console.log(`[Gemini] Anahtar uzunluğu: ${geminiKey.length} karakter. Test ediliyor...`);
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Merhaba. Kısaca 1+1 kaçtır? Sadece sayıyla cevap ver.' }] }],
      config: { temperature: 0 },
    });
    console.log('[Gemini] ✅ API anahtarı ÇALIŞIYOR. Yanıt:', response.text, '\n');
  } catch (err) {
    hataVar = true;
    console.error('[Gemini] ❌ API anahtarı BAŞARISIZ:', err?.status || err?.code || '', err?.message || err);
    const msg = String(err?.message || err);
    if (/400|API key not valid|invalid/i.test(msg)) {
      console.error('Sebep: Anahtar geçersiz. https://aistudio.google.com/app/apikey adresinden yeni anahtar alın.\n');
    } else if (/429|quota|rate|exhausted|limit/i.test(msg)) {
      console.error('Sebep: Limit aşıldı. Ücretsiz kotanız dolmuş olabilir.\n');
    } else {
      console.error('');
    }
  }
} else {
  console.log('[Gemini] GEMINI_API_KEY tanımlı değil, atlanıyor (yedek modeller çalışmaz).\n');
}

process.exit(hataVar ? 1 : 0);
