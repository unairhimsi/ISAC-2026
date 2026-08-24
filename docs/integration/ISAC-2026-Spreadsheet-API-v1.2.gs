/**
 * ============================================================
 * ISAC 2026 — GOOGLE SPREADSHEET INTEGRATION API v1.2
 * ============================================================
 *
 * Database ISAC = Source of Truth
 * Spreadsheet   = Operational Monitoring / Integration Log
 *
 * Perubahan v1.2 (Operation via Apps Script):
 * - Operation ANNOUNCE_RESULT yang dikirim via ?path=events/batch-upsert
 *   langsung mengirim email via GmailApp di Apps Script (bukan via Laravel Brevo).
 * - Laravel Brevo TETAP dipakai untuk auth (OTP, verification, reset password).
 * - Flag routing: event.emailStatus === 'PENDING' + action === 'ANNOUNCE_RESULT'
 *   => Apps Script kirim email, set email_status=SENT/FAILED langsung di sheet.
 * - Untuk VERIFY_TEAM/PAYMENT/ADVANCE dengan emailStatus NOT_REQUIRED, email tidak dikirim.
 *
 * Konfigurasi Laravel:
 *   GOOGLE_SHEET_EMAIL_VIA_APPS_SCRIPT=true (default) => Laravel TIDAK dispatch SendCompetitionAnnouncementJob
 *   Jika false, fallback ke Brevo seperti v1.1.
 *
 * Supported endpoints: sama seperti v1.1
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
  VERSION: '1.2.0',

  // Email via Apps Script (khusus operation)
  EMAIL_SENDER_NAME: 'ISAC 2026 — HIMSI UNAIR',
  // Opsional: pakai alias Gmail yang sudah terverifikasi di Apps Script account
  // Kosongkan untuk pakai akun pelaksana Apps Script sebagai pengirim
  EMAIL_SENDER_ALIAS: '',
  APP_URL: 'https://isac.himsiunair.com',
  LOGO_URL: 'https://isac.himsiunair.com/logo.png',
  DASHBOARD_URL: 'https://isac.himsiunair.com/dashboard',
};

/**
 * ============================================================
 * SPREADSHEET HEADERS — tetap kompatibel v1.1
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
 * INITIAL SETUP — sama seperti v1.1
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
  console.log('ISAC Spreadsheet API v1.2 initialized');
  console.log('Spreadsheet ID: ' + spreadsheetId);
  console.log('Spreadsheet URL: https://docs.google.com/spreadsheets/d/' + spreadsheetId);
  console.log('API Key configured: YES');
  console.log('Email via Apps Script: ENABLED (operation ANNOUNCE_RESULT)');
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
 * HTTP GET ROUTER — sama v1.1
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
 * HTTP POST ROUTER — sama v1.1
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
 * POST /events/batch-upsert — v1.2 dengan pengiriman email langsung
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

        // --- EMAIL ROUTING v1.2 ---
        // Laravel sekarang mengirim emailStatus di payload (PENDING untuk ANNOUNCE_RESULT yang butuh email, NOT_REQUIRED jika tidak)
        // Apps Script yang kirim email untuk operation, bukan Brevo. Auth tetap Brevo di Laravel.
        let emailStatusRaw = event.emailStatus || event.email_status || null;
        // fallback inferensi jika field tidak ada (backward compat)
        if (!emailStatusRaw) {
          const act = String(event.action || '').trim().toUpperCase();
          emailStatusRaw = act === 'ANNOUNCE_RESULT' ? 'PENDING' : 'NOT_REQUIRED';
        }
        let emailStatus = String(emailStatusRaw).trim().toUpperCase();
        let providerMessageId = event.providerMessageId || '';
        let sentAt = event.sentAt || '';
        let retryCount = Number(event.retryCount || 0);
        let lastError = event.lastError || '';

        // Hanya untuk ANNOUNCE_RESULT + PENDING, kirim via GmailApp langsung
        if (emailStatus === 'PENDING') {
          const actionUpper = String(event.action || '').trim().toUpperCase();
          if (actionUpper === 'ANNOUNCE_RESULT') {
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
              // retryCount biarkan 0, akan di-increment via delivery-status RETRYING nanti jika ada retry
            }
          } else {
            // Untuk VERIFY_* dll, PENDING seharusnya tidak terjadi karena Laravel set NOT_REQUIRED
            // Tapi jika terlanjur PENDING, set jadi NOT_REQUIRED biar tidak pending selamanya
            // Kecuali memang mau kirim, ubah logic di sini
            // emailStatus tetap PENDING akan di-handle sebagai NOT_REQUIRED agar tidak stuck
            // Komentar: jika ke depan mau VERIFY juga kirim email via Apps Script, ganti ke pengiriman di sini
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
 * SEND OPERATION EMAIL VIA APPS SCRIPT (Gmail)
 * ============================================================
 * Dipanggil hanya untuk action ANNOUNCE_RESULT + emailStatus PENDING
 * Body HTML mirip resources/views/emails/competition-operation.blade.php
 */
function sendOperationEmail_(event) {
  const team = event.team || {};
  const competition = event.competition || {};
  const announcement = event.announcement || {};
  const title = announcement.title || 'Pembaruan Kompetisi ISAC 2026';
  const message = announcement.message || 'Terdapat pembaruan pada perjalanan kompetisi Team Anda.';
  const statusAfter = event.statusAfter || event.currentStage || '—';
  const teamName = team.name || 'Team ISAC';
  const recipient = String(team.email || '').trim();

  // Escape HTML untuk message (simple)
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
    + '</td></tr></table>'
    + '<p style="margin:26px 0 0;"><a href="' + CONFIG.DASHBOARD_URL + '" style="display:inline-block;border-radius:999px;background:#a7ff5a;color:#141a0c;padding:12px 20px;text-decoration:none;font-weight:700;">Buka Team Dashboard</a></p>'
    + '<p style="margin:26px 0 0;color:#aeb6cf;font-size:12px;">Jika membutuhkan bantuan, hubungi panitia melalui kanal resmi ISAC 2026.</p>'
    + '</td></tr>'
    + '<tr><td style="padding:18px 32px;border-top:1px solid #30364f;color:#8d95ae;font-size:11px;text-align:center;">© Information Systems Airlangga Competition 2026 · HIMSI UNAIR</td></tr>'
    + '</table></td></tr></table></body></html>';

  const subject = '[ISAC 2026] ' + title;
  const plainBody = 'Halo ' + teamName + ',\n\n' + String(message) + '\n\nKompetisi: ' + (competition.name || 'ISAC 2026') + '\nBatch: ' + (competition.batch || '—') + '\nStatus: ' + statusAfter + '\n\nBuka dashboard: ' + CONFIG.DASHBOARD_URL;

  // Kirim via GmailApp (butuh otorisasi). Alternatif: MailApp.sendEmail
  const options = {
    htmlBody: htmlBody,
    name: CONFIG.EMAIL_SENDER_NAME,
    // replyTo: 'panitia@himsiunair.com' // opsional
  };
  // Jika ada alias terverifikasi, GmailApp bisa pakai from
  if (CONFIG.EMAIL_SENDER_ALIAS) {
    options.from = CONFIG.EMAIL_SENDER_ALIAS;
  }

  // GmailApp lebih direkomendasikan untuk HTML
  if (typeof GmailApp !== 'undefined' && GmailApp.sendEmail) {
    GmailApp.sendEmail(recipient, subject, plainBody, options);
  } else {
    MailApp.sendEmail({ to: recipient, subject: subject, body: plainBody, htmlBody: htmlBody, name: CONFIG.EMAIL_SENDER_NAME });
  }

  // Apps Script tidak mengembalikan messageId native, buat pseudo-id untuk sheet
  return { messageId: 'gmail-' + Utilities.getUuid().slice(0,12) };
}

function escapeHtml_(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * ============================================================
 * GET /events/{eventId} — sama v1.1
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
 * POST /events/{eventId}/delivery-status — tetap ada untuk retry manual
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
 * EVENT VALIDATION — sama v1.1
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
 * DATABASE / SHEET HELPERS — sama v1.1
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
