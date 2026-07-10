// Kalıcı dosya tabanlı veritabanı: tablo verileri db.json'da,
// fiş görselleri store/images/ altında JPEG olarak saklanır.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.join(__dirname, '..', '..', 'store');
const DB_PATH = path.join(STORE_DIR, 'db.json');
const IMAGES_DIR = path.join(STORE_DIR, 'images');

// Veritabanı yapısını ilklendir
function initDb() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ clients: [], receipts: {} }, null, 2), 'utf8');
  }
}

// Ham veriyi oku
function readDb() {
  initDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[db] Okuma hatası, varsayılana dönülüyor:', err.message);
    return { clients: [], receipts: {} };
  }
}

// Veriyi diske yaz (atomik: önce .tmp'ye yaz, sonra rename — yarıda kesilirse db.json bozulmaz)
function writeDb(data) {
  try {
    const tmpPath = DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    console.error('[db] Yazma hatası:', err.message);
  }
}

// --- Fiş Görseli İşlemleri (store/images/<receiptId>.jpg) ---
// Path traversal koruması: id sadece güvenli karakterlerden oluşmalı
function imagePathFor(receiptId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(receiptId || ''))) return null;
  return path.join(IMAGES_DIR, `${receiptId}.jpg`);
}

export function saveImageToDisk(receiptId, buffer) {
  const p = imagePathFor(receiptId);
  if (!p || !buffer) return;
  try {
    initDb();
    fs.writeFileSync(p, buffer);
  } catch (err) {
    console.error('[db] Görsel yazma hatası:', err.message);
  }
}

export function readImageFromDisk(receiptId) {
  const p = imagePathFor(receiptId);
  if (!p) return null;
  try {
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  } catch {
    return null;
  }
}

export function hasStoredImage(receiptId) {
  const p = imagePathFor(receiptId);
  return Boolean(p && fs.existsSync(p));
}

export function deleteStoredImage(receiptId) {
  const p = imagePathFor(receiptId);
  if (!p) return;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (err) {
    console.error('[db] Görsel silme hatası:', err.message);
  }
}

// --- Müşteri (Client) İşlemleri ---
export function getClients() {
  const db = readDb();
  return db.clients || [];
}

export function addClient(name) {
  const db = readDb();
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Müşteri adı boş olamaz.');
  
  // Mükerrer isim kontrolü
  const exists = db.clients.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) throw new Error('Bu isimde bir müşteri zaten mevcut.');

  const client = {
    id: 'client_' + Date.now().toString(36),
    name: trimmed,
    createdAt: Date.now()
  };

  db.clients.push(client);
  db.receipts[client.id] = [];
  writeDb(db);
  return client;
}

export function deleteClient(clientId) {
  const db = readDb();
  // Müşteri silinince fiş görselleri de diskten temizlenir
  for (const r of db.receipts[clientId] || []) {
    deleteStoredImage(r.id);
  }
  db.clients = db.clients.filter(c => c.id !== clientId);
  delete db.receipts[clientId];
  writeDb(db);
  return true;
}

// --- Fiş (Receipt) İşlemleri ---
export function getClientReceipts(clientId) {
  const db = readDb();
  return db.receipts[clientId] || [];
}

export function saveReceipt(clientId, receipt) {
  const db = readDb();
  if (!db.receipts[clientId]) {
    db.receipts[clientId] = [];
  }

  // db.json'a buffer yazılmaz; görsel ayrıca store/images/ altında dosya olarak durur
  const toSave = {
    id: receipt.id,
    fileName: receipt.fileName,
    status: receipt.status,
    data: receipt.data,
    reviewReasons: receipt.reviewReasons,
    error: receipt.error,
    edited: receipt.edited,
    approved: receipt.approved,
    isDuplicate: receipt.isDuplicate,
    duplicateOf: receipt.duplicateOf,
    order: receipt.order,
  };

  const idx = db.receipts[clientId].findIndex(r => r.id === receipt.id);
  if (idx > -1) {
    db.receipts[clientId][idx] = toSave;
  } else {
    db.receipts[clientId].push(toSave);
  }
  
  writeDb(db);
}

export function saveMultipleReceipts(clientId, receiptsList) {
  const db = readDb();
  if (!db.receipts[clientId]) {
    db.receipts[clientId] = [];
  }

  for (const receipt of receiptsList) {
    const toSave = {
      id: receipt.id,
      fileName: receipt.fileName,
      status: receipt.status,
      data: receipt.data,
      reviewReasons: receipt.reviewReasons,
      error: receipt.error,
      edited: receipt.edited,
      approved: receipt.approved,
      isDuplicate: receipt.isDuplicate,
      duplicateOf: receipt.duplicateOf,
      order: receipt.order,
    };

    const idx = db.receipts[clientId].findIndex(r => r.id === receipt.id);
    if (idx > -1) {
      db.receipts[clientId][idx] = toSave;
    } else {
      db.receipts[clientId].push(toSave);
    }
  }

  writeDb(db);
}

export function deleteReceiptFromDb(clientId, receiptId) {
  const db = readDb();
  if (db.receipts[clientId]) {
    db.receipts[clientId] = db.receipts[clientId].filter(r => r.id !== receiptId);
    writeDb(db);
  }
  deleteStoredImage(receiptId);
}

export function clearClientReceipts(clientId) {
  const db = readDb();
  for (const r of db.receipts[clientId] || []) {
    deleteStoredImage(r.id);
  }
  db.receipts[clientId] = [];
  writeDb(db);
}
