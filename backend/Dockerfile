# Backend (Express) için container imajı.
# Render (Docker runtime), Railway, Fly.io veya kendi VPS'inizde kullanılabilir.
FROM node:20-slim

# sharp + heic-convert için gerekli çalışma zamanı kütüphaneleri (prebuilt binariler için yeterli)
WORKDIR /app

# Önce bağımlılıklar (katman önbelleği için)
COPY package*.json ./
RUN npm install --omit=dev

# Uygulama kaynağı
COPY . .

# Kalıcı veri dizini (db.json + fiş görselleri). Volume bağlarsanız buraya bağlayın.
VOLUME ["/app/store"]

ENV NODE_ENV=production
ENV PORT=8002
EXPOSE 8002

CMD ["npm", "start"]
