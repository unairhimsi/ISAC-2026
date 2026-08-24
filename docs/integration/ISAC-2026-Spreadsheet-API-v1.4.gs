/**
 * ============================================================
 * ISAC 2026 — GOOGLE SPREADSHEET INTEGRATION API v1.4
 * ============================================================
 *
 * Database ISAC = Source of Truth
 * Spreadsheet   = Operational Monitoring / Integration Log
 *
 * Perubahan v1.4 — Template Lebih Informatif + Anti-Spam (Tema Web)
 * - Template email sekarang lebih informatif & sinkron tema web ISAC:
 *   header gradient #23155f→#151827, lime accent #a7ff5a, dark #090b15/#151827
 *   logo dari https://isac.himsiunair.com/logo.png (public/logo.png 126x45)
 *   detail box: kode tim, kompetisi, batch, tahap/status, email terdaftar
 *   langkah selanjutnya + CTA "Buka Team Dashboard" + preheader
 *   footer alamat fisik HIMSI UNAIR (wajib anti-spam)
 * - Anti-spam Spreadsheet (karena sebelumnya masuk spam via GmailApp):
 *   • EMAIL_SENDER_ALIAS wajib diisi alias terverifikasi Google Workspace
 *     contoh: isac@himsiunair.com (bukan @gmail.com). Set alias di
 *     Admin console → Gmail → Settings → "Send mail as" → verifikasi.
 *     Jika kosong, tetap pakai akun pemilik script (mudah masuk spam).
 *   • Domain isac.himsiunair.com WAJIB SPF include:_spf.google.com
 *     + include:spf.brevo.net, DKIM & DMARC (lihat docs/integration/README.md)
 *   • Subject tanpa tanda kurung berlebihan: "ISAC 2026 — <judul>"
 *   • Plain text + HTML (multipart) + preheader
 *   • Footer fisik + notice "tambahkan ke kontak"
 *   • Opsional: set GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=false di Laravel
 *     untuk kirim via Brevo (deliverability lebih tinggi) — Sheet tetap SYNCED.
 * - Kompatibel v1.3: HEADERS & endpoint sama, VERSION bump 1.4.0
 *
 * Konfigurasi Laravel:
 *   GOOGLE_SHEET_API_URL=https://script.google.com/macros/s/.../exec
 *   GOOGLE_SHEET_API_KEY=...
 *   GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=true|false
 *
 * Supported endpoints:
 * GET  /exec?path=health | /exec?path=events/{eventId}&apiKey=...
 * POST /exec?path=events/batch-upsert | /exec?path=events/{eventId}/delivery-status
 */

const CONFIG = {
  SHEET_NAME: 'Events',
  SPREADSHEET_ID_PROPERTY: 'SPREADSHEET_ID',
  API_KEY_PROPERTY: 'ISAC_API_KEY',
  MAX_BATCH_SIZE: 500,
  SERVICE_NAME: 'ISAC Spreadsheet Integration API',
  VERSION: '1.4.0',

  // ANTI-SPAM: isi alias domain terverifikasi, JANGAN @gmail.com
  // Setup: Google Workspace isac@himsiunair.com → Settings → Accounts → Send mail as → Add alias
  // Jika dikosongkan, fallback ke akun pemilik script (rawan spam).
  EMAIL_SENDER_NAME: 'ISAC 2026 — HIMSI UNAIR',
  EMAIL_SENDER_ALIAS: 'isac@himsiunair.com',
  APP_URL: 'https://isac.himsiunair.com',
  LOGO_URL: 'https://isac.himsiunair.com/logo.png',
  DASHBOARD_URL: 'https://isac.himsiunair.com/dashboard',
  SUPPORT_EMAIL: 'isac@himsiunair.com',
  PHYSICAL_ADDRESS: 'Departemen Sistem Informasi, FST Universitas Airlangga — Kampus C, Surabaya 60115',
};

const HEADERS = [
  'event_id','operation_id',
  'team_id','team_code','team_name','team_email',
  'competition','batch',
  'current_stage',
  'action',
  'status_before','status_after',
  'announcement_title','announcement_template',
  'requested_by','requested_at',
  'spreadsheet_status',
  'email_status','provider_message_id','sent_at',
  'retry_count','last_error',
  'created_at','updated_at',
];

function setup() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty(CONFIG.SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create('ISAC 2026 - Integration Events');
    spreadsheetId = spreadsheet.getId();
    properties.setProperty(CONFIG.SPREADSHEET_ID_PROPERTY, spreadsheetId);
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,HEADERS.length).setFontWeight('bold');
    sheet.autoResizeColumns(1, HEADERS.length);
    sheet.getRange(1,1,1,HEADERS.length).createFilter();
  }
  let apiKey = properties.getProperty(CONFIG.API_KEY_PROPERTY);
  if (!apiKey) {
    apiKey = generateApiKey_();
    properties.setProperty(CONFIG.API_KEY_PROPERTY, apiKey);
  }
  console.log('==========================================');
  console.log('ISAC Spreadsheet API v1.4 initialized');
  console.log('Spreadsheet ID: ' + spreadsheetId);
  console.log('Spreadsheet URL: https://docs.google.com/spreadsheets/d/' + spreadsheetId);
  console.log('API Key configured: YES');
  console.log('Email v1.4: template informatif + anti-spam, alias=' + (CONFIG.EMAIL_SENDER_ALIAS || '(owner)'));
  console.log('==========================================');
  return { success: true, spreadsheetId, spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + spreadsheetId, apiKeyConfigured: true };
}

function rotateApiKey() {
  const properties = PropertiesService.getScriptProperties();
  const apiKey = generateApiKey_();
  properties.setProperty(CONFIG.API_KEY_PROPERTY, apiKey);
  return { success: true, message: 'API key successfully rotated.' };
}

function doGet(e) {
  try {
    const path = normalizePath_(e.pathInfo || (e.parameter ? e.parameter.path : ''));
    if (!path || path === 'health') {
      return jsonResponse_({ success: true, service: CONFIG.SERVICE_NAME, version: CONFIG.VERSION, status: 'UP', timestamp: new Date().toISOString(), emailAlias: CONFIG.EMAIL_SENDER_ALIAS || 'owner' });
    }
    const eventMatch = path.match(/^events\/([^/]+)$/);
    if (eventMatch) {
      requireApiKey_(e.parameter ? e.parameter.apiKey : null);
      const eventId = decodeURIComponent(eventMatch[1]);
      return getEvent_(eventId);
    }
    return jsonResponse_({ success: false, code: 404, message: 'Endpoint not found', path, timestamp: new Date().toISOString() });
  } catch (error) { return errorResponse_(error); }
}

function doPost(e) {
  try {
    const path = normalizePath_(e.pathInfo || (e.parameter ? e.parameter.path : ''));
    const body = parseJsonBody_(e);
    requireApiKey_(body.apiKey || (e.parameter ? e.parameter.apiKey : null));
    if (path === 'events/batch-upsert') return batchUpsertEvents_(body);
    const deliveryMatch = path.match(/^events\/([^/]+)\/delivery-status$/);
    if (deliveryMatch) {
      const eventId = decodeURIComponent(deliveryMatch[1]);
      return updateDeliveryStatus_(eventId, body);
    }
    return jsonResponse_({ success: false, code: 404, message: 'Endpoint not found', path, timestamp: new Date().toISOString() });
  } catch (error) { return errorResponse_(error); }
}

function batchUpsertEvents_(payload) {
  if (!payload.operationId) throw new ApiError(422, 'operationId is required');
  if (!Array.isArray(payload.events)) throw new ApiError(422, 'events must be an array');
  if (payload.events.length === 0) throw new ApiError(422, 'events cannot be empty');
  if (payload.events.length > CONFIG.MAX_BATCH_SIZE) throw new ApiError(422, 'Maximum ' + CONFIG.MAX_BATCH_SIZE + ' events per request');

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getEventsSheet_();
    const existingEventIds = getExistingEventIds_(sheet);
    const rowsToInsert = [];
    let accepted = 0, duplicates = 0, failed = 0;
    const errors = [];

    payload.events.forEach((event, index) => {
      try {
        validateEvent_(event);
        if (existingEventIds.has(String(event.eventId))) { duplicates++; return; }
        const now = new Date().toISOString();

        let emailStatusRaw = event.emailStatus || event.email_status || null;
        if (!emailStatusRaw) {
          const act = String(event.action || '').trim().toUpperCase();
          const needsEmail = ['VERIFY_TEAM','VERIFY_PAYMENT','VERIFY_TEAM_PAYMENT','ADVANCE_STAGE','ANNOUNCE_RESULT'].includes(act);
          emailStatusRaw = needsEmail ? 'PENDING' : 'NOT_REQUIRED';
        }
        let emailStatus = String(emailStatusRaw).trim().toUpperCase();
        let providerMessageId = event.providerMessageId || '';
        let sentAt = event.sentAt || '';
        let retryCount = Number(event.retryCount || 0);
        let lastError = event.lastError || '';

        if (emailStatus === 'PENDING') {
          const actionUpper = String(event.action || '').trim().toUpperCase();
          const emailableActions = ['VERIFY_TEAM','VERIFY_PAYMENT','VERIFY_TEAM_PAYMENT','ADVANCE_STAGE','ANNOUNCE_RESULT'];
          if (emailableActions.includes(actionUpper)) {
            try {
              const teamEmail = (event.team && event.team.email) ? String(event.team.email).trim() : '';
              if (!teamEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teamEmail)) {
                throw new Error('team.email tidak valid: ' + teamEmail);
              }
              const sendResult = sendOperationEmail_(event);
              emailStatus = 'SENT';
              providerMessageId = sendResult && sendResult.messageId ? sendResult.messageId : ('apps-script-' + Utilities.getUuid().slice(0,8));
              sentAt = new Date().toISOString();
              lastError = '';
            } catch (emailErr) {
              emailStatus = 'FAILED';
              lastError = String(emailErr && emailErr.message ? emailErr.message : emailErr).slice(0,2000);
            }
          } else {
            emailStatus = 'NOT_REQUIRED';
          }
        }

        const row = [
          event.eventId,
          payload.operationId,
          event.team?.id || '',
          event.team?.code || '',
          event.team?.name || '',
          event.team?.email || '',
          event.competition?.type || '',
          event.competition?.batch || '',
          event.currentStage || '',
          event.action || '',
          event.statusBefore || '',
          event.statusAfter || '',
          event.announcement?.title || '',
          event.announcement?.template || '',
          event.requestedBy || payload.requestedBy || '',
          event.requestedAt || now,
          'SYNCED',
          emailStatus,
          providerMessageId,
          sentAt,
          retryCount,
          lastError,
          now,
          now,
        ];
        rowsToInsert.push(row);
        existingEventIds.add(String(event.eventId));
        accepted++;
      } catch (error) {
        failed++;
        errors.push({ index, eventId: event?.eventId || null, message: error.message });
      }
    });

    if (rowsToInsert.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToInsert.length, HEADERS.length).setValues(rowsToInsert);
    }

    return jsonResponse_({ success: true, operationId: payload.operationId, accepted, duplicates, failed, errors, timestamp: new Date().toISOString() });
  } finally {
    if (typeof lock.hasLock === 'function' ? lock.hasLock() : true) { try { lock.releaseLock(); } catch (_) {} }
  }
}

/**
 * SEND OPERATION EMAIL — v1.4 Informatif + Tema Web + Anti-Spam
 */
function sendOperationEmail_(event) {
  const team = event.team || {};
  const competition = event.competition || {};
  const announcement = event.announcement || {};
  const actionUpper = String(event.action || '').trim().toUpperCase();
  const defaultTitles = {
    'VERIFY_TEAM': 'Verifikasi Data Team',
    'VERIFY_PAYMENT': 'Verifikasi Pembayaran',
    'VERIFY_TEAM_PAYMENT': 'Verifikasi Tim & Pembayaran',
    'ADVANCE_STAGE': 'Pengumuman Kelolosan Tahap',
    'ANNOUNCE_RESULT': 'Pengumuman Hasil ISAC 2026'
  };
  const title = announcement.title || defaultTitles[actionUpper] || 'Pembaruan Kompetisi ISAC 2026';
  const message = announcement.message || 'Terdapat pembaruan pada perjalanan kompetisi Team Anda.';
  const statusAfter = event.statusAfter || event.currentStage || '—';
  const teamName = team.name || 'Team ISAC';
  const teamCode = team.code || '—';
  const recipient = String(team.email || '').trim();
  const actionLabel = actionUpper.replace(/_/g,' ');

  const escapedMessage = String(message)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>');
  const preheader = String(message).slice(0,90) + ' — Lihat detail di dashboard ISAC 2026.';

  // TEMA WEB: #090b15 background, #151827 card, #30364f border, #23155f→#151827 gradient, #a7ff5a lime
  const htmlBody = ''
    + '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>' + escapeHtml_(title) + '</title></head>'
    + '<body style="margin:0;background:#090b15;color:#eff2ff;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + escapeHtml_(preheader) + '</div>'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#090b15;padding:24px 12px;"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#151827;border:1px solid #30364f;border-radius:24px;overflow:hidden;">'
    // Header
    + '<tr><td style="padding:28px 32px 22px;background:linear-gradient(135deg,#23155f 0%,#1a1440 45%,#151827 100%);border-bottom:1px solid rgba(255,255,255,0.06);">'
    + '<img src="' + CONFIG.LOGO_URL + '" alt="ISAC 2026 — HIMSI UNAIR" width="132" height="48" style="display:block;border:0;max-width:132px;height:auto;">'
    + '<p style="margin:16px 0 0;color:#b9b5ff;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">INFORMATION SYSTEMS AIRLANGGA COMPETITION 2026</p>'
    + '<p style="margin:6px 0 0;color:#8d95ae;font-size:11px;">HIMSI Universitas Airlangga — Fakultas Sains &amp; Teknologi</p>'
    + '<h1 style="margin:16px 0 0;color:#ffffff;font-size:22px;line-height:1.3;font-weight:800;">' + escapeHtml_(title) + '</h1>'
    + '<p style="margin:8px 0 0;display:inline-block;background:rgba(167,255,90,0.12);border:1px solid rgba(167,255,90,0.25);color:#a7ff5a;font-size:11px;font-weight:700;letter-spacing:0.6px;padding:4px 10px;border-radius:999px;">' + escapeHtml_(actionLabel) + '</p>'
    + '</td></tr>'
    // Body
    + '<tr><td style="padding:28px 32px;color:#e4e7f4;font-size:14px;line-height:1.7;">'
    + '<p style="margin:0 0 14px;">Halo, <strong style="color:#ffffff;">' + escapeHtml_(teamName) + '</strong> 👋</p>'
    + '<p style="margin:0 0 18px;color:#e4e7f4;">' + escapedMessage + '</p>'
    // Detail box
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #30364f;border-radius:16px;background:#0f1220;overflow:hidden;"><tr><td style="padding:18px;">'
    + '<p style="margin:0 0 12px;color:#a7ff5a;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Detail Peserta</p>'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;line-height:1.5;">'
    + '<tr><td style="padding:6px 0;color:#aeb6cf;width:38%;">Kode Tim</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">' + escapeHtml_(teamCode) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:#aeb6cf;">Kompetisi</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">' + escapeHtml_(competition.name || 'ISAC 2026') + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:#aeb6cf;">Batch</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">' + escapeHtml_(competition.batch || '—') + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:#aeb6cf;">Tahap / Status</td><td style="padding:6px 0;color:#ffffff;font-weight:700;">' + escapeHtml_(statusAfter) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:#aeb6cf;">Email Terdaftar</td><td style="padding:6px 0;color:#e4e7f4;">' + escapeHtml_(recipient || '—') + '</td></tr>'
    + '</table></td></tr></table>'
    // Langkah selanjutnya
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:rgba(167,255,90,0.07);border:1px solid rgba(167,255,90,0.18);border-radius:14px;"><tr><td style="padding:14px 16px;">'
    + '<p style="margin:0 0 4px;color:#a7ff5a;font-size:12px;font-weight:700;">Langkah Selanjutnya</p>'
    + '<p style="margin:0;color:#e4e7f4;font-size:13px;line-height:1.55;">Buka dashboard team untuk melihat jadwal, pengumuman, dan instruksi tahap berikutnya. Pastikan data tim &amp; anggota sudah lengkap.</p>'
    + '</td></tr></table>'
    // CTA
    + '<p style="margin:22px 0 0;text-align:center;"><a href="' + CONFIG.DASHBOARD_URL + '" style="display:inline-block;border-radius:999px;background:#a7ff5a;color:#141a0c;padding:13px 24px;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.2px;box-shadow:0 6px 20px rgba(167,255,90,0.25);">Buka Team Dashboard →</a></p>'
    + '<p style="margin:12px 0 0;text-align:center;color:#8d95ae;font-size:11px;">atau salin tautan: <a href="' + CONFIG.DASHBOARD_URL + '" style="color:#a7ff5a;word-break:break-all;">' + CONFIG.DASHBOARD_URL + '</a></p>'
    + '<p style="margin:22px 0 0;color:#aeb6cf;font-size:12px;line-height:1.6;">Butuh bantuan? Hubungi panitia via <a href="mailto:' + CONFIG.SUPPORT_EMAIL + '" style="color:#a7ff5a;text-decoration:none;">' + CONFIG.SUPPORT_EMAIL + '</a> atau kanal resmi ISAC 2026.</p>'
    + '<p style="margin:8px 0 0;color:#8d95ae;font-size:11px;line-height:1.5;">Pesan ini dikirim otomatis untuk <strong style="color:#e4e7f4;">' + escapeHtml_(recipient || 'email terdaftar') + '</strong>. Jika kamu merasa tidak mendaftar ISAC 2026, abaikan email ini.</p>'
    + '</td></tr>'
    // Footer fisik anti-spam
    + '<tr><td style="padding:16px 32px;background:#0f1220;border-top:1px solid #30364f;color:#8d95ae;font-size:11px;line-height:1.6;text-align:center;">'
    + '<p style="margin:0;color:#e4e7f4;font-weight:700;letter-spacing:0.3px;">© ' + new Date().getFullYear() + ' Information Systems Airlangga Competition — HIMSI UNAIR</p>'
    + '<p style="margin:4px 0 0;">' + escapeHtml_(CONFIG.PHYSICAL_ADDRESS) + '</p>'
    + '<p style="margin:8px 0 0;font-size:10px;color:#6b7280;">Email resmi ISAC 2026. Tambahkan <span style="color:#aeb6cf;">' + escapeHtml_(CONFIG.SUPPORT_EMAIL) + '</span> ke kontak agar tidak masuk spam. Mohon tidak membalas langsung ke email ini.</p>'
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';

  const subject = 'ISAC 2026 — ' + title;
  const plainBody = 'Halo ' + teamName + ',\n\n'
    + String(message) + '\n\n'
    + 'Kode Tim: ' + teamCode + '\n'
    + 'Kompetisi: ' + (competition.name || 'ISAC 2026') + '\n'
    + 'Batch: ' + (competition.batch || '—') + '\n'
    + 'Tahap/Status: ' + statusAfter + '\n'
    + 'Aksi: ' + actionUpper + '\n\n'
    + 'Buka dashboard: ' + CONFIG.DASHBOARD_URL + '\n\n'
    + 'Butuh bantuan? ' + CONFIG.SUPPORT_EMAIL + '\n'
    + CONFIG.PHYSICAL_ADDRESS;

  const options = {
    htmlBody: htmlBody,
    name: CONFIG.EMAIL_SENDER_NAME,
  };
  if (CONFIG.EMAIL_SENDER_ALIAS) {
    options.from = CONFIG.EMAIL_SENDER_ALIAS;
  }

  // ANTI-SPAM: GmailApp akan kirim via alias domain jika terverifikasi.
  // Jika kuota Gmail consumer terbatas (~500/hari), pertimbangkan switch ke Brevo:
  // Laravel: GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=false
  if (typeof GmailApp !== 'undefined' && GmailApp.sendEmail) {
    GmailApp.sendEmail(recipient, subject, plainBody, options);
  } else {
    MailApp.sendEmail({ to: recipient, subject: subject, body: plainBody, htmlBody: htmlBody, name: CONFIG.EMAIL_SENDER_NAME });
  }

  return { messageId: 'gmail-' + Utilities.getUuid().slice(0,12) };
}

function escapeHtml_(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getEvent_(eventId) {
  if (!eventId) throw new ApiError(422, 'eventId is required');
  const sheet = getEventsSheet_();
  const rowNumber = findEventRow_(sheet, eventId);
  if (!rowNumber) return jsonResponse_({ success: false, code: 404, message: 'Event not found', eventId, timestamp: new Date().toISOString() });
  const values = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  const event = {};
  HEADERS.forEach((header, index) => { event[header] = serializeSheetValue_(values[index]); });
  return jsonResponse_({ success: true, data: event, timestamp: new Date().toISOString() });
}

function updateDeliveryStatus_(eventId, payload) {
  const allowedStatuses = ['PENDING','PROCESSING','SENT','FAILED','RETRYING','NOT_REQUIRED'];
  if (!payload.status) throw new ApiError(422, 'status is required');
  const status = String(payload.status).trim().toUpperCase();
  if (!allowedStatuses.includes(status)) throw new ApiError(422, 'Invalid delivery status: ' + status);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getEventsSheet_();
    const rowNumber = findEventRow_(sheet, eventId);
    if (!rowNumber) throw new ApiError(404, 'Event not found');
    const headerMap = getHeaderMap_();
    sheet.getRange(rowNumber, headerMap.email_status).setValue(status);
    if (payload.providerMessageId !== undefined) sheet.getRange(rowNumber, headerMap.provider_message_id).setValue(payload.providerMessageId || '');
    if (status === 'SENT') {
      sheet.getRange(rowNumber, headerMap.sent_at).setValue(payload.sentAt || new Date().toISOString());
    } else if (payload.sentAt !== undefined) {
      sheet.getRange(rowNumber, headerMap.sent_at).setValue(payload.sentAt || '');
    }
    const retryCell = sheet.getRange(rowNumber, headerMap.retry_count);
    if (payload.retryCount !== undefined) retryCell.setValue(Number(payload.retryCount));
    else if (status === 'RETRYING') {
      const currentRetry = Number(retryCell.getValue()) || 0;
      retryCell.setValue(currentRetry + 1);
    }
    if (payload.lastError !== undefined) sheet.getRange(rowNumber, headerMap.last_error).setValue(payload.lastError || '');
    if (status === 'SENT' || status === 'NOT_REQUIRED') sheet.getRange(rowNumber, headerMap.last_error).setValue('');
    sheet.getRange(rowNumber, headerMap.updated_at).setValue(new Date().toISOString());
    return jsonResponse_({ success: true, eventId, emailStatus: status, providerMessageId: payload.providerMessageId || null, timestamp: new Date().toISOString() });
  } finally { if (typeof lock.hasLock === 'function' ? lock.hasLock() : true) { try { lock.releaseLock(); } catch (_) {} } }
}

function validateEvent_(event) {
  if (!event) throw new Error('Event cannot be null');
  if (!event.eventId) throw new Error('eventId is required');
  if (!event.team?.id) throw new Error('team.id is required');
  if (!event.team?.email) throw new Error('team.email is required');
  if (!event.action) throw new Error('action is required');
  const action = String(event.action).trim().toUpperCase();
  if (!action) throw new Error('action cannot be empty');
}

function getEventsSheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(CONFIG.SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) throw new ApiError(500, 'Spreadsheet not configured. Run setup() first.');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new ApiError(500, 'Events sheet not found');
  return sheet;
}
function getExistingEventIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return new Set(values.map(row => String(row[0])).filter(Boolean));
}
function findEventRow_(sheet, eventId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const finder = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(String(eventId)).matchEntireCell(true);
  const result = finder.findNext();
  return result ? result.getRow() : null;
}
function getHeaderMap_() {
  const map = {};
  HEADERS.forEach((header, index) => { map[header] = index + 1; });
  return map;
}
function requireApiKey_(providedKey) {
  const expectedKey = PropertiesService.getScriptProperties().getProperty(CONFIG.API_KEY_PROPERTY);
  if (!expectedKey) throw new ApiError(500, 'API key not configured');
  if (!providedKey) throw new ApiError(401, 'API key is required');
  if (String(providedKey) !== String(expectedKey)) throw new ApiError(401, 'Invalid API key');
  return true;
}
function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try { return JSON.parse(e.postData.contents); } catch (error) { throw new ApiError(400, 'Invalid JSON body'); }
}
function normalizePath_(path) {
  if (!path) return '';
  return String(path).trim().replace(/^\/+/, '').replace(/\/+$/, '');
}
function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data, null, 2)).setMimeType(ContentService.MimeType.JSON);
}
function errorResponse_(error) {
  console.error(error && error.stack ? error.stack : error);
  return jsonResponse_({ success: false, code: error instanceof ApiError ? error.statusCode : 500, message: error?.message || 'Internal server error', timestamp: new Date().toISOString() });
}
function serializeSheetValue_(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}
function generateApiKey_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}
class ApiError extends Error {
  constructor(statusCode, message) { super(message); this.name = 'ApiError'; this.statusCode = statusCode; }
}
