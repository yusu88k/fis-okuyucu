import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'C:\\Users\\User\\Downloads\\Ornek_Fisler';

// Bayağı silik/soluk Türk fişleri için SVG oluşturucu
// Text rengi çok açık gri (#b4b4b4) ve blur derecesi yüksek (2.4) tutulur
function veryFadedReceiptSvg(lines) {
  const lineHeight = 34;
  const height = lines.length * lineHeight + 85;
  const textLines = lines
    .map((line, i) => `<text x="35" y="${65 + i * lineHeight}" font-family="DejaVu Sans Mono, monospace" font-size="20" font-weight="bold" fill="#b4b4b4">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="${height}"><rect width="100%" height="100%" fill="#fafaf2" stroke="#ddd" stroke-width="1"/>${textLines}</svg>`;
}

const veryFadedTemplates = [
  {
    index: 26,
    name: 'migros_baya_silik',
    lines: [
      '        MIGROS TIC. A.S.',
      '   ATATURK MAH. 123. SK. NO:5',
      '       KADIKOY / ISTANBUL',
      ' KOZYATAGI V.D.  6220039119',
      '--------------------------------',
      'TARIH : 26.10.2025   SAAT: 20:15',
      'FIS NO: 0099',
      '--------------------------------',
      'DANA KIYMA 1KG             %1',
      '                       *550,00',
      'ZEYTINYAGI 1L              %1',
      '                       *300,40',
      '--------------------------------',
      'KDV %1   MATRAH:*841,98  KDV:*8,42',
      'TOPKDV                   *8,42',
      'TOPLAM                 *850,40',
      '--------------------------------',
      'KREDI KARTI            *850,40',
      '     YINE BEKLERIZ',
    ]
  },
  {
    index: 27,
    name: 'sok_baya_silik',
    lines: [
      '     SOK MARKETLER TIC. A.S.',
      '  CUMHURIYET MAH. 45. CAD. NO:12',
      '        CANKAYA / ANKARA',
      ' MALTEPE V.D.   7810045623',
      '--------------------------------',
      'TARIH : 27.10.2025   SAAT: 10:05',
      'FIS NO: 0256',
      '--------------------------------',
      'SUT 1L 2 AD                 %1',
      '                        *90,10',
      'SIVI SABUN                 %20',
      '                       *100,00',
      '--------------------------------',
      'KDV %1   MATRAH:*89,21   KDV:*0,89',
      'KDV %20  MATRAH:*83,33   KDV:*16,67',
      'TOPKDV                  *17,56',
      'TOPLAM                 *190,10',
      '--------------------------------',
      'NAKIT                  *200,00',
    ]
  },
  {
    index: 28,
    name: 'bim_baya_silik',
    lines: [
      '        BIM BIRLESIK MAGAZALAR A.S.',
      '    FATIH MAH. ATATURK CAD. NO:4',
      '        SANCAKTEPE / ISTANBUL',
      ' SARIGAZI V.D.  1650029312',
      '--------------------------------',
      'TARIH : 28.10.2025   SAAT: 15:30',
      'FIS NO: 0314',
      '--------------------------------',
      'SABUN TOZU                 %20',
      '                       *295,00',
      '--------------------------------',
      'KDV %20 MATRAH:*245,83  KDV:*49,17',
      'TOPKDV                  *49,17',
      'TOPLAM                 *295,00',
      '--------------------------------',
      'KREDI KARTI            *295,00',
    ]
  }
];

async function generateVeryFaded() {
  console.log("\n=== BAYAGI SILIK/SOLUK TURKCE FISLER URETILIYOR ===");
  
  for (let i = 0; i < veryFadedTemplates.length; i++) {
    const t = veryFadedTemplates[i];
    const fileName = `gercek_fis_baya_silik_${t.index}.jpg`;
    const destPath = path.join(TARGET_DIR, fileName);

    try {
      const svg = veryFadedReceiptSvg(t.lines);
      // Sharp ile yüksek derecede solukluk/siliklik (.blur(2.5)) verip JPEG olarak kaydet
      const buffer = await sharp(Buffer.from(svg))
        .blur(2.5)
        .jpeg({ quality: 65 }) // Kaliteyi daha da dusurerek parazit ekliyoruz (tam solmus termal kağıt)
        .toBuffer();
      
      fs.writeFileSync(destPath, buffer);
      console.log(`  Baya Silik Fis Uretildi: ${fileName}`);
    } catch (e) {
      console.error(`  ❌ Hata (${t.name}):`, e.message);
    }
  }

  console.log(`\n🎉 Bayağı silik fişler başarıyla üretildi!`);
}

generateVeryFaded();
