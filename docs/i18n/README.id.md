# SEEDPOD（Bahasa Indonesia）

> Halaman ini adalah terjemahan bahasa Indonesia dari [README.md](../../README.md). Versi English dan Tionghoa Sederhana yang menjadi acuan.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Pustaka turunan sang penabur" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Pustaka turunan sang penabur</p>

<p align="center"><b>Dalam segala hal, lakukan yang terbaik.</b></p>

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

SEEDPOD mengumpulkan ekstensi satu berkas yang dipasang langsung ke situs: skrip Tampermonkey dan lembar gaya eksternal. Satu berkas dipasang langsung berfungsi, tanpa langkah build, tanpa dependensi, tanpa backend.

Modul saling tidak bergantung; untuk memilih yang dipasang cukup lihat dokumentasi modul tersebut.

## Modul

| Modul | Bentuk | Fungsi | Akses |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Skrip pengguna | Panel pemindahan disk asli: penyaringan massal, pemeriksaan duplikat antar situs, tata letak BDInfo, pemindahan tangkapan layar, pengisian formulir dan pengiriman torrent | [Pasang](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 skrip pengguna | Operasi harian di situs: bantuan unggah, menyembunyikan data sendiri, menyembunyikan lencana dan pengumuman, hadiah massal, penandaan unduhan | [Indeks](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Tema terang Broomhilda Red, gaya eksternal untuk situs | [Pasang](../../styles/r/README.md) |

## Keterangan

**bluray** adalah skrip utama pustaka ini, sekitar 6300 baris, yang merangkum pekerjaan berulang pemindahan disk asli ke dalam satu panel yang selalu terbuka: menyaring disk yang memenuhi syarat menurut aturan, memeriksa duplikat di situs tujuan, membaca tata letak halaman detail, memindahkan gambar ke host lain, mengisi formulir unggah, lalu mengirimkannya ke pengunduh. Mendukung empat jenis situs: NexusPHP, UNIT3D, Gazelle, dan f3nix. Dokumentasi: [mulai cepat](../../scripts/bluray/docs/QUICKSTART.md), [panduan penggunaan](../../scripts/bluray/docs/GUIDE.md), [arsitektur](../../scripts/bluray/docs/ARCHITECTURE.md), [pengembangan](../../scripts/bluray/docs/DEVELOPMENT.md), [konteks AI](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** adalah kumpulan skrip yang dipindahkan utuh dari proyek hulu `DaMauu/Scripts`; berkas dipertahankan apa adanya, hanya tautan pemasangan yang diarahkan ke pustaka ini, pembaruan mengikuti hulu. Kegunaan tiap skrip ada di [indeks](../../scripts/PTScripts/README.md).

**styles/r** menyimpan tema untuk situs. Alamat pemasangan memakai tag tetap sehingga isinya tidak bergeser; setelah mengubah gaya cukup buat tag baru.

## Pemasangan

- Skrip: pasang [Tampermonkey](https://www.tampermonkey.net/), buka `.user.js` yang sesuai, lalu tekan `Raw` untuk mengonfirmasi.
- Gaya: salin tautan langsung jsDelivr ke kolom lembar gaya eksternal situs, atau uji sementara menurut [penjelasan](../../styles/r/README.md).

## Aturan versi

| Modul | Aturan |
|---|---|
| bluray | `0.0.0.N` empat segmen menaik, satu versi satu berkas, versi lama tidak pernah ditimpa atau dihapus; `@version` di bagian kepala, judul panel, dan log penyuntikan tetap sinkron |
| PTScripts | Mengikuti hulu; pustaka ini hanya menjamin berkas tidak hilang |
| styles | Satu berkas per gaya, saat diubah nomor versi dinaikkan dan tag dibuat, tag lama disimpan selamanya agar bisa kembali |

## Struktur

```
SEEDPOD/
├── docs/banner.png              gambar sampul
├── scripts/
│   ├── bluray/                  panel pemindahan disk asli (dokumentasi di docs/, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 skrip satu berkas + indeks
├── styles/r/                    tema Broomhilda Red
└── README.md
```

## Masalah yang diketahui

Masalah berulang dan butir yang belum selesai pada bluray (K-01 ~ K-14) beserta pola kemunculannya dicatat di [`scripts/bluray/README.md`](../../scripts/bluray/README.md). Baca bagian itu sebelum mengubah apa pun.

## Lisensi dan penafian

Kode dilisensikan dengan [GPL-3.0](../../LICENSE): bebas digunakan, diubah, dan didistribusikan ulang, tetapi saat mendistribusikan versi yang diubah harus tetap open source dan mempertahankan pemberitahuan hak cipta; tidak boleh dikemas tertutup lalu dijual.

Hanya untuk penggunaan pribadi dalam memindahkan sumber daya antar situs privat yang sudah Anda dapat izinnya. Patuhi aturan setiap situs: sebelum memindahkan, pastikan tidak ada larangan pemindahan dan tidak ada duplikat.

<p align="center"><sub>Kristalisasi pengembangan tengah malam yang penuh semangat oleh 大肥鱼 DeepSeek dan 主任</sub></p>
