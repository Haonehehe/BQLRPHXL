/**
 * BQLRPH Xuân Lộc — Auth + Sheet sources + Thông báo (Google Apps Script)
 * Deploy: Web app · Execute as: Me · Who has access: Anyone
 * Dán URL /exec vào CONFIG.SCRIPT_URL (menu.html, admin.html)
 *
 * Tabs:
 *   Users    — email|name|pass|status|role|perms|created|approvedAt
 *   ThongBao — Loại|Tiêu đề|Nội dung|Ngày đăng|Hết hạn|Link file|Ảnh|Người đăng|Ghim|Hiện
 * Script Properties: PRESENCE, SHEET_SOURCES
 *
 * Admin mặc định: admin@bqlrph.local / Admin@2026
 */

var SHEET_NAME = 'Users';
var THONGBAO_SHEET = 'ThongBao';
var ADMIN_EMAIL = 'admin@bqlrph.local';
var ADMIN_PASS = 'Admin@2026';
var ONLINE_MINUTES = 5;
var RECENT_MINUTES = 60;

function doGet() {
  return jsonOut({ ok: true, service: 'BQLRPH-Auth', version: 3 });
}

function doPost(e) {
  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    var action = String(data.action || '').toLowerCase();
    ensureSheet_();

    if (action === 'register') return jsonOut(register_(data));
    if (action === 'login') return jsonOut(login_(data));
    if (action === 'list') return jsonOut(list_(data));
    if (action === 'approve') return jsonOut(approve_(data));
    if (action === 'reject') return jsonOut(reject_(data));
    if (action === 'disable') return jsonOut(disable_(data));
    if (action === 'setperms') return jsonOut(setPerms_(data));
    if (action === 'changepass') return jsonOut(changePass_(data));
    if (action === 'resetpass') return jsonOut(resetPass_(data));
    if (action === 'heartbeat') return jsonOut(heartbeat_(data));
    if (action === 'listonline') return jsonOut(listOnline_(data));
    if (action === 'getsheets') return jsonOut(getSheets_(data));
    if (action === 'setsheets') return jsonOut(setSheets_(data));
    if (action === 'addthongbao') return jsonOut(addThongBao_(data));

    return jsonOut({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sh_() {
  return ss_().getSheetByName(SHEET_NAME);
}

function hash_(s) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(s),
    Utilities.Charset.UTF_8
  );
  return raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function ensureSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['email', 'name', 'pass', 'status', 'role', 'perms', 'created', 'approvedAt']);
    sh.setFrozenRows(1);
  }
  var admin = findUser_(ADMIN_EMAIL);
  if (!admin) {
    sh.appendRow([
      ADMIN_EMAIL,
      'Quản trị viên',
      hash_(ADMIN_PASS),
      'approved',
      'admin',
      'qlbvr,lamba,nhao,mocgioi,trongrung,tasks,tonghop,pdf,thongbao',
      new Date().toISOString(),
      new Date().toISOString()
    ]);
  }
}

function colMap_(header) {
  var m = {};
  header.forEach(function (h, i) {
    m[String(h || '').toLowerCase().trim()] = i;
  });
  return m;
}

function readUsers_() {
  var sh = sh_();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var map = colMap_(values[0]);
  var users = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var email = String(row[map.email] || '').trim().toLowerCase();
    if (!email) continue;
    users.push({
      row: r + 1,
      email: email,
      name: String(row[map.name] || ''),
      pass: String(row[map.pass] || ''),
      status: String(row[map.status] || '').toLowerCase(),
      role: String(row[map.role] || 'user').toLowerCase(),
      perms: String(row[map.perms] || ''),
      created: String(row[map.created] || ''),
      approvedAt: String(row[map.approvedat] || '')
    });
  }
  return users;
}

function findUser_(email) {
  email = String(email || '').trim().toLowerCase();
  var users = readUsers_();
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) return users[i];
  }
  return null;
}

function requireAdmin_(data) {
  var email = String(data.adminEmail || data.email || '').trim().toLowerCase();
  var pass = String(data.adminPass || data.pass || '');
  var admin = findUser_(email);
  if (!admin || admin.role !== 'admin' || admin.status !== 'approved') {
    throw new Error('Không có quyền admin');
  }
  if (admin.pass !== hash_(pass)) {
    throw new Error('Xác thực admin thất bại');
  }
  return admin;
}

function parsePerms_(v) {
  var arr = Array.isArray(v) ? v : String(v || '').split(/[,;|]/);
  arr = arr.map(function (s) { return String(s).trim().toLowerCase(); }).filter(Boolean);
  if (arr.indexOf('pdf') < 0) arr.push('pdf');
  return arr;
}

function register_(data) {
  var name = String(data.name || '').trim();
  var email = String(data.email || '').trim().toLowerCase();
  var pass = String(data.pass || '');
  if (name.length < 2) throw new Error('Nhập họ tên hợp lệ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email không hợp lệ');
  if (pass.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
  if (findUser_(email)) throw new Error('Email đã được đăng ký');

  sh_().appendRow([
    email, name, hash_(pass), 'pending', 'user', 'pdf',
    new Date().toISOString(), ''
  ]);
  return { ok: true, message: 'Đã gửi đăng ký — chờ admin duyệt' };
}

function login_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var pass = String(data.pass || '');
  var u = findUser_(email);
  if (!u || u.pass !== hash_(pass)) throw new Error('Email hoặc mật khẩu không đúng');
  if (u.status === 'pending') throw new Error('Tài khoản đang chờ admin duyệt');
  if (u.status === 'rejected') throw new Error('Tài khoản đã bị từ chối');
  if (u.status === 'disabled') throw new Error('Tài khoản đã bị khóa');
  return {
    ok: true,
    user: {
      email: u.email,
      name: u.name,
      role: u.role,
      perms: u.perms,
      status: u.status
    }
  };
}

function list_(data) {
  requireAdmin_(data);
  var users = readUsers_().map(function (u) {
    return {
      email: u.email,
      name: u.name,
      status: u.status,
      role: u.role,
      perms: u.perms,
      created: u.created,
      approvedAt: u.approvedAt
    };
  });
  return { ok: true, users: users };
}

function updateUserRow_(u, fields) {
  var sh = sh_();
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = colMap_(header);
  Object.keys(fields).forEach(function (k) {
    var col = map[k.toLowerCase()];
    if (col == null) return;
    sh.getRange(u.row, col + 1).setValue(fields[k]);
  });
}

function approve_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  var perms = parsePerms_(data.perms);
  updateUserRow_(u, {
    status: 'approved',
    perms: perms.join(','),
    approvedat: new Date().toISOString()
  });
  return { ok: true };
}

function reject_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  updateUserRow_(u, { status: 'rejected' });
  return { ok: true };
}

function disable_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  if (u.role === 'admin') throw new Error('Không khóa tài khoản admin');
  updateUserRow_(u, { status: 'disabled' });
  return { ok: true };
}

function setPerms_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  var perms = parsePerms_(data.perms);
  updateUserRow_(u, { perms: perms.join(',') });
  return { ok: true };
}

function changePass_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var oldPass = String(data.oldPass || data.passOld || '');
  var newPass = String(data.newPass || data.passNew || '');
  if (newPass.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
  var u = findUser_(email);
  if (!u || u.pass !== hash_(oldPass)) throw new Error('Mật khẩu hiện tại không đúng');
  updateUserRow_(u, { pass: hash_(newPass) });
  return { ok: true };
}

function resetPass_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  var np = String(data.newPass || data.pass || '');
  if (np.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
  updateUserRow_(u, { pass: hash_(np) });
  return { ok: true };
}

/* ===== Presence ===== */

function presenceMap_() {
  var props = PropertiesService.getScriptProperties();
  try {
    return JSON.parse(props.getProperty('PRESENCE') || '{}') || {};
  } catch (e) {
    return {};
  }
}

function savePresenceMap_(map) {
  PropertiesService.getScriptProperties().setProperty('PRESENCE', JSON.stringify(map));
}

function heartbeat_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Thiếu email' };
  var u = findUser_(email);
  if (!u) return { ok: false, error: 'User không tồn tại' };
  if (u.status !== 'approved') return { ok: false, error: 'Tài khoản chưa được duyệt' };

  var map = presenceMap_();
  map[email] = {
    email: email,
    name: String(data.name || u.name || '').trim(),
    unit: String(data.unit || '').trim(),
    page: String(data.page || '').trim(),
    at: new Date().toISOString()
  };
  var now = Date.now();
  Object.keys(map).forEach(function (k) {
    var t = Date.parse(map[k].at || 0);
    if (!t || now - t > 24 * 3600 * 1000) delete map[k];
  });
  savePresenceMap_(map);
  return { ok: true };
}

function listOnline_(data) {
  requireAdmin_(data);
  var map = presenceMap_();
  var now = Date.now();
  var onlineMs = ONLINE_MINUTES * 60 * 1000;
  var recentMs = RECENT_MINUTES * 60 * 1000;
  var online = [];
  var recent = [];
  Object.keys(map).forEach(function (k) {
    var row = map[k];
    var t = Date.parse(row.at || 0);
    if (!t) return;
    var age = now - t;
    row.ageSec = Math.round(age / 1000);
    if (age <= onlineMs) online.push(row);
    else if (age <= recentMs) recent.push(row);
  });
  online.sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); });
  recent.sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); });
  return {
    ok: true,
    online: online,
    recent: recent,
    onlineMinutes: ONLINE_MINUTES,
    recentMinutes: RECENT_MINUTES
  };
}

/* ===== Sheet sources (admin sync) ===== */

function getSheets_(data) {
  // Public read of config is OK for modules; optional admin check skipped for get
  var props = PropertiesService.getScriptProperties();
  var sheets = {};
  try {
    sheets = JSON.parse(props.getProperty('SHEET_SOURCES') || '{}') || {};
  } catch (e) {
    sheets = {};
  }
  return { ok: true, sheets: sheets };
}

function setSheets_(data) {
  requireAdmin_(data);
  var sheets = data.sheets;
  if (!sheets || typeof sheets !== 'object') {
    throw new Error('Thiếu sheets');
  }
  PropertiesService.getScriptProperties()
    .setProperty('SHEET_SOURCES', JSON.stringify(sheets));
  return { ok: true };
}

/* ===== Thông báo / Niêm yết ===== */

function ensureThongBaoSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(THONGBAO_SHEET);
  if (!sh) {
    sh = ss.insertSheet(THONGBAO_SHEET);
    sh.appendRow(['Loại', 'Tiêu đề', 'Nội dung', 'Ngày đăng', 'Hết hạn', 'Link file', 'Ảnh', 'Người đăng', 'Ghim', 'Hiện']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function thongBaoFolder_() {
  var name = 'BQLRPH-ThongBao';
  var it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  var folder = DriveApp.createFolder(name);
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
  requireAdmin_(data);
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
