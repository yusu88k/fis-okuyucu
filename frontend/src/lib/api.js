// Backend API istemcisi - REACT_APP_BACKEND_URL + /api öneki
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8002';
export const API_BASE = `${BACKEND_URL.replace(/\/+$/, '')}/api`;

// Kalıcı ziyaretçi kimliği (kayıt/üyelik yok; bu tarayıcıyı tanımlamak için)
// Admin panelinde cihaz/kullanım istatistikleri bu id ile eşleştirilir.
export function getVisitorId() {
  let id = localStorage.getItem('visitor_id');
  if (!id) {
    id = (crypto.randomUUID?.() || `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`);
    localStorage.setItem('visitor_id', id);
  }
  return id;
}

export const api = axios.create({ baseURL: API_BASE });

// Her isteğe ziyaretçi kimliğini başlık olarak ekle
api.interceptors.request.use((cfg) => {
  cfg.headers = cfg.headers || {};
  cfg.headers['x-visitor-id'] = getVisitorId();
  return cfg;
});

// Sunucudan gelen Türkçe hata mesajını çıkar, yoksa varsayılanı kullan
export function apiErrorMessage(err, fallback) {
  return err?.response?.data?.error || fallback;
}
