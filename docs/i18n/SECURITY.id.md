# Security Policy（Bahasa Indonesia）

> Halaman ini adalah terjemahan bahasa Indonesia dari [SECURITY.md](../../SECURITY.md). Versi English dan Tionghoa Sederhana yang menjadi acuan.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Melaporkan kerentanan

**Jangan** melaporkan masalah keamanan melalui Issue publik. Gunakan kanal privat repositori:

1. Buka tab [Security](../../security/advisories) dan klik "Report a vulnerability";
2. Atau hubungi maintainer secara langsung dengan langkah reproduksi dan dampaknya.

Kami berupaya membalas dalam 7 hari, lalu setelah konfirmasi menyepakati perbaikan dan waktu pengungkapan bersama Anda.

### Apa yang perlu dilaporkan

Userscript SEEDPOD berjalan pada halaman tracker privat yang sudah Anda login, dapat membaca konten halaman, dan dapat mengirim permintaan atas nama Anda. Semua hal berikut termasuk masalah keamanan:

- Kredensial (cookie, passkey, kunci tracker, kata sandi akun) dikirim ke alamat pihak ketiga
- Permintaan keluar yang tidak didokumentasikan (ke domain selain host gambar, CDN, atau layanan yang dijelaskan dokumentasi)
- Jalur XSS yang menyuntikkan konten kendali penyerang ke panel atau dialog
- Injeksi hak istimewa atau parameter pada dedupe lintas situs, pengisian formulir unggah, atau push ke downloader
- Stylesheet memuat sumber daya tidak tepercaya melalui `@import` eksternal

### Di luar cakupan

- Kerentanan pada tracker itu sendiri (laporkan ke situs terkait)
- Aturan situs, konten torrent, atau pemblokiran akun
- Masalah yang membutuhkan akses lebih dulu ke berkas lokal atau konteks ekstensi peramban Anda

### Saat mengirim Issue atau PR

Sebelum memposting log atau tangkapan layar, hapus: cookie, passkey, kunci tracker, alamat dan kata sandi downloader, serta nama pengguna situs. Pertahankan stack trace; jangan tempel seluruh header permintaan.
