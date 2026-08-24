# Đồng bộ tài khoản BQLRPH qua Google Sheet

## Bước 1 — Tạo Sheet
1. Tạo Google Spreadsheet mới (ví dụ: "BQLRPH-Auth").
2. Đổi tên tab đầu thành: **Users**
3. Không cần gõ cột — script tự tạo header.

## Bước 2 — Apps Script
1. Trong Sheet: **Extensions → Apps Script**
2. Xóa code mặc định, dán toàn bộ file **BQLRPH-Auth-AppsScript.gs**
3. **Save** (Ctrl+S)

## Bước 3 — Deploy Web App
1. **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy → Copy **Web App URL** (dạng .../exec)

## Bước 4 — Gắn vào hệ thống
1. Mở **menu.html**
2. Bấm nút **⚙**
3. Dán URL → **Lưu**
4. Badge trên menu đổi thành **Sheet sync**

## Admin mặc định
- Email: `admin@bqlrph.local`
- Mật khẩu: `Admin@2026`

(Script tự tạo admin lần chạy API đầu tiên.)

## Lưu ý
- Mật khẩu lưu dạng SHA-256 trên Sheet (không phải plain text).
- Mọi máy dùng cùng Script URL → cùng danh sách user.
- Nếu API lỗi: kiểm tra Deploy "Anyone", URL đúng /exec, đăng nhập lại admin.
