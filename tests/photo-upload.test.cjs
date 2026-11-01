const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [320,390]){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const png=await page.screenshot();
 await page.route('https://**/*',r=>r.request().resourceType()==='image'?r.fulfill({contentType:'image/png',body:png}):r.abort());
 await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'application/javascript',body:'/* Mock Supabase for isolated tests. */'}));
 await page.addInitScript(()=>{
  window.fixture={rows:[],uploaded:[],removed:[],saved:[],failRemove:false,failRead:false,failSave:false,failSecond:false};
  window.supabase={createClient:()=>({auth:{onAuthStateChange:()=>{},getUser:async()=>({data:{user:{id:'0c40000a-9f2c-46dc-8ba7-a0b016e6988e',email:'fixture@example.invalid'}},error:null})},storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:'https://fixture.invalid/'+path}}),upload:async(path,file)=>{await new Promise(r=>setTimeout(r,30));if(fixture.failSecond&&fixture.uploaded.length===1){fixture.failSecond=false;return {error:{message:'fixture upload failure'}}}fixture.uploaded.push(path);return {error:null}},remove:async paths=>{if(fixture.failRemove)return {error:{message:'fixture Storage denied'}};fixture.removed.push(...paths);return {data:paths.map(name=>({name})),error:null}}})},from:table=>{
   const q={select:()=>q,order:()=>q,range:async(a,b)=>({data:table==='entries'?fixture.rows.slice(a,b+1):[],error:fixture.failRead?{message:'fixture read failure'}:null}),upsert:async row=>{if(fixture.failSave)return {error:{message:'fixture save failure'}};fixture.saved.push(JSON.parse(JSON.stringify(row)));fixture.rows=[row];return {error:null}}};return q;
  }})};
 });
 page.on('dialog',d=>d.accept());
 await page.goto((process.env.TAESAN_TEST_URL||'http://127.0.0.1:8000')+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.classList.contains('admin-on'));await page.locator('#manageBtn').click();
 async function upload(files){await page.locator('#entryPhotoFile').setInputFiles(files);await page.evaluate(()=>{document.getElementById('uploadPhotoBtn').onclick();document.getElementById('uploadPhotoBtn').onclick()});await page.waitForFunction(()=>!photoUploading);}
 const A={name:'a.png',mimeType:'image/png',buffer:png},A2={name:'same-renamed.png',mimeType:'image/png',buffer:png},B={name:'b.png',mimeType:'image/png',buffer:Buffer.concat([png,Buffer.from('different')])};
 await upload([A,A2,B]);assert.equal(await page.locator('#uploadPreview .previewItem').count(),2);assert.equal(await page.evaluate(()=>fixture.uploaded.length),2);
 await upload([A]);assert.equal(await page.evaluate(()=>fixture.uploaded.length),2);
 // Verify mobile hit areas are distinct and reachable, not merely present in DOM.
 const rects=await page.locator('#uploadPreview .previewItem').first().locator('button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
 for(const r of rects){assert(r.w>=44&&r.h>=44);assert(r.x>=0&&r.x+r.w<=width+1)}
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));}
 const urls=await page.evaluate(()=>uploadedPhotos.slice());await page.getByRole('button',{name:'第 1 张照片后移',exact:true}).click();assert.deepEqual(await page.evaluate(()=>uploadedPhotos),urls.reverse());
 await page.getByRole('button',{name:'删除第 1 张照片',exact:true}).click();await page.waitForFunction(()=>!photoCleanupTask);assert.equal(await page.locator('#entryPhotoCount').inputValue(),'1');assert.equal(await page.evaluate(()=>fixture.removed.length),1);
 await page.getByRole('button',{name:'删除第 1 张照片',exact:true}).click();await page.waitForFunction(()=>!photoCleanupTask);assert.equal(await page.locator('#entryPhotoCount').inputValue(),'0');assert.equal(await page.locator('#entryPhoto').inputValue(),'');
 await page.locator('#entryTitle').fill('fixture empty-photo save');await page.evaluate(()=>document.getElementById('entryForm').onsubmit(new Event('submit',{cancelable:true})));assert.deepEqual(await page.evaluate(()=>fixture.saved.at(-1).photos),[]);assert.equal(await page.evaluate(()=>fixture.saved.at(-1).photo),'');
 // Editing saved/shared photos removes association only, never Storage objects.
 await page.evaluate(()=>editEntry({id:'existing',date:'2026-09-01',platform:'Weverse',kind:'帖子',title:'saved',photos:['https://fixture.invalid/shared.jpg'],photo:'https://fixture.invalid/shared.jpg',videos:['https://fixture.invalid/video.mp4'],photo_count:1,video_count:1}));
 const removed=await page.evaluate(()=>fixture.removed.length);await page.getByRole('button',{name:'删除第 1 张照片',exact:true}).click();await page.waitForFunction(()=>!photoCleanupTask);assert.equal(await page.evaluate(()=>fixture.removed.length),removed);assert.deepEqual(await page.evaluate(()=>uploadedVideos),['https://fixture.invalid/video.mp4']);
 await upload([A]);await page.evaluate(()=>{fixture.failRemove=true});await page.getByRole('button',{name:'删除第 1 张照片',exact:true}).click();await page.waitForFunction(()=>!photoCleanupTask);assert.match(await page.locator('#photoCleanupStatus').textContent(),/清理失败/);assert.equal(await page.locator('#entryPhotoCount').inputValue(),'0');
 await page.evaluate(()=>{fixture.failRemove=false});await page.locator('#retryPhotoCleanup').click();await page.waitForFunction(()=>!photoCleanupTask);assert.match(await page.locator('#photoCleanupStatus').textContent(),/已清理/);
 // Fresh cross-record reference prevents deleting even a draft-owned URL.
 await upload([A]);await page.evaluate(()=>fixture.rows.push({id:'other',photo:uploadedPhotos[0],photos:[uploadedPhotos[0]]}));const beforeShared=await page.evaluate(()=>fixture.removed.length);await page.getByRole('button',{name:'删除第 1 张照片',exact:true}).click();await page.waitForFunction(()=>!photoCleanupTask);assert.equal(await page.evaluate(()=>fixture.removed.length),beforeShared);
 // Partial upload retry does not add the successful first file twice.
 await page.evaluate(()=>{fixture.uploaded=[];fixture.failSecond=true});await upload([A,B]);assert.equal(await page.locator('#uploadPreview .previewItem').count(),1);await upload([A,B]);assert.equal(await page.locator('#uploadPreview .previewItem').count(),2);assert.equal(await page.evaluate(()=>fixture.uploaded.length),2);
 await page.locator('#entryVideoCover').check();assert.equal(await page.locator('#entryPhotoCount').inputValue(),'1');await page.locator('#entryVideoCover').uncheck();
 // Save failure preserves active draft photos; successful save commits ownership before reset.
 await page.evaluate(()=>{fixture.failSave=true});
 const active=await page.evaluate(()=>uploadedPhotos.slice());
 await page.evaluate(()=>document.getElementById('entryForm').onsubmit(new Event('submit',{cancelable:true})));
 assert.deepEqual(await page.evaluate(()=>uploadedPhotos),active);
 await page.evaluate(()=>{fixture.failSave=false});
 await page.evaluate(()=>document.getElementById('entryForm').onsubmit(new Event('submit',{cancelable:true})));
 assert.equal(await page.evaluate(()=>draftPhotoFiles.size),0);
 await page.evaluate(()=>editEntry({id:'counts-only',date:'2026-09-02',platform:'Weverse',kind:'帖子',title:'count-only historical record',photo:'',photos:[],photo_count:7,video_count:0}));
 assert.equal(await page.locator('#entryPhotoCount').inputValue(),'7');
 await page.evaluate(()=>renderUploadPreview());assert.equal(await page.locator('#entryPhotoCount').inputValue(),'7');
 await page.screenshot({path:'/tmp/taesan-photo-upload-'+width+'.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS mobile '+width+': visible non-overlapping delete/order buttons, SHA-256 duplicate and double-click protection, last-photo clear, draft cleanup/retry/shared-reference safety, partial retry, video-cover counts; videos unchanged.');await page.close();
 }
 }finally{await browser?.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
