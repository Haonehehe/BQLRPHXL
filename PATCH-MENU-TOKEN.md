# Patch tối thiểu menu.html / admin.html (token phiên)

Sau khi deploy Apps Script v4, response `login` có thêm `token`.
Áp dụng các thay đổi dưới đây để ưu tiên token, vẫn giữ `_pass` tạm thời (không phá client cũ).

## 1. Hàm loginUser (menu.html)

Tìm đoạn tạo `sess` sau login cloud, sửa thành:

```js
var sess = {
  email: u.email,
  name: u.name,
  role: u.role || 'user',
  perms: extractPermsFromUser(u),
  loginAt: new Date().toISOString(),
  token: res.token || '',   // MỚI
  _pass: pass               // giữ tạm để tương thích adminCred cũ
};
```

## 2. Hàm adminCred()

Tìm hàm trả về `{ adminEmail, adminPass }`, sửa thành:

```js
function adminCred() {
  var s = getSession();
  if (!s || s.role !== 'admin') throw new Error('Cần đăng nhập admin');
  // Ưu tiên token
  if (s.token) {
    return { token: s.token, adminEmail: s.email, adminPass: s._pass || '' };
  }
  return { adminEmail: s.email, adminPass: s._pass || '' };
}
```

Và mọi chỗ `apiCall({ action: '...', adminEmail: c.adminEmail, adminPass: c.adminPass })`  
có thể giữ nguyên — server v4 vẫn nhận cả token lẫn pass.

## 3. Heartbeat (nếu có)

Thêm `token: (getSession() || {}).token || ''` vào payload heartbeat.

## 4. Gắn activity-log

Trong `menu.html` (cuối body, trước `</body>`):

```html
<script src="js/activity-log.js"></script>
<script>
  if (window.BQLRPHLog) BQLRPHLog.page('menu');
</script>
```

Các trang module: thêm `data-bqlrph-module="qlbvr"` trên `<body>` và `<script src="js/activity-log.js"></script>`.

## 5. (Tuỳ chọn) Xem log trong admin.html

Thêm nút “Nhật ký” gọi:

```js
apiCall(Object.assign({ action: 'listlog', limit: 100 }, adminCred()))
  .then(function (res) {
    // render res.logs vào bảng
  });
```

---

Không bắt buộc patch ngay: hệ thống vẫn chạy với client cũ. Token chỉ giúp bỏ dần việc gửi mật khẩu mỗi request.
