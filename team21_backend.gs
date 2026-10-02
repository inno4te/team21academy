/*  ============================================================
    TEAM21 ACADEMY — Google Apps Script backend
    ------------------------------------------------------------
    Receives events from the e-learning platform (index.html /
    index_cameroon.html) and writes them into tabs of a Google
    Sheet. One tab per event type. Students are "upserted"
    (updated in place, keyed by username) so student_update
    edits the same row instead of adding duplicates.

    ⚠️ IF YOU'RE UPDATING AN EARLIER DEPLOYMENT, READ THIS:
    Earlier versions called SpreadsheetApp.getActiveSpreadsheet()
    directly wherever a tab was needed. That call can silently
    return null when the script runs as a deployed web app instead
    of from the Sheets UI/editor — and every write was wrapped in a
    try/catch that swallowed the resulting error, so registrations
    and inquiries could fail to save with NO visible sign of it.
    This version fixes that with a self-healing getSpreadsheet()
    helper further down, but it needs ONE more thing from you:
    RE-RUN the `setup` function from the Apps Script editor toolbar
    after pasting this code in. That single run is what lets
    getActiveSpreadsheet() succeed (it only works reliably from the
    editor) and permanently stores the real Spreadsheet ID for every
    request after that — including ones from the deployed web app.

    WRITES (from the platform, POST):
      The platform posts:  { event: "<name>", data: {...} }
      as a text/plain body in no-cors mode (fire-and-forget —
      the site cannot read the response to a POST).

      student_create   -> Students tab (upsert by username)
      student_update   -> Students tab (upsert by username)
      inquiry          -> Inquiries tab
      quiz_score       -> QuizScores tab
      progress         -> Progress tab (one-way append log)
      progress_state   -> ProgressState tab (upsert by user+course — always
                          the LATEST snapshot: done modules, scores, exam
                          result. This is what makes cross-device resume and
                          admin's Learner Progress tab possible.)
      mentor_request   -> MentorRequests tab
      ping             -> Log tab  (from the "Send test event" button)
      (anything else)  -> Log tab

    READS (from the platform, GET — this is what makes login work
    across different devices/browsers, not just the one that
    created the account):
      ?fn=auth&u=<username>&p=<password>
          -> checks the Students tab for a match and returns the
             student record if found (used as a fallback when a
             login doesn't match anything cached in the browser's
             own local storage — e.g. a different device).
      ?fn=roster&au=<adminUser>&ap=<adminPass>
          -> returns the full student roster (requires the admin
             credentials, matching the ADMIN_USER/ADMIN_PASS below
             — keep these the same as the ADMIN object in the HTML
             files). Used by the admin dashboard's "Sync roster
             from cloud" so every device's admin panel can see
             every student, no matter which device created them.
      ?fn=inquiries&au=<adminUser>&ap=<adminPass>
          -> returns every submitted inquiry (admin credentials
             required, same as above). Needed because a visitor's
             contact-form submission happens on THEIR device, never
             the admin's — without this, admin can never see it.
      ?fn=myprogress&u=<username>&p=<password>
          -> returns that student's own progress across every course
             (module completions, scores, Certification Exam result).
             Verified the same way as fn=auth. Pulled automatically at
             login so a student resumes exactly where they left off,
             on ANY device.
      ?fn=allprogress&au=<adminUser>&ap=<adminPass>
          -> returns EVERY student's progress across every course.
             Powers the admin dashboard's "Learner Progress" tab —
             real per-student tracking and certificate visibility.
      (no fn, or unrecognized)
          -> simple health check

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
         (already hardwired if you're using Team21's current build)
      7. In the platform admin, click "Send test event" — a row
         should appear in the Log tab.
      8. Make sure ADMIN_USER / ADMIN_PASS below match the ADMIN
         object in the HTML files exactly (default: forteh / f0rteh).

    Re-deploying after edits: Deploy -> Manage deployments ->
    edit the existing one -> Version: New version -> Deploy.
    (Editing the SAME deployment keeps the URL unchanged, so you
    don't have to re-paste it into the HTML.)
    ============================================================ */


/* ---- Must match the ADMIN object in index.html / index_cameroon.html ---- */
var ADMIN_USER = 'forteh';
var ADMIN_PASS = 'f0rteh';


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
  /* Current-STATE snapshot per student per course (upserted, not a log) — this is
     what lets a student resume on a different device and what admin's Learner
     Progress tab reads. Distinct from the Progress tab above, which is a one-way
     append log of individual module-completion events. */
  ProgressState: [
    'timestamp','user','name','course','doneModules','scores','examPct','examPassed','examDate','updated'
  ],
  Log: [
    'timestamp','event','payload'
  ]
};


/* ---- Main entry point: the platform POSTs here (writes) ---- */
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


/* ---- GET entry point (reads): health check, auth, roster, inquiries ---- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.fn === 'auth') return handleAuth(p);
    if (p.fn === 'roster') return handleRoster(p);
    if (p.fn === 'inquiries') return handleInquiries(p);
    if (p.fn === 'myprogress') return handleMyProgress(p);
    if (p.fn === 'allprogress') return handleAllProgress(p);
    return json({ ok: true, service: 'Team21 backend', time: new Date().toISOString() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}


/* ---- Student login fallback: GET ?fn=auth&u=...&p=... ----
   Returns {ok:true, student:{...}} on a match, {ok:false} otherwise.
   Never reveals whether the username exists — same response shape
   either way — so this can't be used to enumerate accounts. */
function handleAuth(p) {
  var u = String(p.u || '');
  var pass = String(p.p || '');
  if (!u || !pass) return json({ ok: false });
  var rows = readTabAsObjects('Students');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.username) === u && String(r.password) === pass && r.status !== 'suspended') {
      return json({
        ok: true,
        student: {
          id: r.id, name: r.name, email: r.email, username: r.username,
          courses: splitCourses(r.courses), status: r.status, created: r.created
        }
      });
    }
  }
  return json({ ok: false });
}


/* ---- Admin roster pull: GET ?fn=roster&au=<adminUser>&ap=<adminPass> ----
   Returns the full student list so the admin dashboard sees every
   student regardless of which device/browser created them. */
function handleRoster(p) {
  if (String(p.au || '') !== ADMIN_USER || String(p.ap || '') !== ADMIN_PASS) {
    return json({ ok: false, error: 'unauthorized' });
  }
  var rows = readTabAsObjects('Students');
  var roster = rows.map(function (r) {
    return {
      id: r.id, name: r.name, email: r.email, username: r.username,
      password: r.password, courses: splitCourses(r.courses),
      status: r.status, created: r.created
    };
  });
  return json({ ok: true, students: roster });
}


/* ---- Admin inquiries pull: GET ?fn=inquiries&au=<adminUser>&ap=<adminPass> ----
   Returns every inquiry submitted from ANY visitor's device — this is the
   only way the admin sees them, since a visitor's own browser is never
   the same device as the admin's. */
function handleInquiries(p) {
  if (String(p.au || '') !== ADMIN_USER || String(p.ap || '') !== ADMIN_PASS) {
    return json({ ok: false, error: 'unauthorized' });
  }
  var rows = readTabAsObjects('Inquiries');
  var list = rows.map(function (r) {
    return {
      id: r.id, name: r.name, email: r.email, type: r.type,
      course: r.course, mode: r.mode, msg: r.msg, date: r.date
    };
  });
  return json({ ok: true, inquiries: list });
}


/* ---- Turn one ProgressState row into the {course, doneModules, scores, exam}
   shape the front end expects, parsing the JSON-text cells back into real
   arrays/objects (with safe fallbacks if a cell is ever blank/malformed). ---- */
function progressRowToObj(r) {
  var doneModules = [], scores = {};
  try { doneModules = JSON.parse(r.doneModules || '[]'); } catch (e) { doneModules = []; }
  try { scores = JSON.parse(r.scores || '{}'); } catch (e) { scores = {}; }
  var exam = null;
  if (r.examPct !== '' && r.examPct !== undefined && r.examPct !== null) {
    exam = { pct: Number(r.examPct), passed: (r.examPassed === true || r.examPassed === 'true' || r.examPassed === 'TRUE'), date: r.examDate || '' };
  }
  return { user: r.user, name: r.name, course: r.course, doneModules: doneModules, scores: scores, exam: exam, updated: r.updated };
}


/* ---- Student progress pull (login-time, cross-device resume): GET
   ?fn=myprogress&u=<username>&p=<password>. Verifies against Students tab
   (same as fn=auth) before returning — a student can only pull their OWN
   progress, never anyone else's. Returns every course row for that student. */
function handleMyProgress(p) {
  var u = String(p.u || '');
  var pass = String(p.p || '');
  if (!u || !pass) return json({ ok: false });
  var students = readTabAsObjects('Students');
  var match = null;
  for (var i = 0; i < students.length; i++) {
    if (String(students[i].username) === u && String(students[i].password) === pass && students[i].status !== 'suspended') { match = students[i]; break; }
  }
  if (!match) return json({ ok: false });
  var rows = readTabAsObjects('ProgressState').filter(function (r) { return String(r.user) === u; });
  return json({ ok: true, rows: rows.map(progressRowToObj) });
}


/* ---- Admin progress pull (Learner Progress tab): GET
   ?fn=allprogress&au=<adminUser>&ap=<adminPass>. Returns EVERY student's
   progress across every course — this is what makes admin actually able to
   track each registered user and view/reprint their earned certificates. ---- */
function handleAllProgress(p) {
  if (String(p.au || '') !== ADMIN_USER || String(p.ap || '') !== ADMIN_PASS) {
    return json({ ok: false, error: 'unauthorized' });
  }
  var rows = readTabAsObjects('ProgressState');
  return json({ ok: true, rows: rows.map(progressRowToObj) });
}


/* ---- Read a whole tab back into an array of {header: value} objects ---- */
function readTabAsObjects(tabName) {
  var sheet = getTab(tabName);
  var headers = TABS[tabName];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}


/* ---- "id, name" course list stored as a joined string -> array of ids ---- */
function splitCourses(s) {
  if (!s) return [];
  return String(s).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
}


/* ---- Route each write event to its handler ---- */
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
    case 'progress_state':
      upsertProgressState(data);
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


/* ---- Upsert a progress snapshot, keyed by user+course (one row per student
   per course — always the LATEST state, never a growing log). data shape from
   the front end: {user, name, course, doneModules:[...], scores:{modIdx:pct},
   exam:{pct,passed,date}|null, updated}. Arrays/objects are stored as JSON
   text in their cell and parsed back out on read. */
function upsertProgressState(data) {
  var sheet = getTab('ProgressState');
  var headers = TABS.ProgressState;
  var userCol = headers.indexOf('user') + 1;
  var courseCol = headers.indexOf('course') + 1;
  var lastCol = headers.length;
  var lastRow = sheet.getLastRow();
  var exam = data.exam || null;

  var rowVals = headers.map(function (h) {
    if (h === 'timestamp') return new Date();
    if (h === 'doneModules') return JSON.stringify(data.doneModules || []);
    if (h === 'scores') return JSON.stringify(data.scores || {});
    if (h === 'examPct') return exam ? exam.pct : '';
    if (h === 'examPassed') return exam ? exam.passed : '';
    if (h === 'examDate') return exam ? exam.date : '';
    var v = data[h];
    return (v === undefined || v === null) ? '' : v;
  });

  var targetRow = 0;
  if (lastRow >= 2 && data.user && data.course) {
    var uv = sheet.getRange(2, userCol, lastRow - 1, 1).getValues();
    var cv = sheet.getRange(2, courseCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < uv.length; i++) {
      if (String(uv[i][0]) === String(data.user) && String(cv[i][0]) === String(data.course)) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow) {
    sheet.getRange(targetRow, 1, 1, lastCol).setValues([rowVals]);
  } else {
    sheet.appendRow(rowVals);
  }
}


/* ---- Generic Log tab writer (ping, unknown events, errors) ---- */
function logRow(event, data) {
  var sheet = getTab('Log');
  sheet.appendRow([new Date(), event, JSON.stringify(data)]);
}


/* ---- Get a tab, creating it (with headers) if missing ---- */
function getTab(tabName) {
  var ss = getSpreadsheet();
  if (!ss) throw new Error('No spreadsheet bound. Open this script from Extensions > Apps Script inside your Sheet, then run setup() once from the editor toolbar — that fixes this permanently.');
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


/* ---- Reliably find the right Spreadsheet, even when this script runs as a
   deployed web app (where SpreadsheetApp.getActiveSpreadsheet() is known to
   return null) OR as a standalone (unbound) script project, where
   getActiveSpreadsheet() NEVER succeeds — not even run manually from the
   editor. If you hit "Could not detect the active Spreadsheet" when running
   setup() directly from the editor toolbar, that's exactly what's going on:
   this project isn't bound to a Sheet, so there IS no active spreadsheet to
   find, in any context.
   FIX: paste your Sheet's ID into SPREADSHEET_ID_OVERRIDE right below (find
   it in the Sheet's URL — the long string between /d/ and /edit), Save, then
   run setup() again. Once that succeeds once, the ID is also stored as a
   script property, so everything (including live web-app requests) keeps
   working from then on even if you clear the override later. ---- */
var SPREADSHEET_ID_OVERRIDE = '1Jq-7DALWiGb8ygQNXblm1g6CjVsj7XFlMxTUP1TMrDk'; // hardwired to Innocent's Team21 data Sheet
function getSpreadsheet() {
  if (SPREADSHEET_ID_OVERRIDE) {
    try { return SpreadsheetApp.openById(SPREADSHEET_ID_OVERRIDE); } catch (e) { /* fall through */ }
  }
  var storedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (storedId) {
    try { return SpreadsheetApp.openById(storedId); } catch (e) { /* fall through */ }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    try { PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId()); } catch (e) {}
  }
  return ss;
}


/* ---- Standard JSON response ---- */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ---- Run this ONCE from the editor to create all tabs ----
   MUST be run by clicking ▷ Run in the Apps Script editor toolbar (not
   triggered externally) — that's the one context where
   getActiveSpreadsheet() is guaranteed to work, which lets this store the
   real Spreadsheet ID for every future request (web app calls included). */
function setup() {
  // Prefer SPREADSHEET_ID_OVERRIDE / a previously-stored ID if present —
  // this makes setup() work even for a standalone (unbound) script project,
  // where getActiveSpreadsheet() can never succeed no matter how it's run.
  var ss = getSpreadsheet();
  if (!ss) {
    throw new Error('Could not find a Spreadsheet. Do ONE of these, then run setup() again:\n' +
      '  (a) RECOMMENDED FIX: open your Google Sheet, copy the ID from its URL ' +
      '(the part between /d/ and /edit), and paste it into SPREADSHEET_ID_OVERRIDE ' +
      'near the top of this file, then Save.\n' +
      '  (b) OR: make sure this script is opened via Extensions > Apps Script from ' +
      'INSIDE your actual Google Sheet (not a standalone script.google.com project), ' +
      'so getActiveSpreadsheet() has something to detect.');
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Object.keys(TABS).forEach(function (name) { getTab(name); });
  // Remove the default "Sheet1" if it's empty and unused
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1 && s1.getLastRow() === 0) {
    ss.deleteSheet(s1);
  }
  try { ss.toast('Team21 tabs created & spreadsheet linked ✓', 'Setup complete', 5); } catch (e) {}
  Logger.log('Setup complete. Spreadsheet linked: ' + ss.getUrl());
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
