import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'C:\\Users\\User\\Downloads\\Ornek_Fisler';

// 1. Dosya silme: gercek_fis_16.jpg ile gercek_fis_25.jpg arası dosyaları sil
console.log("=== ESKI YABANCI FISLER SILINIYOR ===");
for (let i = 16; i <= 25; i++) {
  const fileName = `gercek_fis_${String(i).padStart(2, '0')}.jpg`;
  const filePath = path.join(TARGET_DIR, fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`  Silindi: ${fileName}`);
    } catch (e) {
      console.error(`  Silinemedi: ${fileName}`, e.message);
    }
  }
}

// 2. Silik/Soluk Türk fişleri için SVG oluşturucu
// Text rengi gri (#9a9a9a) yapılarak "silik" görünüm verilir.
function fadedReceiptSvg(lines) {
  const lineHeight = 34;
  const height = lines.length * lineHeight + 85;
  const textLines = lines
    .map((line, i) => `<text x="35" y="${65 + i * lineHeight}" font-family="DejaVu Sans Mono, monospace" font-size="20" font-weight="bold" fill="#929292">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`)
    .join('\n');
  // Arka plan rengi de kirli sarı/beyaz (#fefefa)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="${height}"><rect width="100%" height="100%" fill="#fafaf0" stroke="#ccc" stroke-width="1"/>${textLines}</svg>`;
}

const fadedTemplates = [
  {
    index: 16,
    name: 'bim_silik',
    lines: [
      '        BIM BIRLESIK MAGAZALAR A.S.',
      '    FATIH MAH. ATATURK CAD. NO:4',
      '        SANCAKTEPE / ISTANBUL',
      ' SARIGAZI V.D.  1650029312',
      '--------------------------------',
      'TARIH : 16.10.2025   SAAT: 11:20',
      'FIS NO: 0884',
      '--------------------------------',
      'UN 5KG                      %1',
      '                        *75,00',
      'MAKARNA 3 AD                %1',
      '                        *45,00',
      'YOGURT 1.5KG               %1',
      '                        *25,50',
      '--------------------------------',
      'KDV %1   MATRAH:*144,06  KDV:*1,44',
      'TOPKDV                   *1,44',
      'TOPLAM                 *145,50',
      '--------------------------------',
      'KREDI KARTI            *145,50',
      '     YINE BEKLERIZ',
    ]
  },
  {
    index: 17,
    name: 'a101_silik',
    lines: [
      '     A101 YENI MAGAZACILIK A.S.',
      '   MERKEZ MAH. ATATURK CAD. NO:90',
      '        KONAK / IZMIR',
      ' KORDON V.D.   0290312782',
      '--------------------------------',
      'TARIH : 17.10.2025   SAAT: 16:47',
      'FIS NO: 0233',
      '--------------------------------',
      'AYCICKEK YAGI 1L           %1',
      '                       *120,00',
      'BEYAZ PEYNIR               %1',
      '                       *200,00',
      '--------------------------------',
      'KDV %1   MATRAH:*316,83  KDV:*3,17',
      'TOPKDV                  *3,17',
      'TOPLAM                 *320,00',
      '--------------------------------',
      'KREDI KARTI            *320,00',
    ]
  },
  {
    index: 18,
    name: 'migros_silik',
    lines: [
      '        MIGROS TIC. A.S.',
      '   ATATURK MAH. 123. SK. NO:5',
      '       KADIKOY / ISTANBUL',
      ' KOZYATAGI V.D.  6220039119',
      '--------------------------------',
      'TARIH : 18.10.2025   SAAT: 14:32',
      'FIS NO: 0042',
      '--------------------------------',
      'MEYVE SUYU 1L              %10',
      '                        *45,00',
      'ET DANA 1KG                %1',
      '                       *550,75',
      'CIPS FAMILY SIZE           %20',
      '                        *85,00',
      '--------------------------------',
      'KDV %1   MATRAH:*545,30  KDV:*5,45',
      'KDV %10  MATRAH:*40,91   KDV:*4,09',
      'KDV %20  MATRAH:*70,83   KDV:*14,17',
      'TOPKDV                  *23,71',
      'TOPLAM                 *680,75',
      '--------------------------------',
      'KREDI KARTI            *680,75',
    ]
  },
  {
    index: 19,
    name: 'sok_silik',
    lines: [
      '     SOK MARKETLER TIC. A.S.',
      '  CUMHURIYET MAH. 45. CAD. NO:12',
      '        CANKAYA / ANKARA',
      ' MALTEPE V.D.   7810045623',
      '--------------------------------',
      'TARIH : 19.10.2025   SAAT: 09:15',
      'FIS NO: 0117',
      '--------------------------------',
      'CAY 500G                   %1',
      '                        *95,00',
      '--------------------------------',
      'KDV %1   MATRAH:*94,06   KDV:*0,94',
      'TOPKDV                   *0,94',
      'TOPLAM                  *95,00',
      '--------------------------------',
      'NAKIT                   *95,00',
    ]
  },
  {
    index: 20,
    name: 'carrefoursa_silik',
    lines: [
      '       CARREFOURSA TIC. A.S.',
      '  BAHRIYE CAD. NO:104 BEYOGLU',
      '           ISTANBUL',
      ' BEYOGLU V.D.  2090456123',
      '--------------------------------',
      'TARIH : 20.10.2025   SAAT: 19:10',
      'FIS NO: 0451',
      '--------------------------------',
      'KASAR PEYNIRI              %1',
      '                       *350,20',
      'KEK CIKOLATALI             %10',
      '                        *80,00',
      '--------------------------------',
      'KDV %1   MATRAH:*346,73  KDV:*3,47',
      'KDV %10  MATRAH:*72,73   KDV:*7,27',
      'TOPKDV                  *10,74',
      'TOPLAM                 *430,20',
      '--------------------------------',
      'KREDI KARTI            *430,20',
    ]
  },
  {
    index: 21,
    name: 'opet_silik',
    lines: [
      '       OPET PETROLCULUK A.S.',
      '   E-5 KARAYOLU UZERI DILOVASI',
      '            KOCAELI',
      ' GEBZE V.D.     6450039121',
      '--------------------------------',
      'TARIH : 21.10.2025   SAAT: 19:40',
      'FIS NO: 0312',
      '--------------------------------',
      'ULTRA FORCE BENZIN         %20',
      '                      *1500,00',
      '--------------------------------',
      'KDV %20 MATRAH:*1250,00 KDV:*250,00',
      'TOPKDV                 *250,00',
      'TOPLAM                *1500,00',
      '--------------------------------',
      'KREDI KARTI           *1500,00',
      '     PLAKA: 34XYZ888',
    ]
  },
  {
    index: 22,
    name: 'shell_silik',
    lines: [
      '         SHELL & TURCAS PETROL',
      '     BARBAROS BULVARI NO:55 BESIKTAS',
      '           ISTANBUL',
      ' BESIKTAS V.D.  8090029312',
      '--------------------------------',
      'TARIH : 22.10.2025   SAAT: 08:30',
      'FIS NO: 0521',
      '--------------------------------',
      'KURUSUNSUZ BENZIN          %20',
      '                      *1200,00',
      '--------------------------------',
      'KDV %20 MATRAH:*1000,00 KDV:*200,00',
      'TOPKDV                 *200,00',
      'TOPLAM                *1200,00',
      '--------------------------------',
      'KREDI KARTI           *1200,00',
      '     PLAKA: 06ABC444',
    ]
  },
  {
    index: 23,
    name: 'starbucks_silik',
    lines: [
      '       SHAYA KAHVE SANAYI TIC.',
      '   STARBUCKS BEBEK MH. BESIKTAS',
      '           ISTANBUL',
      ' BESIKTAS V.D.  7690045123',
      '--------------------------------',
      'TARIH : 23.10.2025   SAAT: 10:20',
      'FIS NO: 0884',
      '--------------------------------',
      'FILTRE KAHVE TALL           %10',
      '                        *70,00',
      'HAVUC KEK                   %10',
      '                        *90,00',
      '--------------------------------',
      'KDV %10 MATRAH:*145,45  KDV:*14,55',
      'TOPKDV                  *14,55',
      'TOPLAM                 *160,00',
      '--------------------------------',
      'KREDI KARTI            *160,00',
    ]
  },
  {
    index: 24,
    name: 'burger_silik',
    lines: [
      '         TAB GIDA SANAYI A.S.',
      '    BURGER KING KONYA KENT PLAZA AVM',
      '             KONYA',
      ' BEYOGLU V.D.   8200029312',
      '--------------------------------',
      'TARIH : 24.10.2025   SAAT: 13:10',
      'FIS NO: 0214',
      '--------------------------------',
      'BIG KING MENU              %10',
      '                       *390,00',
      '--------------------------------',
      'KDV %10 MATRAH:*354,55  KDV:*35,45',
      'TOPKDV                  *35,45',
      'TOPLAM                 *390,00',
      '--------------------------------',
      'KREDI KARTI            *390,00',
    ]
  },
  {
    index: 25,
    name: 'eczane_silik',
    lines: [
      '         PINAR ECZANESİ ECZ. P.',
      '    GAZI MUSTAFA KEMAL CD. NO:78',
      '        KIZILAY / ANKARA',
      ' KIZILAY V.D.   1080045612',
      '--------------------------------',
      'TARIH : 25.10.2025   SAAT: 11:15',
      'FIS NO: 0332',
      '--------------------------------',
      'VITAMIN HAP                   %10',
      '                       *275,00',
      '--------------------------------',
      'KDV %10 MATRAH:*250,00  KDV:*25,00',
      'TOPKDV                  *25,00',
      'TOPLAM                 *275,00',
      '--------------------------------',
      'NAKIT                  *275,00',
    ]
  }
];

async function generateFaded() {
  console.log("\n=== SILIK VE BLURLU TURKCE FISLER URETILIYOR ===");
  
  for (let i = 0; i < fadedTemplates.length; i++) {
    const t = fadedTemplates[i];
    const fileName = `gercek_fis_silik_${t.index}.jpg`;
    const destPath = path.join(TARGET_DIR, fileName);

    try {
      const svg = fadedReceiptSvg(t.lines);
      // Sharp ile resmi olustur ve .blur(1.6) ile siliklik/solukluk ver
      const buffer = await sharp(Buffer.from(svg))
        .blur(1.6)
        .jpeg({ quality: 80 }) // kaliteyi dusurerek daha da gercekci bir bulaniklik/solukluk veriyoruz
        .toBuffer();
      
      fs.writeFileSync(destPath, buffer);
      console.log(`  [${i + 1}/${fadedTemplates.length}] Silik Fis Uretildi: ${fileName}`);
    } catch (e) {
      console.error(`  ❌ Hata (${t.name}):`, e.message);
    }
  }

  console.log(`\n🎉 Islem basariyla tamamlandi! 10 adet silik/soluk Türkçe fis görseli '${TARGET_DIR}' altina yazildi.`);
}

generateFaded();
