# MacBookPro10,1 — bu bilgisayara özel Chrome ayar kaydı

19 Kasım 2026. **Bu ayarlar genel FamiliarMac kurulumunda veya güncellemesinde uygulanmaz.** Sahibinin yeniden kurulum kaydı ve isteyenlerin inceleyebileceği manuel bir örnektir. Kişisel Chrome profili veya hesap verisi içermez.

## Ne değişti?

Zorin OS / GNOME 46 üzerinde Intel HD 4000 + NVIDIA GT 650M (Nouveau) bulunan MacBookPro10,1'de, Chrome Flatpak 158.0.8127.36 ile denendi. Chrome X11 olarak çalışıyor; masaüstü oturumu Wayland.

Intel ANGLE OpenGL seçimi, Mesa senkronizasyon beklemesini kapatma ve Chrome GPU vsync seçeneği birlikte kullanıldı. Ayrı test profilinde kullanıcı akıcılığın düzeldiğini doğruladı. Aynı grafik seçenekleriyle eski normal profil ve gizli penceresi takılmaya devam etti. **Eski profilin asıl sorunu kesinleşmedi; bunun belirli bir eklentiden veya tercihten kaynaklandığı kanıtlanmadı.**

Akıcı çalışan profil geçici önbellekten kalıcı `google-chrome-smooth` dizinine taşındı ve varsayılan açılış profili yapıldı. Eski `google-chrome` profili silinmedi. Kullanıcı yeni profilde Chrome Sync ile giriş yaparak verilerinin geldiğini bildirdi. Sync aşağıdaki yerel Flatpak ayarlarını taşımaz.

Son profil taşınmasından sonra bağımsız uzun süreli 1080p/tam ekran ve yırtılma ölçümü tamamlanmadı; olumlu sonuç kullanıcı gözlemine dayanır. Birden çok video aynı anda oynatılan teşhis denemesinde CPU 98°C'ye ulaştığından bu karşılaştırma güvenilir kabul edilmedi.

## Etkin ayarlar

Yalnızca `com.google.Chrome` için ortam değerleri:

```text
DRI_PRIME=pci-0000_00_02_0
vblank_mode=0
```

`~/.var/app/com.google.Chrome/config/chrome-flags.conf` içeriği (YOUR_USER yerine kendi kullanıcı adınızı ve gerçek mutlak yolu yazın; bu dosyada `$HOME` açılımına güvenmeyin):

```text
--use-gl=angle
--use-angle=gl
--disable-gpu-vsync
--user-data-dir=/home/YOUR_USER/.var/app/com.google.Chrome/config/google-chrome-smooth
```

Mevcut FamiliarMac başlatıcısı ve `--ozone-platform=x11` korunur. Sistem geneli GPU, fan ve güç ayarlarına dokunulmaz. `--disable-frame-rate-limit` kullanılmaz: düşük dropped-frame sayısına rağmen gerçek sunum hızını düşürdüğü görüldü. Teşhis amaçlı tracing ve otomatik oynatma seçenekleri kalıcı ayarlarda yoktur.

## İsteğe bağlı uygulama

1. Intel GPU'nun PCI adresini kendi bilgisayarınızda doğrulayın. Buradaki adres başka cihazlar için varsayılmamalı.
2. Chrome'dan tamamen çıkın. Mevcut flags dosyasını yedekleyin ve `flatpak override --user --show com.google.Chrome` çıktısını kaydedin.
3. Ayrı bir yeni profil için yukarıdaki kalıcı dizini seçebilirsiniz; ilk açılışta Chrome oluşturur. Önceden doğruladığınız test profilini taşıyacaksanız önce tamamen kapatın ve mevcut bir hedefin üzerine yazmayın. Yeni bir profil oluşturmak aynı sonucu garanti etmez.
4. Mevcut diğer seçenekleri koruyarak yukarıdaki satırları flags dosyasına ekleyin; çakışan seçenekleri veya çift satırları bırakmayın.
5. Yalnızca uygulamaya özel ortam değerlerini ekleyin:

```bash
flatpak override --user --env=DRI_PRIME=pci-0000_00_02_0 --env=vblank_mode=0 com.google.Chrome
```

Chrome'u normal başlatın. `chrome://version` içindeki Profile Path `google-chrome-smooth/Default` ile bitmeli; Command Line grafik seçeneklerini göstermeli. Aynı codec ve çözünürlükte tek video oynatarak pencere/tam ekran akıcılığını ve yırtılmayı kontrol edin. Senkronizasyonu kapatmak görüntü sunumunu ve güç tüketimini etkileyebilir; yalnızca cihazınızda yararlıysa tutun.

## Geri dönüş

Chrome tamamen kapalıyken yalnızca `--user-data-dir=...google-chrome-smooth` satırını kaldırmak eski profile döndürür. İki profil de diskte korunur.

Grafik değişikliklerini de geri almak için eklenen üç grafik seçeneğini önceki durumuna getirin. Bu bilgisayarda önceden bulunmayan iki ortam değerini kaldırmak için:

```bash
flatpak override --user --unset-env=DRI_PRIME --unset-env=vblank_mode com.google.Chrome
```

Önceden farklı değerleriniz varsa veya daha sonra bunları değiştirdiyseniz kendi yedeğinize göre geri alın. Tüm Flatpak izinlerini resetlemeyin; FamiliarMac entegrasyon izinleri korunmalı. Bu metin profil/veri yedeği değildir.

[İngilizce ayrıntılı kayıt](macbookpro10-1-chrome.md) · [Cihaza özel kayıtlar](README.md)
