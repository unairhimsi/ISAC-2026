/**
 * ============================================================
 * ISAC 2026 — GOOGLE SPREADSHEET INTEGRATION API v1.3
 * ============================================================
 *
 * Database ISAC = Source of Truth
 * Spreadsheet   = Operational Monitoring / Integration Log
 *
 * Perubahan v1.3 (Gabungan Verifikasi & Email All Actions):
 * - Tambah action VERIFY_TEAM_PAYMENT (gabungan team+payment dalam 1 operasi)
 * - Email via GmailApp sekarang untuk SEMUA action jika emailStatus=PENDING:
 *   VERIFY_TEAM, VERIFY_PAYMENT, VERIFY_TEAM_PAYMENT, ADVANCE_STAGE, ANNOUNCE_RESULT
 *   (sebelumnya hanya ANNOUNCE_RESULT)
 * - MAX_BATCH_SIZE tetap 500 -> support 300-400 team per operasi
 * - Laravel: MAX_TEAMS 100 -> 500, RunAdminOperationRequest max:500
 * - Frontend: announcement + send_notification sekarang tampil untuk semua aksi
 * - Laravel Brevo tetap untuk auth (OTP, verification) tidak terpengaruh
 * - Flag routing: event.emailStatus === 'PENDING' (dikirim Laravel jika send_notification=true)
 *   => Apps Script kirim email langsung, set SENT/FAILED di sheet
 *
 * Konfigurasi Laravel:
 *   GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=true (default) => Laravel TIDAK dispatch SendCompetitionAnnouncementJob
 *   Jika false, fallback ke Brevo seperti v1.1.
 *
 * Supported endpoints: sama seperti v1.2
 * GET  /exec?path=health | /exec?path=events/{eventId}&apiKey=...
 * POST /exec?path=events/batch-upsert | /exec?path=events/{eventId}/delivery-status
 */

/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const CONFIG = {
  SHEET_NAME: 'Events',
  SPREADSHEET_ID_PROPERTY: 'SPREADSHEET_ID',
  API_KEY_PROPERTY: 'ISAC_API_KEY',
  MAX_BATCH_SIZE: 500,
  SERVICE_NAME: 'ISAC Spreadsheet Integration API',
  VERSION: '1.3.0',

  // Email via Apps Script (semua operation jika PENDING) — anti-spam: pakai alias domain, jangan @gmail
  EMAIL_SENDER_NAME: 'ISAC 2026 — HIMSI UNAIR',
  EMAIL_SENDER_ALIAS: 'isac@himsiunair.com',
  APP_URL: 'https://isac.himsiunair.com',
  LOGO_URL: 'https://isac.himsiunair.com/logo.png',
  DASHBOARD_URL: 'https://isac.himsiunair.com/dashboard',
};

/**
 * ============================================================
 * SPREADSHEET HEADERS — tetap kompatibel v1.1/v1.2
 * ============================================================
 */

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

/**
 * ============================================================
 * INITIAL SETUP — sama seperti v1.2
 * ============================================================
 */
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
  console.log('ISAC Spreadsheet API v1.3 initialized');
  console.log('Spreadsheet ID: ' + spreadsheetId);
  console.log('Spreadsheet URL: https://docs.google.com/spreadsheets/d/' + spreadsheetId);
  console.log('API Key configured: YES');
  console.log('Email via Apps Script: ENABLED (ALL ACTIONS: VERIFY_TEAM, VERIFY_PAYMENT, VERIFY_TEAM_PAYMENT, ADVANCE_STAGE, ANNOUNCE_RESULT)');
  console.log('Batch limit: 500 teams per operation');
  console.log('Auth email tetap via Brevo (Laravel)');
  console.log('==========================================');
  return { success: true, spreadsheetId, spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + spreadsheetId, apiKeyConfigured: true };
}

function rotateApiKey() {
  const properties = PropertiesService.getScriptProperties();
  const apiKey = generateApiKey_();
  properties.setProperty(CONFIG.API_KEY_PROPERTY, apiKey);
  console.log('==========================================');
  console.log('ISAC API KEY ROTATED');
  console.log('NEW API KEY: ' + apiKey);
  console.log('==========================================');
  return { success: true, message: 'API key successfully rotated.' };
}

/**
 * ============================================================
 * HTTP GET ROUTER — sama v1.2
 * ============================================================
 */
function doGet(e) {
  try {
    const path = normalizePath_(e.pathInfo || (e.parameter ? e.parameter.path : ''));
    if (!path || path === 'health') {
      return jsonResponse_({ success: true, service: CONFIG.SERVICE_NAME, version: CONFIG.VERSION, status: 'UP', timestamp: new Date().toISOString() });
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

/**
 * ============================================================
 * HTTP POST ROUTER — sama v1.2
 * ============================================================
 */
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

/**
 * ============================================================
 * POST /events/batch-upsert — v1.3 dengan email untuk SEMUA aksi
 * ============================================================
 */
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

        // --- EMAIL ROUTING v1.3 ---
        // Laravel kirim emailStatus PENDING jika send_notification=true untuk SEMUA aksi
        // Apps Script kirim untuk VERIFY_TEAM, VERIFY_PAYMENT, VERIFY_TEAM_PAYMENT, ADVANCE_STAGE, ANNOUNCE_RESULT
        let emailStatusRaw = event.emailStatus || event.email_status || null;
        if (!emailStatusRaw) {
          const act = String(event.action || '').trim().toUpperCase();
          // fallback: jika tidak ada field, anggap PENDING untuk semua verify/announce yang butuh email
          const needsEmail = ['VERIFY_TEAM','VERIFY_PAYMENT','VERIFY_TEAM_PAYMENT','ADVANCE_STAGE','ANNOUNCE_RESULT'].includes(act);
          emailStatusRaw = needsEmail ? 'PENDING' : 'NOT_REQUIRED';
        }
        let emailStatus = String(emailStatusRaw).trim().toUpperCase();
        let providerMessageId = event.providerMessageId || '';
        let sentAt = event.sentAt || '';
        let retryCount = Number(event.retryCount || 0);
        let lastError = event.lastError || '';

        // Kirim email jika PENDING untuk semua aksi yang support email
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
            // action tidak support email, ubah ke NOT_REQUIRED biar tidak stuck PENDING
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
 * ============================================================
 * SEND OPERATION EMAIL VIA APPS SCRIPT (Gmail) — v1.3 support all actions
 * ============================================================
 */
function sendOperationEmail_(event) {
  const team = event.team || {};
  const competition = event.competition || {};
  const announcement = event.announcement || {};
  const actionUpper = String(event.action || '').trim().toUpperCase();
  // Judul default per aksi
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
  const recipient = String(team.email || '').trim();

  const escapedMessage = String(message)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>');

  const htmlBody = ''
    + '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>'
    + '<body style="margin:0;background:#090b15;color:#eff2ff;font-family:Arial,sans-serif;">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#090b15;padding:28px 12px;"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#151827;border:1px solid #30364f;border-radius:24px;overflow:hidden;">'
    + '<tr><td style="padding:30px 32px 20px;background:linear-gradient(135deg,#23155f,#151827);">'
    + '<img src="' + CONFIG.LOGO_URL + '" alt="ISAC 2026" width="160" style="display:block;border:0;max-width:160px;height:auto;">'
    + '<p style="margin:18px 0 0;color:#b9b5ff;font-size:12px;font-weight:700;letter-spacing:1.2px;">INFORMATION SYSTEMS AIRLANGGA COMPETITION 2026</p>'
    + '<h1 style="margin:10px 0 0;color:#ffffff;font-size:26px;line-height:1.25;">' + escapeHtml_(title) + '</h1>'
    + '</td></tr>'
    + '<tr><td style="padding:30px 32px;color:#e4e7f4;font-size:15px;line-height:1.65;">'
    + '<p style="margin:0 0 16px;">Halo, <strong>' + escapeHtml_(teamName) + '</strong>.</p>'
    + '<p style="margin:0 0 22px;">' + escapedMessage + '</p>'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #30364f;border-radius:16px;background:#0f1220;"><tr><td style="padding:16px;">'
    + '<p style="margin:0 0 6px;color:#aeb6cf;font-size:12px;">KOMPETISI</p><p style="margin:0;color:#ffffff;font-weight:700;">' + escapeHtml_(competition.name || 'ISAC 2026') + '</p>'
    + '<p style="margin:10px 0 6px;color:#aeb6cf;font-size:12px;">BATCH</p><p style="margin:0;color:#ffffff;font-weight:700;">' + escapeHtml_(competition.batch || '—') + '</p>'
    + '<p style="margin:10px 0 6px;color:#aeb6cf;font-size:12px;">TAHAP / STATUS</p><p style="margin:0;color:#ffffff;font-weight:700;">' + escapeHtml_(statusAfter) + '</p>'
    + '<p style="margin:10px 0 6px;color:#aeb6cf;font-size:12px;">AKSI</p><p style="margin:0;color:#a7ff5a;font-weight:700;">' + escapeHtml_(actionUpper.replace(/_/g,' ')) + '</p>'
    + '</td></tr></table>'
    + '<p style="margin:26px 0 0;"><a href="' + CONFIG.DASHBOARD_URL + '" style="display:inline-block;border-radius:999px;background:#a7ff5a;color:#141a0c;padding:12px 20px;text-decoration:none;font-weight:700;">Buka Team Dashboard</a></p>'
    + '<p style="margin:26px 0 0;color:#aeb6cf;font-size:12px;">Jika membutuhkan bantuan, hubungi panitia melalui kanal resmi ISAC 2026.</p>'
    + '</td></tr>'
    + '<tr><td style="padding:18px 32px;border-top:1px solid #30364f;color:#8d95ae;font-size:11px;text-align:center;">© Information Systems Airlangga Competition 2026 · HIMSI UNAIR</td></tr>'
    + '</table></td></tr></table></body></html>';

  const subject = '[ISAC 2026] ' + title;
  const plainBody = 'Halo ' + teamName + ',\n\n' + String(message) + '\n\nKompetisi: ' + (competition.name || 'ISAC 2026') + '\nBatch: ' + (competition.batch || '—') + '\nStatus: ' + statusAfter + '\nAksi: ' + actionUpper + '\n\nBuka dashboard: ' + CONFIG.DASHBOARD_URL;

  const options = {
    htmlBody: htmlBody,
    name: CONFIG.EMAIL_SENDER_NAME,
  };
  if (CONFIG.EMAIL_SENDER_ALIAS) {
    options.from = CONFIG.EMAIL_SENDER_ALIAS;
  }

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

/**
 * ============================================================
 * GET /events/{eventId} — sama v1.2
 * ============================================================
 */
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

/**
 * ============================================================
 * POST /events/{eventId}/delivery-status — sama v1.2
 * ============================================================
 */
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

/**
 * ============================================================
 * EVENT VALIDATION — sama v1.2
 * ============================================================
 */
function validateEvent_(event) {
  if (!event) throw new Error('Event cannot be null');
  if (!event.eventId) throw new Error('eventId is required');
  if (!event.team?.id) throw new Error('team.id is required');
  if (!event.team?.email) throw new Error('team.email is required');
  if (!event.action) throw new Error('action is required');
  const action = String(event.action).trim().toUpperCase();
  if (!action) throw new Error('action cannot be empty');
}

/**
 * ============================================================
 * DATABASE / SHEET HELPERS — sama v1.2
 * ============================================================
 */
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
