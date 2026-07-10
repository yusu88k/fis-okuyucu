import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'C:\\Users\\User\\Downloads\\Ornek_Fisler';

// 1. Çok zor fişlerden birini sil
const toDelete = '12_cok_zor_bozuk_bim.jpg';
const delPath = path.join(TARGET_DIR, toDelete);
if (fs.existsSync(delPath)) {
  fs.unlinkSync(delPath);
  console.log(`Silindi: ${toDelete}`);
}

// Zor seviye SVG - orta derecede silik
function hardReceiptSvg(lines) {
  const lineHeight = 34;
  const height = lines.length * lineHeight + 85;
  const textLines = lines
    .map((line, i) => `<text x="35" y="${65 + i * lineHeight}" font-family="DejaVu Sans Mono, monospace" font-size="20" font-weight="bold" fill="#8a8a8a">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="${height}"><rect width="100%" height="100%" fill="#f5f3eb" stroke="#ccc" stroke-width="1"/>${textLines}</svg>`;
}

const zorTemplates = [
  {
    fileName: '12_zor_carrefoursa.jpg',
    lines: [
      '       CARREFOURSA TIC. A.S.',
      '  BAHRIYE CAD. NO:104 BEYOGLU',
      '           ISTANBUL',
      ' BEYOGLU V.D.  2090456123',
      '--------------------------------',
      'TARIH : 14.11.2025   SAAT: 17:30',
      'FIS NO: 0782',
      '--------------------------------',
      'KASAR PEYNIRI 500G         %1',
      '                       *180,50',
      'TAVUK GOGSU 1KG            %1',
      '                       *250,00',
      'BROKOLI                    %1',
      '                        *65,00',
      '--------------------------------',
      'KDV %1   MATRAH:*490,59  KDV:*4,91',
      'TOPKDV                   *4,91',
      'TOPLAM                 *495,50',
      '--------------------------------',
      'KREDI KARTI            *495,50',
    ]
  },
  {
    fileName: '13_zor_teknosa.jpg',
    lines: [
      '       TEKNOSA IC VE DIS TIC.',
      '    METROPOL AVM KAT:1 NO:22',
      '       UMRANIYE / ISTANBUL',
      ' UMRANIYE V.D.  8360052341',
      '--------------------------------',
      'TARIH : 15.11.2025   SAAT: 14:55',
      'FIS NO: 0444',
      '--------------------------------',
      'USB KABLO TYPE-C           %20',
      '                       *250,00',
      'TELEFON KILIF              %20',
      '                       *180,00',
      '--------------------------------',
      'KDV %20 MATRAH:*358,33  KDV:*71,67',
      'TOPKDV                  *71,67',
      'TOPLAM                 *430,00',
      '--------------------------------',
      'KREDI KARTI            *430,00',
    ]
  }
];

async function generateHard() {
  console.log("\n=== 2 ADET ZOR FIS URETILIYOR ===\n");
  
  for (const t of zorTemplates) {
    const destPath = path.join(TARGET_DIR, t.fileName);
    try {
      const svg = hardReceiptSvg(t.lines);
      const buffer = await sharp(Buffer.from(svg))
        .blur(1.8)
        .modulate({ brightness: 0.95 })
        .jpeg({ quality: 70 })
        .toBuffer();
      
      fs.writeFileSync(destPath, buffer);
      console.log(`  Uretildi: ${t.fileName} (${buffer.length} byte)`);
    } catch (e) {
      console.error(`  Hata: ${t.fileName}`, e.message);
    }
  }
  console.log("\nTamamlandi!");
}

generateHard();
