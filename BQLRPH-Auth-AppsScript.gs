/**
 * BQLRPH Xuân Lộc — Auth API (Google Apps Script)
 * ------------------------------------------------
 * 1. Tạo Google Sheet mới (hoặc dùng sheet riêng) tên tab: Users
 * 2. Extensions → Apps Script → dán toàn bộ file này → Save
 * 3. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy Web App URL → dán vào CONFIG.SCRIPT_URL trong menu.html & admin.html
 *
 * Cột sheet Users (hàng 1 header):
 * email | name | pass | status | role | perms | created | approvedAt
 *
 * Admin mặc định tạo lần chạy đầu: admin@bqlrph.local / Admin@2026
 */

var SHEET_NAME = 'Users';
var ADMIN_EMAIL = 'admin@bqlrph.local';
var ADMIN_PASS = 'Admin@2026';

function doGet(e) {
  return jsonOut({ ok: true, service: 'BQLRPH-Auth', version: 1 });
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

    return jsonOut({ ok: false, error: 'Unknown action' });
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

function ensureSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(['email', 'name', 'pass', 'status', 'role', 'perms', 'created', 'approvedAt']);
  }
  // seed admin
  var users = readUsers_();
  var found = users.some(function (u) { return u.email === ADMIN_EMAIL; });
  if (!found) {
    sh.appendRow([
      ADMIN_EMAIL,
      'Quản trị viên',
      hash_(ADMIN_PASS),
      'approved',
      'admin',
      'qlbvr,lamba,nhao,mocgioi,pdf',
      new Date().toISOString(),
      new Date().toISOString()
    ]);
  }
}

function hash_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function readUsers_() {
  var sh = sh_();
  var values = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    out.push({
      row: i + 1,
      email: String(r[0]).trim().toLowerCase(),
      name: String(r[1] || '').trim(),
      pass: String(r[2] || ''),
      status: String(r[3] || 'pending').trim(),
      role: String(r[4] || 'user').trim(),
      perms: String(r[5] || 'pdf').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      created: String(r[6] || ''),
      approvedAt: String(r[7] || '')
    });
  }
  return out;
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
  var admin = findUser_(data.adminEmail);
  if (!admin || admin.role !== 'admin' || admin.status !== 'approved') {
    throw new Error('Không có quyền admin');
  }
  if (admin.pass !== hash_(String(data.adminPass || ''))) {
    // also allow session-style: adminPass already hashed from client? No - client sends plain, we hash
    throw new Error('Xác thực admin thất bại');
  }
  return admin;
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

function approve_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  var perms = Array.isArray(data.perms) ? data.perms : String(data.perms || 'pdf').split(',');
  perms = perms.map(function (s) { return String(s).trim(); }).filter(Boolean);
  if (perms.indexOf('pdf') < 0) perms.push('pdf');
  var sh = sh_();
  sh.getRange(u.row, 4).setValue('approved');
  sh.getRange(u.row, 5).setValue(data.asAdmin ? 'admin' : (u.role === 'admin' ? 'admin' : 'user'));
  sh.getRange(u.row, 6).setValue(perms.join(','));
  sh.getRange(u.row, 8).setValue(new Date().toISOString());
  return { ok: true };
}

function reject_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  if (u.email === ADMIN_EMAIL) throw new Error('Không thể từ chối admin gốc');
  var sh = sh_();
  sh.getRange(u.row, 4).setValue('rejected');
  sh.getRange(u.row, 5).setValue('user');
  sh.getRange(u.row, 6).setValue('pdf');
  return { ok: true };
}

function disable_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  if (u.email === ADMIN_EMAIL) throw new Error('Không thể khóa admin gốc');
  sh_().getRange(u.row, 4).setValue('disabled');
  return { ok: true };
}

function setPerms_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  var perms = Array.isArray(data.perms) ? data.perms : String(data.perms || 'pdf').split(',');
  perms = perms.map(function (s) { return String(s).trim(); }).filter(Boolean);
  if (perms.indexOf('pdf') < 0) perms.push('pdf');
  sh_().getRange(u.row, 6).setValue(perms.join(','));
  return { ok: true };
}

function changePass_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var u = findUser_(email);
  if (!u || u.pass !== hash_(String(data.oldPass || ''))) throw new Error('Mật khẩu cũ không đúng');
  var np = String(data.newPass || '');
  if (np.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
  sh_().getRange(u.row, 3).setValue(hash_(np));
  return { ok: true };
}


function resetPass_(data) {
  requireAdmin_(data);
  var u = findUser_(data.email);
  if (!u) throw new Error('Không tìm thấy user');
  var np = String(data.newPass || '');
  if (np.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
  sh_().getRange(u.row, 3).setValue(hash_(np));
  return { ok: true, message: 'Đã đặt lại mật khẩu' };
}
