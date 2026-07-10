import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'C:\\Users\\User\\Downloads\\Ornek_Fisler';

// Bozuk/silik fiş SVG - çok düşük kontrast, lekeli arka plan
function brutalReceiptSvg(lines, seed) {
  const lineHeight = 34;
  const height = lines.length * lineHeight + 100;
  
  // Rastgele lekeler oluştur (termal kağıdın solmuş/yıpranmış bölgeleri)
  let stains = '';
  for (let s = 0; s < 12; s++) {
    const cx = 50 + (seed * 37 + s * 89) % 440;
    const cy = 30 + (seed * 53 + s * 67) % (height - 60);
    const r = 15 + (seed * 11 + s * 23) % 40;
    const opacity = 0.03 + ((seed * 7 + s * 13) % 10) / 100;
    stains += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#888" opacity="${opacity}"/>`;
  }
  
  // Bazı satırları daha silik yap (rastgele parça parça solma)
  const textLines = lines.map((line, i) => {
    // Her satır farklı derecede soluk
    const fade = 170 + ((seed * 3 + i * 17) % 60); // #aa ile #e6 arası gri
    const hex = fade.toString(16);
    // Bazı satırları hafif kaydır (termal kağıt kayması)
    const xOffset = ((seed + i * 7) % 5) - 2;
    return `<text x="${35 + xOffset}" y="${65 + i * lineHeight}" font-family="DejaVu Sans Mono, monospace" font-size="20" font-weight="bold" fill="#${hex}${hex}${hex}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
  }).join('\n');

  // Arka plan: kirli, lekeli, sararmış termal kağıt
  return `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="${height}">
    <rect width="100%" height="100%" fill="#f0ede4"/>
    <rect x="0" y="0" width="540" height="40" fill="#e8e4d8" opacity="0.5"/>
    <rect x="0" y="${height-30}" width="540" height="30" fill="#ddd8cc" opacity="0.4"/>
    ${stains}
    ${textLines}
  </svg>`;
}

const hardTemplates = [
  {
    seed: 42,
    fileName: '11_cok_zor_bozuk_migros.jpg',
    lines: [
      '        MIGROS TIC. A.S.',
      '   ATATURK MAH. 123. SK. NO:5',
      '       KADIKOY / ISTANBUL',
      ' KOZYATAGI V.D.  6220039119',
      '--------------------------------',
      'TARIH : 05.11.2025   SAAT: 21:45',
      'FIS NO: 0187',
      '--------------------------------',
      'DANA KUSBASI 1KG           %1',
      '                       *680,00',
      'ZEYTINYAGI SIZMA 1L        %1',
      '                       *420,50',
      'DETERJAN TOZ 4KG          %20',
      '                       *310,00',
      'KOLA 2.5L                 %20',
      '                       *100,00',
      '--------------------------------',
      'KDV %1   MATRAH:*1089,60 KDV:*10,90',
      'KDV %20  MATRAH:*341,67  KDV:*68,33',
      'TOPKDV                  *79,23',
      'TOPLAM                *1510,50',
      '--------------------------------',
      'KREDI KARTI           *1510,50',
      '     TESEKKUR EDERIZ',
    ]
  },
  {
    seed: 99,
    fileName: '12_cok_zor_bozuk_bim.jpg',
    lines: [
      '    BIM BIRLESIK MAGAZALAR A.S.',
      '  FATIH MAH. ATATURK CAD. NO:4',
      '      SANCAKTEPE / ISTANBUL',
      ' SARIGAZI V.D.  1650029312',
      '--------------------------------',
      'TARIH : 12.11.2025   SAAT: 18:20',
      'FIS NO: 1042',
      '--------------------------------',
      'UN 10KG                     %1',
      '                       *150,00',
      'SEKER 5KG                  %1',
      '                       *130,00',
      'CAY 1KG CAYKUR             %1',
      '                       *195,00',
      'MARGARIN 500G              %1',
      '                        *65,25',
      '--------------------------------',
      'KDV %1   MATRAH:*534,90  KDV:*5,35',
      'TOPKDV                   *5,35',
      'TOPLAM                 *540,25',
      '--------------------------------',
      'NAKIT                  *600,00',
      'PARA USTU               *59,75',
    ]
  }
];

async function generateBrutal() {
  console.log("=== COK ZOR / BOZUK FISLER URETILIYOR ===\n");
  
  for (const t of hardTemplates) {
    const destPath = path.join(TARGET_DIR, t.fileName);
    
    try {
      const svg = brutalReceiptSvg(t.lines, t.seed);
      
      // 1. SVG -> PNG buffer
      let buffer = await sharp(Buffer.from(svg)).png().toBuffer();
      
      // 2. Agresif blur (2.8) + dusuk JPEG kalite (55) + hafif rotate
      buffer = await sharp(buffer)
        .rotate(1.5, { background: '#f0ede4' })  // hafif egrilik
        .blur(2.8)                                // agresif bulaniklik
        .modulate({ brightness: 0.92 })           // biraz karart
        .jpeg({ quality: 55 })                    // dusuk kalite = parazit
        .toBuffer();
      
      // 3. Tekrar blur + daha da dusuk kalite (double degradation)
      buffer = await sharp(buffer)
        .blur(1.2)
        .jpeg({ quality: 50 })
        .toBuffer();
      
      fs.writeFileSync(destPath, buffer);
      console.log(`  Uretildi: ${t.fileName} (${buffer.length} byte)`);
    } catch (e) {
      console.error(`  Hata: ${t.fileName}`, e.message);
    }
  }
  
  console.log("\nTamamlandi! 2 adet cehennem zorlugunda bozuk fis uretildi.");
}

generateBrutal();
