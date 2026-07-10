// Akıllı düzeltme hafızası: kullanıcının yaptığı firma/vergi dairesi düzeltmelerini kaydeder ve sonraki okumalarda otomatik uygular.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.join(__dirname, '..', '..', 'store');
const MEMORY_PATH = path.join(STORE_DIR, 'learning_memory.json');

// Hafızayı yükle
function loadMemory() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEMORY_PATH)) {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
  try {
    const raw = fs.readFileSync(MEMORY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[learning] Hafıza okunamadı:', err.message);
    return {};
  }
}

// Hafızayı kaydet
function saveMemory(memory) {
  try {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2), 'utf8');
  } catch (err) {
    console.error('[learning] Hafıza kaydedilemedi:', err.message);
  }
}

// Yeni bir düzeltmeyi öğren / kaydet
export function learnCorrection(vergiNo, data) {
  const vNo = String(vergiNo || '').trim();
  if (!vNo || vNo.length < 5) return; // Geçersiz veya çok kısa vergi numaralarını kaydetme
  
  const firmaUnvani = String(data?.firma_unvani || '').trim();
  const vergiDairesi = String(data?.vergi_dairesi || '').trim();
  
  if (!firmaUnvani) return;

  const memory = loadMemory();
  memory[vNo] = {
    firma_unvani: firmaUnvani,
    vergi_dairesi: vergiDairesi || null,
    updatedAt: Date.now()
  };
  
  saveMemory(memory);
  console.log(`[learning] Öğrenildi: Vergi No: ${vNo} -> ${firmaUnvani}`);
}

// Çıkarılan verilere kayıtlı düzeltmeleri uygula
export function applyLearnedCorrections(data) {
  if (!data || !data.vergi_no) return data;
  
  const vNo = String(data.vergi_no).trim();
  const memory = loadMemory();
  
  const corrected = memory[vNo];
  if (corrected) {
    console.log(`[learning] Otomatik düzeltme uygulandı (Vergi No: ${vNo}): "${data.firma_unvani}" -> "${corrected.firma_unvani}"`);
    return {
      ...data,
      firma_unvani: corrected.firma_unvani,
      vergi_dairesi: corrected.vergi_dairesi || data.vergi_dairesi
    };
  }
  
  return data;
}
