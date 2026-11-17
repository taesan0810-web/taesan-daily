const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),sharp=require('sharp'),{normalize,recordId,sqlFor}=require('../scripts/import-bilibili-stage.cjs');
(async()=>{
 const manifest=require('../data/bilibili-stage-9582384.json'),rows=manifest.records;
 assert.equal(rows.length,190);assert.equal(new Set(rows.map(r=>r.bvid)).size,190);assert.equal(new Set(rows.map(r=>r.id)).size,190);
 assert(rows.every(r=>r.kind==='stage'&&r.category==='个人直拍'&&r.published));
 for(let i=0;i<rows.length;i++){
  const row=rows[i];assert.equal(row.id,recordId(row.bvid));assert.match(row.id,/^[a-f0-9-]{14}5[a-f0-9-]{21}$/);
  assert(row.cover_path.startsWith('assets/stage/bilibili/')&&!row.cover_path.includes('..'));
  assert.equal(row.cover_url,'https://taesan0810-web.github.io/taesan-daily/'+row.cover_path);
  const bytes=fs.readFileSync(row.cover_path);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.cover_sha256);
  const m=await sharp(bytes).metadata();assert(m.width>0&&m.width<=960&&m.height>0);assert.equal(m.format,'webp');
  assert.equal(row.source_url,'https://www.bilibili.com/video/'+row.bvid+'/');
  if(i)assert(rows[i-1].published_at>=row.published_at);
 }
 const sample=rows[0],payload={code:0,data:{owner:{mid:383798385},ugc_season:{id:9582384,title:'直拍',sections:[{episodes:[{bvid:sample.bvid,arc:{state:0,author:{mid:383798385},title:"原文's 标题",pubdate:Date.parse('2026-10-20T17:00:00Z')/1000,pic:sample.original_cover_url}}]}]}}};
 assert.equal(normalize(payload)[0].public_date,'2026-10-21');assert.equal(normalize(payload)[0].title,"原文's 标题");
 const duplicate=structuredClone(payload);duplicate.data.ugc_season.sections[0].episodes.push(duplicate.data.ugc_season.sections[0].episodes[0]);assert.throws(()=>normalize(duplicate));
 const wrong=structuredClone(payload);wrong.data.owner.mid=1;assert.throws(()=>normalize(wrong));
 const cover=structuredClone(payload);cover.data.ugc_season.sections[0].episodes[0].arc.pic='https://example.com/cover.jpg';assert.throws(()=>normalize(cover));
 const sql=sqlFor([{...sample,title:"原文's 标题"}]);assert(sql.includes("原文''s 标题"));assert(sql.includes('ON CONFLICT (id) DO NOTHING'));assert(sql.includes('substring(old.source_url'));
 console.log('PASS 190 unique BVs/IDs, original titles and dates, SHA-256/bitmap checks for all covers, Shanghai date conversion, uploader validation, SQL quoting and additive deduplication');
})().catch(error=>{console.error(error);process.exitCode=1;});
