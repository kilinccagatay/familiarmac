# MacBookPro10,1 — bu bilgisayara özel Plex ayar kaydı

19 Kasım 2026. **Bu ayarlar genel FamiliarMac kurulumu veya güncellemesiyle uygulanmaz.** Yeniden kurulum için isteğe bağlı, manuel bir kayıttır; Plex hesabı, sunucu adresi veya kişisel oynatma verisi içermez.

## Gözlem ve kapsam

Zorin OS / GNOME 46, Wayland oturumu ve Intel HD Graphics 4000 + NVIDIA GT 650M (Nouveau) bulunan MacBookPro10,1 üzerinde `tv.plex.PlexDesktop` Flatpak uygulaması denendi.

NVIDIA çizim yoluyla açılan son denemede Plex günlüğü `NVE7` gösteriyordu. Tampon doluyken yaklaşık 10 saniyede atlanan kare sayısı 2'den 148'e çıktı. Aynı bilgisayarda aşağıdaki Intel/X11/senkronizasyon ayarlarıyla kullanıcı önce köşe efektleri kapalıyken, ardından açıkken pencere modunda akıcılığı doğruladı. Intel seçimi günlüğün `OpenGL VENDOR` / `GL_RENDERER` satırlarında da doğrulandı.

Bu, üç seçeneğin birlikte çalıştığı bir cihaz kaydıdır; iyileşmenin yalnızca tek bir seçeneğe ait olduğunu kanıtlamaz. Köşeler açık karşılaştırma sırasında yerel deneysel Mutter yuvarlatma kodu vardı; bu belge o kodu kurmaz ve başka sistemlerde aynı sonucu garanti etmez. Son doğrulama kullanıcı gözlemidir; bu son birleşim için bağımsız uzun süreli kare/yırtılma ölçümü yapılmadı. Intel ile çizim, her codec'in donanımla çözüleceği anlamına gelmez: test videosu yazılımsal çözmeye dönüyordu.

## Yeniden uygulama

Plex'ten tamamen çıkın. Intel GPU'nun PCI adresini `lspci -nn` ile doğrulayın; aşağıdaki adres bu bilgisayara aittir. Mevcut Plex override değerlerini kaydedin:

```bash
flatpak override --user --show tv.plex.PlexDesktop
```

Varsa `~/.local/share/flatpak/overrides/tv.plex.PlexDesktop` dosyasını da yedekleyin. Ardından yalnızca Plex için:

```bash
flatpak override --user \
  --env=DRI_PRIME=pci-0000_00_02_0 \
  --env=QT_QPA_PLATFORM=xcb \
  --env=vblank_mode=0 \
  tv.plex.PlexDesktop
```

- `DRI_PRIME`: Intel GPU'yu seçer.
- `QT_QPA_PLATFORM=xcb`: Wayland masaüstünde Plex'i X11/XWayland üzerinden çalıştırır.
- `vblank_mode=0`: Mesa'nın dikey senkronizasyon beklemesini kapatır; görüntü yırtılması ve güç tüketimi açısından kendi cihazınızda kontrol edin.

Normal Plex simgesinden açın. Kullanıcı override'ı her yeni açılışta uygulanır; ayrıca özel bir başlatıcı gerekmez. Chrome profili, Chrome Flatpak ayarları, sistem geneli GPU/güç ayarları ve Plex `mpv.conf` dosyası değiştirilmez.

## Doğrulama

```bash
flatpak override --user --show tv.plex.PlexDesktop
flatpak run --command=sh tv.plex.PlexDesktop -c 'printf "DRI_PRIME=%s\nQT_QPA_PLATFORM=%s\nvblank_mode=%s\n" "$DRI_PRIME" "$QT_QPA_PLATFORM" "$vblank_mode"'
```

Plex'i normal açtıktan sonra `~/.var/app/tv.plex.PlexDesktop/data/plex/Logs/Plex.log` dosyasındaki en yeni `OpenGL VENDOR` / `GL_RENDERER` satırlarında `Intel` ve `HD Graphics 4000` arayın. Ortam değişkenlerini görmek tek başına GPU seçimini kanıtlamaz. Aynı videoyu aynı boyutta pencere ve tam ekran modunda deneyin.

## Geri alma

Bu bilgisayarda önceden Plex kullanıcı override'ı yoktu. Plex kapalıyken yalnızca eklenen değerleri kaldırmak için:

```bash
flatpak override --user \
  --unset-env=DRI_PRIME \
  --unset-env=QT_QPA_PLATFORM \
  --unset-env=vblank_mode \
  tv.plex.PlexDesktop
```

Önceden bu anahtarlara ait farklı değerler varsa yedeğinizdeki değerleri geri yükleyin. Tüm Flatpak izinlerini sıfırlamayın. Yeniden açınca eski başlatma koşulları geçerli olur.

[English](macbookpro10-1-plex.md) · [Cihaza özel kayıtlar](README.md)
