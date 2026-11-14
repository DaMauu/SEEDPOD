# Contributing（Bahasa Indonesia）

> Halaman ini adalah terjemahan bahasa Indonesia dari [CONTRIBUTING.md](../../CONTRIBUTING.md). Versi English dan Tionghoa Sederhana yang menjadi acuan.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Terima kasih telah ingin meningkatkan SEEDPOD. Baca sekilas halaman ini dulu — ini menghemat sebagian besar bolak-balik.

### Apa itu repositori ini

Add-on satu berkas: userscript Tampermonkey dan stylesheet eksternal. **Tanpa build, tanpa dependensi, tanpa backend** — masukkan satu berkas dan langsung berfungsi. Jangan masukkan bundler, dependensi npm, atau langkah kompilasi ke dalam PR.

### Tata letak

| Path | Isi |
|---|---|
| `scripts/bluray/legacy/` | Versi panel bluray yang sudah dirilis, satu berkas per versi |
| `scripts/bluray/docs/` | Mulai cepat, panduan, arsitektur, catatan pengembangan |
| `scripts/PTScripts/` | Kumpulan utilitas tracker, mengikuti upstream `DaMauu/Scripts` |
| `styles/r/` | Gaya tema untuk tracker |
| `pta/` | Halaman catatan arsitektur tracker lokal |

### Pembuatan versi

- **bluray**: nama berkas `pt-bluray-assistant-v0.0.0.N.user.js`, empat segmen yang bertambah. **Jangan pernah menimpa atau menghapus versi lama** — tambahkan berkas baru. Header `@version`, judul panel, dan baris log saat injeksi harus semuanya cocok.
- **styles**: satu berkas per gaya, saat berubah naikkan versi dan buat tag; tag lama tetap selamanya agar pengguna bisa kembali.
- **PTScripts**: repo ini hanya menjamin berkas tetap online; upstream `DaMauu/Scripts` adalah sumber kebenaran. Kirim perubahan ke upstream dulu, lalu sinkronkan kembali.

### Sebelum mengirim

1. Skrip terpasang di Tampermonkey dan benar-benar berjalan di situs target — bukan “seharusnya berjalan”.
2. Sebutkan jenis tracker yang sudah kamu verifikasi (NexusPHP / UNIT3D / Gazelle / f3nix); nama situs sangat membantu.
3. Hapus `console.log` debug, path lokal, dan akun uji.
4. Jangan commit data tracker lokal: `data/site-defs/` dan `pta/data/site-arch.local.csv` sudah ada di `.gitignore` — jangan paksa dengan `git add -f`.
5. **Jangan pernah commit** cookie, passkey, kunci tracker, API key, atau tangkapan layar yang berisi data pribadi.

### Pesan commit

Deskripsi singkat tentang apa yang berubah dan modul mana yang terpengaruh, misalnya:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Bahasa Tionghoa atau Inggris sama-sama boleh.

### Pull request

- Satu PR satu hal; jangan campur perubahan format yang tidak terkait.
- Jelaskan: motivasi, modul yang terpengaruh, cara memverifikasi dan hasilnya, serta apakah berkas versi lama tersentuh.
- Sertakan tangkapan layar untuk perubahan panel atau gaya — dengan akun dan kunci disamarkan.

### Issue

Laporkan bug dan permintaan lewat templat. Untuk masalah keamanan jangan buka Issue publik — lihat [SECURITY.md](../../SECURITY.md).
