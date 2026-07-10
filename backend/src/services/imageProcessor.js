// Görsel ön işleme: HEIC -> JPEG dönüşümü ve boyut küçültme (sharp)
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { config } from '../config.js';

// HEIC/HEIF dosyası mı? (dosya imzasındaki ftyp kutusuna ve uzantıya bakılır)
export function isHeic(buffer, fileName = '') {
  const ext = fileName.toLowerCase();
  if (ext.endsWith('.heic') || ext.endsWith('.heif')) return true;
  if (!buffer || buffer.length < 12) return false;
  const ftyp = buffer.slice(4, 8).toString('ascii');
  if (ftyp !== 'ftyp') return false;
  const brand = buffer.slice(8, 12).toString('ascii');
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand);
}

// Görseli Gemini'ye uygun hale getirir:
// 1) HEIC ise JPEG'e çevirir
// 2) EXIF yönünü düzeltir
// 3) Uzun kenarı max 1568px olacak şekilde küçültür
// 4) JPEG buffer döndürür (kalite 85)
export async function prepareImage(buffer, fileName = '') {
  let input = buffer;

  if (isHeic(buffer, fileName)) {
    // HEIC dosyalarını JPEG'e çevir (heic-convert saf JS, lisans sorunu yok)
    const converted = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 });
    input = Buffer.from(converted);
  }

  const image = sharp(input, { failOn: 'none' }).rotate(); // EXIF yönünü otomatik düzelt
  const meta = await image.metadata();

  const longEdge = Math.max(meta.width || 0, meta.height || 0);
  let pipeline = image;
  if (longEdge > config.maxLongEdge) {
    // Uzun kenarı sınırla, en-boy oranını koru
    pipeline = pipeline.resize({
      width: config.maxLongEdge,
      height: config.maxLongEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const jpeg = await pipeline.jpeg({ quality: 85 }).toBuffer();
  return jpeg;
}
