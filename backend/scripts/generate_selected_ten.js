import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'C:\\Users\\User\\Downloads\\Ornek_Fisler';

// Klasörü temizle
console.log("=== ESKI TEST FISLERI TEMIZLENIYOR ===");
if (fs.existsSync(TARGET_DIR)) {
  const files = fs.readdirSync(TARGET_DIR);
  for (const file of files) {
    fs.unlinkSync(path.join(TARGET_DIR, file));
    console.log(`  Silindi: ${file}`);
  }
} else {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// SVG Oluşturucu (Zorluk seviyesine göre renk ve stil ayarlar)
function receiptSvg(lines, difficulty) {
  const lineHeight = 34;
  const height = lines.length * lineHeight + 85;
  
  // Zorluk derecesine göre yazı rengi
  let textColor = '#111111'; // Kolay
  if (difficulty === 'zor') {
    textColor = '#929292'; // Zor (silik)
  } else if (difficulty === 'cok_zor') {
    textColor = '#bebebe'; // Çok zor (bayağı silik)
  }

  const textLines = lines
    .map((line, i) => `<text x="35" y="${65 + i * lineHeight}" font-family="DejaVu Sans Mono, monospace" font-size="20" font-weight="bold" fill="${textColor}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="${height}"><rect width="100%" height="100%" fill="#fafaf2" stroke="#ddd" stroke-width="1"/>${textLines}</svg>`;
}

const templates = [
  // 1 Tane Çok Zor
  {
    difficulty: 'cok_zor',
    blur: 2.8,
    quality: 60,
    fileName: '01_cok_zor_migros.jpg',
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
  // 3 Tane Zor
  {
    difficulty: 'zor',
    blur: 1.6,
    quality: 75,
    fileName: '02_zor_sok.jpg',
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
    difficulty: 'zor',
    blur: 1.6,
    quality: 75,
    fileName: '03_zor_a101.jpg',
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
    difficulty: 'zor',
    blur: 1.6,
    quality: 75,
    fileName: '04_zor_bim.jpg',
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
  // 6 Tane Kolay (İstek 4 kolaydı ama toplamı 10 yapmak için 6 tane ekledik)
  {
    difficulty: 'kolay',
    blur: 0,
    quality: 100,
    fileName: '05_kolay_starbucks.jpg',
    lines: [
      '       SHAYA KAHVE SANAYI TIC.',
      '   STARBUCKS BEBEK MH. BESIKTAS',
      '           ISTANBUL',
      ' BESIKTAS V.D.  7690045123',
      '--------------------------------',
      'TARIH : 16.10.2025   SAAT: 10:20',
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
    difficulty: 'kolay',
    blur: 0,
    quality: 100,
    fileName: '06_kolay_shell.jpg',
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
    difficulty: 'kolay',
    blur: 0,
    quality: 100,
    fileName: '07_kolay_opet.jpg',
    lines: [
      '       OPET PETROLCULUK A.S.',
      '   E-5 KARAYOLU UZERI DILOVASI',
      '            KOCAELI',
      ' GEBZE V.D.     6450039121',
      '--------------------------------',
      'TARIH : 12.10.2025   SAAT: 19:40',
      'FIS NO: 0312',
      '--------------------------------',
      'ULTRA FORCE DIZEL          %20',
      '                      *1000,00',
      '--------------------------------',
      'KDV %20 MATRAH:*833,33  KDV:*166,67',
      'TOPKDV                 *166,67',
      'TOPLAM                *1000,00',
      '--------------------------------',
      'KREDI KARTI           *1000,00',
      '     PLAKA: 06ABC123',
    ]
  },
  {
    difficulty: 'kolay',
    blur: 0,
    quality: 100,
    fileName: '08_kolay_lcwaikiki.jpg',
    lines: [
      '       LC WAIKIKI MAGAZACILIK A.S.',
      '    CEVAHIR AVM KAT:2 NO:45 BEYOGLU',
      '           ISTANBUL',
      ' SISLI V.D.    5810052913',
      '--------------------------------',
      'TARIH : 07.10.2025   SAAT: 13:40',
      'FIS NO: 0056',
      '--------------------------------',
      'PANTOLON KOT               %10',
      '                       *540,00',
      'TI SORT                    %10',
      '                       *350,00',
      '--------------------------------',
      'KDV %10 MATRAH:*809,09  KDV:*80,91',
      'TOPKDV                  *80,91',
      'TOPLAM                 *890,00',
      '--------------------------------',
      'KREDI KARTI            *890,00',
    ]
  },
  {
    difficulty: 'kolay',
    blur: 0,
    quality: 100,
    fileName: '09_kolay_defacto.jpg',
    lines: [
      '         DEFACTO PERAKENDE TIC.',
      '   MALL OF ISTANBUL NO:15 BAŞAKŞEHİR',
      '           ISTANBUL',
      ' IKITELLI V.D.  2730045612',
      '--------------------------------',
      'TARIH : 08.10.2025   SAAT: 15:10',
      'FIS NO: 0341',
      '--------------------------------',
      'KAZAN ORGU                 %10',
      '                       *620,00',
      '--------------------------------',
      'KDV %10 MATRAH:*563,64  KDV:*56,36',
      'TOPKDV                  *56,36',
      'TOPLAM                 *620,00',
      '--------------------------------',
      'KREDI KARTI            *620,00',
    ]
  },
  {
    difficulty: 'kolay',
    blur: 0,
    quality: 100,
    fileName: '10_kolay_eczane.jpg',
    lines: [
      '         PINAR ECZANESİ ECZ. P.',
      '    GAZI MUSTAFA KEMAL CD. NO:78',
      '        KIZILAY / ANKARA',
      ' KIZILAY V.D.   1080045612',
      '--------------------------------',
      'TARIH : 18.10.2025   SAAT: 11:15',
      'FIS NO: 0332',
      '--------------------------------',
      'ILAC BEDELI                 %10',
      '                       *220,00',
      '--------------------------------',
      'KDV %10 MATRAH:*200,00  KDV:*20,00',
      'TOPKDV                  *20,00',
      'TOPLAM                 *220,00',
      '--------------------------------',
      'NAKIT                  *220,00',
    ]
  }
];

async function generateTenSelected() {
  console.log("\n=== SECILEN 10 ADET TURKCE TEST FISI URETILIYOR ===");
  
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const destPath = path.join(TARGET_DIR, t.fileName);

    try {
      const svg = receiptSvg(t.lines, t.difficulty);
      
      let transform = sharp(Buffer.from(svg));
      if (t.blur > 0) {
        transform = transform.blur(t.blur);
      }
      
      const buffer = await transform
        .jpeg({ quality: t.quality })
        .toBuffer();
      
      fs.writeFileSync(destPath, buffer);
      console.log(`  Uretildi [${t.difficulty.toUpperCase()}]: ${t.fileName}`);
    } catch (e) {
      console.error(`  ❌ Hata (${t.fileName}):`, e.message);
    }
  }

  console.log(`\n🎉 Secilen 10 adet test fisi '${TARGET_DIR}' klasorune basariyla yazildi.`);
}

generateTenSelected();
