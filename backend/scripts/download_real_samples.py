import urllib.request
import os
import time

TARGET_DIR = r"C:\Users\User\Downloads\Ornek_Fisler"
BASE_URL = "https://raw.githubusercontent.com/zzzDavid/ICDAR-2019-SROIE/refs/heads/master/data/img/{:03d}.jpg"

def download_samples():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)
        print(f"Klasor olusturuldu: {TARGET_DIR}")

    print("=== GERCEK FIS GORSELLERI INDIRILIYOR ===")
    print("SROIE veritabanindan 25 adet gercek taranmis fis indirilecek...\n")

    success_count = 0
    for i in range(25):
        url = BASE_URL.format(i)
        file_name = f"gercek_fis_{i+1:02d}.jpg"
        dest_path = os.path.join(TARGET_DIR, file_name)

        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )

        downloaded = False
        attempts = 3
        wait_seconds = 2

        for attempt in range(1, attempts + 1):
            try:
                with urllib.request.urlopen(req) as response:
                    data = response.read()
                    with open(dest_path, 'wb') as f:
                        f.write(data)
                success_count += 1
                print(f"  [{i+1}/25] Indirildi: {file_name}")
                downloaded = True
                # GitHub'i yormamak icin her basarili indirmeden sonra 1 saniye bekle
                time.sleep(1.0)
                break
            except Exception as e:
                # Eger 429 alirsak daha uzun bekle
                if hasattr(e, 'code') and e.code == 429:
                    sleep_time = attempt * 5
                    print(f"  [Deneme {attempt}/{attempts}] Limit asildi (429), {sleep_time} saniye bekleniyor...")
                    time.sleep(sleep_time)
                else:
                    print(f"  [Deneme {attempt}/{attempts}] Hata: {e}")
                    time.sleep(1.0)

        if not downloaded:
            print(f"  [!] HATA: {file_name} indirilemedi.")

    print(f"\n* Tamamlandi! {success_count} adet gercek fis görseli '{TARGET_DIR}' klasörune indirildi.")

if __name__ == "__main__":
    download_samples()
