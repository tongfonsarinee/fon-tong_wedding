/**
 * ระบบเก็บคำอวยพร (โคมลอย) ของการ์ด ฝน & โต้ง ลง Google Sheet — ฟรี ไม่ต้องมีเซิร์ฟเวอร์
 *
 * วิธีตั้งค่า (ประมาณ 5 นาที):
 *  1. สร้าง Google Sheet ใหม่ (ตั้งชื่ออะไรก็ได้ เช่น "งานแต่ง ฝน & โต้ง")
 *  2. เมนู ส่วนขยาย (Extensions) → Apps Script → ลบโค้ดเดิม แล้ววางไฟล์นี้ทั้งหมด → บันทึก
 *  3. ปุ่ม ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ (New deployment)
 *     ประเภท: เว็บแอป (Web app) · ดำเนินการในฐานะ: ฉัน (Me) · ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)
 *  4. กดอนุญาตสิทธิ์ แล้วคัดลอก URL ที่ลงท้ายด้วย /exec
 *  5. วาง URL ใน js/config.js ที่ endpoint: '...'  แล้วรัน sh tools/bump-version.sh
 *
 * ชีต "Wishes" จะถูกสร้างให้อัตโนมัติเมื่อมีแขกส่งคำอวยพรครั้งแรก
 * ซ่อนคำอวยพรที่ไม่เหมาะสม: พิมพ์ no ในคอลัมน์ "แสดง" ของแถวนั้น
 * แก้โค้ดแล้วต้อง Deploy → Manage deployments → Edit → Version: New version ทุกครั้ง
 */

var MAX_NAME = 60;
var MAX_TEXT = 200;
var MAX_WISHES_RETURNED = 80;

function doGet(e) {
  var sheet = sheet_('Wishes', ['เวลา', 'ชื่อ', 'คำอวยพร', 'แสดง']);
  var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues() : [];
  var wishes = rows
    .filter(function (r) { return String(r[3]).toLowerCase() !== 'no' && r[2]; })
    .slice(-MAX_WISHES_RETURNED)
    .map(function (r) { return { name: String(r[1]), message: String(r[2]) }; });
  return json_({ ok: true, wishes: wishes });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad json' });
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (data.type === 'wish') {
      var message = clean_(data.message, MAX_TEXT);
      if (!message) return json_({ ok: false, error: 'empty' });
      sheet_('Wishes', ['เวลา', 'ชื่อ', 'คำอวยพร', 'แสดง'])
        .appendRow([new Date(), clean_(data.name, MAX_NAME) || 'แขก', message, 'yes']);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown type' });
  } finally {
    lock.releaseLock();
  }
}

function sheet_(name, header) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
  }
  return sheet;
}

// trims, caps length, and stops text being read as a spreadsheet formula (= + - @)
function clean_(value, max) {
  var text = String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
