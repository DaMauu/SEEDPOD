# Security Policy（Tiếng Việt）

> Trang này là bản dịch tiếng Việt của [SECURITY.md](../../SECURITY.md). Bản English và tiếng Trung giản thể là bản chuẩn.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Báo cáo lỗ hổng

Vui lòng **không** báo cáo vấn đề bảo mật qua Issue công khai. Hãy dùng kênh riêng của repository:

1. Mở thẻ [Security](../../security/advisories) và bấm "Report a vulnerability";
2. Hoặc liên hệ trực tiếp với người bảo trì, nêu các bước tái hiện và phạm vi ảnh hưởng.

Chúng tôi cố gắng phản hồi trong 7 ngày; sau khi xác nhận, sẽ thống nhất với bạn về bản sửa và thời điểm công bố.

### Cần báo cáo những gì

Userscript của SEEDPOD chạy trên các trang tracker riêng tư đã đăng nhập, có thể đọc nội dung trang và gửi yêu cầu thay bạn. Những trường hợp sau đều là vấn đề bảo mật:

- Thông tin xác thực (cookie, passkey, khóa tracker, mật khẩu tài khoản) bị gửi tới địa chỉ của bên thứ ba
- Yêu cầu ra ngoài không được ghi trong tài liệu (tới tên miền khác ngoài máy chủ ảnh, CDN hoặc các dịch vụ mà tài liệu mô tả)
- Đường XSS đưa nội dung do kẻ tấn công kiểm soát vào panel hoặc hộp thoại
- Chèn quyền hoặc chèn tham số trong bước đối chiếu trùng lặp giữa các site, điền biểu mẫu upload hoặc đẩy sang downloader
- Stylesheet tải tài nguyên không đáng tin qua `@import` bên ngoài

### Ngoài phạm vi

- Lỗ hổng của chính các tracker (hãy báo cho trang tương ứng)
- Quy định của trang, nội dung torrent hoặc việc khóa tài khoản
- Vấn đề cần có quyền truy cập trước vào tệp cục bộ hoặc ngữ cảnh tiện ích trình duyệt của bạn

### Khi gửi Issue hoặc PR

Trước khi đăng log hoặc ảnh chụp màn hình, hãy xóa: cookie, passkey, khóa tracker, địa chỉ và mật khẩu downloader, tên người dùng trên trang. Giữ stack trace; đừng dán toàn bộ header của yêu cầu.
