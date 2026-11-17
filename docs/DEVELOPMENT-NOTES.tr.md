# MacBook Zorin

MacBookPro10,1 üzerinde Zorin OS 18.1 / GNOME 46 / Wayland için tekrar uygulanabilir kişisel profil. GitHub'a yüklenmez. Klavye motoru **keyd 2.6.0**; bu depo yeni bir eşleme motoru yazmaz.

## Kurulum

```bash
./apply.sh             # Kullanıcı ayarları, ardından sudo ile sistem kurulumu
./apply.sh --gui       # Yerel grafik parola penceresiyle kurulum
./apply.sh --desktop-only
```

Sistem kurulumundan sonra bilgisayarı yeniden başlatın. Bu işlem keyd servisini, yeni grup üyeliğini, GNOME uygulama eşleme eklentisini ve Apple açılış temasını birlikte etkinleştirir. Kurucu kendisi yeniden başlatmaz. GNOME Terminal'i oturum yeniden açıldıktan sonra başlatın; uygulamaya özel eşlemeler eklentiye bağlıdır.

## Değişiklikler

- GNOME ve GTK düğme sırası solda: kapat, küçült, büyüt.
- GNOME Shell, GTK 3/4 ve simgeler için gerçek WhiteSur koyu teması; kırmızı, sarı, yeşil pencere düğmeleri. GTK4 uygulamalarına tema CSS import ile uygulanır.
- Panelde yalnızca tek Apple simgesi (Zorin menüsü kapalı). Altta dar, sürekli görünür ve büyütülmüş pencereler için çalışma alanı ayıran dock, çalışan uygulama noktaları, çöp ve disk simgeleri.
- Doğal kaydırma, dokunarak tıklama, iki parmakla kaydırma/sağ tık, dokunup sürükleme.
- GNOME Wayland'ın yerleşik üç parmak yukarı genel bakış ve yatay çalışma alanı hareketleri. Pinch-to-zoom uygulama desteğine bağlıdır. macOS'un bütün hareketleri aynı değildir.
- 512×512 kaynak görselden ekran boyutuna göre ölçeklenen Apple logolu Plymouth script teması. Altında Plymouth ilerleme tahminini gösteren ince çubuk; veri yokken hareketli gösterge bulunur. Yüzde yazılmaz. Parola, soru ve durum mesajları için ayrı callback işlevleri vardır. Initramfs yeniden oluşturulur.
- Apple klavyesinde medya tuşları varsayılan; Fn ile F tuşları.
- Yalnızca `k:05ac:0262:f2d1f5c2` dahili klavyeye uygulanan keyd profili. Aynı USB kimliğini paylaşan `05ac:0262:799a7e74` touchpad açıkça dışlanır. Başka MacBook modellerinde aygıt kimliğini ayrıca inceleyin.

## Giriş ekranı ve görünüm düzeltmesi

GDM için `/usr/local/share/macbook-zorin/gdm.gresource` kayıtlıdır; dağıtımın orijinal tema kaynakları değiştirilmez. `gdm-theme.gresource` alternatifi bu dosyaya yönlendirilir. Giriş ekranındaki alttaki ayrı logo kaldırılır. GNOME 46/Zorin için `gdm.css`, `gnome-shell.css` ve açık/koyu CSS adları aynı kaynakta sunulur; oturum seçme dişlisi 16px simgeyle sınırlanır. GNOME 46 için upstream kaynaklardan derlenir. Giriş yöneticisi kurulum sırasında yeniden başlatılmaz.

Yalnızca touchpad düzeltmesini yeniden uygulamak için:

```bash
sudo bash scripts/fix-touchpad.sh
```

Bu işlem anında etkilidir. `tests/device-match.c`, keyd'nin gerçek `config_check_match` işlevini kullanarak klavyenin eşleştiğini, touchpad'in eşleşmediğini test eder. İlk kurulumdaki geniş USB eşlemesi bu regresyon testiyle engellenir.

## Kısayollar

| Fiziksel tuşlar | Davranış |
|---|---|
| Cmd+C/V/X/A/Z/S/F | Uygulamanın Ctrl karşılığı |
| Cmd+Shift+Z | Yinele (uygulama desteğine bağlı) |
| Cmd+Tab / Cmd+Shift+Tab | Uygulama değiştir |
| Cmd+Space | GNOME genel bakış ve arama |
| Cmd+Q | Etkin pencereyi kapat; macOS gibi tüm uygulamayı sonlandırmaz |
| Cmd+H / Cmd+M | Etkin pencereyi küçült |
| Cmd+←/→ | Satır başı/sonu |
| Cmd+↑/↓ | Belge başı/sonu |
| Option+←/→ | Kelime atla |
| Cmd+Shift+3 | Ekran görüntüsü |
| Cmd+Shift+4 | Alan seçip dosyaya kaydet |
| Cmd+Shift+5 | Ekran görüntüsü/kayıt seçim arayüzü |
| Cmd+Ctrl+Shift+3 | Tam ekranı panoya kopyala |
| Cmd+Ctrl+Shift+4 | Alan seçip panoya kopyala |
| Ctrl+Cmd+F | F11 tam ekran (uygulama desteğine bağlı) |
| Terminalde Cmd+C/V | Kopyala/yapıştır |
| Terminalde fiziksel Ctrl+C | İşlemi durdur |

Terminal eşlemesi GNOME Terminal, GNOME Console ve kısmen Kitty için tanımlıdır. Başka terminal kullanırken `config/app.conf` içine sınıfını ekleyin. GNOME uygulama eşleme eklentisi çalışmıyorsa Cmd+C terminale Ctrl+C olarak gider; terminalde kopyalama için eşleyici çalışana kadar Ctrl+Shift+C kullanın.

## Geri alma

```bash
./restore.sh
```

İlk kullanıcı ayarları `~/.local/state/macbook-zorin/desktop.json`, sistem yedekleri `/var/lib/macbook-zorin/` altında tutulur. Bunlar Git'e eklenmez. Geri alma sadece değiştirilen anahtarları ve dosyaları eski haline getirir; bütün dconf veritabanını sıfırlamaz. keyd servisini kapatır, önceki Plymouth ve GDM temalarını geri seçer, giriş ekranı ayarlarını geri alır. Yüklü derleyici paketlerini ve etkin olmayan keyd/WhiteSur tema dosyalarını ve WhiteSur kurucusunun eklediği GTK4 Theme Switcher yardımcı uygulamasını silmez. Geri aldıktan sonra yeniden başlatın.

Klavye beklenmedik davranırsa keyd'nin acil durdurma kombinasyonu: **Backspace + Escape + Enter**. Ardından geri alma betiğini çalıştırın.

## Doğrulama

```bash
./scripts/test.sh
keyd check config/apple.conf
systemctl status keyd
gnome-extensions info keyd@keyd.rvaiya.github.com
tail ~/.config/keyd/app.log
```

2026-11-15 kurulumunda: kullanıcı ayarları okuma ile doğrulandı; keyd yapılandırması ayrıştırıldı; upstream keyd testleri ve Cmd+C/V, fiziksel Ctrl+C testleri geçti; Apple tema dosyalarının üretilen initramfs içinde olduğu doğrulandı. Servis sonraki açılış için etkinleştirildi. İlk yeniden başlatma sonrası klavye çalıştı; kullanıcı açılış logosunun büyük olduğunu ve touchpad hareketlerinin bozulduğunu bildirdi. İkinci düzeltmede touchpad keyd kapsamından çıkarıldı ve kullanıcı çalıştığını doğruladı. Logo 64×64 yapıldı. GNOME 46 WhiteSur teması ve simgeler etkinleştirildi; GTK4 CSS kontrolü sıfır hata verdi. Yeni GDM görünümü ve küçültülen açılış logosu henüz gerçek yeniden açılışta görülmedi.

## Sınırlar ve ChatGPT/Codex

Bu profil Linux'u macOS'a dönüştürmez. Firmware ekranı, macOS global menü ve uygulamaların kendi çizdiği arayüzler bu kurulumla birebir macOS olmaz. GRUB zaten gizli olduğu için önyükleme/recovery davranışı değiştirilmedi.

Bu bilgisayardaki ChatGPT/Codex uygulaması Electron'un kendi çizdiği Linux başlık çubuğunu kullanıyor. Sistem ayarını izlemediği fotoğrafla doğrulandı. `scripts/chatgpt-frame.py` sürümü kontrol eden bir uyumluluk düzeltmesidir: ana/ayrılan pencerelerde sistem başlık çubuğunu açar ve özel overlay güncellemelerini kapatır. ASAR bütünlük hash'leri yenilenir; orijinal dosya `/var/lib/macbook-zorin/chatgpt-frame/original.asar` altında tutulur. Açık uygulama kapatılmaz. Güncelleme bu düzeltmeyi kaldırabilir; tanımadığı sürüme uygulanmayı reddeder.

```bash
# Bu sürümde native başlık çubuğunu yeniden uygulama:
sudo bash scripts/chatgpt-native-frame.sh
# Yalnızca uygulama düzeltmesini geri alma:
sudo python3 scripts/chatgpt-frame.py restore
```

Geri alma mevcut dosya hash'i değişmişse eski sürümü yeni uygulamanın üzerine yazmayı reddeder. Bu durumda uygulamanın normal paketini yeniden kurun.

## Wi-Fi

BCM4360 (14e4:43a0) kartında b43 sürücüsü desteklenmeyen PHY hatası veriyordu. Zorin deposundaki `broadcom-sta-dkms` (6.30.223.271-29ubuntu1+zorin2) çekirdek 7.0.0-43 için derlenip `wl` yüklendi. `wlp4s0` ortaya çıktı ve ağ taraması başarılı oldu. Wi-Fi ağına giriş kullanıcı tarafından ağ menüsünden yapılır; parola depoda tutulmaz. `scripts/wifi.sh` yeniden kurulum içindir. Görünüm geri alma işlemi çalışan Wi-Fi sürücüsünü kaldırmaz.

## Kaynaklar

- [keyd](https://github.com/rvaiya/keyd), v2.6.0, commit `7c0aecb8bfd34dc8642bf4eefd2e59c89e61cec3`. Kaynak arşivi ve upstream lisansı `vendor/keyd-2.6.0.tar.gz` içinde.
- [keyd uygulama eşleyicisi](https://github.com/rvaiya/keyd/blob/v2.6.0/docs/keyd-application-mapper.scdoc).
- [Devicon Apple SVG](https://github.com/devicons/devicon/blob/master/icons/apple/apple-original.svg). Devicon MIT lisansı `assets/DEVICON-LICENSE` içinde. Apple logosu Apple Inc. markasıdır.
- [Apple model tanımlama](https://support.apple.com/en-gb/108052): MacBookPro10,1, 15 inç Retina 2012/erken 2013 ailesi; model kimliği tek başına bu iki yılı ayırmaz.

- [WhiteSur GTK](https://github.com/vinceliuice/WhiteSur-gtk-theme), commit `d5782652d412137e26fb8ff55b55a5572e4c6995`; kaynak ve lisans `vendor/whitesur-gtk.tar.gz` içinde.
- [WhiteSur simgeleri](https://github.com/vinceliuice/WhiteSur-icon-theme), commit `73d8040da51a9ed74e47c7366e7e9ff437601a5c`; kaynak ve lisans `vendor/whitesur-icons.tar.gz` içinde.

## Üçüncü düzeltmenin doğrulaması

- Touchpad dışlama ve mevcut Cmd+C/V testleri geçti.
- Cmd+Ctrl+Shift+3/4 tuşları gerçek keyd motorunda, Ctrl/Cmd basma sırasının her ikisiyle sınandı; doğru modifier kombinasyonu üretildi ve basılı kalan tuş yok.
- ChatGPT yamasının tüm JavaScript dosyası sözdizimi kontrolünden geçti; Linux ana/ayrılan pencereleri native frame kullanıyor.
- GDM'nin önceki kaynağında eksik olan `gdm.css` adı düzeltildi.
- Açılış ve GDM'nin fiziksel ekrandaki son görünümü, sonraki açılışta kullanıcı tarafından doğrulanmalı.

### Son masaüstü kontrolleri

Dock'un Zorin kapsül stili kapatıldı. `dock-fixed=true`, `autohide=false`, `intellihide=false` ile sabit ve pencere alanından pay alan davranış etkin. 2880×1800 ekranda `_NET_WORKAREA` değeri `(0,56,2880,1584)` olarak okundu: altta 160 fiziksel piksel dock için ayrıldı. Ekran görüntüsünde ChatGPT penceresinin dock üstünde bittiği ve panelde tek Apple simgesi kaldığı doğrulandı.

Panoya kopyalama için GNOME Screenshot'ın bu oturumda görüntüyü kalıcı tutmayan `--clipboard` yolu yerine `gnome-screenshot --file` + `xclip` kullanılır. Geçici PNG işlem bitince silinir; xclip panonun sahibi olarak görüntüyü tutar. Gerçek 2880×1800 görüntü panodan geri okunarak doğrulandı. Alan seçiminin iptali boş dosyayı panoya göndermez.

### Apple menüsü ve masaüstleri

`extensions/macbook-menu@local` GNOME 46 için ayrı bir sistem menüsüdür. Etkinlikler düğmesini ve üzerindeki çalışma alanı göstergesini gizler; tek Apple simgesinden sistem ayarları, mağaza, genel görünüm, uyku, kilit ve GNOME'un onaylı oturum/güç işlemlerini sunar. Yeni eklenti **oturum yeniden açılınca** yüklenir; çalışan oturumda henüz görsel doğrulanmadı.

Dinamik yatay masaüstleri tüm ekranlarda birlikte değişir. Ctrl+Option+Sol/Sağ masaüstü değiştirir; Shift eklenince pencere taşınır. Ctrl+Yukarı genel görünümü açar; Cmd+Space aramayı korur. Ctrl+Sol/Sağ özellikle kullanılmaz: keyd'nin Option+ok kelime gezinme eşlemesi bu tuşları üretiyor. Sol üst sıcak köşe kapalıdır.

Son kullanıcı geri bildiriminde çoklu dokunma hareketleri çalışmıyor ve trackpad hissi hâlâ yetersiz. Wayland oturumu ve bcm5974 sürücüsü doğrulandı. X11 Gestures eklentisi kendi kodunda Wayland'da erken çıkıyor; bu eklenti hareketlerin çalıştığının kanıtı değildir. Hareketler için kullanıcı doğrulaması ve çalışan Mac ayarlarıyla karşılaştırma bekleniyor.

### Referans Mac ile trackpad karşılaştırması (2026-11-15)

SSH üzerinden salt okunur ayarlar alındı; ham çıktı kişisel pencere/uygulama verileri içerdiğinden depoya eklenmedi. Referans Mac'te `Clicking=0`, `Dragging=0`, `TrackpadThreeFingerDrag=0`, sağ tık, kaydırma, pinch ve üç/dört parmak kaydırmaları etkin. Linux tarafında dokunarak tıklama ve dokunup sürükleme kapatıldı; fiziksel tıklama ve iki parmakla sağ tıklama korundu. Kullanıcının fazla hızlanma geri bildirimine göre adaptif hız önce -0.35 denendi; yavaş bulununca **-0.15** olarak düzeltildi. Bu değer bir yüzde değildir. Referansın hız ve doğal kaydırma global anahtarları mevcut olmadığı için sayısal hız eşleşmesi iddia edilmez.

[Touchpad Gesture Customization](https://extensions.gnome.org/extension/7850/touchpad-gesture-customization/) v27, GNOME 45–48 uyumlu sürüm olarak sabitlendi. GNOME Extensions indirme kimliği `76688`, arşiv SHA256 `8184d9c65673a0cb8dadc000db9b56f21753da3b0736c4f54ab22bb6ae64cb7a`. Kaynak: https://github.com/HieuTNg/touchpad-gesture-customization . Arşiv ve lisans vendor içinde; başka makinede kurulum için ağ gerekmez. Eklenti şeması ve ikili dosyaları kullanıcı ayarlarıyla birlikte yedeklenir/geri alınır.

- Üç/dört parmak yatay: çalışma alanı değiştir.
- Üç/dört parmak dikey: pencere genel görünümü; uygulama ızgarasına geçmez.
- Dört parmak açma: masaüstünü göster; kapatma ile geri dönme eklentinin davranışına bağlıdır.
- Üç parmak pinch: kapalı. Eklentinin varsayılan belge/pencere kapatma hareketleri kullanılmaz.
- İki parmak kaydırma/zoom: sistem ve uygulama desteğine bırakılır.

Wayland'da işlem yapmayan X11 Gestures devre dışı bırakılır. Yeni gesture eklentisi ve Apple menüsü sonraki oturumda yüklenir; gerçek parmak hareketleri henüz doğrulanmadı. Dokunma sürücüsünün günlüğünde tek bir `Touch jump detected and discarded` olayı da görüldü; hız ayarı bunun düzeldiğini kanıtlamaz.

Sabit dock'un Zorin CSS'indeki 4 mantıksal piksel üst boşluğu ve ek ikon üst payı kaldırıldı. Kural hem Shell temasında hem Apple menü eklentisinin yüksek öncelikli stylesheet dosyasında bulunur; dock sabit kalır ve çalışma alanından yer ayırır. Yeni stylesheet'in görsel sonucu oturum yeniden açıldıktan sonra doğrulanmalıdır.

### Ortak onay pencereleri

Kullanıcının oturum kapatma fotoğrafında iptal düğmesinin yazısı görünmediği ve düğme kenarlarının bozulduğu görüldü. `config/shell-refinements.css` içinde `.modal-dialog` kapsamındaki ortak düğme ve etiket renkleri, hover/active/disabled durumları, klavye odak çerçevesi, kenar boşlukları ve köşe yarıçapları açıkça tanımlandı. Düzeltme oturum kapatma/yeniden başlatma dahil aynı sınıfı kullanan Shell onaylarına uygulanır. Tema canlı yeniden yüklendi; St.Theme oluşturma kontrolü başarılı. Otomatik oturum kapatma başlatılmadı; son pencere görünümü henüz görsel doğrulanmadı. GDM ve uygulama içi özel diyaloglar bu CSS kapsamına girmez.

### Menü, giriş ekranı ve küçültme güncellemesi

Apple menüsü sabit Türkçe yerine oturum dilini kullanır (özel metinlerde İngilizce/Türkçe, standart güç eylemlerinde GNOME çevirisi). Açılır kutunun kaynak hizası sola alındı; ok kaldırıldı, 250px minimum genişlik, grup ayraçları ve ilk üç seçeneğe simgeler eklendi. Son kullanılan belgeler yerel XBEL dosyasından okunur; içerikleri depoya alınmaz. Force Quit seçeneği Sistem Monitörü'nü açar: kullanıcı burada işlemi seçip sonlandırır, menü doğrudan uygulama öldürmez. Menü kodundaki değişiklikler oturum yeniden açıldığında yüklenir.

GDM resource paketine `gdm-dark.css`, `gdm-light.css`, `gdm-high-contrast.css` adları eklendi. Giriş arka planı artık masaüstü duvar kâğıdının aynısı; kaynak içindeki PNG hash'i kurulu duvar kâğıdıyla doğrulandı. Seçili kullanıcı kutusu ve parola alanına nötr renkler uygulandı. GDM simge teması Adwaita olarak değiştirildi, oturum seçici simgesi 16px ile sınırlandı. Bu yalnızca giriş yöneticisinin simgelerini etkiler. Giriş ekranı macOS'un birebir kopyası değildir; GNOME kimlik doğrulama ve kullanıcı seçimi düzenini korur. Son fiziksel görünüm yeniden girişte doğrulanacak.

Küçültme için [Compiz alike magic lamp effect](https://github.com/hermes83/compiz-alike-magic-lamp-effect) v25 kuruldu; GNOME 46 desteklenen sürümler arasında. Arşiv `vendor/magic-lamp-v25.zip` içinde (GPL-3.0-or-later lisansı arşivde), SHA256 `a3a445a0f0329b581fec6edd2c33f143eec9b267cbb9b028bb6d7bff990cc420`. Süre 400ms. Pencereyi dock ikonuna doğru büken efekt sonraki oturumda yüklenir; animasyon henüz fiziksel ekranda doğrulanmadı.

### Kullanıcı tercihleri ve global uygulama menüsü

Tap to Click kullanıcı isteğiyle tekrar açıldı. Kurulum artık bu anahtarı yalnızca ilk kurulumda başlatır; sonraki masaüstü uygulamalarında kullanıcının seçimini korur. Apple popup'ı düğmenin iç padding'ine hizalanmak yerine kendi BoxPointer konumlandırmasında monitörün sol kenarından 4 mantıksal piksele sabitlenir; diğer menüler değiştirilmez. Bu GNOME 46'ya özgü konumlandırma kodu sonraki oturumda yüklenir.

[AppMenu](https://github.com/ChathurangaBW/AppMenu) 5.7.1, upstream commit `edd9373261995f64d5f7e82a0c3eb74a63768a18`, yerel uyarlamalarla vendor arşivine alındı (GPL lisansı arşivde). Arşiv SHA256 `8ee7df37cf1b60ff603e9130df45809584480daf8e003fc001d8e03ef9505dee`. Değişiklikler: ikinci Apple menüsünü çıkarma, gerçek menü yayımlamayan uygulamalarda varsayımsal File/Edit/View menülerini kaldırma ve XWayland pencere kimliğini tercih etme. Desteklenmeyen uygulamalarda yalnızca uygulama/pencere denetimleri kalır. Gerçek D-Bus menülerini alan seçenek açık; ayrı arama kısayolu ve kullanıcı/çalışma alanı göstergeleri kapalıdır.

`scripts/appmenu-registrar.py` Canonical AppMenu kayıt protokolünü oturum içinde sağlar, uygulama çıkınca kayıtlarını temizler. Kullanıcı autostart dosyasıyla başlar; ikinci bir kayıt servisi varsa onun yerini almaz. Register/Get/Unregister çağrıları gerçek oturum D-Bus'ında doğrulandı. Şu an çalışan ChatGPT XWayland penceresi test sırasında menü yayımlamadı; uygulama yeniden başlatıldıktan ve eklenti yüklendikten sonra tekrar doğrulanmalıdır. Kurulum tek başına ChatGPT'nin pencere içi menüsünün kaldırıldığını kanıtlamaz. Kodların sözdizimi kontrolü geçti; panelde gerçek menü testi sonraki oturum için bekliyor.


### Yeniden başlatma sonrası menü düzeltmesi

GNOME 46 BoxPointer `_reposition(allocationBox)` tek parametrelidir. Yanlış iki parametreli sarmalayıcı Apple menüsünü açarken hata oluşturuyordu; kaynak aktör artık `_sourceActor` üzerinden alınır. `tests/menu-position.cjs` gerçek sarmalayıcıyı tek argüman ve çoklu monitör koordinatlarıyla sınar.

AppMenu uyarlaması uygulama adını gizlemez. Boş masaüstünde Finder menüleri gerçek Files eylemlerine ve klasörlere bağlanır. Seçili dosya gerektiren, henüz desteklenmeyen işlemler devre dışıdır. Uygulama menüsündeki Settings/About ve varsa güncelleme/oturum işlemleri gerçek dışa aktarılmış komutları kullanır; sistem ayarlarına yönlendirilmez. Gizle/diğerlerini gizle/tümünü göster pencere işlemleri eklenir. Nautilus penceresi yokken Finder dock simgesinin altına kalıcı masaüstü göstergesi eklenir; bu işaret arka planda Nautilus işlemi çalıştığı iddiası değildir.

ChatGPT Linux kodu native menüyü `removeMenu()` ile kaldırıyordu. `sudo scripts/chatgpt-global-menu.sh` önce native menüyü korur, sonra aynı menünün uygulama içi HTML kopyasını gizler. Sürüm imzaları ve ASAR bütünlük hash'leri kontrol edilir; eşleşmeyen sürüme uygulanmaz. Kök yedekleri `/var/lib/macbook-zorin/chatgpt-global-menu` ve `chatgpt-renderer-menu` altındadır. `system.sh restore` sırasıyla renderer, global menü ve native frame katmanlarını geri alır; uygulama güncellenmişse üzerine yazmayı reddeder.

Kurulu ASAR içindeki iki değişiklik ve bütünlük hash'leri doğrulandı. Ancak çalışan eski ChatGPT süreci hâlâ menü yayımlamıyor (Registrar GetMenus boş); gerçek File/Edit/View/Help aktarımı henüz görsel doğrulanmadı. Uygulamanın ve Shell eklentilerinin birlikte yeniden yüklenmesi için oturum kapatılıp açılmalıdır. İşlem otomatik yapılmaz. Yeni oturumda Apple menüsü, gerçek uygulama menüleri, Finder menüsü ve dock göstergesi doğrulanmalıdır. Tap to Click açık kalmıştır.


Ortak AppMenu yaşam döngüsü düzeltmesi: odaktaki pencere menüsünü sonradan kaydeder/kaldırırsa veya registrar servisi yeniden başlarsa sorgu yenilenir; başka pencerenin kayıt sinyali odaktaki menüyü değiştirmez. Eklenti kapatılırken D-Bus abonelikleri temizlenir. GTK pencere eylemleri artık tahmini `/window/1` yolundan alınmaz; Meta.Window tarafından bildirilen odaktaki pencere yolu kullanılır. Yol yoksa pencereye özel eylemler sunulmaz.

`tests/appmenu-lifecycle.cjs` vendor içindeki gerçek kod üzerinde geç kayıt, farklı pencere, kayıt servisinin dönüşü, abonelik temizleme ve gerçek Settings callback'ini sınar. Testler ve GJS içinde gerçek oturum D-Bus abonelik oluşturma/temizleme kontrolü geçti. Bunlar ekran üzerinde menü aktarımı doğrulamasının yerine geçmez; kurulu eklenti dosyaları yeni oturumda yüklenir.


### Açılış/kapanış ve kullanıcı giriş tercihleri

Apple SVG kaynağı `scripts/render-boot-assets.py` ile 4x örnekleme ve Lanczos filtreyle 64–256px arasında 8px adımlı PNG'lere dönüştürülür (python3-gi, gir1.2-rsvg-2.0, python3-cairo, python3-pil). Plymouth logoyu yeniden ölçeklemez; ekran yüksekliğine uygun hazır boyutu seçer. Logo merkezi %50, yükleme çubuğu %90 yükseklikte; çubuk genişliği ekranın %18.3'üdür. Referans görüntüdeki geniş dikey boşluk korunur. Plymouth modu boot değilse dekoratif logo/çubuk gizlidir; kapanış ve restart kapanış aşaması siyahtır. Sistem parola/soru mesajları işlevini korur.

Yalnızca bu değişikliği kurmak için `sudo scripts/install-boot.sh`: mevcut tema `/var/lib/macbook-zorin/boot-before-spaced-progress` altında bir kez yedeklenir, tema dosyaları ve initramfs güncellenir. Masaüstü profili çalıştırılmaz. Gerçek açılış/kapanış görünümü bir sonraki yeniden başlatmada doğrulanmalıdır.

Kullanıcının son isteği gereği masaüstü kurucusu önceden yapılandırılmış touchpad ve hareket anahtarlarını artık tekrar yazmaz. Kullanıcının değiştirdiği hız, tıklama ve gesture değerleri korunur. Bu turda masaüstü kurucusu çalıştırılmadı; giriş ayarlarının önce/sonra dconf çıktıları karşılaştırıldı.


### 16 Kasım: fotoğraflarda görülen panel hataları

Apple popup içerik kutusunun WhiteSur'dan miras aldığı `margin: 4px 12px 17px 12px` sıfırlandı; dış kutunun 4px ekran hizasına artık ek 12px boşluk gelmez. Finder işaretinde Clutter BinLayout için x/y genişleme etkinleştirildi, böylece alt hizalama ikon merkezine düşmez. AppMenu kara listeye alınan masaüstü/Gjs penceresini fallback yolunda tekrar uygulama olarak tanımıyor; boş masaüstü Finder menülerine gider.

Apple popup açıkken yakalanan ekran görüntüsü tuşları Shell içinde ele alınır. Cmd+Ctrl+Shift+3 açık menü dahil PNG'yi panoya kopyalar; Ctrl olmadan tam ekran dosyaya kaydedilir. Alan seçimi GNOME Screenshot UI üzerinden açılır: Shell önce açık menüyü görüntüye alır, sonra popup grab'ini kaldırır. Bu alan seçimi normal GNOME arayüzünün kaydetme/panoya kopyalama davranışını kullanır. Yeni kısayol yolu henüz fiziksel tuşlarla doğrulanmadı.

Tarih/saat durum simgelerinden sonra en sağa taşınır; eklenti kapatılırken eski panel konumuna döner. Etiket beyaz ve normal kalınlıktadır.

Önceki ChatGPT renderer gizleme yaması, gerçek global menü dışa aktarımı doğrulanamadığı için geri alındı. `scripts/chatgpt-global-menu.sh` artık bu katmanı geri alıp native menüyü Linux penceresine açıkça `setMenu(Menu.getApplicationMenu())` ile bağlar; uygulama içi menüyü gizlemez. Kurulu dosyada doğrulandı, açık süreç yeniden başlatılmadı. Global File/Edit/View/Help aktarımı hâlâ çalışma zamanında doğrulama gerektirir; yalnızca ChatGPT/Window görünmesi başarı sayılmaz.

Pencere köşeleri için `python3 scripts/install-rounded-corners.py` ayrı kurucusu kullanılır. [Rounded Window Corners Reborn](https://extensions.gnome.org/extension/7048/rounded-window-corners-reborn/) v13, GNOME 46 uyumlu arşiv sabitlendi (indirme kimliği 65276). Kaynak/lisans: https://github.com/flexagoon/rounded-window-corners . Arşiv ve GPL lisansı vendor içinde. Fotoğraf referansına yaklaşık 14 mantıksal piksel, smoothing 0.5 ayarlandı. Büyütülmüş pencerelerde yuvarlatma korunur; gerçek fullscreen'de kapalıdır. Önceki ayarlar `~/.local/state/macbook-zorin/rounded-corners.json` içinde saklanır. Efekti kapatmak için `gnome-extensions disable rounded-window-corners@fxgn` kullanılabilir. Yeni eklenti sonraki oturumda yüklenir; mevcut oturumun extension listesinde henüz yoktur.

Bu turda `desktop.py` çalıştırılmadı; yalnızca ilgili eklenti dosyaları ve yuvarlatma ayarları kuruldu. Touchpad/gesture ayarlarına yazılmadı. Eklenti sözdizimi, popup konumlandırma ve AppMenu yaşam döngüsü testleri geçti; fiziksel/görsel kontroller sonraki oturumda bekliyor.

Rounded corners arşiv SHA256: `7e2271cc9717e7f7900825d2d8f85dd77e9085679814d1c8590010cfe2a041a4`.


### Gerçek menü dışa aktarım köprüsü ve Brave

ChatGPT'nin kurulu Electron sürümü native pencere menüsü bağlıyken bile Canonical registrar'a menü kaydetmedi. `bridges/appmenu-bridge.cjs` gerçek Electron MenuItem ağacını (enabled/visible/checked dahil) Python Dbusmenu adaptörüne aktarır; seçim gerçek MenuItem.click üzerinden odaktaki webContents'e gider. Kalıcı öğe kimlikleri eski menü olaylarının başka komutlara kaymasını önler. Adaptör uygulama kapanınca sonlanır, registrar kayıtlarını sahip bağlantı kapanınca temizler. Köprü yalnızca ana Linux pencere oluşturulurken yüklenir. Root kurulum `scripts/chatgpt-global-menu.sh`; mevcut HTML menüsü henüz gizlenmez. `tests/appmenu-exporter.py` gerçek D-Bus üzerinde menü ağacı ve activation geri dönüşünü doğruladı. Çalışan ChatGPT eski süreç olduğu için gerçek uygulama aktarımı yeniden açılışta doğrulanacak.

Mutter pencere kimliği XWayland XID'sinden farklı olabileceği için AppMenu sorgusu `get_description()` içindeki XID'yi de dener. Yeni eklenti kodu sonraki Shell oturumunda yüklenir.

Brave, ayrı boş test profiliyle `--ozone-platform=x11` altında gerçek `_File`, `_Edit`, `_View`, `Hi_story`, `_Tools`, `Profiles`, `_Help` menülerini D-Bus üzerinden yayımladı. Test profili kapatıldı; kullanıcının mevcut profili/oturumu değiştirilmedi. `scripts/install-brave-global-menu.py` kullanıcı başlatıcısına bu X11 seçeneğini ekler. Orijinal başlatıcı `~/.local/state/macbook-zorin/brave-launcher.json` içinde saklanır. Mevcut Brave süreci tamamen kapanıp yeniden açılana kadar bu seçenek etkili olmaz. Wayland'a özgü tarayıcı davranışları farklılaşabilir; giriş aygıtı ayarları değiştirilmez. Hamburger menüsü tüm Brave özel seçeneklerini korur; bunların tamamının global menüde yer aldığı iddia edilmez.

Giriş/kilit ekranı için son fotoğraftaki üstte büyük saat, altta avatar/parola yerleşimi incelendi; bu yeni yerleşim henüz uygulanmadı. GNOME GDM'nin aktör yerleşimi CSS dışında kodla belirleniyor; yalnızca arka plan değişikliği bu isteği karşılamaz.


### Uygulama menülerinin görsel düzeni

Kullanıcı fotoğrafı Brave'in gerçek menülerinin panelde göründüğünü doğruladı. Safari referansına göre yalnızca uygulama popup'larını kapsayan `macbook-app-popup` stili eklendi: dış tema marjı sıfır, içerik payı 5px, satır payı 4px/8px, işaret sütunu 12px, köşe 12px, daha opak arka plan. Başlıklarda yalnızca uygulama adı kalın. D-Bus `shortcut` özelliği varsa sağdaki ayrı sütunda gerçek Linux tuş adlarıyla gösterilir; kısayol tahmin edilmez. Menü komutları/profilleri değiştirilmez. Kaynak ve kurulu dosyalar güncellendi, JS ve yaşam döngüsü testleri geçti; yeni CSS sınıflarını oluşturan kod sonraki Shell oturumunda yüklenir, görsel sonuç henüz doğrulanmadı.


### Finder göstergesini standartlaştırma

Özel mavi St.Widget noktası kaldırıldı. Finder artık Zorin dock'un mevcut RunningIndicatorDots çizicisini kullanır; renk, çap, kenarlık ve konum diğer uygulamalardan aynen gelir. Yalnızca bu göstergeye sunulan pencere sayısı en az 1 tutulur; uygulamanın gerçek çalışma durumu/pencere sayısı değiştirilmez. Açık pencere sayısı 2 ve üzerindeyse gerçek sayı korunur. Eklenti kapanınca yerel getter kaldırılır. `tests/finder-indicator.cjs` sıfır/iki pencere ve geri alma davranışını sınar. Kurulu dosya güncellendi; çalışan Shell eski modülü tuttuğundan görsel doğrulama sonraki oturumda yapılmalıdır.


### Brave iç kenarında yanlış yuvarlatma

Fotoğrafta Brave araç çubuğu başlangıcının yuvarlatıldığı görüldü. Upstream RWC v13 X11 için WindowActor.first_child hedefliyordu; yerel `overrides/rounded-window-corners/manager/utils.js` değişikliği efekt ekleme/arama/kaldırmayı aynı dış WindowActor üzerinde tutar. Paket arşivi değiştirilmez; ayrı kurucu bu okunabilir override'ı kopyalar. Çalışan eklentinin kodu yenilenene kadar eski efekt kalır. `tests/window-rounding.cjs` ekleme ve aramanın içerik yerine dış aktörü seçtiğini sınar; gerçek Brave köşesi sonraki oturumda görsel doğrulanmalıdır. Bu değişiklik hiçbir input ayarına yazmaz.


### Pencere kapatma ve uygulamadan çıkma

Apple davranışı: [Quit apps](https://support.apple.com/en-lamr/guide/mac-help/mchl834d18c2/27/mac/27). Kırmızı düğme/pencere kapatma ile uygulamadan çıkış farklıdır. Yanlış `Cmd+Q → Alt+F4` eşlemesi `Ctrl+Q` olarak düzeltildi. `scripts/install-quit-shortcut.sh` yalnızca bilinen bu satırı değiştirir, mevcut diğer keyd düzenlemelerini korur ve reload yapar. Cmd+W mevcut uygulama kapatma/sekme kapatma komutuna gider. Brave Ctrl+Q desteklemediğinden uygulamaya özgü `Alt+F, X` Exit makrosu kullanılır ([Brave resmi kısayollar](https://support.brave.app/hc/en-us/articles/360032272171-What-keyboard-shortcuts-can-I-use-in-Brave)); bu makro mevcut İngilizce menüye göredir. keyd mapper kullanıcı dosyasına yalnızca bu bölüm eklendi. Çıkış komutları kullanıcının açık uygulamaları üzerinde otomatik denenmedi.

Uygulama menüsü gerçek Quit/Exit eylemini tercih eder. Böyle bir eylem yoksa tüm pencereleri kapatan yedek komut artık Quit olarak değil Close All Windows olarak görünür; bu işlem tüm arka plan süreçlerini sonlandırmış gibi sunulmaz.

Dock çizicisi, Shell uygulamasından bilinen PID'leri /proc başlangıç zamanı ile izler. Pencere kapandıktan sonra aynı süreç yaşıyorsa mevcut dock simgesinin standart noktası kalır; süreç yoksa/zombie ise veya PID başka süreçte yeniden kullanılmışsa söner. Finder sürekli masaüstü girişidir ve özel olarak kalır. Bu izleme hiç gözlenmemiş süreçleri tahmin etmez, kaybolmuş sabitlenmemiş dock simgesini yeniden üretmez ve son pencerede kendiliğinden çıkan uygulamaları arka planda tutmaz. Böyle uygulamalar için ayrı uygulama desteği gerekir; kapanan pencere gizlenmiş/minimize edilmiş gibi taklit edilmez.

ProcessTracker ve yerel gösterge testleri, gerçek keyd test motorunda Cmd+Q ve mevcut kısayollar geçti. Klavye eşlemesi kurulu/reload edildi. Yeni süreç göstergesi Shell yeniden yüklenince etkinleşir; gerçek uygulama kapatma/çıkış görsel testi beklenir. Touchpad/gesture ayarları değiştirilmedi.


### Açık menü ve modal üzerinde ekran görüntüsü
`macbook-menu@local/capture.js` Cmd+Ctrl+Shift+3/4 ve Cmd+Shift+4 eşlemelerini Mutter genel accelerator katmanına kaydeder. POPUP ve SYSTEM_MODAL dahil oturum modlarında çalışır; giriş/kilit ekranları hariçtir. Eski media-keys eşlemeleri etkin olduğu sürece boşaltılır, özgün değerler state/capture-bindings.json içinde tutulur ve disable sırasında geri yüklenir. Tam ekran Cmd+Shift+3 mevcut Shell Print eylemini kullanır. Alan seçimi önce sahneyi dondurur, sonra kırpar; Control sürümü yalnızca panoya, diğer sürüm Pictures/Screenshots içine yazar. Escape sonucu kaydetmez. Bu değişiklikler yeni Shell oturumunda yüklenir. Gerçek menü/modal üzerinde fiziksel tuş ve ölçek testi henüz bekliyor. Touchpad ayarları değiştirilmez.

Uygulama menüsündeki yerel ve D-Bus kaynaklı satırlar aynı ornament sütununu ayırır; About/Settings/Quit ile Hide/Show satırları aynı sol çizgiye oturur.


### Açılış geçişleri ve köşeler
AppMenu boş odağı 300 ms bekletir; yeni uygulamanın gerçek menüsü için en fazla 300 ms tanır ve beklerken eski komutları tıklanamaz yapar. Böylece kısa odak boşluklarında Finder, ardından geçici Window menüsü çizilmez. Menü aktarılmayan uygulamaların yedek menüsü bekleme sonunda açılır.

DockLaunch yalnızca hayatta kalan penceresi olmayan uygulamaya normal sol tıklamayı ele alır. Kapanış sürüyorsa STOPPED durumunu bekleyerek tek bir yeni pencere isteği gönderir; arka planda yaşamaya devam eden uygulamalar için bekleme en fazla 1.5 saniyedir. Tekrarlanan tıklamalar birleştirilir, bu sırada pencere açılırsa bekleyen istek iptal edilir. Gerçek Brave kapanış yarışı yeni oturumda fiziksel olarak doğrulanmalıdır.

Rounding v13 ilk açılışta settings-version<7 ise ayarları sıfırlıyordu. Kurucu mevcut v13 biçimini sürüm 7 olarak işaretler; 14px ve maximized=true kalıcıdır. Pencere texture sinyalleri de pencereye ait bağlantılar olarak temizlenir. ChatGPT dış köşeleri canlı ekran görüntüsünde doğrulandı.

ChatGPT'nin gerçek menü aktarımı doğrulandığından renderer içindeki yinelenen menü tekrar gizlendi. Sürüm/imza kontrollü chatgpt-renderer-menu.py prepare/install kullanılır; geri alınmış önceki yedekler hash adıyla saklanır. Uygulama yeniden açılınca görünür hale gelir; üst menü eklentisi devre dışı bırakılacaksa renderer patch önce restore edilmelidir.

Son görsel geri bildirimle yarıçap 12 mantıksal piksele, smoothing 0.2 değerine indirildi; önceki 14/0.5 ayarı artık kullanılmaz.

Büyütülmüş pencerelerde kenar boşluğu: rounding padding tüm yönlerde 0; computeBounds büyütülmüş çerçevede ek 1px sol/üst iç boşluk uygulamaz. 12px köşe eğrisi korunur. Padding canlı uygulanır, computeBounds değişikliği yeni Shell oturumunda yüklenir.

### Yumuşak kaydırma
`python3 scripts/install-smooth-scrolling.py` Brave ve ChatGPT kullanıcı başlatıcılarına yalnızca `--enable-smooth-scrolling` ekler. Chromium kaydırma animasyonu seçeneğidir; macOS momentum eğrisinin kopyası değildir ve diğer uygulamaları etkilemez. Kaynak: https://chromium.googlesource.com/chromium/src/+/master/content/public/common/content_switches.cc . Uygulamayı tamamen kapatıp yeniden açınca etkinleşir. Touchpad, keyd, gesture ve ekran protokolü ayarları değiştirilmez. `--restore` önceki başlatıcıları değişiklik kontrolüyle geri getirir. Fiziksel akıcılık kullanıcı denemesini gerektirir.

Güncel tamamlanma/eksik listesi: [STATUS.md](STATUS.md). Yukarıdaki eski tarihsiz ilerleme notları tek başına tamamlanma kanıtı değildir.

`bash scripts/install-scroll-speed.sh` yalnızca kullanıcıya ait GNOME Wayland Shell servisine `scroll-scale.so` ekler. libinput'ın parmak scroll mesafesi 0.70 ile çarpılır; legacy ve yeni scroll API'si desteklenir. Fare tekerleği/continuous kaynaklar korunur; pointer motion, keyboard, gesture veya device setter hook'u bulunmaz. Sistem `/etc/ld.so.preload` dosyası değiştirilmez. Yeni oturum gerekir. `tests/scroll-scale.sh` gerçek dinamik linker ile taklit libinput olaylarını test eder. Fiziksel testin yerine geçmez.

`python3 scripts/install-chromium-corners.py` GTK kullanıcı CSS'ine yalnızca Chromium'un örneklediği iç window/titlebar köşelerini sıfırlayan işaretli blok ekler. Dış compositor köşesi korunur; tarayıcı yeniden başlatılınca görsel olarak doğrulanmalıdır.

`build-login-layout.py` henüz kurulmamış bir giriş yerleşimi taslağıdır. GDM kimlik doğrulama yöntemleri değiştirilmez; saat ve actor allocation düzenlenir. İzole test gerçek greeter yetkisini alamadığı için üretime alınmadı.

### GDM giriş yerleşimi kurulumu

`sudo bash scripts/install-login-layout.sh` mevcut GNOME 46 kaynağından yalnızca görünüm değişiklikleri içeren bir resource overlay üretir: üstte tarih/saat, altta dikey kullanıcı/parola, küçük AuthMenuButton. `build-login-layout.py` beklenmeyen kaynak imzasında durur; parola doğrulama, kullanıcı seçimi ve oturum açma yöntemleri değiştirilmez. 768/900/1800 yükseklikte yerleşim ve ekran klavyesi payı test edilir.

`gdm-shell-wrapper.sh` yalnızca `gdm` kullanıcısı için overlay'i açar. Normal kullanıcı Shell'ine overlay uygulanmaz. GNOME kütüphane hash'i güncelleme nedeniyle değişirse standart login kodu kullanılır. `--restore` GDM tema yedeğini ve önceki launcher'ı geri getirip servis override'larını kaldırır. Kurucu oturum kapatmaz, GDM'yi veya bilgisayarı yeniden başlatmaz. Yeni GDM oturumunda yüklenir; fiziksel giriş ekranı doğrulaması ayrıca gerekir. Duvar kâğıdı mevcut Big Sur görselidir; fotoğraftaki farklı duvar kâğıdının kopyası değildir.

GDM yerleşimi yönetici onayıyla kuruldu. Kurulu loginDialog kaynağı hazırlanan dosyayla birebir eşleşiyor; GNOME hash koruması, GDM CSS saat/AuthMenuButton stilleri ve systemd/desktop başlatıcıları doğrulandı. GDM yeniden başlatılmadı; gerçek giriş ekranındaki görünüm sonraki giriş oturumunda doğrulanacak.

Üst uygulama menülerinin ortak minimum içerik genişliği 260 yerine 200 mantıksal pikseldir; uzun metinler gerektiğinde menüyü genişletebilir. Satır iç boşluğu 3px, minimum satır yüksekliği 18px; ayırıcılar normal satır yüksekliğini miras almaz (1px çizgi, 3px dış boşluk).

### Performans incelemesi — 2026-11-16
Dock göstergeleri artık yalnızca doğrudan `dashtodockContainer` altını tarar; tüm Shell sahnesini dolaşmaz. Çalışma durumu değişmeyen göstergeler yeniden çizilmez. Gösterge aktörü yok edildiğinde izleme kaydı ve getter hemen temizlenir; disposed nesneye repaint gönderilmez. Ekran görüntüsü PNG dosyaları asenkron yazılır. Electron D-Bus köprüsü mevcut pencereyi menü güncellemelerinde tekrar kaydetmez; registrar yeniden geldiğinde kayıtları yeniler.

Üst çubuktaki Apple ve uygulama menüsü düğmelerinin seçili alanı ortak kapsül köşe stili kullanır; açılır menü satırlarına uygulanmaz. Shell JavaScript değişiklikleri yeni oturumda, sistem menü köprüsü yeni uygulama sürecinde yüklenir. Kullanıcının oturumu veya uygulamaları otomatik kapatılmadı.

Kısa aktif kullanım örneklemi GNOME Shell için tek CPU çekirdeğinin yaklaşık %10.85'ini gösterdi; bu bir boşta ölçüm veya önce/sonra karşılaştırması değildir. Görsel efektlerin GPU maliyetinin sıfır olduğu ya da tüm yavaşlamaların giderildiği sonucuna varılamaz. Pointer/tap/gesture/scroll tercihleri değiştirilmedi.

GTK4 başlık çubuklarında ortak yatay boşluk azaltıldı (`config/headerbar-spacing.css`); Settings yeniden açılıp başlığın tam göründüğü ekran görüntüsüyle doğrulandı. Kontrol simgeleri ve yazı boyutu korunur. Parmakla kaydırma katsayısı 0.70'ten 0.50'ye indirildi (önceki ayara göre yaklaşık %29 az mesafe); yeni oturumda yüklenir. Önceki kitaplığın çalışan Shell'e yüklenmiş olduğu `/proc` eşlemeleriyle kontrol edildi. Fare tekerleği, imleç hızı ve gesture ayarları değiştirilmedi.

### 2026-11-17: Kaydırma yönteminin değiştirilmesi

Yukarıdaki özel scroll-scale ve enable-smooth-scrolling notları tarihsel kayıttır; artık kurulum yöntemi değildir. Özel ölçekleyicinin kaynak/test yolu kaldırıldı. `--scroll` WSF 1.0.4 ve Touchpad Speed Control 5 kurar; `--smooth` artık yumuşatmayı kapatan uygulama ayarlarıdır. Güncel ayrıntılar: [TOUCHPAD.md](TOUCHPAD.md).
