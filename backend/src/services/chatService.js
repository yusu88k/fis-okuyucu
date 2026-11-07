// Yapay zekâ ajanı: mevcut oturumdaki fişler hakkında soruları yanıtlar VE
// kullanıcının talimatıyla tabloyu doğrudan düzenler (araç/function calling).
// Oturum özeti + (seçiliyse) fiş görseli modele gönderilir.
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { summarize } from '../store/sessionStore.js';
import { readImageFromDisk } from '../store/dbStore.js';
import { isKimiModel, kimiChatCompletion } from './kimi.js';
import { isNvidiaModel, nvidiaChatCompletion } from './nvidia.js';
import { applyReceiptEdit, approveReceipt, removeReceipt, addManualReceipt } from './receiptOps.js';
import { estimateCost } from './costEstimator.js';
import { recordCost } from '../store/analyticsStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.join(__dirname, '..', '..', 'store');
const DB_PATH = path.join(STORE_DIR, 'db.json');
const MEMORY_PATH = path.join(STORE_DIR, 'learning_memory.json');

// Müşteri adını getir
function getClientName(clientId) {
  if (!clientId) return 'Seçilmemiş (Ortak)';
  try {
    if (fs.existsSync(DB_PATH)) {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      const client = db.clients?.find(c => c.id === clientId);
      return client ? client.name : 'Bilinmeyen Müşteri';
    }
  } catch (e) {
    console.error('[chat] Müşteri adı okunamadı:', e.message);
  }
  return 'Bilinmeyen Müşteri';
}

// Öğrenilen hafıza listesini getir
function getLearnedMemorySummary() {
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
      const entries = Object.entries(memory);
      if (entries.length === 0) return 'Henüz bir firma düzeltmesi hafızaya alınmadı.';
      return entries.map(([vNo, item]) => `- Vergi No ${vNo} -> "${item.firma_unvani}"`).join('\n');
    }
  } catch (e) {
    console.error('[chat] Hafıza okunamadı:', e.message);
  }
  return 'Hafıza yüklenemedi.';
}

const SYSTEM_PROMPT = `Sen "Fişten Excel'e" uygulamasının yapay zekâ ajanısın. Görevin, kullanıcının yüklediği fişler hakkında kısa ve net Türkçe yanıtlar vermek VE kullanıcı istediğinde tabloyu araçlarla (tools) doğrudan düzenlemek.

Konuşma tarzın:
- Samimi ama profesyonel: "Merhaba", "Tabii, yardımcı olayım", "Rica ederim" gibi ifadeler kullan.
- Robot gibi değil, ama çok slang değil. Orta seviye resmiyet.
- Cümleleri kısa tut; gereksiz tekrar yapma.
- Kullanıcıya suçlayıcı değil, yardımsever davran.

Yapabileceklerin:
- Oturumdaki fişlerin özetini, KDV toplamlarını, mükerrerleri ve kontrol gerekenleri açıklayabilirsin.
- Araçlarla (tools) fişleri DOĞRUDAN düzenleyebilirsin: alan güncelleme (fis_guncelle), silme (fis_sil), onaylama (fis_onayla), yeni manuel satır ekleme (satir_ekle), detay okuma (fis_detay).
- Sana ekranda seçili olan fiş fotoğrafı (görsel) iletilirse, o görseli inceleyerek üzerindeki yazıları doğrudan analiz edebilir, tabloyla karşılaştırıp fis_guncelle ile düzeltebilirsin.
- Genel muhasebe / KDV konularında kısa bilgi verebilirsin.
- "Excel'e nasıl aktarırım?" gibi uygulama sorularını yanıtlayabilirsin (Excel indirmeyi sen yapamazsın; kullanıcıya "Üstteki Excel'e Aktar butonuna tıklayın" de).

Araç kullanım kuralları (ÇOK ÖNEMLİ):
- fis_sil GERİ ALINAMAZ. Sadece kullanıcı açıkça silme istediğinde kullan. Kullanıcı "şunları sil" gibi net bir talimat vermediyse önce hangi fişleri sileceğini yaz ve onay iste.
- fis_guncelle'yi kullanıcının verdiği değerlerle veya seçili fiş görselinden okuduğun değerlerle çağır; değer uydurma.
- Fişleri receipt_id ile hedefle. receipt_id'ler sana oturum özetindeki listede verilir; emin değilsen önce fis_listele çağır.
- Bir araç hata dönerse hatayı kullanıcıya Türkçe açıkla, aynı çağrıyı körlemesine tekrarlama.
- ÇOK ÖNEMLİ: Bir alanın "eksik/boş" olduğunu söylemeden ÖNCE fis_detay ile o fişin GERÇEK değerlerini kontrol et. Oturum özetinde her alan (vergi no, fiş no, vergi dairesi, ödeme türü) görünmeyebilir; bu alan gerçekten yok demek DEĞİLDİR. Seçili fişin tablo değerleri sana ayrıca verilir; orada dolu olanı asla "eksik" deme.
- Yaptığın her işlemi yanıtının sonunda tek cümleyle özetle ("X fişinin tarihini düzelttim" gibi).

Yanıt formatı:
- Markdown kullanabilirsin (kalın, liste), ama çok uzun olmasın.
- Sayıları Türk para birimi formatında yaz: 1.234,56 TL.
- Kısa paragraflar ve maddeler halinde yaz.
- Emoji KULLANMA; sadece metin.`;

// Ajanın kullanabileceği araçlar (OpenAI / Kimi function calling şeması)
const KDV_SCHEMA = {
  type: 'object',
  description: 'KDV kırılımı düz formda. m=matrah (KDV hariç), k=KDV tutarı. Örn: {"m20": 100, "k20": 20}',
  properties: {
    m1: { type: 'number' }, k1: { type: 'number' },
    m10: { type: 'number' }, k10: { type: 'number' },
    m20: { type: 'number' }, k20: { type: 'number' },
  },
};

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fis_listele',
      description: 'Oturumdaki tüm fişleri receipt_id, firma, tarih, toplam, durum ve güven skoru ile listeler. Bir fişi hedeflemeden önce id bulmak için kullan.',
      parameters: {
        type: 'object',
        properties: {
          durum: {
            type: 'string',
            enum: ['tamam', 'kontrol_gerekli', 'hata', 'bekliyor', 'isleniyor'],
            description: 'Opsiyonel durum filtresi',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fis_detay',
      description: 'Tek bir fişin tüm alanlarını (KDV kırılımı dahil) döndürür.',
      parameters: {
        type: 'object',
        properties: { receipt_id: { type: 'string' } },
        required: ['receipt_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fis_guncelle',
      description: 'Bir fişin alanlarını günceller (tabloya anında yansır). Sadece değişecek alanları gönder.',
      parameters: {
        type: 'object',
        properties: {
          receipt_id: { type: 'string' },
          tarih: { type: 'string', description: 'YYYY-MM-DD' },
          firma_unvani: { type: 'string' },
          vergi_dairesi: { type: 'string' },
          vergi_no: { type: 'string' },
          fis_no: { type: 'string' },
          toplam: { type: 'number' },
          odeme_turu: { type: 'string', enum: ['nakit', 'kredi_karti', 'havale', 'bilinmiyor'] },
          kdv: KDV_SCHEMA,
        },
        required: ['receipt_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fis_sil',
      description: 'Bir fişi tablodan KALICI olarak siler. Geri alınamaz; sadece kullanıcının açık silme talimatıyla kullan.',
      parameters: {
        type: 'object',
        properties: { receipt_id: { type: 'string' } },
        required: ['receipt_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fis_onayla',
      description: '"Kontrol gerekli" durumundaki bir fişi onaylayıp "tamam" durumuna alır.',
      parameters: {
        type: 'object',
        properties: { receipt_id: { type: 'string' } },
        required: ['receipt_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'satir_ekle',
      description: 'Tabloya yeni bir manuel fiş satırı ekler. Kullanıcının verdiği değerlerle doldur; vermediklerini boş bırak.',
      parameters: {
        type: 'object',
        properties: {
          tarih: { type: 'string', description: 'YYYY-MM-DD' },
          firma_unvani: { type: 'string' },
          vergi_dairesi: { type: 'string' },
          vergi_no: { type: 'string' },
          fis_no: { type: 'string' },
          toplam: { type: 'number' },
          odeme_turu: { type: 'string', enum: ['nakit', 'kredi_karti', 'havale', 'bilinmiyor'] },
          kdv: KDV_SCHEMA,
        },
      },
    },
  },
];

// Fişi ajanın okuyabileceği sade nesneye çevirir
function receiptToAgentJson(r) {
  return {
    receipt_id: r.id,
    dosya: r.fileName,
    durum: r.status,
    tarih: r.data?.tarih ?? null,
    firma_unvani: r.data?.firma_unvani ?? null,
    vergi_dairesi: r.data?.vergi_dairesi ?? null,
    vergi_no: r.data?.vergi_no ?? null,
    fis_no: r.data?.fis_no ?? null,
    toplam: r.data?.toplam ?? null,
    kdv_detay: r.data?.kdv_detay ?? [],
    odeme_turu: r.data?.odeme_turu ?? null,
    guven_skoru: r.data?.guven_skoru ?? null,
    mukerrer: Boolean(r.isDuplicate),
    kontrol_nedenleri: r.reviewReasons || [],
    hata: r.error || null,
  };
}

// Bir araç çağrısını çalıştırır; { result, action } döndürür (action: kullanıcıya gösterilecek Türkçe özet)
function executeAgentTool(session, name, args) {
  switch (name) {
    case 'fis_listele': {
      let list = [...session.receipts.values()].sort((a, b) => a.order - b.order);
      if (args?.durum) list = list.filter((r) => r.status === args.durum);
      return {
        result: { adet: list.length, fisler: list.slice(0, 100).map(receiptToAgentJson) },
        action: null, // salt okuma, kullanıcıya aksiyon olarak gösterilmez
      };
    }
    case 'fis_detay': {
      const r = session.receipts.get(args?.receipt_id);
      if (!r) throw new Error('Fiş bulunamadı (receipt_id hatalı olabilir, fis_listele ile kontrol et).');
      return { result: receiptToAgentJson(r), action: null };
    }
    case 'fis_guncelle': {
      const { receipt_id, ...fields } = args || {};
      const r = applyReceiptEdit(session, receipt_id, fields);
      const changed = Object.keys(fields).join(', ');
      return {
        result: { ok: true, fis: receiptToAgentJson(r) },
        action: `"${r.data.firma_unvani || r.fileName}" fişi güncellendi (${changed}).`,
      };
    }
    case 'fis_sil': {
      const r = session.receipts.get(args?.receipt_id);
      const label = r ? (r.data?.firma_unvani || r.fileName) : args?.receipt_id;
      removeReceipt(session, args?.receipt_id);
      return { result: { ok: true }, action: `"${label}" fişi silindi.` };
    }
    case 'fis_onayla': {
      const r = approveReceipt(session, args?.receipt_id);
      return {
        result: { ok: true, fis: receiptToAgentJson(r) },
        action: `"${r.data.firma_unvani || r.fileName}" fişi onaylandı.`,
      };
    }
    case 'satir_ekle': {
      const r = addManualReceipt(session, args || {});
      return {
        result: { ok: true, fis: receiptToAgentJson(r) },
        action: `Yeni satır eklendi: "${r.data.firma_unvani}" (${r.data.toplam} TL).`,
      };
    }
    default:
      throw new Error(`Bilinmeyen araç: ${name}`);
  }
}

// Oturumdaki fişlerden asistanın görebileceği özet oluştur (receipt_id'ler dahil)
function buildSessionContext(session) {
  const summary = summarize(session);
  const receipts = [...session.receipts.values()].sort((a, b) => a.order - b.order);

  const totalByRate = { 1: 0, 10: 0, 20: 0 };
  let totalAmount = 0;
  for (const r of receipts) {
    if (!r.data) continue;
    totalAmount += r.data.toplam || 0;
    for (const item of r.data.kdv_detay || []) {
      const oran = Number(item.oran);
      const bucket = oran === 1 ? 1 : oran === 8 || oran === 10 ? 10 : oran === 18 || oran === 20 ? 20 : null;
      if (bucket) totalByRate[bucket] += item.matrah + item.kdv_tutari;
    }
  }

  const clientName = getClientName(session.clientId);
  const memorySummary = getLearnedMemorySummary();

  const contextLines = [
    `Aktif Müşteri/Firma: ${clientName}`,
    `Oturumdaki fiş sayısı: ${summary.toplamDosya}`,
    `Durumlar: ${summary.tamam} tamam, ${summary.kontrolGerekli} kontrol gerekli, ${summary.hata} hata, ${summary.bekliyor} bekliyor, ${summary.isleniyor} işleniyor.`,
    `Mükerrer fiş sayısı: ${summary.mukerrer}`,
    `Genel toplam: ${totalAmount.toFixed(2)} TL`,
    `KDV kırılımı (yaklaşık): %1 → ${totalByRate[1].toFixed(2)} TL, %10 → ${totalByRate[10].toFixed(2)} TL, %20 → ${totalByRate[20].toFixed(2)} TL`,
  ];

  // İlk 50 fişin temel bilgileri; araç çağrıları için receipt_id de verilir
  const sample = receipts.slice(0, 50).map((r, i) => {
    const d = r.data;
    if (!d) return `${i + 1}. [id: ${r.id}] ${r.fileName}: henüz işlenmedi (${r.status})`;
    return `${i + 1}. [id: ${r.id}] ${d.firma_unvani || 'Bilinmiyor'} / ${d.tarih || 'tarih yok'} / ${(d.toplam || 0).toFixed(2)} TL / güven ${d.guven_skoru ?? '-'} / ${r.status}${r.isDuplicate ? ' (mükerrer)' : ''}`;
  });

  return contextLines.join('\n') +
         '\n\nÖğrenilen Vergi No - Firma Bilgileri (Hafıza):\n' + memorySummary +
         '\n\nİlk 50 fiş (araç çağrılarında receipt_id olarak köşeli parantezdeki id kullanılır):\n' + sample.join('\n');
}

// OpenAI-uyumlu (Kimi/NVIDIA) ajan döngüsü: model araç çağırdıkça çalıştırır, sonucu geri verir.
// completionFn: kimiChatCompletion veya nvidiaChatCompletion (ikisi de aynı imzayı döndürür).
// En fazla 8 tur; her turda birden çok araç çağrısı olabilir.
async function runAgentLoop(session, kimiMessages, model, visitorId = null, completionFn = kimiChatCompletion) {
  const actions = [];
  const maxRounds = 8;

  for (let round = 0; round < maxRounds; round++) {
    const { text, toolCalls, message, usage } = await completionFn(kimiMessages, {
      model,
      tools: AGENT_TOOLS,
    });
    // Sohbet çağrısının tahmini maliyetini işle
    if (usage) recordCost(visitorId, estimateCost(model, usage));

    if (!toolCalls.length) {
      return { reply: text.trim() || 'Yanıt oluşturulamadı, lütfen tekrar sorun.', actions };
    }

    // Modelin araç çağrısı içeren mesajı geçmişe aynen eklenir (OpenAI protokolü gereği)
    kimiMessages.push(message);

    for (const call of toolCalls) {
      const name = call.function?.name;
      let toolResult;
      try {
        const args = JSON.parse(call.function?.arguments || '{}');
        const { result, action } = executeAgentTool(session, name, args);
        if (action) actions.push(action);
        toolResult = JSON.stringify(result);
      } catch (err) {
        toolResult = JSON.stringify({ hata: String(err?.message || err) });
      }
      kimiMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: toolResult,
      });
    }
  }

  // Tur limiti doldu: yapılanları raporla
  return {
    reply: 'İstediğiniz işlemlerin bir kısmını yaptım ama işlem adımı limiti doldu. Kalanlar için lütfen tekrar yazın.',
    actions,
  };
}

export async function chatWithAssistant(session, userMessage, history = [], selectedReceiptId = null, visitorId = null) {
  const model = config.model;
  const usesKimi = isKimiModel(model);
  const usesNvidia = isNvidiaModel(model);
  // Ajanlı (araç kullanabilen) sağlayıcı ve onun completion fonksiyonu
  const agentFn = usesKimi ? kimiChatCompletion : usesNvidia ? nvidiaChatCompletion : null;
  if (usesKimi && !config.kimiApiKey) {
    throw new Error('KIMI_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }
  if (usesNvidia && !config.nvidiaApiKey) {
    throw new Error('NVIDIA_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }
  if (!agentFn && !config.geminiApiKey && !config.kimiApiKey && !config.nvidiaApiKey) {
    throw new Error('GEMINI_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
  }
  if (!userMessage || !String(userMessage).trim()) {
    throw new Error('Mesaj boş olamaz.');
  }

  const context = buildSessionContext(session);

  const selectedReceipt = selectedReceiptId ? session.receipts.get(selectedReceiptId) : null;
  const parts = [
    { text: `${SYSTEM_PROMPT}\n\n---\nŞu anki oturum özeti:\n${context}` }
  ];

  if (selectedReceipt && !selectedReceipt.previewJpeg) {
    // Sunucu yeniden başlamışsa görseli diskteki kalıcı kopyadan al
    selectedReceipt.previewJpeg = readImageFromDisk(selectedReceipt.id);
  }
  if (selectedReceipt?.previewJpeg) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: selectedReceipt.previewJpeg.toString('base64')
      }
    });
    parts.push({
      text: `Not: Kullanıcı şu an ekranda "${selectedReceipt.fileName}" isimli fişi seçti (receipt_id: ${selectedReceipt.id}). Sana fişin görselini gönderdim. Bu fişle ilgili soru sorarsa görseli analiz ederek cevap ver; tabloda yanlış alan varsa fis_guncelle ile düzeltebilirsin.`
    });
  }
  // Seçili fişin TABLODAKİ mevcut değerlerini de ver ki asistan dolu alanları "eksik" sanmasın
  if (selectedReceipt?.data) {
    const d = selectedReceipt.data;
    const kdvStr = (d.kdv_detay || []).map((k) => `%${k.oran}: matrah ${k.matrah}, kdv ${k.kdv_tutari}`).join('; ') || 'yok';
    parts.push({
      text: `Seçili fişin TABLODA HÂLİHAZIRDA KAYITLI değerleri (görselle karşılaştır; SADECE "BOŞ" yazan alanlar gerçekten eksiktir, dolu olanları "eksik" DEME):
- Firma: ${d.firma_unvani || 'BOŞ'}
- Tarih: ${d.tarih || 'BOŞ'}
- Vergi No: ${d.vergi_no || 'BOŞ'}
- Vergi Dairesi: ${d.vergi_dairesi || 'BOŞ'}
- Belge/Fiş No: ${d.fis_no || 'BOŞ'}
- Toplam: ${d.toplam ?? 'BOŞ'}
- Ödeme Türü: ${d.odeme_turu || 'BOŞ'}
- Belge Türü: ${d.belge_turu || 'BOŞ'}
- KDV kırılımı: ${kdvStr}
Gerçekten BOŞ olan bir alan varsa fis_guncelle ile doldurabilirsin.`
    });
  }

  const contents = [
    { role: 'user', parts },
    { role: 'model', parts: [{ text: 'Anlaşıldı. Fişleriniz hakkında soru sorabilir veya tabloda düzenleme isteyebilirsiniz. Nasıl yardımcı olayım?' }] },
  ];

  for (const h of history.slice(-10)) {
    contents.push({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(h.content || '') }],
    });
  }

  contents.push({ role: 'user', parts: [{ text: String(userMessage) }] });

  // Gemini içerik formatını OpenAI (Kimi) mesaj formatına çevirir
  const toKimiMessages = () => {
    const messages = [];
    for (const c of contents) {
      const role = c.role === 'model' ? 'assistant' : 'user';
      const content = c.parts.map((p) => {
        if (p.inlineData) {
          return {
            type: 'image_url',
            image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` },
          };
        }
        return { type: 'text', text: p.text || '' };
      });
      // Sadece metin varsa düz string gönder (token/format sadeliği)
      messages.push({
        role,
        content: content.length === 1 && content[0].type === 'text' ? content[0].text : content,
      });
    }
    return messages;
  };

  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (agentFn) {
        // Kimi/NVIDIA yolu: araçlı ajan döngüsü (fiş düzenleme/silme/ekleme yapabilir)
        return await runAgentLoop(session, toKimiMessages(), model, visitorId, agentFn);
      }
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      const response = await ai.models.generateContent({
        model: config.model,
        contents,
        config: {
          responseMimeType: 'text/plain',
          temperature: 0.3,
        },
      });
      if (response.usageMetadata) recordCost(visitorId, estimateCost(config.model, response.usageMetadata));
      const replyText = String(response.text || '').trim() || 'Yanıt oluşturulamadı, lütfen tekrar sorun.';
      return { reply: replyText, actions: [] };
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || err);
      const transient = /503|UNAVAILABLE|overloaded|high demand|429|rate/i.test(msg);
      if (!transient || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  // Sağlayıcılar arası yedek: Gemini çöktüyse araçlı bir sağlayıcıyla (Kimi -> NVIDIA) bir kez dene
  if (!agentFn) {
    if (config.kimiApiKey) {
      try {
        console.warn('[chat] Gemini yanıt vermedi, Kimi (kimi-k2.6) ile deneniyor...');
        const result = await runAgentLoop(session, toKimiMessages(), 'kimi-k2.6', visitorId, kimiChatCompletion);
        if (result.reply) return result;
      } catch (fallbackErr) {
        console.warn('[chat] Kimi yedeği de başarısız:', fallbackErr?.message || fallbackErr);
      }
    }
    if (config.nvidiaApiKey) {
      try {
        console.warn('[chat] NVIDIA yedeği deneniyor...');
        const result = await runAgentLoop(session, toKimiMessages(), config.nvidiaVisionModel, visitorId, nvidiaChatCompletion);
        if (result.reply) return result;
      } catch (fallbackErr) {
        console.warn('[chat] NVIDIA yedeği de başarısız:', fallbackErr?.message || fallbackErr);
      }
    }
  }

  const code = lastError?.status || lastError?.statusCode || lastError?.code || '';
  const msg = String(lastError?.message || lastError || 'Bilinmeyen hata');
  const prefix = code ? `[Hata ${code}] ` : '';

  if (/429|quota|rate|exhausted/i.test(msg)) {
    throw new Error(`${prefix}Yapay zekâ servisinin limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.`);
  }
  if (/401|403|api.?key|permission|unauthoriz/i.test(msg)) {
    throw new Error(`${prefix}API anahtarı geçersiz görünüyor.`);
  }
  throw new Error(`${prefix}Asistan şu an yanıt veremiyor. Lütfen tekrar deneyin.`);
}
