// Uygulama yapılandırması - .env dosyasından okunur
// NOT: geminiApiKey her erişimde .env'den taze okunur; anahtar değişince restart gerekmez.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env');

function reloadEnv() {
  dotenv.config({ path: ENV_PATH, override: true });
}

// İlk yükleme
reloadEnv();

// Çalışma zamanında değiştirilebilir model adı (UI ayar panelinden güncellenebilir)
// AI_MODEL öncelikli; ana model Kimi (en ucuz vision modeli kimi-k2.5), Gemini yedek olarak durur
let currentModel = process.env.AI_MODEL || process.env.GEMINI_MODEL || 'kimi-k2.5';

// Düşünme (thinking) modu — UI ayar panelinden değiştirilebilir:
//   'auto' (önerilen): ilk okuma hızlı/düşünmesiz; fiş okunamazsa eskalasyonda düşünme açılır
//   'on'  : her okumada düşünme açık (yavaş ve pahalı ama titiz)
//   'off' : düşünme hiç kullanılmaz (eskalasyon yine çalışır ama düşünmesiz)
let thinkingMode = process.env.KIMI_THINKING === '1' ? 'on' : 'auto';

export const config = {
  port: parseInt(process.env.PORT || process.env.NODE_PORT || '8002', 10),
  get geminiApiKey() {
    reloadEnv();
    return process.env.GEMINI_API_KEY || '';
  },
  get kimiApiKey() {
    reloadEnv();
    return process.env.KIMI_API_KEY || '';
  },
  get nvidiaApiKey() {
    reloadEnv();
    return process.env.NVIDIA_API_KEY || '';
  },
  // NVIDIA yedeğinde kullanılacak vision modeli (build.nvidia.com'dan seçilebilir).
  // Fiş okuma fallback zincirinde bu model denenir; org/model biçiminde olmalı.
  get nvidiaVisionModel() {
    reloadEnv();
    // Qwen2.5-VL: fiş/fatura OCR ve yapılandırılmış JSON çıkarımında en güçlü açık vision modeli
    return process.env.NVIDIA_VISION_MODEL || 'qwen/qwen2.5-vl-72b-instruct';
  },
  get model() {
    reloadEnv();
    return currentModel;
  },
  setModel(modelName) {
    currentModel = String(modelName || '').trim() || currentModel;
  },
  get thinkingMode() {
    return thinkingMode;
  },
  setThinkingMode(mode) {
    if (['auto', 'on', 'off'].includes(mode)) thinkingMode = mode;
  },
  // İlk okuma "kontrol gerekli" çıkarsa sırayla denenecek daha güçlü modeller
  // (düşünme modu açık çalışırlar). .env'de ESCALATION_MODELS ile değiştirilebilir.
  get escalationModels() {
    reloadEnv();
    return (process.env.ESCALATION_MODELS || 'kimi-k2.6,kimi-k2.7-code')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  },
  // Aynı anda en fazla kaç fiş işlensin (rate limit koruması)
  concurrency: 3,
  // Gemini'ye gönderilmeden önce görselin uzun kenarı en fazla bu kadar olur (token tasarrufu)
  maxLongEdge: 1568,
  // Tek seferde yüklenebilecek en fazla dosya sayısı (ortam değişkeniyle artırılabilir)
  maxFiles: parseInt(process.env.MAX_FILES || '200', 10),
  // Tek dosya için maksimum boyut (20 MB)
  maxFileSizeBytes: 20 * 1024 * 1024,
};
