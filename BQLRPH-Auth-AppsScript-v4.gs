/**
 * BQLRPH Xuân Lộc — Auth + Sheet sources + Thông báo + Activity Log (v4)
 * Deploy: Web app · Execute as: Me · Who has access: Anyone
 * Dán URL /exec vào CONFIG.SCRIPT_URL (menu.html, admin.html)
 *
 * Tabs:
 *   Users       — email|name|pass|status|role|perms|created|approvedAt
 *   ThongBao    — Loại|Tiêu đề|Nội dung|Ngày đăng|Hết hạn|Link file|Ảnh|Người đăng|Ghim|Hiện
 *   ActivityLog — time|email|name|action|module|detail|ip|ua
 *
 * Script Properties: PRESENCE, SHEET_SOURCES, SESSIONS, LOGIN_ATTEMPTS
 *
 * TƯƠNG THÍCH NGƯỢC:
 * - Hash cũ (SHA-256 không salt) vẫn login được.
 * - Client cũ gửi adminPass / _pass vẫn được chấp nhận.
 * - Token phiên mới được trả về khi login; client mới ưu tiên dùng token.
 * - Rate-limit chỉ áp dụng khi login thất bại.
 *
 * LƯU Ý BẢO MẬT:
 * - KHÔNG hard-code mật khẩu admin trong repo công khai.
 * - Sau khi deploy, admin nên đổi mật khẩu ngay.
 */

var SHEET_NAME = 'Users';
var THONGBAO_SHEET = 'ThongBao';
var LOG_SHEET = 'ActivityLog';
var ADMIN_EMAIL = 'admin@bqlrph.local';
// Chỉ dùng khi tạo admin lần đầu (sheet trống). Đổi ngay sau deploy.
var ADMIN_PASS_BOOTSTRAP = 'Admin@2026';
var ONLINE_MINUTES = 5;
var RECENT_MINUTES = 60;
var SESSION_TTL_HOURS = 72;
var MAX_LOGIN_ATTEMPTS = 5;
var LOCK_MINUTES = 15;
var VERSION = 4;

/* ===================== Entry ===================== */

function doGet() {
  return jsonOut({ ok: true, service: 'BQLRPH-Auth', version: VERSION });
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
    if (action === 'listthongbao') return jsonOut(listThongBao_(data));
    if (action === 'hidethongbao') return jsonOut(hideThongBao_(data));
    // v4
    if (action === 'log') return jsonOut(logActivity_(data));
    if (action === 'listlog') return jsonOut(listLog_(data));
    if (action === 'logout') return jsonOut(logout_(data));
    if (action === 'validatesession') return jsonOut(validateSession_(data));
    if (action === 'pcccr_get') return jsonOut(pcccrGet_(data));
    if (action === 'pcccr_save_cap') return jsonOut(pcccrSaveCap_(data));

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

/* ===================== Hash (tương thích ngược) ===================== */

/** Hash cũ: SHA-256(plain) — vẫn chấp nhận để không khóa user hiện tại */
function hashLegacy_(s) {
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

/** Hash mới: SHA-256(salt + plain), format "s1$<salt>$<hex>" */
function hashNew_(plain, salt) {
  salt = salt || Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + String(plain),
    Utilities.Charset.UTF_8
  );
  var hex = raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  return 's1$' + salt + '$' + hex;
}

function verifyPass_(stored, plain) {
  stored = String(stored || '');
  plain = String(plain || '');
  if (stored.indexOf('s1$') === 0) {
    var parts = stored.split('$');
    if (parts.length !== 3) return false;
    var salt = parts[1];
    return hashNew_(plain, salt) === stored;
  }
  // Legacy
  return hashLegacy_(plain) === stored;
}

function hashForStore_(plain) {
  return hashNew_(plain);
}

/* ===================== Sheet Users ===================== */

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
      hashForStore_(ADMIN_PASS_BOOTSTRAP),
      'approved',
      'admin',
      'qlbvr,lamba,nhao,mocgioi,trongrung,tasks,tonghop,pdf,thongbao',
      new Date().toISOString(),
      new Date().toISOString()
    ]);
  }
  ensureLogSheet_();
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

function parsePerms_(v) {
  var arr = Array.isArray(v) ? v : String(v || '').split(/[,;|]/);
  arr = arr.map(function (s) { return String(s).trim().toLowerCase(); }).filter(Boolean);
  if (arr.indexOf('pdf') < 0) arr.push('pdf');
  return arr;
}

/* ===================== Session token ===================== */

function sessionsMap_() {
  var props = PropertiesService.getScriptProperties();
  try {
    return JSON.parse(props.getProperty('SESSIONS') || '{}') || {};
  } catch (e) {
    return {};
  }
}

function saveSessionsMap_(map) {
  PropertiesService.getScriptProperties().setProperty('SESSIONS', JSON.stringify(map));
}

function createSession_(email, name, role) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  var map = sessionsMap_();
  // Dọn session hết hạn
  var now = Date.now();
  Object.keys(map).forEach(function (k) {
    if (!map[k].exp || map[k].exp < now) delete map[k];
  });
  map[token] = {
    email: email,
    name: name || '',
    role: role || 'user',
    exp: now + SESSION_TTL_HOURS * 3600 * 1000
  };
  saveSessionsMap_(map);
  return token;
}

function getSession_(token) {
  token = String(token || '');
  if (!token) return null;
  var map = sessionsMap_();
  var s = map[token];
  if (!s) return null;
  if (!s.exp || s.exp < Date.now()) {
    delete map[token];
    saveSessionsMap_(map);
    return null;
  }
  return s;
}

function revokeSession_(token) {
  token = String(token || '');
  if (!token) return;
  var map = sessionsMap_();
  if (map[token]) {
    delete map[token];
    saveSessionsMap_(map);
  }
}

function logout_(data) {
  revokeSession_(data.token);
  return { ok: true };
}

function validateSession_(data) {
  var s = getSession_(data.token);
  if (!s) return { ok: false, error: 'Phiên hết hạn hoặc không hợp lệ' };
  var u = findUser_(s.email);
  if (!u || u.status !== 'approved') return { ok: false, error: 'Tài khoản không hợp lệ' };
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

/* ===================== Rate limit login ===================== */

function attemptsMap_() {
  var props = PropertiesService.getScriptProperties();
  try {
    return JSON.parse(props.getProperty('LOGIN_ATTEMPTS') || '{}') || {};
  } catch (e) {
    return {};
  }
}

function saveAttemptsMap_(map) {
  PropertiesService.getScriptProperties().setProperty('LOGIN_ATTEMPTS', JSON.stringify(map));
}

function checkLoginAllowed_(email) {
  var map = attemptsMap_();
  var rec = map[email];
  if (!rec) return true;
  var now = Date.now();
  if (rec.lockUntil && rec.lockUntil > now) {
    var mins = Math.ceil((rec.lockUntil - now) / 60000);
    throw new Error('Quá nhiều lần thử. Thử lại sau ' + mins + ' phút.');
  }
  // Reset nếu đã qua cửa sổ
  if (rec.windowStart && now - rec.windowStart > LOCK_MINUTES * 60000) {
    delete map[email];
    saveAttemptsMap_(map);
  }
  return true;
}

function recordLoginFail_(email) {
  var map = attemptsMap_();
  var now = Date.now();
  var rec = map[email] || { count: 0, windowStart: now };
  if (now - rec.windowStart > LOCK_MINUTES * 60000) {
    rec = { count: 0, windowStart: now };
  }
  rec.count++;
  if (rec.count >= MAX_LOGIN_ATTEMPTS) {
    rec.lockUntil = now + LOCK_MINUTES * 60000;
  }
  map[email] = rec;
  saveAttemptsMap_(map);
}

function clearLoginAttempts_(email) {
  var map = attemptsMap_();
  if (map[email]) {
    delete map[email];
    saveAttemptsMap_(map);
  }
}

/* ===================== Auth helpers ===================== */

/**
 * Xác thực admin: ưu tiên token, fallback mật khẩu (tương thích client cũ).
 */
function requireAdmin_(data) {
  // 1) Token
  var token = String(data.token || data.sessionToken || '');
  if (token) {
    var s = getSession_(token);
    if (s && s.role === 'admin') {
      var u = findUser_(s.email);
      if (u && u.role === 'admin' && u.status === 'approved') return u;
    }
  }
  // 2) Legacy: email + pass
  var email = String(data.adminEmail || data.email || '').trim().toLowerCase();
  var pass = String(data.adminPass || data.pass || '');
  var admin = findUser_(email);
  if (!admin || admin.role !== 'admin' || admin.status !== 'approved') {
    throw new Error('Không có quyền admin');
  }
  if (!verifyPass_(admin.pass, pass)) {
    throw new Error('Xác thực admin thất bại');
  }
  return admin;
}

/**
 * User đã login (bất kỳ role): token hoặc email+pass.
 */
function requireUser_(data) {
  var token = String(data.token || data.sessionToken || '');
  if (token) {
    var s = getSession_(token);
    if (s) {
      var u = findUser_(s.email);
      if (u && u.status === 'approved') return u;
    }
  }
  var email = String(data.email || '').trim().toLowerCase();
  var pass = String(data.pass || data._pass || '');
  if (email && pass) {
    var u2 = findUser_(email);
    if (u2 && u2.status === 'approved' && verifyPass_(u2.pass, pass)) return u2;
  }
  throw new Error('Cần đăng nhập');
}

/* ===================== Actions ===================== */

function register_(data) {
  var name = String(data.name || '').trim();
  var email = String(data.email || '').trim().toLowerCase();
  var pass = String(data.pass || '');
  if (name.length < 2) throw new Error('Nhập họ tên hợp lệ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email không hợp lệ');
  if (pass.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
  if (findUser_(email)) throw new Error('Email đã được đăng ký');

  sh_().appendRow([
    email, name, hashForStore_(pass), 'pending', 'user', 'pdf',
    new Date().toISOString(), ''
  ]);
  try {
    appendLog_({
      email: email,
      name: name,
      action: 'register',
      module: 'auth',
      detail: 'Đăng ký tài khoản mới'
    });
  } catch (e) {}
  return { ok: true, message: 'Đã gửi đăng ký — chờ admin duyệt' };
}

function login_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var pass = String(data.pass || '');
  checkLoginAllowed_(email);

  var u = findUser_(email);
  if (!u || !verifyPass_(u.pass, pass)) {
    recordLoginFail_(email);
    throw new Error('Email hoặc mật khẩu không đúng');
  }
  if (u.status === 'pending') throw new Error('Tài khoản đang chờ admin duyệt');
  if (u.status === 'rejected') throw new Error('Tài khoản đã bị từ chối');
  if (u.status === 'disabled') throw new Error('Tài khoản đã bị khóa');

  clearLoginAttempts_(email);
  var token = createSession_(u.email, u.name, u.role);

  // Tự nâng hash cũ → hash mới khi login thành công (không bắt user đổi pass)
  if (String(u.pass || '').indexOf('s1$') !== 0) {
    try {
      updateUserRow_(u, { pass: hashForStore_(pass) });
    } catch (e) {}
  }

  try {
    appendLog_({
      email: u.email,
      name: u.name,
      action: 'login',
      module: 'auth',
      detail: 'Đăng nhập thành công'
    });
  } catch (e) {}

  return {
    ok: true,
    token: token,
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
  appendLog_({
    email: data.adminEmail || data.email || '',
    name: '',
    action: 'approve',
    module: 'admin',
    detail: 'Duyệt ' + u.email
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
  if (!u || !verifyPass_(u.pass, oldPass)) throw new Error('Mật khẩu hiện tại không đúng');
  updateUserRow_(u, { pass: hashForStore_(newPass) });
  // Hủy mọi session cũ của user này (đơn giản: không quét hết, client nên logout)
  appendLog_({
    email: email,
    name: u.name,
    action: 'changepass',
    module: 'auth',
    detail: 'Đổi mật khẩu'
  });
  return { ok: true };
}

function resetPass_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  var np = String(data.newPass || data.pass || '');
  if (np.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
  updateUserRow_(u, { pass: hashForStore_(np) });
  return { ok: true };
}

/* ===================== Presence ===================== */

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
  // Ưu tiên token; vẫn chấp nhận email (tương thích)
  var email = '';
  var name = '';
  var token = String(data.token || '');
  if (token) {
    var s = getSession_(token);
    if (s) {
      email = s.email;
      name = s.name;
    }
  }
  if (!email) {
    email = String(data.email || '').trim().toLowerCase();
  }
  if (!email) return { ok: false, error: 'Thiếu email / token' };

  var u = findUser_(email);
  if (!u) return { ok: false, error: 'User không tồn tại' };
  if (u.status !== 'approved') return { ok: false, error: 'Tài khoản chưa được duyệt' };

  var map = presenceMap_();
  map[email] = {
    email: email,
    name: String(data.name || name || u.name || '').trim(),
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
  var online = [];
  var recent = [];
  Object.keys(map).forEach(function (k) {
    var rec = map[k];
    var t = Date.parse(rec.at || 0);
    if (!t) return;
    var ageMin = (now - t) / 60000;
    if (ageMin <= ONLINE_MINUTES) online.push(rec);
    else if (ageMin <= RECENT_MINUTES) recent.push(rec);
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

/* ===================== Sheet sources ===================== */

function getSheets_(data) {
  var props = PropertiesService.getScriptProperties();
  var sheets = {};
  try {
    sheets = JSON.parse(props.getProperty('SHEET_SOURCES') || '{}') || {};
  } catch (e) {
    sheets = {};
  }
  // Nguồn PCCCR thống nhất trong tệp BQLRPH-Auth.
  sheets.pcccr = {sid:'1XtE06-U5kUfsiOro4vxuik3uM7NslWDYg8wMPud-pRI',gid:'581631532',label:'BQLRPH-Auth — Tiến độ PCCCR'};
  return { ok: true, sheets: sheets };
}

function setSheets_(data) {
  requireAdmin_(data);
  var sheets = data.sheets;
  if (!sheets || typeof sheets !== 'object') {
    throw new Error('Thiếu sheets');
  }
  // Không cho cấu hình cũ ghi đè nguồn PCCCR đã thống nhất.
  sheets.pcccr = {sid:'1XtE06-U5kUfsiOro4vxuik3uM7NslWDYg8wMPud-pRI',gid:'581631532',label:'BQLRPH-Auth — Tiến độ PCCCR'};
  PropertiesService.getScriptProperties()
    .setProperty('SHEET_SOURCES', JSON.stringify(sheets));
  return { ok: true };
}

/* ===================== Thông báo ===================== */

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

/**
 * Danh sách tin đăng (admin).
 * Cột sheet: Loại|Tiêu đề|Nội dung|Ngày đăng|Hết hạn|Link file|Ảnh|Người đăng|Ghim|Hiện
 * Client admin.html cần: items[{ row, type, title, date, author, link, show, pin, body, exp, image }]
 */
function listThongBao_(data) {
  requireAdmin_(data);
  var sh = ensureThongBaoSheet_();
  var values = sh.getDataRange().getValues();
  var items = [];
  if (values.length < 2) return { ok: true, items: items };

  // Đọc từ cuối (tin mới trước)
  for (var r = values.length - 1; r >= 1; r--) {
    var row = values[r];
    var title = String(row[1] || '').trim();
    if (!title) continue;
    items.push({
      row: r + 1,
      type: String(row[0] || ''),
      title: title,
      body: String(row[2] || ''),
      date: String(row[3] || ''),
      exp: String(row[4] || ''),
      link: String(row[5] || ''),
      image: String(row[6] || ''),
      author: String(row[7] || ''),
      pin: String(row[8] || ''),
      show: String(row[9] || '')
    });
  }
  return { ok: true, items: items };
}

/**
 * Ẩn / hiện tin: cập nhật cột "Hiện" (cột 10).
 * data.row = số dòng sheet (1-based), data.show = 1|0
 */
function hideThongBao_(data) {
  requireAdmin_(data);
  var rowNum = parseInt(data.row, 10);
  if (!rowNum || rowNum < 2) throw new Error('Dòng tin không hợp lệ');
  var sh = ensureThongBaoSheet_();
  if (rowNum > sh.getLastRow()) throw new Error('Không tìm thấy tin');
  var showVal = (data.show === 1 || data.show === '1' || data.show === true) ? '1' : '';
  // Cột 10 = Hiện
  sh.getRange(rowNum, 10).setValue(showVal);
  return { ok: true, row: rowNum, show: showVal };
}

/* ===================== Activity Log ===================== */

function ensureLogSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(['time', 'email', 'name', 'action', 'module', 'detail', 'ip', 'ua']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function appendLog_(rec) {
  var sh = ensureLogSheet_();
  sh.appendRow([
    new Date().toISOString(),
    String(rec.email || ''),
    String(rec.name || ''),
    String(rec.action || ''),
    String(rec.module || ''),
    String(rec.detail || '').slice(0, 500),
    String(rec.ip || ''),
    String(rec.ua || '').slice(0, 200)
  ]);
  // Giữ tối đa ~5000 dòng gần nhất (đơn giản)
  var last = sh.getLastRow();
  if (last > 5002) {
    sh.deleteRows(2, last - 5001);
  }
}

function logActivity_(data) {
  // Cho phép ghi log khi đã login (token hoặc email+pass)
  var user = null;
  try {
    user = requireUser_(data);
  } catch (e) {
    // Vẫn ghi được log ẩn danh nếu muốn (ví dụ mở trang công khai)
    user = {
      email: String(data.email || 'anonymous'),
      name: String(data.name || '')
    };
  }
  appendLog_({
    email: user.email,
    name: user.name || data.name || '',
    action: String(data.logAction || data.event || 'view'),
    module: String(data.module || data.page || ''),
    detail: String(data.detail || data.note || ''),
    ip: String(data.ip || ''),
    ua: String(data.ua || '')
  });
  return { ok: true };
}

function listLog_(data) {
  requireAdmin_(data);
  var sh = ensureLogSheet_();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, logs: [] };

  var limit = Math.min(parseInt(data.limit, 10) || 200, 1000);
  var emailFilter = String(data.email || '').trim().toLowerCase();
  var moduleFilter = String(data.module || '').trim().toLowerCase();

  var logs = [];
  // Đọc từ cuối (mới nhất)
  for (var r = values.length - 1; r >= 1 && logs.length < limit; r--) {
    var row = values[r];
    var email = String(row[1] || '').toLowerCase();
    var module = String(row[4] || '').toLowerCase();
    if (emailFilter && email.indexOf(emailFilter) < 0) continue;
    if (moduleFilter && module.indexOf(moduleFilter) < 0) continue;
    logs.push({
      time: String(row[0] || ''),
      email: String(row[1] || ''),
      name: String(row[2] || ''),
      action: String(row[3] || ''),
      module: String(row[4] || ''),
      detail: String(row[5] || ''),
      ip: String(row[6] || ''),
      ua: String(row[7] || '')
    });
  }
  return { ok: true, logs: logs };
}


/* ===================== Module PCCCR ===================== */
function pcccrUser_(data) {
  var token = String(data.token || data.sessionToken || '');
  var sess = token ? getSession_(token) : null;
  var user = sess ? findUser_(sess.email) : null;
  if ((!user || user.status !== 'approved') && (data.adminEmail || data.adminPass)) {
    user = requireAdmin_(data);
  }
  if (!user || user.status !== 'approved') {
    throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
  }
  var perms = String(user.perms || '').split(/[,;|]/).map(function(x){return x.trim();});
  if (user.role !== 'admin' && perms.indexOf('pcccr') < 0) throw new Error('Tài khoản chưa được cấp quyền PCCCR.');
  return user;
}
function pcccrSheet_(name, headers) {
  var cfg = {};
  try { cfg = JSON.parse(PropertiesService.getScriptProperties().getProperty('SHEET_SOURCES') || '{}') || {}; } catch(e) {}
  // Cấp cháy được lưu trong cùng tệp BQLRPH-Auth, tại tab PCCCR_CapChay.
  // Bảng tiến độ nằm ở tab GID 581631532 trong chính tệp này.
  var sid = '1XtE06-U5kUfsiOro4vxuik3uM7NslWDYg8wMPud-pRI';
  var ss = SpreadsheetApp.openById(sid);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  // Bổ sung bảng tra cấp dự báo cháy rừng theo QĐ 47/2026/QĐ-UBND
  // tại cột J:L; không ghi đè nhật ký cập nhật hằng ngày ở cột A:H.
  if (name === 'PCCCR_CapChay') {
    var ref = [
      ['BẢNG TRA CẤP DỰ BÁO CHÁY RỪNG — ĐỒNG NAI','CHỈ TIÊU P NESTEROV','ĐẶC TRƯNG CẤP DỰ BÁO'],
      ['CẤP I — THẤP','< 5.000','Ít có khả năng xảy ra cháy rừng'],
      ['CẤP II — TRUNG BÌNH','5.001 – 10.000','Có khả năng xảy ra cháy rừng'],
      ['CẤP III — CAO','10.001 – 15.000','Có khả năng dễ xảy ra cháy rừng'],
      ['CẤP IV — NGUY HIỂM','15.001 – 20.000','Có khả năng xảy ra cháy rừng lớn'],
      ['CẤP V — CỰC KỲ NGUY HIỂM','> 20.000','Có khả năng cháy lớn ở tất cả các loại rừng, tốc độ lửa lan nhanh']
    ];
    sh.getRange(1,10,ref.length,3).setValues(ref);
    sh.getRange(1,10,1,3).setFontWeight('bold').setWrap(true).setBackground('#1e3a5f').setFontColor('#ffffff');
    sh.getRange(2,10,5,3).setWrap(true).setVerticalAlignment('middle');
    sh.setColumnWidth(10,220);
    sh.setColumnWidth(11,170);
    sh.setColumnWidth(12,430);
    sh.setRowHeights(1,6,38);
    sh.getRange(8,10).setValue('CÔNG THỨC: P = K × Σ(T13 × D13). K = 1 khi lượng mưa ngày < 5 mm; K = 0 khi lượng mưa ngày > 5 mm hoặc có mưa phùn kéo dài 3–5 ngày theo quy định. T13: nhiệt độ lúc 13 giờ (°C); D13: độ chênh lệch bão hòa lúc 13 giờ (hPa).');
    sh.getRange(8,10,1,3).setWrap(true).setBackground('#fff7ed').setFontColor('#7c2d12');
    sh.setRowHeight(8,70);
  }
  return sh;
}
function pcccrGet_(data) {
  // Đọc cấp cháy là dữ liệu hiển thị; không kiểm tra lại phiên tại API này.
  // Quyền Admin vẫn được kiểm tra riêng khi ghi/cập nhật cấp cháy.
  var user = null;
  try {
    var token = String(data.token || data.sessionToken || '');
    var sess = token ? getSession_(token) : null;
    if (sess) user = findUser_(sess.email);
  } catch (e) { user = null; }
  var capSh = pcccrSheet_('PCCCR_CapChay', ['Ngày','Cấp cháy','Nhiệt độ','Độ ẩm','Tốc độ gió','Nguồn','Người cập nhật','Thời điểm cập nhật']);
  var capRows = capSh.getLastRow() > 1 ? capSh.getRange(2,1,capSh.getLastRow()-1,8).getValues() : [];
  var cap = null;
  if (capRows.length) {
    // Chuẩn hóa ngày vì Google Sheets có thể trả về Date thay vì chuỗi yyyy-MM-dd.
    function dateKey_(v) {
      if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
        return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyyMMdd');
      }
      var s = String(v || '').trim();
      var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return m[1] + m[2] + m[3];
      var d = new Date(s);
      return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyyMMdd');
    }
    capRows.sort(function(a,b) {
      var ka = dateKey_(a[0]), kb = dateKey_(b[0]);
      if (ka !== kb) return kb.localeCompare(ka);
      return String(b[7] || '').localeCompare(String(a[7] || ''));
    });
    var r = capRows[0], key = dateKey_(r[0]);
    cap = {ngay:key ? key.slice(0,4)+'-'+key.slice(4,6)+'-'+key.slice(6,8) : String(r[0] || ''),cap:r[1],nhietDo:r[2],doAmKK:r[3],tocDoGio:r[4],nguon:r[5],nguoiCapNhat:r[6],capNhatLuc:r[7]};
  }
  return {ok:true,capChay:cap,user:user ? {name:user.name,email:user.email,role:user.role} : null};
}
function pcccrSaveCap_(data) {
  var user = requireAdmin_(data);
  var x = data.capChay || {};
  var ngay = String(x.ngay || '');
  var cap = Number(x.cap);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || cap < 1 || cap > 5) throw new Error('Ngày hoặc cấp cháy không hợp lệ.');
  var sh = pcccrSheet_('PCCCR_CapChay', ['Ngày','Cấp cháy','Nhiệt độ','Độ ẩm','Tốc độ gió','Nguồn','Người cập nhật','Thời điểm cập nhật']);
  var values = [ngay,cap,Number(x.nhietDo)||0,Number(x.doAmKK)||0,Number(x.tocDoGio)||0,String(x.nguon||''),String(user.name||user.email),new Date().toISOString()];
  var last = sh.getLastRow(), found = 0;
  if (last > 1) {
    var dates = sh.getRange(2,1,last-1,1).getDisplayValues();
    for (var i=0;i<dates.length;i++) if (String(dates[i][0])===ngay) { found=i+2; break; }
  }
  if (found) sh.getRange(found,1,1,8).setValues([values]); else sh.appendRow(values);
  return {ok:true,message:'Đã cập nhật biển báo cấp cháy.'};
}
