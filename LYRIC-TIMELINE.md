# MP4 Lyric Timeline

The music workspace now includes TXT import, alternating bilingual text splitting,
experimental local automatic alignment, per-line preview/timestamp editing, explicit
LRC application with undo, and LRC export. Existing upload/save/publish behavior is
unchanged. No database migration, new API key, paid recognition service, or schema
change is required.

## Processing

- The chosen local MP4 remains available for alignment after its upload input clears.
  Existing uploaded works use the current admin's existing signed media URL.
- Audio is decoded and resampled to mono 16 kHz in the browser. Maximum media size
  is 50 MB, with a maximum automatic processing duration of 10 minutes.
- A module worker runs Transformers.js 3.8.1 and the multilingual ONNX
  `onnx-community/whisper-tiny_timestamped` q8 model, pinned to revision
  `517244293732ee2d58139af5814231b7e6830a0d`. WASM uses a single thread, so it does
  not require cross-origin isolation on GitHub Pages.
- First use requires explicit agreement to the model/runtime download (allow about
  100 MB). The CDN and Hugging Face receive model-download requests, not the user's
  media or lyrics. Media/lyrics are processed locally. Browser caching is best-effort.
- Vendored `diff` 7.0.0 (BSD-3-Clause, license in source) matches the original lyrics
  against observed word timestamps. Unmatched lines remain unset, not evenly timed.
- All automatic results require listening review. Singing, backing vocals, rap,
  mixed languages and repeated choruses can produce incorrect or missing matches.
  Tiny is a lightweight speech model, not a dedicated singing forced aligner.
- Select the original sung language. Translations remain separate from recognition
  and are saved in the existing `lyrics_zh` field.
- Nothing writes to LRC until Apply is clicked, and nothing writes to the database
  until Save Work is clicked. Publishing retains its existing separate checkbox.
- Resetting the work or logging out terminates processing and releases local URLs.
  Model download/recognition failures retain existing lyrics and allow manual timing.

## Verification

Serve the repository on localhost:8000 and run:

```sh
node tests/lyric-alignment.test.cjs
node tests/lyric-editor.test.cjs
node tests/lyric-workbench.test.cjs
node tests/production-workbench.test.cjs
```

Browser tests need Playwright, `/usr/bin/chromium`, and FFmpeg. Media fixtures are
generated temporarily and removed on exit. API writes and recognition outputs in
workbench tests are intercepted. Separate real-engine verification decoded an AAC
MP4 of the public Whisper JFK speech sample, downloaded the actual model, ran WASM
in Chromium, and aligned three supplied English lines. This is not a guarantee of
Korean-song accuracy or a real iPhone memory/performance test.
