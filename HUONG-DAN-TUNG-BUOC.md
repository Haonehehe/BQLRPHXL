# HƯỚNG DẪN TỪNG BƯỚC — BQLRPH Auth v4 + Nhật ký + Vá bảo mật

Bản này **không làm đứt phiên** người đang dùng. Client cũ vẫn login bằng mật khẩu như trước.

---

## PHẦN A — Chuẩn bị (5 phút)

### A1. Backup Google Sheet
1. Mở Google Sheet đang gắn Apps Script (tab **Users**).
2. **File → Tải về → Microsoft Excel (.xlsx)** hoặc **Tạo bản sao**.
3. Ghi lại URL deployment hiện tại (trong `menu.html` → `CONFIG.SCRIPT_URL`) để đối chiếu sau.

### A2. File cần dùng trong bản này
| File | Việc cần làm |
|------|----------------|
| `BQLRPH-Auth-AppsScript-v4.gs` | Dán vào Apps Script (thay code cũ) |
| `menu.html` | Đã vá token + log (upload lên hosting) |
| `admin.html` | Đã vá token + nút **Nhật ký** (upload) |
| `js/activity-log.js` | Thư mục mới — upload cùng |
| `theme.css` | Có thêm class `bq-lively` (upload) |

Các file HTML module khác (qlbvr, lamba…) **chưa bắt buộc** sửa ngay.

---

## PHẦN B — Deploy Apps Script (quan trọng nhất)

### B1. Mở project script
1. Trong Google Sheet Users → **Extensions → Apps Script**.
2. Xóa **toàn bộ** code trong file hiện tại (thường là `Code.gs`).

### B2. Dán bản v4
1. Mở file `BQLRPH-Auth-AppsScript-v4.gs` trên máy.
2. Copy **toàn bộ** nội dung → dán vào Apps Script → **Save** (Ctrl+S / Cmd+S).

### B3. Deploy không đổi URL (không downtime)
1. Góc trên phải → **Deploy → Manage deployments**.
2. Bấm biểu tượng **bút chì** (Edit) trên deployment Web app đang dùng.
3. **Version** → chọn **New version**.
4. Description có thể ghi: `v4 auth token + activity log`.
5. Bấm **Deploy**.
6. **Không** tạo “New deployment” nếu không cần — URL `/exec` phải giữ nguyên để `menu.html` / `admin.html` không phải sửa.

> Nếu lỡ tạo deployment mới: copy URL `/exec` mới → cập nhật `CONFIG.SCRIPT_URL` trong `menu.html` và `admin.html`, rồi upload lại 2 file đó.

### B4. Kiểm tra API sống
Mở trình duyệt, dán URL `/exec` (GET):
```text
{"ok":true,"service":"BQLRPH-Auth","version":4}
```
Thấy `version: 4` là thành công.

---

## PHẦN C — Upload file web

### C1. Cấu trúc thư mục trên hosting / GitHub Pages
```text
/
  index.html
  menu.html          ← bản đã vá
  admin.html         ← bản đã vá
  theme.css          ← bản đã cập nhật
  js/
    activity-log.js  ← file mới
  quanly-*.html
  tienich-*.html
  maps/
  ...
```

### C2. Upload
- Upload `menu.html`, `admin.html`, `theme.css`, thư mục `js/` (có `activity-log.js`).
- **Không** upload `BQLRPH-Auth-AppsScript-v4.gs`, `*.md` hướng dẫn, mật khẩu lên repo công khai nếu có thể.

### C3. Kiểm tra đăng nhập
1. Mở `menu.html` trên web.
2. Đăng nhập bằng tài khoản đang dùng → **phải thành công**.
3. Mở `admin.html` (tài khoản admin) → thấy nút **Nhật ký** (góc thanh công cụ).
4. Bấm **Nhật ký** → bảng ActivityLog (có thể trống lần đầu; sau vài thao tác sẽ có dòng).

---

## PHẦN D — Đổi mật khẩu admin (bắt buộc)

1. Đăng nhập admin trên web.
2. Dùng chức năng **đổi mật khẩu** trong giao diện (nếu có) **hoặc** trong admin: **Đặt lại MK** cho `admin@bqlrph.local`.
3. Chọn mật khẩu mạnh (tối thiểu 6 ký tự, nên dài hơn, có chữ số + ký tự đặc biệt).
4. Xóa chuỗi `Admin@2026` khỏi mọi file README / repo công khai.
5. Đăng xuất → đăng nhập lại bằng mật khẩu mới để xác nhận.

> Hash cũ vẫn login được; sau login lần đầu server **tự nâng** lên hash có salt.

---

## PHẦN E — Bật nhật ký trên các module (tuỳ chọn, làm dần)

Với mỗi trang (ví dụ `quanly-qlbvr.html`):

1. Thêm thuộc tính trên `<body>`:
```html
<body data-bqlrph-module="qlbvr" ...>
```

2. Trước `</body>`:
```html
<script src="js/activity-log.js"></script>
```

3. (Tuỳ chọn) Ghi thao tác quan trọng:
```js
BQLRPHLog.action('qlbvr', 'export_excel', 'Xuất 12 dòng');
BQLRPHLog.action('qlbvr', 'save', 'Lưu biên bản');
```

Module gợi ý: `qlbvr`, `lamba`, `nhao`, `mocgioi`, `trongrung`, `tasks`, `tonghop`, `lamnghiep`, `pdf`, `admin`, `menu`.

---

## PHẦN F — Giao diện sống động (tuỳ chọn)

Trên trang quản lý nền sáng, thêm class:

```html
<body class="bq-lively" data-bqlrph-module="qlbvr">
```

Sẽ có hover card nổi, nút gradient, hero/tabs kiểu trang **Tiện ích Lâm nghiệp** (đã có sẵn CSS trong `theme.css`).

Menu nền tối giữ nguyên style hiện tại.

---

## PHẦN G — Kiểm tra an toàn sau deploy

| Kiểm tra | Kỳ vọng |
|----------|---------|
| Login user thường | Thành công |
| Login admin | Thành công + có `token` trong session (DevTools → Application → sessionStorage `bqlrph_session_v1`) |
| 6 lần gõ sai mật khẩu | Bị khóa ~15 phút |
| Sheet tab **ActivityLog** | Tự xuất hiện sau log/login đầu tiên |
| Nút **Nhật ký** trên admin | Hiện bảng thời gian / user / action / module |
| Người đang online khác | Vẫn dùng bình thường, không bị logout |

---

## PHẦN H — Rollback (nếu cần)

1. Apps Script → **Deploy → Manage deployments** → Edit → chọn **Version** cũ → Deploy.
2. URL `/exec` giữ nguyên → client không cần đổi.
3. Có thể upload lại `menu.html` / `admin.html` bản backup nếu muốn.

---

## Tóm tắt những gì đã vá

1. Rate-limit đăng nhập (5 lần / 15 phút).
2. Hash mật khẩu có salt (tự nâng khi login).
3. Token phiên 72 giờ (client mới dùng; client cũ vẫn gửi pass).
4. Sheet **ActivityLog** + API `log` / `listlog`.
5. `menu.html` / `admin.html` lưu token, heartbeat có token, ghi log mở trang.
6. Admin có nút xem nhật ký.
7. CSS `bq-lively` cho giao diện động hơn.

---

## Việc nên làm tiếp (không chặn deploy)

1. Escape `innerHTML` ở `quanly-qlbvr.html` (dữ liệu từ Sheet).
2. Chuyển Sheet nghiệp vụ từ “ai có link đều xem” → đọc qua Apps Script có auth.
3. Gỡ `.gs`, `.md`, mật khẩu khỏi GitHub Pages.
4. Nâng `xlsx` CDN lên bản mới hơn (0.20.x) + thêm SRI khi tiện.
5. Thêm `noindex` / robots cho site nội bộ.

---

**Hỗ trợ:** Sau khi làm xong B → C → D, nếu login lỗi hãy gửi message lỗi từ trình duyệt (F12 → Console / Network) và dòng Executions trong Apps Script.
