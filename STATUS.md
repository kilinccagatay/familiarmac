# Uygulama denetimi — 16 Kasım 2026

Bu dosya README'deki kronolojik notların yerine güncel tamamlanma durumunu özetler. Kurulu dosya ve birim testi, fiziksel kullanım doğrulaması anlamına gelmez.

| İstek | Durum / kalan iş |
|---|---|
| Yeniden uygulanabilir Git deposu; açık GitHub yayını | Kaynaklar ve kurucular bu depoda. Yayın için kurulum/geri alma ve kaynak belgeleri eklendi. |
| Apple açılış logosu, net görsel ve aşağıda ilerleme çubuğu | Kurulu. Vektörden farklı çözünürlüklerde PNG üretiliyor. Son fiziksel boot görünümü ayrıca doğrulanmalı. |
| Kapanırken logo/ilerleme gösterilmemesi | Boot-only koşulu kurulu, kod testi geçti. Fiziksel kapanış doğrulaması bekliyor. |
| Referans Mac giriş ekranı: büyük üst saat, altta avatar/parola | Yeni yerleşim GDM'ye kuruldu. Kurulu kaynak, GNOME sürüm hash koruması, tema içindeki saat stilleri ve başlatıcılar doğrulandı; yerleşim testleri geçti. Fiziksel giriş ekranı henüz görülmedi. |
| Giriş ekranındaki aşırı büyük oturum dişlisi | GNOME 46 gerçek AuthMenuButton sınıfına 16px simge sınırı kuruldu; yeni giriş ekranında görsel doğrulama bekliyor. |
| Üst panel Apple menüsü, tek logo, sağda tarih | Kurulu ve kullanıcı fotoğraflarında görüldü. |
| Apple/app menüsü sol hizası ve satır girintileri | Düzeltmeler kurulu. Son girinti düzeltmesi yeni oturum sonrası görsel doğrulama bekliyor. |
| Uygulama menülerinin panelde görünmesi | Brave/ChatGPT gerçek menüleri fotoğraflarla doğrulandı. Tüm Linux uygulamaları menü yayınlamaz; evrensel değil. |
| ChatGPT içindeki yinelenen File/Edit/View menüsü | Sürüm kontrollü renderer patch kurulu. Uygulama tam yeniden açılınca görünür; son fiziksel doğrulama bekliyor. |
| Uygulama açılırken başka menünün kısa süre görünmesi | Odak/menü yayını bekleme düzeltmesi kurulu, yeni oturumda fiziksel doğrulama bekliyor. |
| Masaüstünde Gjs yerine Finder işlevleri | DING filtreleme ve dosya yönetimi menüleri kurulu. |
| Dock sabit, büyütülmüş pencere dock altında kalmasın | Kurulu, fotoğraflarda ayrılmış alan var. |
| Finder göstergesi diğer uygulamalarla aynı olsun | Yerel dock renderer kullanılıyor; son ekran görüntüsünde aynı beyaz nokta görüldü. |
| Son pencere kapanınca uygulama arka planda kalsın; Quit ayrı olsun | KISMİ. Cmd+Q ayrıldı ve yaşayan süreç göstergesi eklendi. Son pencereyle kendiliğinden çıkan her uygulamayı arka planda tutma uygulanmadı. |
| Kapanmakta olan Brave'i dock'tan tek tıklamayla açma | Bekleyen tek istek/coalescing düzeltmesi kurulu. Gerçek yarış koşulu doğrulaması bekliyor. |
| Pencere köşeleri macOS benzeri olsun | 12px/smoothing 0.2 aktif. ChatGPT dış köşeleri görüntüyle doğrulandı. Tam macOS eğrisi iddia edilmiyor. |
| Brave'deki ikinci iç eğri | ÇÖZÜLMEDİ. Önceki Chromium-only GTK CSS denemesi kullanıcı tarafından etkisiz olarak doğrulandı; yeni kurucu bunu uygulamaz. |
| Büyütülmüş pencere kenarındaki ince boşluk | Padding=0 aktif; ek üst/sol inset düzeltmesi kurulu, yeni Shell oturumu gerekiyor. |
| Küçültme animasyonu | Magic Lamp eklentisi kurulu; fiziksel benzerlik doğrulanmadı. |
| Cmd kısayolları ve screenshot 3/4/5 | Kurulu. Açık popup/modal üzerinde yeni Shell capture katmanı kurulu; fiziksel doğrulama bekliyor. Giriş/kilit ekranları kapsam dışı, dolayısıyla 'her şeyin üzerinde' tamamen sağlanmış değil. |
| Touchpad tercihlerimi koru | Son işlerde hız/tap/gesture ayarlarına yazılmadı. |
| Akıcı kaydırma | Brave/ChatGPT --enable-smooth-scrolling eklendi. Sistem genelinde macOS momentum eğrisi uygulanmış değil. |
| Çok hızlı kaydırmayı azalt | Finger scroll mesafesi 0.50 ölçekleyecek kullanıcı Shell preload'u kuruldu. Sonraki oturumda devreye girer; fiziksel değerlendirme bekliyor. İmleç/klavye/gesture hook'u yok. |
| Wi-Fi | Kullanıcı Wi-Fi’nin çalıştığını doğruladı. |
| ChatGPT içindeki sarı bant | Kullanıcının isteğiyle şimdilik kapsam dışında. |

## Geri alma

- Kaydırma mesafesi: `bash scripts/install-scroll-speed.sh --restore`, sonra oturumu yeniden aç.
- Kaydırma animasyonu başlatıcıları: `python3 scripts/install-smooth-scrolling.py --restore`.
- Chromium iç köşe CSS'i: `~/.config/gtk-3.0/gtk.css` içindeki `macbook-chromium-inner-corners` işaretli bloğu kaldır.
- Giriş yerleşimi: `sudo bash scripts/install-login-layout.sh --restore`.

## Public installer status
Preflight, dry-run, source checksums and automated tests are included. Fresh-OS end-to-end installation is not yet independently verified. Other distributions/models are unsupported. Historical development notes are not the current installation guide.

## Brightness
Opt-in `--brightness`: internal gmux down key can reach true zero. Real hardware readback confirmed `actual_brightness=0`; native GNOME StepUp restored light, and the initial brightness was restored after the test. Native up key is deliberately retained (including secure-screen behavior). Custom down shortcut is not claimed to work on secure screens or every modal grab.

## Son uygulama uyarlaması doğrulamaları

- ChatGPT: gerçek Electron kısayol aktarımı düzeltildi; kullanıcı yeniden açtıktan sonra doğruladı.
- Audacity: ortak GTK3 Flatpak modülü ile normal açılışta üst menü, yerel menünün gizlenmesi ve kısayol işaretleri görsel olarak doğrulandı.
- Krita/Scribus/FreeCAD: ana ekranlar tek tek incelendi. Windows/Window tekrarının ortak düzeltmesi hazır; yeni oturumda görsel kontrol bekliyor.
- Kurulum/güncelleme izleyicisi etkin; geçici launcher olayıyla otomatik çalışması doğrulandı. Bu test yeni indirilen her uygulamanın uyarlanacağını garanti etmez.
- Ardour istisnası ve HomeBank'in yeniden görsel kontrolü açık kalıyor. GPU çökmesinin kök nedeni çözülmüş sayılmıyor; Mixxx geçici yazılım çizimi ayrı ve opt-in.

Ayrıntılar: [otomasyon](docs/APPLICATION-INTEGRATION.md), [uygulama denetimi](docs/APPLICATION-AUDIT.md), [GPU tanılama](docs/GPU-DIAGNOSTICS.md).
