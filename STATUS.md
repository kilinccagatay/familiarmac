# Uygulama denetimi — 18 Kasım 2026

Bu dosya README'deki kronolojik notların yerine güncel tamamlanma durumunu özetler. Kurulu dosya ve birim testi, fiziksel kullanım doğrulaması anlamına gelmez.

18 Kasım / 1.0.2: ChatGPT penceresi hazırken Dock simgesinin geç gelmesi kullanıcı tarafından **düzeldi** olarak doğrulandı. İlk açılış için odaklanmış normal X11 penceresine ait, eşleştirmesi kesin başlatma kaydı tamamlanır; tepsi dönüşü ve Dock yenilemesi ayrıca korunur. Bu doğrulama tüm uygulamalar veya GNOME sürümleri için ölçülmüş bir performans garantisi değildir. Dock menü işaretçisi, balonlar, panel geçişleri ve Ayarlar başlatıcıları otomatik test kapsamındadır; her ölçek/ekran düzeni ayrı görsel doğrulama gerektirir.

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
- HomeBank ortak GTK3 düzeltmesiyle yeniden açılarak menü/kısayol aktarımı doğrulandı. Ardour istisnası açık kalıyor. GPU çökmesinin kök nedeni çözülmüş sayılmıyor; Mixxx geçici yazılım çizimi ayrı ve opt-in.

Ayrıntılar: [otomasyon](docs/APPLICATION-INTEGRATION.md), [uygulama denetimi](docs/APPLICATION-AUDIT.md), [GPU tanılama](docs/GPU-DIAGNOSTICS.md).

### Latest sequential application checks

Evolution native menu export is repaired through an audited, reversible catalog profile (X11 launcher plus its own menubar settings); File rows and shortcut hints verified. Shotwell empty-library menus and hints verified. HandBrake still duplicates its local menu and has no File shortcut hints; further GTK4 integration work is required. No Wi-Fi, boot, kernel or GPU configuration changed during these checks.


2026-11-17 — Shared menu completion installed (next normal login): actual GTK
app/window addresses, empty-GMenu action fallback, state refresh, transient dialog
identity, and shared read-only GtkAccelMap shortcut hints. Live backend checks
passed for Mousepad, Rhythmbox and Apostrophe; native GMenu/D-BusMenu priority and
lifecycle tests passed. Existing Shell was not restarted; visual panel verification
is pending login. Apps without exported or supported saved accelerator metadata
still have no inferred hints. Wi-Fi/boot/graphics settings unchanged.

2026-11-17 post-login visual check: Mousepad hints and chooser identity, Rhythmbox Settings/dialog identity, Apostrophe Open/Save/Find, and VLC/Inkscape native menu regressions verified. VLC Flatpak chooser still identifies as Portal; transient-owner priority follow-up installed, awaiting visual validation after normal login. Apostrophe hints remain unavailable without supported metadata.

2026-11-17 Apostrophe hints: shared conservative Python/GTK startup reader and
underscore action-ID lookup installed; live action/shortcut model and regression
suite pass. No keys assigned. Pending next normal-login visual check together
with VLC portal ownership.

2026-11-17 second login: Apostrophe hints visually verified. VLC Portal identity
remains unresolved: backend FileChooser.OpenFile carries org.videolan.VLC but
parent_window=x11:0. Actual request metadata is available; transient-parent-only
resolution is insufficient. No persistent D-Bus monitor or Qt/graphics change.

2026-11-17 generic Portal ownership bridge installed and running. Actual request
app ID + backend PID + chooser title resolve orphan dialogs without changing Qt,
Flatpak or graphics. Live bridge/client and full regression checks pass. Next
normal login required for final panel display verification.

2026-11-17 Portal ownership visual verification PASSED after root-cause fix:
Meta reported the GNOME Shell PID for the portal's inherited Wayland socket,
while D-Bus reported the backend PID. Added a generic guarded compositor-socket
match: exact backend executable/window class and title, unique window/request.
No VLC-specific mapping or last-focused-app fallback. Loaded the installed
resolver into the running owner instance without restarting Shell. The open VLC
chooser visibly showed “VLC media player”; cancelling cleared GetState to [],
and native Media menu/shortcut hints were visually verified afterward. Full
regression suite passed. Wi-Fi, graphics, boot and sandbox settings untouched.


## 17 Kasım — son yayın kapsamı

Ortak GTK menü tamamlama, eylem durum güncellemelerinde tıklama bağlantısını koruma,
GtkBuilder kaynaklarından gerçek kısayol okuma ve doğrulanan portal sahipliği
kuruldu. Text Editor New Window → ⌘N ve Clocks kısayol penceresi ekranda doğrulandı.
GTK4 başlıkları 32px içerik minimumu + eşit 4px üst/alt boşluk kullanır; Calendar
ve Maps son hâli ekranda kontrol edildi. Bağlı grid başlıkları da dengeli boşluk alır.
Yerel ve Flatpak kurulum/geri alma testleri geçti. Tüm uygulamalar tam destekli
sayılmıyor: dışa aktarılmayan GTK4 belge komutları, bazı eksik kısayollar, HandBrake
menü tekrarı ve Ardour istisnası sürüyor. Mixxx/GPU sorunu çözülmüş sayılmıyor.
