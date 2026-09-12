# Melisa'nın Defteri

iPad + Apple Pencil için, Notability'ye benzer, ücretsiz bir not alma / PDF üzerine çizim uygulaması. PWA (web uygulaması) olarak çalışır; App Store veya abonelik gerektirmez, Safari'den "Ana Ekrana Ekle" ile kurulur.

## Özellikler (Faz 1 / MVP)

- PDF yükleme ve çok sayfalı görüntüleme
- Apple Pencil ile basınca duyarlı çizim, nesne bazlı silgi, geri al
- Boş defter oluşturma, sayfa ekleme
- Metin notları: taşıma, boyutlandırma, 4 font seçeneği, renk seçimi
- Tüm çizim/notlar cihazda (IndexedDB) saklanır — sunucu veya hesap yok
- Tam kütüphane yedekleme/geri yükleme (zip dosyası)
- Belgeyi düzleştirilmiş PDF olarak dışa aktarma
- Çevrimdışı çalışma (service worker) — bkz. "Bilinen sınırlamalar"

## Geliştirme

```bash
npm install
npm run dev
```

## Yayınlama

`main` dalına her push'ta GitHub Actions otomatik olarak build alıp GitHub Pages'e dağıtır (`.github/workflows/deploy.yml`). Deploy edilen adres:

`https://ilker-hd.github.io/pdfnot/`

Repo ayarlarında **Settings → Pages → Source** kısmının "GitHub Actions" olarak seçili olduğundan emin olun (ilk deploy sonrası otomatik ayarlanır, ama görünmüyorsa elle seçin).

## iPad'de kurulum ve test

1. Yukarıdaki adresi iPad Safari'de aç.
2. Doğrudan sekmede kalemle çizmeyi dene.
3. Paylaş → Ana Ekrana Ekle.
4. Ana ekrandaki simgeden aç (Safari çerçevesi olmamalı).
5. Uçak Modu'na al, uygulamanın hâlâ açılıp çalıştığını doğrula.
6. Bir sayfa yaz, uygulamayı tamamen kapat, yeniden aç, notların durduğunu doğrula.
7. Kütüphaneden "Yedekle" ile bir yedek al (Dosyalar'a kaydedilebilir).

## Bilinen sınırlamalar / sonraki adımlar

- Service worker (çevrimdışı önbellek) kaydı geliştirme ortamının tarayıcı panelinde test edilemedi (izleme katmanı engelliyor); gerçek iPad Safari'de doğrulanmalı.
- Fosforlu kalem, şekiller, lasso seçim, sayfa yeniden sıralama, arama, ses kaydı gibi özellikler sonraki fazlar için planlandı (bkz. proje planı).
- İkonlar basit bir yer tutucu monogramdır (`scripts/generate-icons.mjs` ile yeniden üretilebilir); istenirse gerçek bir logo ile değiştirilebilir.
