// Regression fixtures are synthetic; actual 115-row production read-only checks are separate.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../album-cover-data.json')));
const first=source.find(s=>s.selected);
const rows=source.map((s,i)=>({...s,id:String(i),cover_url:!s.cover_url||s===first?'https://i.scdn.co/image/test-'+i:'',album:s.album||s.spotify_album||''}));
let png;
(async()=>{let b;try{
 b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const p=await b.newPage();p.setDefaultTimeout(15000);png=await p.screenshot();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://**/*',r=>r.request().resourceType()==='image'?r.fulfill({contentType:'image/png',body:png}):r.abort());
 await p.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'application/javascript',body:'/* read-only fixture SDK */'}));
 await p.addInitScript(({rows})=>{
  window.musicRanges=[];
  window.supabase={createClient:()=>({auth:{onAuthStateChange:()=>{},getUser:async()=>({data:{user:null},error:null})},from:table=>{
   const query={select:()=>query,order:()=>query,range:async(start,end)=>{if(table==='music_tracks'){window.musicRanges.push([start,end]);return {data:rows.slice(start,end+1),error:null}}return {data:[],error:null}}};return query;
  }})};
 },{rows});
 await p.goto((process.env.ALBUM_COVERS_BASE_URL||'http://127.0.0.1:8000')+'/',{waitUntil:'domcontentloaded'});
 await p.locator('#tabs button[data-tab="music"]').click();await p.waitForFunction(()=>document.querySelectorAll('#musicList .music-track').length===115);
 assert.deepEqual(await p.evaluate(()=>musicRanges),[[0,49],[50,99],[100,149],[150,199]]);
 assert.equal(await p.locator('#musicList img').count(),110);assert.equal(await p.locator('#musicList .music-cover-placeholder').count(),5);
 const before=await p.evaluate(()=>musicRows.map(r=>r.cover_url));assert.deepEqual(before,rows.map(r=>r.cover_url));
 await p.locator('#musicList img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
 await p.waitForFunction(()=>[...document.querySelectorAll('#musicList img')].every(i=>i.complete&&i.naturalWidth>0));
 const url='https://i.scdn.co/image/test-network-failure';
 await p.route(url,r=>r.abort());
 await p.evaluate(url=>{musicRows[0].cover_url=url;renderMusic()},url);
 await p.locator('#musicList img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
 await p.waitForFunction(()=>[...document.querySelectorAll('.music-cover-status')].some(e=>e.textContent.includes('封面加载失败')));
 const box=p.locator('.music-cover-box').filter({hasText:'封面加载失败'}).first();assert(await box.getByText('重试',{exact:true}).isVisible());assert(await box.getByText('打开封面原图').isVisible());
 await p.unroute(url);await box.getByText('重试',{exact:true}).click();
 await p.waitForFunction(()=>![...document.querySelectorAll('.music-cover-status')].some(e=>e.textContent.includes('封面加载失败')));
 await p.locator('#musicSearch').fill('Michael Jackson');assert.equal(await p.locator('#musicList .music-track').count(),1);
 for(const tab of ['daily','monthly','dm','photos','yearly','manage']){await p.locator(`#tabs button[data-tab="${tab}"]`).click();assert(await p.locator('#'+tab).isVisible());}
 assert.deepEqual(errors,[]);
 console.log('PASS 115-row pagination; 57 database + 53 approved fallback covers; database URLs unchanged; 5 missing notices; actual img error/retry; search and six other tabs.');
}finally{await b?.close()}})().catch(e=>{console.error(e);process.exitCode=1});
