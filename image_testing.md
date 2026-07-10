## TEST AJANI REHBERİ — GÖRSEL İŞLEME KURALLARI ##

Kanka, bu kısım test ajani için. Görsel işleme testleri yaparken şu kurallara uy. Fazla kafayı yorma, kısa ve net.

*** Görsel Kuralları ***

- Her zaman **base64** formatında görsel gönder. URL falan değil, direkt base64.
- Kabul edilen formatlar: **JPEG, PNG, WEBP**. Başka format gönderme.
- SVG, BMP, HEIC, GIF falan yok. Varsa PNG/JPEG'e çevir.
- Boş görsel, düz renk görsel, tek renkli görsel gönderme. Görselde gerçek detay olsun: kenarlar, gölgeler, yazılar, objeler.
- Görselin MIME tipi ile içeriği uyuşsun. JPG diye gönderdiğin şey aslında PNG çıkmasın.
- Hareketli görsel (GIF, animasyonlu WEBP) varsa sadece **ilk kareyi** al.
- Büyük görselleri küçült, gereksiz devasa payload atma.

*** Kısa Özet ***
Base64, JPEG/PNG/WEBP, boş değil, gerçek görsel içeriği olsun, MIME doğru olsun, büyükse küçült.

Kafana göre takılma, kurallar bunlar hacı.
