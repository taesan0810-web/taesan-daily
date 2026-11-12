# Archive Interface

## Scope

- Home opens the daily archive directly. Legacy home links still route to their
  original destinations. Without an explicit date, the archive opens the latest
  public entry; a chosen date is never replaced by a later data refresh.
- Public navigation has one archive menu and contextual back links. The daily
  archive, music and TMI are the main paths; other views remain in native details.
- The management workspace has one content selector, one login, and one primary
  save action in the current editor. Backup, import, supplemental fields and
  alternate draft storage are secondary disclosures.
- Optional controls are moved, not cloned. Existing IDs, event handlers, record
  payloads, uploads and access policies stay intact. Native validation opens a
  closed disclosure before focusing an invalid field.
- Shared layout lives in archive.css; navigation and disclosures live in
  archive-nav.js. No frontend framework or production dependency was added.
- Journey retains its independent map interface. Old pages and media remain.

## Safety

This review branch does not change production main or the database. GitHack hosts
activate the existing read-only guard, blocking Supabase data/storage mutations
through fetch and XHR while permitting login and signed image reads.

## Verification

Run the static server on localhost:8000. Browser tests need Playwright, Chromium
and, for generated MP4 fixtures, FFmpeg.

```sh
node tests/home-routing.test.cjs
node tests/simple-interface.test.cjs
node tests/tmi.test.cjs
node tests/production-workbench.test.cjs
node tests/photo-upload.test.cjs
node tests/lyric-alignment.test.cjs
node tests/lyric-editor.test.cjs
node tests/lyric-workbench.test.cjs
node tests/archive.test.cjs
node tests/workbench.test.cjs
node tests/music-covers.test.cjs
```

The interface tests cover 320, 390, 768 and 1440 pixel widths; login cancellation,
failure and success; required/hidden invalid fields; failed submission preserving
content; explicit draft save; module switching; back links and logout. Archive
tests cover 44 page/viewport combinations. All test writes target isolated API
fixtures, not production. They do not constitute a real administrator login.
