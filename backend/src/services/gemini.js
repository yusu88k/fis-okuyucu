// Vision entegrasyonu: fiş görselinden yapılandırılmış JSON çıkarma
// Model adına göre sağlayıcı seçilir: kimi-* / moonshot-* -> Kimi, diğerleri -> Gemini
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { isKimiModel, extractReceiptKimi, testKimiKey } from './kimi.js';
import { isNvidiaModel, extractReceiptNvidia, testNvidiaKey } from './nvidia.js';

// Türk yazarkasa fişi formatını modele anlatan prompt (Gemini ve Kimi ortak kullanır)
export const RECEIPT_PROMPT = `Sen Türk yazarkasa (ÖKC) fişlerini, e-Arşiv/e-Fatura çıktılarını ve perakende satış fişlerini okuyan uzman bir muhasebe asistanısın. Sana bir fiş/fatura fotoğrafı veriyorum. Dikkatli ve titiz oku; acele etme.

Belge tipleri (belge_turu alanına yaz):
- "yazarkasa_fisi": Yazarkasa (ÖKC) fişi, en yaygın. Üstte firma, altta MALİ/EKÜ bilgileri (Z NO, EKÜ NO, MF/ZY seri no) olur.
- "e_fatura": e-Arşiv Fatura / e-Fatura / e-SMM. Bilgisayar çıktısı, üstte "e-ARŞİV FATURA"/"e-FATURA" başlığı, ETTN/UUID numarası, "Mal Hizmet Toplam Tutarı", "Hesaplanan KDV", "Vergiler Dahil Toplam Tutar" satırları bulunur.
- "fatura": Klasik kağıt/matbu fatura (elden veya kaşeli). Fatura no, alıcı/satıcı, mal-hizmet kalemleri, KDV ve genel toplam olur.
- "dekont": Banka dekontu / EFT-havale makbuzu / ATM işlem fişi / POS slip / fatura ödeme makbuzu. DİKKAT: dekontta genellikle KDV YOKTUR (kdv_detay boş kalabilir). toplam = işlem/ödeme tutarı; tarih = işlem tarihi; firma_unvani = karşı taraf/alıcı unvanı veya açıklama (yoksa banka adı); fis_no = dekont/işlem/referans no. ÖNEMLİ: dekontta VKN/Vergi No ve Vergi Dairesi genelde olmaz ama belgenin üstünde/altında "VKN", "Vergi No" veya "Vergi Dairesi" yazıyorsa (örn. "Büyük Mükellefler Vergi Dairesi VKN 8760017566") MUTLAKA vergi_no ve vergi_dairesi alanlarına yaz, boş bırakma. odeme_turu: EFT/havale dekontuysa "havale", POS/kart slipiyse "kredi_karti".
- "gider_pusulasi": Gider pusulası / serbest meslek makbuzu benzeri belgeler.
- Restoran/market: adisyon + yazarkasa fişi birlikte olabilir; yazarkasa (mali) olanı esas al (belge_turu "yazarkasa_fisi").
- "diger": Yukarıdakilerden hiçbiri değil ama yine de mali bir tutar içeren belge.

Alanların yerleri ve okuma ipuçları:
- FİRMA UNVANI: en üstteki büyük yazı. Zincir marketlerde şube adı değil ana unvanı tercih et (örn. "MİGROS TİCARET A.Ş.").
- VERGİ DAİRESİ: "V.D.", "VD", "VERGİ DAİRESİ" etiketiyle. Vergi no ile karıştırma.
- VERGİ NO: 10 haneli (şirket/kurumlar) veya 11 haneli (şahıs, TC kimlik no olabilir). Sadece rakam. Telefon/EKÜ/Z no ile karıştırma.
- TARİH: "GG.AA.YYYY", "GG/AA/YYYY" veya "GG-AA-YYYY" (örn. 15.09.2025). Saat varsa yok say. İki haneli yıl varsa 20YY yap. Belirsizse fişteki en olası satış tarihini seç.
- FİŞ NO: "FİŞ NO", "FIS NO", "BELGE NO" veya "NO". Z NO / EKÜ NO / ETTN farklıdır; öncelik gerçek fiş/belge numarasıdır, yoksa Z NO kullan.
- ÖDEME TÜRÜ: "NAKİT" -> nakit; "KREDİ KARTI", "BANKA KARTI", "KART", "POS", "TEMASSIZ" -> kredi_karti; "HAVALE", "EFT", "TRANSFER" (dekontlarda) -> havale; belirsizse bilinmiyor.
- GİDER KATEGORİSİ (harcamanın türü/sektörü — muhasebeci gideri doğru hesaba atsın diye): firma unvanı ve satılan ürün/hizmetten çıkar. Seçenekler: "gida_market" (market/bakkal/manav), "akaryakit" (benzinlik/petrol/LPG), "yemek_restoran" (restoran/kafe/lokanta/pastane), "kirtasiye_ofis" (kırtasiye/matbaa/ofis malzemesi), "saglik_eczane" (eczane/hastane/klinik/tıbbi), "konaklama" (otel/pansiyon), "ulasim" (taksi/otobüs/uçak/köprü-otoyol/park), "iletisim" (telefon/internet/GSM operatörü), "teknoloji_demirbas" (bilgisayar/telefon/elektronik/mobilya/demirbaş), "giyim" (tekstil/ayakkabı/giyim), "insaat_yapi" (kereste/hırdavat/nalbur/yapı malzemesi/inşaat), "temizlik_sarf" (temizlik/hijyen/sarf), "hizmet" (danışmanlık/muhasebe/hukuk/tamir/servis/kira), "arac" (oto yedek parça/lastik/servis/otopark), "diger" (hiçbirine uymuyorsa). Emin değilsen en yakın kategoriyi seç, mümkünse "diger" deme.

Tutarlar ve KDV (EN KRİTİK KISIM):
- Ondalık ayracı virgüldür (248,15) ve önünde * olabilir (*248,15). Binlik ayracı nokta olabilir (1.248,15 = 1248.15).
- TOPLAM = fişin genel toplamı (KDV DAHİL, ödenmesi gereken tutar). "TOPLAM", "GENEL TOPLAM", "TUTAR", "Vergiler Dahil Toplam" satırından al.
- DİKKAT: "NAKİT" ve "PARA ÜSTÜ" satırları TOPLAM DEĞİLDİR. Örn. TOPLAM 80,00 / NAKİT 100,00 / PARA ÜSTÜ 20,00 ise toplam 80,00'dir.
- İSKONTO/İNDİRİM varsa toplam indirimli tutardır.
- KDV kırılımı: her oran için matrah (KDV hariç) ve kdv_tutari. Fişte "TOPKDV" veya "*KDV" toplamı olabilir; oran bazında ayrımı ürün satırlarındaki oran işaretlerinden (%1, %10, %20; eski %8/%18) çıkar.
- matrah = KDV hariç tutar. Her oran için: matrah + kdv_tutari = o oranın brüt tutarı. Tüm oranların brüt toplamı ≈ TOPLAM olmalı.
- KDV kırılımı hiç yazmıyorsa: tek kalemde en olası oranla (market gıda çoğu %1/%10, diğer %20) tahmin et, matrah ve kdv'yi toplamdan geri hesapla ve guven_skoru'nu düşür, notlar'a yaz.

Görevin: SADECE aşağıdaki şemaya uygun tek bir JSON nesnesi döndür. Markdown code fence (\\\`\\\`\\\`) KULLANMA, açıklama YAZMA, sadece saf JSON:

{
  "belge_turu": "yazarkasa_fisi" | "e_fatura" | "fatura" | "dekont" | "gider_pusulasi" | "diger",
  "gider_kategorisi": "gida_market" | "akaryakit" | "yemek_restoran" | "kirtasiye_ofis" | "saglik_eczane" | "konaklama" | "ulasim" | "iletisim" | "teknoloji_demirbas" | "giyim" | "insaat_yapi" | "temizlik_sarf" | "hizmet" | "arac" | "diger",
  "tarih": "YYYY-MM-DD",
  "firma_unvani": "string - fişteki firma adı/unvanı",
  "vergi_dairesi": "string veya null",
  "vergi_no": "string veya null",
  "fis_no": "string veya null",
  "toplam": 0.0,
  "kdv_detay": [{ "oran": 1, "matrah": 0.0, "kdv_tutari": 0.0 }],
  "notlar": "string veya null - varsayım/tahmin yaptıysan kısa açıkla (örn. %8 eski oran %10'a yönlendirildi; KDV kırılımı toplamdan hesaplandı; dekont olduğu için KDV yok)",
  "odeme_turu": "nakit" | "kredi_karti" | "havale" | "bilinmiyor",
  "guven_skoru": 0
}

Kurallar:
- "oran" 1, 8, 10, 18 veya 20 olabilir. Eski fişlerdeki %8'i 8, %18'i 18 yaz; kontrolde sırasıyla %10 ve %20 sütunlarına yönlendirilir.
- Sayıları nokta ondalıklı number yaz (248,15 -> 248.15). Para birimi simgesi/işaret ekleme.
- Okuyamadığın alan için null kullan (toplam ve tarih hariç; onları en iyi tahminle doldur).
- Dekontta (belge_turu "dekont") KDV genelde yoktur; kdv_detay'ı boş dizi [] bırak, guven_skoru'nu bu yüzden DÜŞÜRME (dekont için normaldir).
- "guven_skoru" 0-100: net okunan ve matrah+kdv=toplam tutan fişte yüksek (85+); tahmin/bulanıklık/tutmayan matematik varsa düşür (<60). Bu skor kullanıcıya kırmızı/amber uyarı olarak gösterilir, dürüst ol.
- Görsel MALİ BİR BELGE DEĞİLSE (manzara, insan, ekran görüntüsü, alakasız yazı/belge, üzerinde ödenecek bir tutar yok) belge_turu'nu "diger" yerine boş bırakma; guven_skoru 0 ver, firma_unvani alanına "FIS_DEGIL" yaz ve toplam'a 0 koy. Emin değilsen fiş kabul et; sadece açıkça fiş/fatura/dekont OLMAYAN görsellerde "FIS_DEGIL" de.`;

// Model çıktısındaki olası markdown fence ve fazlalıkları temizleyip JSON parse eder (savunmacı)
export function parseReceiptJson(rawText) {
  let text = String(rawText || '').trim();
  // Code fence temizliği: ```json ... ``` veya ``` ... ```
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  // İlk { ile son } arasındaki bölümü al (önce/sonra açıklama yazılmışsa kırp)
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model yanıtında JSON bulunamadı');
  }
  return JSON.parse(text.slice(start, end + 1));
}

// Tek bir fiş görselini (JPEG buffer) seçili modele gönderir ve ham JSON nesnesi döndürür
// opts.thinking: Kimi modellerinde düşünme modunu çağrı bazında açar
// opts.noFallback: sadece verilen modeli dener (eskalasyon çağrıları için)
export async function extractReceipt(jpegBuffer, modelOverride = null, opts = {}) {
  // Model Fallback listesi: seçilen model -> (diğer sağlayıcı) -> flash -> flash-lite
  // Sağlayıcılar ARASI yedekleme: Gemini çökerse Kimi'ye, Kimi çökerse Gemini'ye geçilir.
  // ŞU AN KİMİ-ONLY: Gemini ve NVIDIA yedekleri devre dışı (kod duruyor, istenirse geri açılır).
  // Yeniden açmak için: ...(config.nvidiaApiKey ? [config.nvidiaVisionModel] : []), 'gemini-2.5-flash', 'gemini-2.5-flash-lite'
  const modelsToTry = opts.noFallback
    ? [modelOverride || config.model]
    : [
        modelOverride || config.model,
        ...(config.kimiApiKey ? ['kimi-k2.5'] : []),
      ];
  const uniqueModels = [...new Set(modelsToTry.filter(Boolean))];

  let lastError = null;

  for (const currentModel of uniqueModels) {
    // Her model için geçici hatalarda 2 deneme yap
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[ai] Fiş işleniyor, model: ${currentModel} (deneme: ${attempt}/${maxAttempts})`);

        // Kimi (Moonshot) modelleri OpenAI uyumlu endpoint üzerinden çalışır
        if (isKimiModel(currentModel)) {
          const parsed = await extractReceiptKimi(jpegBuffer, currentModel, { thinking: opts.thinking });
          return { ...parsed, _usedModel: currentModel }; // _usage extractReceiptKimi'den gelir
        }

        // NVIDIA NIM modelleri (org/model biçimi veya nvidia: ön eki) — OpenAI uyumlu
        if (isNvidiaModel(currentModel)) {
          const parsed = await extractReceiptNvidia(jpegBuffer, currentModel);
          return { ...parsed, _usedModel: currentModel };
        }

        if (!config.geminiApiKey) {
          throw new Error('GEMINI_API_KEY tanımlı değil (.env dosyasını kontrol edin)');
        }
        const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
        // Pro modellerinde veya model desteklediğinde düşünme adımlarını (thinking) de almak için
        // modelden dönen yanıt nesnesinin detaylarını inceleyip saklıyoruz.
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: jpegBuffer.toString('base64') } },
                { text: RECEIPT_PROMPT },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0,
            // Schema tanımlayarak modelin kesinlikle bu formatta dönmesini garanti ediyoruz
            responseSchema: {
              type: 'OBJECT',
              properties: {
                belge_turu: { type: 'STRING', enum: ['yazarkasa_fisi', 'e_fatura', 'fatura', 'dekont', 'gider_pusulasi', 'diger'], description: 'Belge türü' },
                gider_kategorisi: { type: 'STRING', nullable: true, enum: ['gida_market', 'akaryakit', 'yemek_restoran', 'kirtasiye_ofis', 'saglik_eczane', 'konaklama', 'ulasim', 'iletisim', 'teknoloji_demirbas', 'giyim', 'insaat_yapi', 'temizlik_sarf', 'hizmet', 'arac', 'diger'], description: 'Harcama kategorisi/sektörü' },
                tarih: { type: 'STRING', description: 'Tarih, YYYY-MM-DD formatında' },
                firma_unvani: { type: 'STRING', description: 'Fişteki firma adı/unvanı' },
                vergi_dairesi: { type: 'STRING', nullable: true },
                vergi_no: { type: 'STRING', nullable: true },
                fis_no: { type: 'STRING', nullable: true },
                toplam: { type: 'NUMBER', description: 'Genel toplam tutar' },
                kdv_detay: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      oran: { type: 'INTEGER', description: 'KDV oranı (%)' },
                      matrah: { type: 'NUMBER', description: 'KDV matrahı (KDV hariç tutar)' },
                      kdv_tutari: { type: 'NUMBER', description: 'KDV tutarı' }
                    },
                    required: ['oran', 'matrah', 'kdv_tutari']
                  }
                },
                notlar: { type: 'STRING', nullable: true },
                odeme_turu: { type: 'STRING', enum: ['nakit', 'kredi_karti', 'havale', 'bilinmiyor'] },
                guven_skoru: { type: 'INTEGER', description: '0-100 arası güven skoru' }
              },
              required: ['tarih', 'firma_unvani', 'toplam', 'guven_skoru']
            }
          },
        });
        
        const parsed = parseReceiptJson(response.text);
        
        // Eğer modelin düşünme (thinking/reasoning) adımları varsa bunu da yakalayıp JSON'a gömüyoruz
        let thinkingText = null;
        try {
          // Aday yanıtların içindeki part'larda modelin düşünme içeriğini arıyoruz (Gemini pro modellerinde gelir)
          const parts = response.candidates?.[0]?.content?.parts || [];
          const thoughtPart = parts.find(p => p.thought || p.text?.includes('"thought"') || p.thoughtText);
          if (thoughtPart) {
            thinkingText = thoughtPart.thoughtText || thoughtPart.text;
          }
        } catch (e) {
          console.warn('[gemini] Düşünme adımları okunurken hata oluştu:', e.message);
        }
        
        return {
          ...parsed,
          _thinking: thinkingText,
          _usedModel: currentModel,
          // Token kullanımı (maliyet tahmini için) — Gemini biçimi
          _usage: response.usageMetadata || null,
        };
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || err);
        
        // Hata kodu 404 ise (model bulunamadı/desteklenmiyor) doğrudan sonraki modele geç
        const isModelNotFound = /404|not.?found|support/i.test(msg);
        if (isModelNotFound) {
          console.warn(`[gemini] Model hatası (404/Not Found veya Unsupported) model: ${currentModel}. Sonraki modele geçiliyor.`);
          break;
        }

        const transient = /503|UNAVAILABLE|overloaded|high demand|429|rate/i.test(msg);
        if (!transient || attempt === maxAttempts) {
          // Geçici hata değilse veya deneme sınırı dolduysa bu modeli geç, sonrakini dene
          console.warn(`[gemini] Model hatası (${currentModel}): ${msg}. Sonraki model denenecek.`);
          break;
        }
        // Yoğunluk geçici: bekle ve tekrar dene
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }
  
  throw lastError;
}

// API anahtarını ve bağlantısını doğrulamak için küçük bir test çağrısı yapar
// (aktif modelin sağlayıcısına göre Kimi veya Gemini anahtarı test edilir)
export async function testApiKey(apiKeyOverride = null, modelOverride = null) {
  const model = modelOverride || config.model;
  if (isKimiModel(model)) {
    return testKimiKey(apiKeyOverride, model);
  }
  if (isNvidiaModel(model)) {
    return testNvidiaKey(apiKeyOverride, model);
  }
  const apiKey = apiKeyOverride || config.geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY .env dosyasında tanımlı değil.');
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: 'Merhaba, bu bir testtir.' }] }],
    config: { temperature: 0 },
  });
  return response.text ? true : false;
}

