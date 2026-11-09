# Security Policy（Türkçe）

> Bu sayfa [SECURITY.md](../../SECURITY.md) dosyasının Türkçe çevirisidir. English ve basitleştirilmiş Çince sürümler esas alınır.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Güvenlik açığı bildirme

Güvenlik sorunlarını herkese açık Issue üzerinden **bildirmeyin**. Deponun özel kanalını kullanın:

1. [Security](../../security/advisories) sekmesini açın ve "Report a vulnerability" seçeneğine tıklayın;
2. Ya da yeniden üretme adımları ve etkiyi belirterek doğrudan bakımcılarla iletişime geçin.

7 gün içinde yanıt vermeyi hedefliyoruz; onaydan sonra düzeltme ve açıklama zamanlamasını sizinle birlikte belirleriz.

### Neleri bildirmelisiniz

SEEDPOD'un userscript'leri oturum açılmış özel tracker sayfalarında çalışır, sayfa içeriğini okuyabilir ve sizin adınıza istek gönderebilir. Aşağıdakilerin tümü güvenlik sorunu sayılır:

- Kimlik bilgilerinin (cookie, passkey, tracker anahtarları, hesap parolaları) üçüncü taraf bir adrese gönderilmesi
- Belgelendirilmemiş dış istekler (resim sunucusu, CDN veya belgelerde açıklanan servisler dışındaki alan adlarına)
- Saldırgan tarafından kontrol edilen içeriği panele veya iletişim kutularına enjekte eden XSS yolları
- Siteler arası yinelenen kayıt denetimi, yükleme formu doldurma veya downloader'a gönderme aşamalarında yetki ya da parametre enjeksiyonu
- Harici `@import` ile güvenilmeyen kaynakları yükleyen stil sayfaları

### Kapsam dışı

- Tracker'ların kendi güvenlik açıkları (bunları ilgili siteye bildirin)
- Site kuralları, torrent içeriği veya hesap yasakları
- Yerel dosyalarınıza veya tarayıcı uzantısı bağlamına önceden erişim gerektiren sorunlar

### Issue veya PR gönderirken

Log veya ekran görüntüsü paylaşmadan önce şunları kaldırın: cookie, passkey, tracker anahtarları, downloader adresleri ve parolaları ve site kullanıcı adları. Stack trace'i koruyun; istek başlıklarının tamamını yapıştırmayın.
