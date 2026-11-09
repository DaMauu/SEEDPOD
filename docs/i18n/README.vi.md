# SEEDPOD（Tiếng Việt）

> Trang này là bản dịch tiếng Việt của [README.md](../../README.md). Bản English và tiếng Trung giản thể là bản chuẩn.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Thư viện phái sinh của người gieo hạt" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Thư viện phái sinh của người gieo hạt</p>

<p align="center"><b>Trong mọi việc, hãy làm hết sức mình.</b></p>

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

SEEDPOD tập hợp các tiện ích một tệp gắn trực tiếp vào trang: script Tampermonkey và bảng định kiểu ngoài. Chỉ cần cài một tệp là chạy, không có bước build, không phụ thuộc, không backend.

Các mô-đun không phụ thuộc lẫn nhau; cài cái nào chỉ cần xem tài liệu của mô-đun đó.

## Mô-đun

| Mô-đun | Dạng | Làm gì | Lối vào |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Script người dùng | Bảng chuyển nguồn đĩa gốc: lọc hàng loạt, kiểm tra trùng giữa các trang, dàn trang BDInfo, chuyển ảnh chụp, điền biểu mẫu và đẩy torrent | [Cài đặt](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 script người dùng | Thao tác thường ngày trên trang: hỗ trợ đăng tải, tự ẩn dữ liệu, ẩn huy hiệu và thông báo, tặng quà hàng loạt, đánh dấu tải xuống | [Mục lục](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Giao diện sáng Broomhilda Red, style ngoài cho trang | [Gắn](../../styles/r/README.md) |

## Mô tả

**bluray** là script chủ lực của thư viện này, khoảng 6300 dòng, gom công việc lặp lại của việc chuyển nguồn đĩa gốc vào một bảng điều khiển luôn mở: lọc ra những đĩa đủ điều kiện theo quy tắc, kiểm tra trùng trên trang đích, phân tích cách dàn trang của trang chi tiết, chuyển ảnh sang dịch vụ lưu trữ khác, điền biểu mẫu đăng tải và đẩy sang trình tải. Hỗ trợ bốn loại trang: NexusPHP, UNIT3D, Gazelle và f3nix. Tài liệu: [bắt đầu nhanh](../../scripts/bluray/docs/QUICKSTART.md), [hướng dẫn sử dụng](../../scripts/bluray/docs/GUIDE.md), [kiến trúc](../../scripts/bluray/docs/ARCHITECTURE.md), [phát triển](../../scripts/bluray/docs/DEVELOPMENT.md), [ngữ cảnh AI](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** là bộ sưu tập script được chuyển nguyên từ dự án thượng nguồn `DaMauu/Scripts`; các tệp được giữ nguyên, chỉ liên kết cài đặt trỏ về thư viện này, việc nâng cấp theo thượng nguồn. Công dụng từng script xem ở [mục lục](../../scripts/PTScripts/README.md).

**styles/r** lưu trữ giao diện cho trang. Địa chỉ gắn dùng tag cố định nên nội dung không thay đổi; sau khi sửa giao diện chỉ cần tạo tag mới.

## Cài đặt

- Script: cài [Tampermonkey](https://www.tampermonkey.net/), mở tệp `.user.js` tương ứng và bấm `Raw` để xác nhận.
- Giao diện: sao chép liên kết trực tiếp jsDelivr vào ô bảng định kiểu ngoài của trang, hoặc thử tạm theo [hướng dẫn](../../styles/r/README.md).

## Quy tắc phiên bản

| Mô-đun | Quy tắc |
|---|---|
| bluray | `0.0.0.N` bốn đoạn tăng dần, mỗi phiên bản một tệp, bản cũ không bao giờ bị ghi đè hay xóa; `@version` ở phần đầu, tiêu đề bảng điều khiển và nhật ký chèn luôn đồng bộ |
| PTScripts | Theo thượng nguồn; thư viện này chỉ bảo đảm tệp không bị mất |
| styles | Mỗi giao diện một tệp, khi sửa thì tăng số phiên bản và tạo tag, tag cũ được giữ vĩnh viễn để có thể quay lại |

## Cấu trúc

```
SEEDPOD/
├── docs/banner.png              ảnh bìa
├── scripts/
│   ├── bluray/                  bảng điều khiển chuyển nguồn đĩa gốc (tài liệu trong docs/, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 script một tệp + mục lục
├── styles/r/                    giao diện Broomhilda Red
└── README.md
```

## Vấn đề đã biết

Các vấn đề tái diễn và mục chưa giải quyết của bluray (K-01 ~ K-14) cùng quy luật tái diễn được ghi trong [`scripts/bluray/README.md`](../../scripts/bluray/README.md). Đọc mục đó trước khi sửa đổi.

## Giấy phép và miễn trừ

Mã nguồn được cấp phép theo [GPL-3.0](../../LICENSE): có thể tự do sử dụng, sửa đổi, phân phối lại, nhưng khi phân phối bản sửa đổi phải mở nguồn tương tự và giữ thông báo bản quyền, không được đóng gói bán dưới dạng mã đóng.

Chỉ dành cho cá nhân chuyển tài nguyên giữa các trang riêng tư mà bạn đã được cấp phép. Hãy tuân thủ quy định của từng trang: trước khi chuyển, xác nhận không bị cấm chuyển và không trùng lặp.

<p align="center"><sub>Kết tinh từ những đêm phát triển đầy nhiệt huyết của 大肥鱼 DeepSeek và 主任</sub></p>
