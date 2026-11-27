# Đăng tin + tải file trực tiếp (Apps Script)

## Sheet `ThongBao`
Hàng 1:
`Loại | Tiêu đề | Nội dung | Ngày đăng | Hết hạn | Link file | Ảnh | Người đăng | Ghim | Hiện`

## Code bổ sung

```javascript
function ensureThongBaoSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('ThongBao');
  if (!sh) {
    sh = ss.insertSheet('ThongBao');
    sh.appendRow(['Loại','Tiêu đề','Nội dung','Ngày đăng','Hết hạn','Link file','Ảnh','Người đăng','Ghim','Hiện']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function thongBaoFolder_() {
  var name = 'BQLRPH-ThongBao';
  var it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  var folder = DriveApp.createFolder(name);
  // Công khai xem/tải cho trang web đọc được
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function saveUpload_(upload) {
  if (!upload || !upload.base64) return '';
  var blob = Utilities.newBlob(
    Utilities.base64Decode(upload.base64),
    upload.mime || 'application/octet-stream',
    upload.name || ('file-' + Date.now())
  );
  var file = thongBaoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=download&id=' + file.getId();
}

function addThongBao_(data) {
  // TODO: kiểm tra admin giống approve_/list_
  var link = String(data.link || '');
  var image = String(data.image || '');
  if (data.fileUpload) {
    var u = saveUpload_(data.fileUpload);
    if (u) link = u;
  }
  if (data.imageUpload) {
    var u2 = saveUpload_(data.imageUpload);
    if (u2) image = u2;
  }
  var sh = ensureThongBaoSheet_();
  var d = data.date
    ? data.date
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  sh.appendRow([
    String(data.type || 'thongbao'),
    String(data.title || ''),
    String(data.body || ''),
    d,
    String(data.exp || ''),
    link,
    image,
    String(data.author || ''),
    data.pin ? '1' : '',
    (data.show === false || data.show === '0') ? '' : '1'
  ]);
  return { ok: true, link: link, image: image };
}
```

Trong `doPost`:

```javascript
if (action === 'addthongbao') return jsonOut(addThongBao_(data));
```

## Lưu ý
1. Deploy **New version** (Execute as: Me; Who has access: Anyone).
2. Lần đầu Script có thể hỏi quyền **Google Drive**.
3. File tối đa ~8MB (giới hạn gửi qua web).
4. Admin → Nguồn Sheet → Thông báo: điền ID spreadsheet + GID tab ThongBao.
5. Trang `tienich-thongbao.html` chỉ xem và nút tải về.
