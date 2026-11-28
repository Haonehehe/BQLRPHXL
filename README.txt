BQLRPH Xuân Lộc — Hệ thống quản lý lâm nghiệp trực tuyến
Tác giả: Huỳnh Nhựt Hào | 0878 884 088 | hnhao.213@gmail.com
Domain: https://www.bqlrphxuanloc.site

CẤU TRÚC
  index.html                 → chuyển vào menu.html
  menu.html                  → menu chính
  admin.html                 → quản trị + đăng tin
  quanly-qlbvr.html          → vi phạm QLBVR
  quanly-datdai-lamba.html   → lâm bạ
  quanly-nhao-lampart.html   → nhà ở
  quanly-mocgioi.html        → mốc giới
  quanly-trongrung.html      → trồng / chăm sóc
  quanly-nhiemvu-gantt.html  → nhiệm vụ Gantt
  quanly-tonghop-duongdan.html
  quanly-pdf.html            → PDF (công khai)
  tienich-thongbao.html      → xem thông báo / niêm yết
  tienich-congcu.html / tienich-phapluat.html / tienich-bando.html
  maps/                      → geojson lâm bạ (nếu có)
  BQLRPH-Auth-AppsScript.gs  → dán vào Apps Script, Deploy Web App

DEPLOY SCRIPT
  1. Mở Google Sheet Users → Extensions → Apps Script
  2. Dán toàn bộ BQLRPH-Auth-AppsScript.gs → Save
  3. Deploy → New deployment → Web app → Anyone → Deploy
  4. Dán URL /exec vào CONFIG.SCRIPT_URL trong menu.html & admin.html
  5. Cho phép quyền Drive (đăng tin + upload file)

UPLOAD GITHUB PAGES
  Upload toàn bộ file HTML + maps + không bắt buộc .gs/.md lên repo
