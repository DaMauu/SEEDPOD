# Contributing（Türkçe）

> Bu sayfa [CONTRIBUTING.md](../../CONTRIBUTING.md) dosyasının Türkçe çevirisidir. English ve basitleştirilmiş Çince sürümler esas alınır.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

SEEDPOD'u iyileştirmek istediğiniz için teşekkürler. Önce bu sayfaya göz atın — bu, gidiş gelişlerin çoğunu ortadan kaldırır.

### Bu depo nedir

Tek dosyalık eklentiler: Tampermonkey userscript'leri ve harici stil sayfaları. **Derleme yok, bağımlılık yok, arka uç yok** — bir dosyayı atın, çalışır. PR'da bundler, npm bağımlılığı veya derleme adımı eklemeyin.

### Yerleşim

| Yol | İçerik |
|---|---|
| `scripts/bluray/legacy/` | Yayınlanmış bluray panel sürümleri, sürüm başına bir dosya |
| `scripts/bluray/docs/` | Hızlı başlangıç, kılavuz, mimari, geliştirme notları |
| `scripts/PTScripts/` | Tracker yardımcı araçları koleksiyonu, upstream `DaMauu/Scripts` takip edilir |
| `styles/r/` | Tracker tema stilleri |
| `pta/` | Yerel tracker mimarisi notları sayfası |

### Sürümleme

- **bluray**: dosya adı `pt-bluray-assistant-v0.0.0.N.user.js`, dört bölüm artarak ilerler. **Eski bir sürümün üzerine asla yazmayın, silmeyin** — yeni bir dosya ekleyin. `@version` başlığı, panel başlığı ve enjeksiyon günlüğü satırı birbiriyle eşleşmelidir.
- **styles**: her stil için bir dosya, değişiklikte sürümü artırın ve tag atın; eski tag'ler kalıcı olarak kalır, böylece kullanıcılar geri dönebilir.
- **PTScripts**: bu depo yalnızca dosyaların çevrimiçi kalmasını garanti eder; doğruluk kaynağı upstream `DaMauu/Scripts`'tir. Değişiklikleri önce upstream'e gönderin, sonra geri senkronize edin.

### Göndermeden önce

1. Betik Tampermonkey'e kuruluyor ve hedef sitede gerçekten çalışıyor — “çalışması gerekir” değil.
2. Hangi tracker türlerinde doğruladığınızı belirtin (NexusPHP / UNIT3D / Gazelle / f3nix); site adları yardımcı olur.
3. Hata ayıklama amaçlı `console.log`'ları, yerel yolları ve test hesaplarını kaldırın.
4. Yerel tracker verilerini commit'lemeyin: `data/site-defs/` ve `pta/data/site-arch.local.csv` `.gitignore` içinde — bunları asla `git add -f` ile zorlamayın.
5. **Asla commit'lemeyin**: çerezler, passkey'ler, tracker anahtarları, API anahtarları veya kişisel veri içeren ekran görüntüleri.

### Commit mesajları

Neyin değiştiğini ve hangi modülü etkilediğini kısa bir şekilde açıklayın, örneğin:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Çince veya İngilizce, ikisi de olur.

### Pull request'ler

- PR başına tek konu; ilgisiz biçimlendirme değişikliklerini dışarıda tutun.
- Şunları açıklayın: motivasyon, etkilenen modüller, nasıl doğruladığınız ve sonuç, eski sürüm dosyalarının etkilenip etkilenmediği.
- Panel veya stil değişikliklerinde ekran görüntüsü ekleyin — hesapları ve anahtarları maskeleyerek.

### Issue'lar

Hataları ve istekleri şablonları kullanarak bildirin. Güvenlik sorunları için herkese açık Issue açmayın — bkz. [SECURITY.md](../../SECURITY.md).
