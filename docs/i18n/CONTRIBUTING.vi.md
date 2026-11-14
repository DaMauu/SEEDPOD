# Contributing（Tiếng Việt）

> Trang này là bản dịch tiếng Việt của [CONTRIBUTING.md](../../CONTRIBUTING.md). Bản English và tiếng Trung giản thể là bản chuẩn.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Cảm ơn bạn đã muốn cải thiện SEEDPOD. Hãy đọc lướt trang này trước — nó giúp tránh phần lớn các lần qua lại.

### Kho lưu trữ này là gì

Tiện ích một tệp: userscript cho Tampermonkey và stylesheet bên ngoài. **Không build, không phụ thuộc, không backend** — thả một tệp vào là chạy. Đừng đưa bundler, phụ thuộc npm hay bước biên dịch vào PR.

### Bố trí thư mục

| Đường dẫn | Nội dung |
|---|---|
| `scripts/bluray/legacy/` | Các phiên bản panel bluray đã phát hành, mỗi phiên bản một tệp |
| `scripts/bluray/docs/` | Bắt đầu nhanh, hướng dẫn, kiến trúc, ghi chú phát triển |
| `scripts/PTScripts/` | Bộ công cụ tiện ích cho tracker, theo dõi upstream `DaMauu/Scripts` |
| `styles/r/` | Style giao diện cho tracker |
| `pta/` | Trang ghi chú kiến trúc tracker cục bộ |

### Đánh phiên bản

- **bluray**: tên tệp `pt-bluray-assistant-v0.0.0.N.user.js`, bốn đoạn tăng dần. **Không bao giờ ghi đè hay xóa phiên bản cũ** — hãy thêm tệp mới. Header `@version`, tiêu đề panel và dòng log khi inject phải khớp nhau cả ba chỗ.
- **styles**: mỗi style một tệp, khi thay đổi hãy tăng phiên bản và tạo tag; tag cũ được giữ mãi để người dùng có thể quay lại.
- **PTScripts**: kho này chỉ bảo đảm các tệp còn online; upstream `DaMauu/Scripts` là nguồn chuẩn. Hãy gửi thay đổi lên upstream trước, rồi đồng bộ lại.

### Trước khi gửi

1. Script cài được trong Tampermonkey và thực sự chạy trên trang đích — không phải “chắc là chạy được”.
2. Nêu rõ bạn đã kiểm chứng trên loại tracker nào (NexusPHP / UNIT3D / Gazelle / f3nix); tên trang rất hữu ích.
3. Xóa các `console.log` gỡ lỗi, đường dẫn cục bộ và tài khoản thử nghiệm.
4. Không commit dữ liệu tracker cục bộ: `data/site-defs/` và `pta/data/site-arch.local.csv` đã nằm trong `.gitignore` — đừng dùng `git add -f` để ép thêm.
5. **Tuyệt đối không commit** cookie, passkey, khóa tracker, khóa API hoặc ảnh chụp màn hình có dữ liệu cá nhân.

### Thông điệp commit

Một mô tả ngắn về thay đổi và module bị ảnh hưởng, ví dụ:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Tiếng Trung hoặc tiếng Anh đều được.

### Pull request

- Mỗi PR một việc; đừng đưa thay đổi định dạng không liên quan vào.
- Mô tả: động cơ, các module bị ảnh hưởng, cách bạn kiểm chứng và kết quả, và liệu tệp phiên bản cũ có bị đụng tới không.
- Kèm ảnh chụp màn hình khi thay đổi panel hoặc style — che tài khoản và khóa trước.

### Issue

Báo lỗi và đề xuất theo mẫu. Với vấn đề bảo mật, đừng mở Issue công khai — xem [SECURITY.md](../../SECURITY.md).
