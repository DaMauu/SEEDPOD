# SEEDPOD（Türkçe）

> Bu sayfa [README.md](../../README.md) dosyasının Türkçe çevirisidir. English ve basitleştirilmiş Çince sürümler esas alınır.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Ekicinin türev kütüphanesi" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Ekicinin türev kütüphanesi</p>

<p align="center"><b>Her şeyde elinden gelenin en iyisini yap.</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/userscripts-37-000000?style=flat-square&logo=tampermonkey" />
  <img src="https://img.shields.io/badge/JavaScript-ES2017-f7df1e?style=flat-square&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/dependencies-none-2ea44f?style=flat-square" />
  <img src="https://img.shields.io/badge/styles-1-8c796a?style=flat-square" />
  <img src="https://img.shields.io/badge/build-none%20%C2%B7%20single--file-success?style=flat-square" />
  <img src="https://img.shields.io/badge/branch-main-8957e5?style=flat-square" />
</p>

<p align="center">
  <a href="../../README.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.nl.md">Nederlands</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

SEEDPOD, doğrudan sitelere takılan tek dosyalık eklentileri bir araya getirir: Tampermonkey betikleri ve harici stil sayfaları. Tek dosya yüklenir ve çalışır; derleme adımı, bağımlılık, arka uç yok.

Modüller birbirine bağlı değildir; hangisinin kurulacağına yalnızca o modülün belgelerine bakarak karar verilir.

## Modüller

| Modül | Biçim | Ne yapar | Giriş |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Kullanıcı betiği | Orijinal disk aktarma paneli: toplu filtreleme, siteler arası yinelenen kontrolü, BDInfo düzeni, ekran görüntülerini taşıma, formu doldurup torrent gönderme | [Kurulum](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 kullanıcı betiği | Sitede günlük işlemler: yüklemeye yardım, kendi verilerini gizleme, rozet ve duyuruları gizleme, toplu hediye, indirmeleri işaretleme | [Dizin](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Broomhilda Red açık teması, site için harici stil | [Uygula](../../styles/r/README.md) |

## Açıklama

**bluray** bu kitaplığın ana betiğidir, yaklaşık 6300 satırdır ve orijinal disk aktarmanın tekrar eden işini her an açık tek bir panelde toplar: kurallara göre uygun diskleri seçer, hedef siteste yinelenen kontrolü yapar, ayrıntı sayfasının düzenini çözer, görselleri başka bir barındırıcıya taşır, yükleme formunu doldurur ve indiriciye gönderir. Dört tür siteyi destekler: NexusPHP, UNIT3D, Gazelle ve f3nix. Belgeler: [hızlı başlangıç](../../scripts/bluray/docs/QUICKSTART.md), [kullanım kılavuzu](../../scripts/bluray/docs/GUIDE.md), [mimari](../../scripts/bluray/docs/ARCHITECTURE.md), [geliştirme](../../scripts/bluray/docs/DEVELOPMENT.md), [AI bağlamı](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts**, upstream `DaMauu/Scripts` projesinden olduğu gibi taşınmış bir betik derlemesidir; dosyalar olduğu gibi korunur, yalnızca kurulum bağlantıları bu kitaplığı gösterir, güncellemeler upstream'i izler. Her betiğin amacı için [dizine](../../scripts/PTScripts/README.md) bakın.

**styles/r** site temalarını barındırır. Takma adresi sabit tag kullanır, bu yüzden içerik kaymaz; stili değiştirdikten sonra yeni bir tag oluşturmak yeterlidir.

## Kurulum

- Betikler: [Tampermonkey](https://www.tampermonkey.net/) kurun, ilgili `.user.js` dosyasını açıp `Raw` düğmesine basarak onaylayın.
- Stiller: jsDelivr doğrudan bağlantısını kopyalayıp sitenin harici stil sayfası alanına yapıştırın ya da [açıklamaya](../../styles/r/README.md) göre geçici olarak deneyin.

## Sürüm kuralları

| Modül | Kural |
|---|---|
| bluray | `0.0.0.N` dört parçalı artan sürüm, her sürüm ayrı dosya, eski sürümler asla üzerine yazılmaz ve silinmez; başlıktaki `@version`, panel başlığı ve enjeksiyon günlüğü eşzamanlı tutulur |
| PTScripts | Upstream'i izler; bu kitaplık yalnızca dosyaların kaybolmamasını garanti eder |
| styles | Her stil için tek dosya, değişiklikte sürüm numarası artırılıp tag oluşturulur, eski taglar kalıcı olarak saklanır ve geri dönüş sağlar |

## Yapı

```
SEEDPOD/
├── docs/banner.png              kapak görseli
├── scripts/
│   ├── bluray/                  orijinal disk aktarma paneli (docs/ belgeleri, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 tek dosyalık betik + dizin
├── styles/r/                    Broomhilda Red teması
└── README.md
```

## Bilinen sorunlar

bluray'in yineleyen sorunları ve çözülmemiş maddeleri (K-01 ~ K-14) ile yineleme düzenleri [`scripts/bluray/README.md`](../../scripts/bluray/README.md) dosyasında kayıtlıdır. Değişiklik yapmadan önce o bölümü okuyun.

## Lisans ve sorumluluk reddi

Kod [GPL-3.0](../../LICENSE) ile lisanslıdır: özgürce kullanabilir, değiştirebilir ve yeniden dağıtabilirsiniz; ancak değiştirilmiş bir sürümü dağıtırken onu da açık kaynak yapmalı ve telif bildirimini korumalısınız, kapalı biçimde paketleyip satamazsınız.

Yalnızca yetkiniz olan özel siteler arasında kaynak aktarmak için kişisel kullanım içindir. Her sitenin kurallarına uyun: aktarmadan önce aktarım yasağı ve yinelenen kayıt olmadığını doğrulayın.

<p align="center"><sub>大肥鱼 DeepSeek ve 主任'in gece geç saatlerde tutkuyla geliştirdiği ürün</sub></p>
