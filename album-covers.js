'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let songs = [], controller = null, running = false;
  // Keep edition words and numbers: acoustic/live/remaster are not interchangeable.
  const norm = s => String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const edition = s => (String(s || '').toLowerCase().match(/acoustic|live|remaster(?:ed)?|remix|instrumental|karaoke|demo|mono|stereo|sped\s*up|slowed|radio\s*edit|re[ -]?recorded|taylor.s version|\b(?:19|20)\d{2}\b/g) || [])
    .map(x => x.replace('remastered', 'remaster')).sort().join('|');
  const albumNorm = s => norm(String(s || '').replace(/\s*-\s*(single|ep)\s*$/i, ''));
  const safeURL = (s, hosts) => {
    try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password &&
      hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? u.href : ''; }
    catch { return ''; }
  };
  const imageURL = s => safeURL(s, ['mzstatic.com', 'scdn.co', 'deezer.com', 'dzcdn.net', 'coverartarchive.org', 'archive.org']);
  function match(song, row) {
    const expectedArtist = (song.spotify_artist || song.artist).split(';').map(norm);
    const actualArtist = norm(row.artistName);
    const artistOK = expectedArtist.every(p => actualArtist === p ||
      actualArtist.split(/\s+(?:and|feat|featuring|with)\s+/).includes(p));
    const titleOK = norm(song.title) === norm(row.trackName);
    const versionOK = edition(song.title) === edition(row.trackName);
    const albumOK = !!song.spotify_album && albumNorm(song.spotify_album) === albumNorm(row.collectionName);
    return { row, artistOK, titleOK, versionOK, albumOK,
      exact: titleOK && artistOK && versionOK && albumOK,
      score: Number(titleOK) * 4 + Number(artistOK) * 3 + Number(versionOK) + Number(albumOK) * 4 };
  }
  function choose(song, rows) {
    // Partial titles and the wrong performer/version are never usable candidates.
    const ranked = rows.filter(r => imageURL(r.artworkUrl100)).map(r => match(song, r))
      .filter(r => r.titleOK && r.artistOK && r.versionOK).sort((a, b) => b.score - a.score);
    return ranked[0] || null;
  }
  async function request(url, signal) {
    const timed = new AbortController();
    const abort = () => timed.abort();
    if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 10000);
    try {
      const response = await fetch(url, { signal: timed.signal, mode: 'cors' });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data.results)) throw Error('曲库响应格式异常');
      return data.results;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  const cache = new Map();
  async function search(song, signal) {
    const primary = (song.spotify_artist || song.artist).split(';')[0];
    const terms = [...new Set([`${song.title} ${primary} ${song.spotify_album || ''}`.trim(), `${song.title} ${primary}`])];
    const countries = /[\u3040-\u30ff\u4e00-\u9fff]/u.test(song.title) ? ['JP', 'TW', 'US', 'KR'] : ['US', 'KR', 'JP', 'TW'];
    const rows = new Map(); let successful = 0, errors = [];
    for (const term of terms) for (const country of countries) {
      if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
      const url = 'https://itunes.apple.com/search?' + new URLSearchParams({ term, entity: 'song', limit: '50', country });
      try {
        let result = cache.get(url);
        if (!result) { result = await request(url, signal); cache.set(url, result); }
        successful++;
        result.forEach(r => rows.set(String(r.trackId || `${r.trackName}|${r.artistName}|${r.collectionName}`), r));
        const best = choose(song, [...rows.values()]);
        if (best?.exact) return { best, errors };
      } catch (e) {
        if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
        errors.push(country + ': ' + (e.name === 'AbortError' ? '请求超时' : e.message));
        // Fail fast on network denial/rate limiting; do not issue hundreds of doomed requests.
        throw Error('曲库查询失败（网络 / CORS / 限流）：' + errors.at(-1));
      }
      // iTunes public API has a low rate limit. Sequential requests, at most ~18/minute.
      await new Promise((resolve, reject) => {
        const stop = () => { clearTimeout(timer); reject(new DOMException('已停止', 'AbortError')); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, 3400);
        signal?.addEventListener('abort', stop, { once: true });
      });
    }
    return { best: choose(song, [...rows.values()]), errors, successful };
  }
  const selected = () => songs.filter(s => s.cover_url && s.selected && imageURL(s.cover_url));
  const quote = s => "'" + String(s).replace(/'/g, "''") + "'";
  function sql() {
    const rows = selected();
    if (!rows.length) return '-- 未选择可更新的封面。\n';
    return '-- 仅更新空封面；按原始 title + artist 精确定位；重复记录跳过。\n' +
      '-- 来自已有 CSV 的选择并非本次在线复核；新增候选需人工确认。\nBEGIN;\n' +
      'WITH covers(title, artist, cover_url) AS (VALUES\n' + rows.map(s =>
        '  (' + [s.title, s.artist, s.cover_url].map(quote).join(', ') + ')').join(',\n') +
      '\n)\nUPDATE public.music_tracks AS t\nSET cover_url = c.cover_url\nFROM covers AS c\n' +
      'WHERE t.title = c.title AND t.artist = c.artist\n' +
      "  AND (t.cover_url IS NULL OR btrim(t.cover_url) = '')\n" +
      '  AND (SELECT count(*) FROM public.music_tracks AS other\n' +
      '       WHERE other.title = c.title AND other.artist = c.artist) = 1\n' +
      'RETURNING t.id, t.title, t.artist, t.cover_url;\nCOMMIT;\n';
  }
  function summary() {
    return `已有候选 ${songs.filter(s => s.cover_url).length}/${songs.length} 首 · 缺封面 ${songs.filter(s => !s.cover_url).length} 首 · 已勾选 ${selected().length} 首`;
  }
  function text(tag, value, className) {
    const el = document.createElement(tag); el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  function draw() {
    const root = $('list'); root.replaceChildren();
    songs.forEach((song, i) => {
      const d = text('div', '', 'song'), img = document.createElement('img');
      img.alt = song.cover_url ? `${song.album || song.spotify_album || song.title} 封面候选` : '尚无封面';
      img.loading = 'lazy';
      const url = imageURL(song.cover_url); if (url) img.src = url;
      const info = text('div', '', 'info'); info.append(text('strong', `${i + 1}. ${song.title}`), text('small', song.artist));
      info.append(text('span', song.cover_url ? (song.source === 'uploaded_csv' ? '保留 CSV 候选' : '新候选 · 请核对后勾选') : '未匹配', 'tag ' + (song.selected ? 'ok' : 'warn')));
      if (song.spotify_album) info.append(text('small', `参考专辑：${song.spotify_album} · Spotify 歌手：${song.spotify_artist || song.artist}`));
      if (song.isrc) info.append(text('small', `ISRC：${song.isrc}（Apple 搜索未验证 ISRC）`));
      if (song.cover_url) info.append(text('small', `候选：${song.matched_title || ''} · ${song.matched_artist || ''} · ${song.album || ''}`));
      if (song.match_note) info.append(text('small', song.match_note));
      if (song.error || song.query_status === 'network_blocked') info.append(text('small', song.error || '上次在线查询受网络策略限制；尚未完成匹配。'));
      for (const [label, raw] of [['Spotify 原曲', song.spotify_url], ['曲库条目', song.source_url]]) {
        const href = safeURL(raw, ['open.spotify.com', 'music.apple.com', 'itunes.apple.com']);
        if (href) { const a = text('a', label); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; info.append(a); }
      }
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !!song.selected;
      check.disabled = !url; check.setAttribute('aria-label', `选择 ${song.title} 的封面`);
      check.onchange = () => { song.selected = check.checked; $('output').value = ''; $('status').textContent = summary(); };
      d.append(img, info, check); root.append(d);
    });
  }
  function download(value, filename, type) {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function run() {
    if (running) return;
    const pending = songs.filter(s => !s.cover_url); let done = 0, note = '';
    if (!pending.length) { $('status').textContent = summary() + ' · 无需重复搜索'; return; }
    running = true; controller = new AbortController(); $('go').disabled = true; $('stop').disabled = false;
    try {
      for (const song of pending) {
        $('status').textContent = `正在核对缺失封面 ${done + 1}/${pending.length}：${song.title}`;
        try {
          const { best } = await search(song, controller.signal);
          song.error = ''; song.query_status = best ? 'candidate_needs_review' : 'no_exact_title_artist_version';
          if (best) {
            const x = best.row;
            Object.assign(song, { cover_url: imageURL(x.artworkUrl100).replace(/\d+x\d+bb\./, '600x600bb.'),
              matched_title: x.trackName, matched_artist: x.artistName, album: x.collectionName,
              source_url: x.trackViewUrl || x.collectionViewUrl, source: 'apple_search', selected: false,
              match_note: best.albumOK ? '歌名、歌手、专辑及标题版本一致；请人工确认。' : '专辑与 Spotify 参考不同，发行版本未确认，请勿直接采用。' });
          }
          done++; draw();
        } catch (e) {
          if (controller.signal.aborted) note = '已停止，尚未完成的歌曲保留原状';
          else { song.error = e.message; song.query_status = 'query_failed'; note = e.message + '；已停止批量查询，剩余歌曲未查询'; }
          break;
        }
        if (done < pending.length) {
          await new Promise(resolve => {
            const stop = () => { clearTimeout(timer); resolve(); };
            const timer = setTimeout(() => { controller.signal.removeEventListener('abort', stop); resolve(); }, 3400);
            controller.signal.addEventListener('abort', stop, { once: true });
          });
          if (controller.signal.aborted) { note = '已停止，剩余歌曲未查询'; break; }
        }
      }
    } finally {
      running = false; $('go').disabled = false; $('stop').disabled = true;
      draw(); $('status').textContent = summary() + ` · 本次完成查询 ${done}/${pending.length}` + (note ? ' · ' + note : '');
      $('output').value = '';
    }
  }
  $('go').onclick = run;
  $('stop').onclick = () => controller?.abort();
  $('sql').onclick = () => { $('output').value = sql(); download(sql(), 'TAESAN_empty_covers.sql', 'text/plain;charset=utf-8'); };
  $('copy').onclick = async () => {
    $('output').value = sql();
    try { await navigator.clipboard.writeText($('output').value); }
    catch { $('output').select(); $('status').textContent = '请从 SQL 文本框手动复制。'; }
  };
  $('csv').onclick = () => {
    const fields = ['title', 'artist', 'spotify_album', 'spotify_artist', 'isrc', 'spotify_url', 'matched_title', 'matched_artist', 'album', 'cover_url', 'selected', 'source', 'source_url', 'query_status', 'match_note', 'error'];
    const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const csv = [fields.join(','), ...songs.map(s => fields.map(f => q(f === 'selected' ? (s.selected ? 'yes' : 'no') : s[f])).join(','))].join('\r\n');
    download('\ufeff' + csv, 'TAESAN_cover_review.csv', 'text/csv;charset=utf-8');
  };
  async function init() {
    try {
      const response = await fetch('./album-cover-data.json');
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data) || !data.length || data.some(s => !s.title || !s.artist) ||
        new Set(data.map(s => JSON.stringify([s.title, s.artist]))).size !== data.length) throw Error('核对数据格式或歌曲标识异常');
      songs = data; draw(); $('status').textContent = summary() + ' · 未开始新查询';
      ['go', 'sql', 'csv', 'copy'].forEach(id => $(id).disabled = false);
    } catch (e) { $('status').textContent = '读取已有核对数据失败：' + e.message + '。请通过 HTTP 服务器打开页面并检查数据文件。'; }
  }
  window.AlbumCovers = { norm, edition, choose, match, search, sql, run, selected, getSongs: () => songs, ready: init() };
})();
