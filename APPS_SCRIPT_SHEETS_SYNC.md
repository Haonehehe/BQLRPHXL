# Đồng bộ nguồn Google Sheet (bắt buộc để “đồng bộ thật”)

Admin bấm **Lưu nguồn Sheet** → gọi `setsheets`.
Mọi module khi mở gọi `getsheets` → dùng SID/GID mới.

## Việc bạn cần làm 1 lần trên Google Apps Script

1. Mở project Apps Script đang gắn Web App (cùng URL `/exec` trong menu).
2. Dán các hàm trong khối bên dưới vào file `.gs`.
3. Trong `doPost`, thêm 2 nhánh `getsheets` / `setsheets`.
4. **Deploy → Manage deployments → Edit → New version → Deploy**.
5. Admin vào trang Admin → Nguồn Google Sheet → **Lưu nguồn Sheet** lần nữa.
6. Máy user: Ctrl+F5 module → nhận sheet mới.

```javascript
/**
 * BQLRPH — Bổ sung vào Apps Script Web App (cùng file auth user)
 * Sau khi dán → Deploy → New version (Execute as: Me, Who has access: Anyone)
 */

function getSheetSources_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('BQLRPH_SHEET_SOURCES');
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}

function setSheetSources_(sheets) {
  PropertiesService.getScriptProperties()
    .setProperty('BQLRPH_SHEET_SOURCES', JSON.stringify(sheets || {}));
}

/**
 * Trong doPost(e), sau khi parse payload, thêm:
 *
 *   if (payload.action === 'getsheets') {
 *     return jsonResponse_({ ok: true, sheets: getSheetSources_() });
 *   }
 *   if (payload.action === 'setsheets') {
 *     if (!isAdminUser_(payload.adminEmail, payload.adminPass)) {
 *       return jsonResponse_({ ok: false, error: 'Không có quyền admin' });
 *     }
 *     setSheetSources_(payload.sheets);
 *     return jsonResponse_({ ok: true });
 *   }
 *
 * jsonResponse_ / isAdminUser_ dùng đúng tên hàm sẵn có trong script của bạn.
 * Nếu hàm admin tên khác (vd isAdmin_), đổi cho khớp.
 */

// --- Bản doPost tối giản nếu bạn muốn thử riêng (merge với auth hiện có) ---
/*
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || '';
    if (action === 'getsheets') {
      return ContentService.createTextOutput(JSON.stringify({
        ok: true, sheets: getSheetSources_()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'setsheets') {
      // TODO: kiểm tra adminEmail/adminPass giống action list/approve
      setSheetSources_(payload.sheets);
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // ... các action register/login/list/...
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false, error: String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
*/

```
