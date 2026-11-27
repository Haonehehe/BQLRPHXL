# Hướng dẫn deploy BQLRPH Auth v4 (không downtime)

## Mục tiêu
- Rate-limit đăng nhập, hash có salt, token phiên, nhật ký ActivityLog.
- **Người đang online không bị đá** — client cũ vẫn login bằng mật khẩu.
- Admin đổi mật khẩu mặc định ngay sau deploy.

---

## Bước 1 — Backup
1. Mở Google Sheet chứa Users (file đang gắn Apps Script).
2. File → Tải về → Excel / sao chép sheet Users sang file backup.

## Bước 2 — Cập nhật Apps Script
1. Extensions → Apps Script.
2. Xóa toàn bộ code cũ, dán **toàn bộ** nội dung `BQLRPH-Auth-AppsScript-v4.gs`.
3. Save (Ctrl+S).
4. Deploy → **Manage deployments** → bút chì (Edit) → Version: **New version** → Deploy.
   - **Không tạo deployment mới** nếu URL `/exec` đang dùng trong menu.html / admin.html — chỉ tạo version mới trên deployment hiện tại để URL giữ nguyên.
5. Nếu buộc phải tạo deployment mới: copy URL `/exec` mới → cập nhật `CONFIG.SCRIPT_URL` trong `menu.html` và `admin.html` (và localStorage `bqlrph_script_url` nếu đã lưu).

## Bước 3 — Kiểm tra nhanh
- Mở `menu.html` → đăng nhập bằng tài khoản hiện có → phải thành công.
- Trong Apps Script → Executions: thấy action `login` OK.
- Sheet sẽ tự tạo tab **ActivityLog** khi có lần ghi log đầu tiên (hoặc khi ensureSheet chạy).

## Bước 4 — Đổi mật khẩu admin (bắt buộc)
1. Đăng nhập admin trên web.
2. Đổi mật khẩu trong giao diện (đổi pass) **hoặc** trong Sheet cột `pass` xóa hash cũ rồi dùng chức năng Reset trong admin (sau khi đã login bằng pass cũ).
3. **Xóa** chuỗi `Admin@2026` khỏi mọi file README / HTML / repo công khai.

Mật khẩu bootstrap chỉ còn trong code để **tạo admin lần đầu** khi sheet trống. Sheet đang có admin rồi thì không dùng lại.

## Bước 5 — Bật ghi nhật ký trên từng trang
Thêm vào `<head>` hoặc cuối body của module:

```html
<script src="js/activity-log.js"></script>
```

Và trên thẻ body:

```html
<body data-bqlrph-module="qlbvr">
```

Hoặc gọi thủ công:

```js
BQLRPHLog.page('qlbvr');
BQLRPHLog.action('qlbvr', 'export_excel', 'Xuất 15 dòng');
```

## Bước 6 — Xem báo cáo
- Admin gọi API: `{ action: "listlog", token: "...", limit: 200 }`
- Hoặc mở sheet **ActivityLog**.
- Có thể lọc theo `email` / `module` trong payload `listlog`.

---

## Tương thích client cũ
| Client gửi | Server v4 |
|------------|-----------|
| email + pass | OK (login, admin) |
| token (mới) | OK |
| Hash SHA-256 cũ | OK, tự nâng lên salt khi login lần sau |
| Không có ActivityLog.js | Vẫn chạy bình thường |

## Việc nên làm tiếp (không bắt buộc ngay)
1. Trong `menu.html` / `admin.html`: lưu `token` từ response login vào session; gửi `token` thay `_pass` khi gọi admin.
2. Escape `innerHTML` ở quanly-qlbvr.html.
3. Sheet dữ liệu nghiệp vụ: chuyển từ gviz công khai → đọc qua Apps Script có auth.
4. Gỡ file `.gs`, `.md`, mật khẩu khỏi repo GitHub Pages.

## Rollback
- Apps Script → Deployments → chọn version cũ → Deploy lại.
- URL `/exec` giữ nguyên → client không cần sửa.
