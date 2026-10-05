TEAM21 ACADEMY — FULL DEPLOY PACKAGE
=====================================
Everything needed to launch both sites, sharing one database.

🆕 NEW THIS UPDATE — exam bug fix, French/Spanish, and mobile
-------------------------------------------------------------------
1. FIXED: the Certification Exam wasn't opening for students who
   completed all 8 modules of Vibe Coding (or any course). The exam
   was gated behind "every module done AND every module quiz passed
   at 75%+" — but a student who used "Mark complete" on even one
   module without acing its quiz got permanently locked out, with
   no error message, no way forward. The gate now matches the spec:
   completing every module (by any means) unlocks the exam. Module
   certificates still require a 75%+ quiz pass — only the exam gate
   changed. No backend/data changes needed for this fix; it's purely
   in the two HTML files, and no student's existing progress or
   certificates are affected.

2. LANGUAGE SWITCHER — a dropdown in the top nav now lets visitors
   and students switch the site's interface between English, French,
   and Spanish (Cameroon edition: English/French). This covers the
   navigation, login screen, LMS tabs, the Certificates page, the
   Certification Exam, and certificate PDFs. Course lesson content
   itself (the 24 courses' actual teaching material and quiz
   questions) stays in English — same approach used by Coursera/edX:
   translating 60+ deep modules of authored content is a much larger
   project than translating the interface around it, so this update
   focuses on making the platform itself fully navigable in all three
   languages while leaving course content authoring for later. The
   chosen language is remembered per-browser (localStorage) and
   re-applied on return visits.

3. MOBILE-FRIENDLY — both sites now adapt properly to phone screens:
   bigger tap targets on every button, tighter spacing so text isn't
   cramped, the hero/section text scales down sensibly, course cards
   go single-column, KPI tiles go 2-per-row, the footer collapses to
   one column, and data tables (Students, Learner Progress, etc.)
   scroll horizontally instead of breaking the layout. The hamburger
   menu for the top nav was already there and still works the same.

TO ACTIVATE THIS UPDATE:
  This update touches ONLY the two HTML files — no backend changes,
  no new Apps Script deploy, no Sheet changes.
  1. Re-upload the new index.html and index_cameroon.html from this
     folder to your two GitHub repos (courses/ folder unchanged,
     team21_backend.gs unchanged from the last update).
  2. Test: as a student, finish all modules of a short course using
     a MIX of quiz-passes and "Mark complete" clicks, and confirm the
     Certification Exam now opens. Then check the language dropdown
     in the top nav switches the interface text on both the
     marketing site and (after logging in) the LMS.
  3. Open either site on an actual phone (or your browser's device
     toolbar / responsive mode) and confirm text and buttons are
     comfortably sized, not cramped.


Certification Exam that gates the full programme certificate
-------------------------------------------------------------------
1. STUDENTS CAN NOW RESUME ON ANY DEVICE. Every module completion,
   quiz score, and exam result now syncs to the shared Sheet the
   moment it happens, and is pulled back down automatically at
   login — on whatever device a student uses. Previously, progress
   only lived in the one browser that earned it.

2. A NEW 20-QUESTION, 40-MINUTE CERTIFICATION EXAM. Once a student
   completes and passes every module in a course, they unlock a
   timed final exam (20 questions sampled evenly across everything
   they covered, 40 minutes on the clock, 75% to pass). Passing it —
   not just averaging module scores — is now what earns the full
   programme certificate. Failing lets them retake it.

3. ADMIN CAN NOW SEE EVERY STUDENT'S PROGRESS AND CERTIFICATES. A
   new "Learner Progress" tab lists every registered student ×
   course: modules completed, average score, Certification Exam
   status, and a one-click "View certificate" button that reprints
   any student's earned certificate — pulled straight from the
   cloud, not whatever happens to be on the admin's own browser.
   There's also a quick "📊 Progress" link on each row of the
   existing Students tab, and a "Full certificates issued" count on
   the Overview screen.

TO ACTIVATE THIS UPDATE:
  1. Open your existing Apps Script project → select all → delete →
     paste in the ENTIRE contents of team21_backend.gs from this
     folder → Save. (Your Sheet ID is still hardwired in, nothing
     to fill in manually.)
  2. Deploy → Manage deployments → edit your EXISTING deployment →
     Version: "New version" → Deploy. (Same /exec URL — no need to
     touch the HTML for this part. This step adds a new "ProgressState"
     tab to your Sheet automatically the first time it's used —
     nothing to set up by hand there either.)
  3. Re-upload the new index.html and index_cameroon.html from this
     folder to your two GitHub repos (courses/ folder unchanged).
  4. Test: log in as a student, pass every module in a short course,
     confirm the Certification Exam appears, take it, and confirm
     the full certificate appears afterward. Then log into admin →
     Learner Progress tab → confirm that student's row shows up
     with the right modules/exam status, and that "View certificate"
     works.

Nothing about this update touches existing student accounts, module
certificates, or the login/inquiry fixes from the previous update —
it only adds the exam layer and the progress-tracking/visibility on
top of what was already working.

⚠️ CRITICAL UPDATE — READ THIS FIRST (fixes logins AND missing inquiries)
--------------------------------------------------------------------
We found TWO real bugs, and this version fixes both:

BUG 1 — accounts only worked on the device that created them.
The site WROTE to the Google Sheet but never READ anything back, so
each browser had its own private, disconnected student list. Fixed
with real two-way sync: a login not found locally now checks the
shared Sheet before failing, and the admin dashboard can pull the
full roster with one click (or automatically).

BUG 2 (deeper, found while testing Bug 1's fix, and CONFIRMED via your
own execution log) — the backend script was calling
SpreadsheetApp.getActiveSpreadsheet(), which returns null when a
script isn't bound to a specific Sheet OR runs as a deployed web app
instead of from the Sheets editor. Your project appears to be a
STANDALONE script (not opened via Extensions > Apps Script from
inside an actual Sheet) — which means getActiveSpreadsheet() can
NEVER succeed for it, in any context, ever. Every write was also
wrapped in a try/catch that swallowed the resulting error — so
student registrations AND website inquiries could fail to save with
ZERO visible sign of it, even though the site looked like it was
working. This explains why inquiries never appeared in the admin
dashboard, and why students still couldn't log in after the first
fix. The permanent fix: point the script at your Sheet's ID directly
(SPREADSHEET_ID_OVERRIDE) instead of relying on auto-detection.

TO ACTIVATE BOTH FIXES, DO THIS IN ORDER:
  1. Open your existing Apps Script project (the one behind your
     live /exec URL) at script.google.com.
  2. Select ALL the existing code and delete it.
  3. Paste in the ENTIRE contents of team21_backend.gs from this
     folder. Save (Ctrl/Cmd+S).
     ✅ Your Sheet ID is ALREADY hardwired into this file — the line
     var SPREADSHEET_ID_OVERRIDE near the top is pre-filled with
     your actual Team21 data Sheet
     (docs.google.com/spreadsheets/d/1Jq-7DALWiGb8ygQNXblm1g6CjVsj7XFlMxTUP1TMrDk).
     No manual editing needed for this part.
  4. In the toolbar dropdown, select the function "setup", click
     ▷ Run. It should now complete without error, and a toast/log
     message confirms which Sheet it linked. Open that Sheet and
     confirm 6 new tabs appeared: Students, Inquiries, QuizScores,
     Progress, MentorRequests, Log.
  5. Deploy → Manage deployments → click the pencil/edit icon on
     your EXISTING deployment → Version: "New version" → Deploy.
     (Do NOT create a brand-new deployment — that would give you a
     different /exec URL, and you'd have to update both HTML files
     again. Editing the existing deployment keeps the same URL. This
     step is what makes the hardwired Sheet ID actually take effect
     on the LIVE endpoint your site calls — saving in the editor
     alone does not update what's already deployed.)
  6. Re-upload the new index.html and index_cameroon.html from this
     folder to your two GitHub repos (courses/ folder unchanged).
  7. IMPORTANT — recovering your existing students: because Bug 2
     means earlier writes never actually reached the Sheet, your
     current students (from your Team21US_Students.csv — inno,
     meln, esenei, sirris, marieg) are almost certainly NOT in the
     Sheet yet. Log into the admin dashboard on THE SAME
     BROWSER/DEVICE where you originally created them (their data is
     still safely sitting in that browser's local storage — nothing
     was deleted), go to the Students tab, and click "⬆ Push local
     accounts to cloud". Wait a few seconds, then click "🔄 Sync
     from cloud" to confirm they landed in the Sheet. After that,
     students should be able to log in from their own devices.
 8. Any inquiries submitted before this fix were likely never
     saved server-side either, and — unlike students — the admin
     never had a local copy of those to re-push (a visitor's
     inquiry only ever lived in THEIR browser). If any of your
     students mentioned submitting an inquiry that never came
     through, the most reliable path is simply asking them to
     resubmit it now that the backend is fixed.

Nothing about this process deletes existing data — every sync/push
above only ADDS or UPDATES records, in both directions. Your local
browser storage is untouched by any of this.

✅ ALREADY DONE FOR YOU: both index.html and index_cameroon.html in
this folder have your Apps Script URL HARDWIRED into them —
      const GS_ENDPOINT_DEFAULT = "https://script.google.com/macros/s/AKfycbw2iGs9Et5zvmVKmmxp8YMihllM4fKfPtEF522TtPBYCfyslOYLmehQadFW-hWBPOpixw/exec";
No manual pasting needed. As long as the Apps Script behind that URL
is deployed and live (Part 1 below), both sites connect to it
automatically the moment they're uploaded.

WHAT'S IN THIS FOLDER
----------------------
index.html            → US edition ("T21 Institute") — backend URL pre-wired
index_cameroon.html   → Cameroon edition — backend URL pre-wired
courses/              → all 26 course content files (REQUIRED — keep as a folder)
team21_backend.gs     → Google Apps Script — the shared database backend

Admin login (both sites): forteh / f0rteh


===========================================================
PART 1 — MAKE SURE THE SHARED BACKEND IS LIVE (do this first, once)
===========================================================
Both sites already point at the same /exec URL — you just need that
URL to correspond to a real, deployed Apps Script.

If you've ALREADY completed this deployment and that exact /exec
URL is live, skip straight to Part 2.

If not (or you want to redo it):

1. Go to sheets.google.com → create a new blank Sheet.
   Name it something like "Team21 Academy — Data".

2. Extensions → Apps Script. A code editor opens in a new tab.

3. Delete any starter code in there, then open team21_backend.gs
   from this folder, copy all of it, and paste it into the editor.
   Save (Ctrl/Cmd+S).

4. In the toolbar dropdown (next to the ▷ Run button), select the
   function "setup", then click ▷ Run.
   → The first time, Google asks you to authorize the script —
     click through "Review permissions" → your account → "Advanced"
     → "Go to [project] (unsafe)" → Allow. This is expected; it's
     your own script accessing your own Sheet.
   → Check the Sheet: you should now see 6 tabs — Students,
     Inquiries, QuizScores, Progress, MentorRequests, Log.

5. Deploy → New deployment:
     Click the gear icon ⚙ next to "Select type" → Web app
     Description:      Team21 backend
     Execute as:        Me (your Google account)
     Who has access:    Anyone
   Click Deploy → Authorize again if asked → COPY the "Web app URL".

   ⚠ IMPORTANT: a brand-new deployment gets a DIFFERENT /exec URL
   than the one already hardwired into index.html and
   index_cameroon.html. If you ever redeploy the backend:
     (a) preferred — reuse the EXISTING deployment instead of
         creating a new one (Deploy → Manage deployments → edit
         the existing one → Version: New version → Deploy — this
         keeps the SAME URL, so the HTML files need no changes), or
     (b) if you do end up with a new URL, find/replace the
         GS_ENDPOINT_DEFAULT line in both index files with it.
   Normally neither is needed — the URL already in these files is
   live and working as-is.


===========================================================
PART 2 — DEPLOY THE US SITE (index.html)
===========================================================
Easiest option: GitHub Pages (free, reliable, gives you a URL).

1. Create a new GitHub repository (e.g. "team21-us").
2. Upload index.html and the whole courses/ folder to the repo
   root, keeping the folder structure:
       team21-us/
         ├── index.html
         └── courses/  (all 26 .json files inside)
3. Repo → Settings → Pages → Source: "Deploy from a branch" →
   Branch: main, folder: / (root) → Save.
4. GitHub gives you a live URL, typically:
       https://<your-username>.github.io/team21-us/
   (takes 1–2 minutes to go live after the first deploy)


===========================================================
PART 3 — DEPLOY THE CAMEROON SITE (index_cameroon.html)
===========================================================
Same method, a SEPARATE repo (so it gets its own clean URL).

1. Create a second GitHub repository (e.g. "team21-cameroon").
2. Upload index_cameroon.html and a copy of the courses/ folder:
       team21-cameroon/
         ├── index_cameroon.html   (rename to index.html so it's
         │                          the default page — see note below)
         └── courses/  (all 26 .json files inside)
3. Settings → Pages → Source: main / root → Save.
4. Live URL:
       https://<your-username>.github.io/team21-cameroon/

NOTE on the filename: GitHub Pages serves "index.html" as the
default homepage of a folder. Since index_cameroon.html isn't
named index.html, visitors would need the exact filename in the
URL. Easiest fix: when uploading to the Cameroon repo, rename
index_cameroon.html to index.html in that repo only (your US repo
keeps its own separate index.html — they never touch each other
since they're in different repos).


===========================================================
WHY TWO REPOS, ONE BACKEND
===========================================================
  • Two repos = two independent URLs/sites, each servable as its
    own clean root address, each with its own copy of courses/.
  • One backend = both already point at the same hardwired
    GS_ENDPOINT_DEFAULT URL, so all registrations, quiz scores,
    and inquiries from EITHER site consolidate into the one Google
    Sheet — one admin view of your whole academy, both markets.


===========================================================
PART 4 — TEST EVERYTHING
===========================================================
1. Open each live URL. Confirm the marketing pages, course
   catalog, and learner portal load.
2. Log in as admin (forteh / f0rteh) on either site → go to the
   admin panel → click "Send test event" → check your Google
   Sheet's Log tab for a new row. If it appears, the connection
   works — and since the URL is hardwired, this should work
   immediately with no setup on the HTML side.
3. Create a test student on ONE device/browser. Then, on a
   DIFFERENT device (or a private/incognito window — anything that
   doesn't share that browser's storage), open the same site and
   log in as that student. This is the real test of the fix — it
   should work now. If it still fails, open the Students tab in
   your Sheet and confirm the row is there with the exact
   username/password you tried.
4. On the admin dashboard's Students tab (or the Sync tab), click
   "🔄 Sync from cloud" — any students registered on OTHER devices
   should appear in this device's admin view too.
5. Submit a test inquiry via the public contact form (use a private/
   incognito window so it's a genuinely different "device" from the
   admin). Then, as admin, open the Inquiries tab — it should
   auto-sync and show the new inquiry within a couple of seconds. A
   manual "🔄 Sync from cloud" button is there too if you want to
   force a refresh.
5. IMPORTANT: this only works when served over http(s) — via
   GitHub Pages or another web host. Double-clicking the HTML file
   locally (file://) will NOT load courses or reach the backend;
   that's expected. To test locally instead, run
   "python3 -m http.server" inside the folder and open
   http://localhost:8000


===========================================================
KEEPING IT UPDATED LATER
===========================================================
  • New/updated courses → replace the relevant file(s) inside
    courses/ in BOTH repos (they each keep their own copy).
  • Backend changes → edit team21_backend.gs in the Apps Script
    editor, then Deploy → Manage deployments → edit the existing
    deployment → Version: New version → Deploy. This keeps the
    SAME /exec URL, so you do NOT need to touch the HTML files
    again.


— Built for Innocent Forteh · inno4te / Team21 Academy
  team21online@gmail.com

------------------------------------------------------------
UPDATE — Practice Studio (October 2026)
------------------------------------------------------------
Replace ALL files this time: index.html, index_cameroon.html and the courses/ folder.
- Every module now ends with a Practice Studio: 4 quick-fact flip cards, 2 hands-on labs
  (sort, put-in-order, match, or spot-the-problems) and 1 plAIbox playground
  (prompt builder, live calculator, or branching decision simulation).
- Works with tap on phones and drag on computers; progress per module is saved in the browser.
- Activities live in each course JSON as "facts", "labs" and "plaibox" per module.
- Fix: certificate QR codes were silently blank (broken QR library) — replaced; now render.
