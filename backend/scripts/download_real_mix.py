import urllib.request
import os
import time
import subprocess
import sys

TARGET_DIR = r"C:\Users\User\Downloads\Ornek_Fisler"

# Klasoru temizle
print("=== ESKI DOSYALAR TEMIZLENIYOR ===")
if os.path.exists(TARGET_DIR):
    for f in os.listdir(TARGET_DIR):
        os.remove(os.path.join(TARGET_DIR, f))
        print(f"  Silindi: {f}")
else:
    os.makedirs(TARGET_DIR)

# Gercek fis gorselleri - karisik kaynaklardan
URLS = [
    # Turk fisleri (muratlutfigoncu/receipt-reader)
    ("https://raw.githubusercontent.com/muratlutfigoncu/receipt-reader/master/47838.png", "01_turk_fis_kolay.png"),
    ("https://raw.githubusercontent.com/muratlutfigoncu/receipt-reader/master/48655.png", "02_turk_fis_kolay.png"),
    ("https://raw.githubusercontent.com/muratlutfigoncu/receipt-reader/master/49426.png", "03_turk_fis_kolay.png"),
    ("https://raw.githubusercontent.com/muratlutfigoncu/receipt-reader/master/images/IMG_1423.JPG", "04_turk_fis_kolay.jpg"),
    ("https://raw.githubusercontent.com/muratlutfigoncu/receipt-reader/master/images/IMG_2070.JPG", "05_turk_fis_zor.jpg"),
    # SROIE gercek taranmis fisler (zorluk arttikca daha buyuk/karisik fisler)
    ("https://raw.githubusercontent.com/zzzDavid/ICDAR-2019-SROIE/refs/heads/master/data/img/001.jpg", "06_gercek_fis_kolay.jpg"),
    ("https://raw.githubusercontent.com/zzzDavid/ICDAR-2019-SROIE/refs/heads/master/data/img/005.jpg", "07_gercek_fis_kolay.jpg"),
    ("https://raw.githubusercontent.com/zzzDavid/ICDAR-2019-SROIE/refs/heads/master/data/img/010.jpg", "08_gercek_fis_zor.jpg"),
    ("https://raw.githubusercontent.com/zzzDavid/ICDAR-2019-SROIE/refs/heads/master/data/img/015.jpg", "09_gercek_fis_zor.jpg"),
    ("https://raw.githubusercontent.com/zzzDavid/ICDAR-2019-SROIE/refs/heads/master/data/img/020.jpg", "10_gercek_fis_cok_zor.jpg"),
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

print("\n=== GERCEK FIS GORSELLERI INDIRILIYOR ===\n")
success = 0
for i, (url, name) in enumerate(URLS):
    dest = os.path.join(TARGET_DIR, name)
    downloaded = False
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                with open(dest, 'wb') as f:
                    f.write(data)
            success += 1
            print(f"  [{i+1}/10] Indirildi: {name} ({len(data)} byte)")
            downloaded = True
            time.sleep(1.5)
            break
        except Exception as e:
            code = getattr(e, 'code', None)
            if code == 429:
                wait = attempt * 5
                print(f"  [{i+1}/10] Rate limit (429), {wait}s bekleniyor...")
                time.sleep(wait)
            else:
                print(f"  [{i+1}/10] Deneme {attempt}/3 hata: {e}")
                time.sleep(2)
    if not downloaded:
        print(f"  [!] BASARISIZ: {name}")

print(f"\n* Tamamlandi! {success}/10 adet GERCEK fis gorseli '{TARGET_DIR}' klasorune indirildi.")
