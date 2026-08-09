/*  ============================================================
    TEAM21 ACADEMY — Google Apps Script backend
    ------------------------------------------------------------
    Receives events from the e-learning platform (index.html /
    index_cameroon.html) and writes them into tabs of a Google
    Sheet. One tab per event type. Students are "upserted"
    (updated in place, keyed by username) so student_update
    edits the same row instead of adding duplicates.

    The platform posts:  { event: "<name>", data: {...} }
    as a text/plain body in no-cors mode.

    EVENTS HANDLED
      student_create   -> Students tab (upsert by username)
      student_update   -> Students tab (upsert by username)
      inquiry          -> Inquiries tab
      quiz_score       -> QuizScores tab
      progress         -> Progress tab
      mentor_request   -> MentorRequests tab
      ping             -> Log tab  (from the "Send test event" button)
      (anything else)  -> Log tab

    ------------------------------------------------------------
    SETUP (5 minutes)
      1. Create a new Google Sheet (this will hold your data).
      2. Extensions -> Apps Script.
      3. Delete any starter code, paste ALL of this file, Save.
      4. Run the function `setup` once (pick it in the toolbar
         dropdown, click Run). Approve the permissions prompt.
         This creates all the tabs with headers.
      5. Deploy -> New deployment -> type: Web app.
           Description: Team21 backend
           Execute as:  Me (your account)
           Who has access:  Anyone
         Click Deploy, then COPY the "/exec" Web app URL.
      6. Paste that URL into BOTH index.html and
         index_cameroon.html, replacing
         PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE
      7. In the platform admin, click "Send test event" — a row
         should appear in the Log tab.

    NOTE: because the site posts in no-cors mode, it cannot read
    this script's response. That's expected — this is one-way
    logging. The data still lands in the Sheet reliably.

    Re-deploying after edits: Deploy -> Manage deployments ->
    edit the existing one -> Version: New version -> Deploy.
    (Editing the SAME deployment keeps the URL unchanged, so you
    don't have to re-paste it into the HTML.)
    ============================================================ */


/* ---- Tab definitions: name -> ordered column headers ---- */
var TABS = {
  Students: [
    'timestamp','id','name','email','username','password',
    'courses','status','created','last_event'
  ],
  Inquiries: [
    'timestamp','id','name','email','type','course','mode','msg','date'
  ],
  QuizScores: [
    'timestamp','user','name','course','module','title','score','passed','date'
  ],
  Progress: [
    'timestamp','user','course','module','date'
  ],
  MentorRequests: [
    'timestamp','user','topic','when','notes','date'
  ],
  Log: [
    'timestamp','event','payload'
  ]
};


/* ---- Main entry point: the platform POSTs here ---- */
function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || '{}';
    var msg = JSON.parse(body);
    var event = (msg && msg.event) || 'unknown';
    var data = (msg && msg.data) || {};
    handleEvent(event, data);
    return json({ ok: true, event: event });
  } catch (err) {
    // Log parse/handler errors so nothing is silently lost
    try { logRow('error', { message: String(err), raw: (e && e.postData && e.postData.contents) }); } catch (e2) {}
    return json({ ok: false, error: String(err) });
  }
}


/* ---- A GET on the URL shows a simple health check in the browser ---- */
function doGet() {
  return json({ ok: true, service: 'Team21 backend', time: new Date().toISOString() });
}


/* ---- Route each event to its handler ---- */
function handleEvent(event, data) {
  switch (event) {
    case 'student_create':
    case 'student_update':
      upsertStudent(data, event);
      break;
    case 'inquiry':
      appendRow('Inquiries', data);
      break;
    case 'quiz_score':
      appendRow('QuizScores', data);
      break;
    case 'progress':
      appendRow('Progress', data);
      break;
    case 'mentor_request':
      appendRow('MentorRequests', data);
      break;
    case 'ping':
      logRow('ping', data);
      break;
    default:
      logRow(event, data);
  }
}


/* ---- Append a row to a tab, in the tab's header order ---- */
function appendRow(tabName, data) {
  var sheet = getTab(tabName);
  var headers = TABS[tabName];
  var row = headers.map(function (h) {
    if (h === 'timestamp') return new Date();
    var v = data[h];
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.join(', ');
    return v;
  });
  sheet.appendRow(row);
}


/* ---- Upsert a student by username (create or update in place) ---- */
function upsertStudent(data, event) {
  var sheet = getTab('Students');
  var headers = TABS.Students;
  var userCol = headers.indexOf('username') + 1;   // 1-based
  var lastCol = headers.length;
  var lastRow = sheet.getLastRow();

  // Build the row values in header order
  var rowVals = headers.map(function (h) {
    if (h === 'timestamp') return new Date();
    if (h === 'last_event') return event;
    var v = data[h];
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.join(', ');
    return v;
  });

  // Look for an existing row with this username
  var targetRow = 0;
  if (lastRow >= 2 && data.username) {
    var usernames = sheet.getRange(2, userCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < usernames.length; i++) {
      if (String(usernames[i][0]) === String(data.username)) {
        targetRow = i + 2; // account for header + 0-index
        break;
      }
    }
  }

  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, lastCol).setValues([rowVals]); // update in place
  } else {
    sheet.appendRow(rowVals); // new student
  }
}


/* ---- Generic Log tab writer (ping, unknown events, errors) ---- */
function logRow(event, data) {
  var sheet = getTab('Log');
  sheet.appendRow([new Date(), event, JSON.stringify(data)]);
}


/* ---- Get a tab, creating it (with headers) if missing ---- */
function getTab(tabName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    var headers = TABS[tabName] || ['timestamp', 'data'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}


/* ---- Standard JSON response ---- */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ---- Run this ONCE from the editor to create all tabs ---- */
function setup() {
  Object.keys(TABS).forEach(function (name) { getTab(name); });
  // Remove the default "Sheet1" if it's empty and unused
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1 && s1.getLastRow() === 0) {
    ss.deleteSheet(s1);
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('Team21 tabs created ✓', 'Setup complete', 5);
}


/* ---- Optional: send yourself an email digest of new inquiries.
        Set a time-based trigger (Triggers -> Add Trigger ->
        dailyInquiryDigest -> Time-driven -> Day timer) if you
        want a daily summary. Edit the address below first. ---- */
function dailyInquiryDigest() {
  var TO = 'team21online@gmail.com'; // <-- your address
  var sheet = getTab('Inquiries');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var headers = TABS.Inquiries;
  var since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var recent = values.filter(function (r) { return r[0] instanceof Date && r[0] >= since; });
  if (!recent.length) return;
  var lines = recent.map(function (r) {
    return '• ' + r[2] + ' (' + r[3] + ') — ' + r[5] + ' [' + r[6] + ']\n   ' + r[7];
  });
  MailApp.sendEmail(TO,
    'Team21: ' + recent.length + ' new inquiry(ies) today',
    'New inquiries in the last 24h:\n\n' + lines.join('\n\n'));
}
