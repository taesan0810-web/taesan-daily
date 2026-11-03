const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),shots=path.join(root,'work','screenshots');fs.mkdirSync(shots,{recursive:true});
const base='http://127.0.0.1:8000';
const entries=[{id:'public',date:'2026-10-01',time:'12:00',platform:'Weverse',kind:'帖子',title:'PUBLIC POST',summary:'fixture',photo_count:2,video_count:0,photos:['https://fixture.invalid/a.jpg','https://fixture.invalid/b.jpg'],videos:[]},{id:'reply',date:'2026-10-01',platform:'Weverse',kind:'粉丝帖子下的回复',title:'PUBLIC REPLY',photos:[],videos:[],photo_count:0,video_count:0},{id:'tiktok',date:'2026-10-01',platform:'TikTok',kind:'视频',title:'TIKTOK LEGACY',photos:[],videos:[]},{id:'dm-entry',date:'2026-10-01',platform:'DM',kind:'DM',title:'DM PRIVATE',photos:[],videos:[]}];
const dm=[{date:'2026-10-01',text:8,voice:1,photos:1,videos:0},{date:'2026-10-02',text:5,voice:0,photos:0,videos:0}];
const tracks=JSON.parse(fs.readFileSync(path.join(root,'album-cover-data.json'))).map((x,i)=>({...x,id:String(i),qq_url:x.qq_url||'',spotify_url:x.spotify_url||'',notes:''}));
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const png=fs.readFileSync(path.join(root,'october-journey/cat.png'));
 let checked=0;
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',async route=>{const req=route.request(),u=new URL(req.url());if(req.resourceType()==='image')return route.fulfill({contentType:'image/png',body:png});
   if(u.hostname.endsWith('.supabase.co')){
    if(req.method()!=='GET'&&!u.pathname.includes('/sign/'))writes.push(req.method()+' '+u.pathname);
    if(u.pathname.includes('/sign/'))return route.fulfill({json:{signedURL:'/object/sign/fixture?token=test'}});
    const table=u.pathname.split('/').at(-1);let data;
    if(table==='archive_records'||table==='journey_locations')return route.fulfill({status:404,json:{code:'PGRST205',message:'Fixture missing table'}});
    if(table==='entries')data=entries;else if(table==='dm_stats')data=dm;else if(table==='music_tracks')data=tracks;else if(table==='music_works'||table==='music_albums')data=[];else if(table==='tmi_categories')data=[{name:'其他'}];else if(table==='tmi_records')data=[{id:'10000000-0000-4000-8000-000000000001',title:'TMI FIXTURE',content_zh:'测试内容',original_ko:'',translation_zh:'',category:'其他',tags:[],life_stage:null,public_date:'2026-10-01',source:'Interview',source_url:'https://example.com',source_note:'',images:[],published:true,created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'}];else data=[];
    for(const [key,value]of u.searchParams){if(value.startsWith('eq.'))data=data.filter(r=>String(r[key])===value.slice(3));if(value.startsWith('gte.'))data=data.filter(r=>r[key]>=value.slice(4));if(value.startsWith('lt.'))data=data.filter(r=>r[key]<value.slice(3));}
    const count=data.length,offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||1000);data=data.slice(offset,offset+limit);
    return route.fulfill({contentType:'application/json',headers:{'content-range':`0-${Math.max(0,data.length-1)}/${count}`},body:JSON.stringify(data)});
   }return route.abort();
  });
  for(const file of ['index.html','work.html','self.html','daily.html','tmi.html','music.html','thoughts.html','fragments.html','stage.html','short-videos.html','journey.html']){
   await page.goto(base+'/'+file,{waitUntil:'networkidle'});
   assert(await page.locator(file==='journey.html'?'#journeyTitle':'h1').first().isVisible(),file);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert(!overflow,`${file} overflow at ${width}`);
   if(file==='index.html'){
    for(const k of ['work','self','daily'])assert.equal(await page.locator('a.tile.'+k).getAttribute('href'),k+'.html');
    assert(await page.locator('.mood img').evaluateAll(a=>a.every(i=>i.complete&&i.naturalWidth>0)));
    await page.screenshot({path:path.join(shots,'home-'+width+'.png'),fullPage:true});
   }
   if(file==='tmi.html')assert.equal(await page.locator('#cards .card').count(),1);
   if(file==='self.html'){assert.equal(await page.locator('.chapter-links a').count(),2);assert.equal(await page.locator('a[href="fragments.html"]').count(),0);}
   if(file!=='index.html'&&file!=='journey.html')assert(await page.locator('.archive-nav a[href="admin.html"]').isVisible());
   if(file==='daily.html'){
    await page.locator('#dayPicker').fill('2026-10-01');await page.locator('#dayPicker').dispatchEvent('change');
    assert.equal(await page.locator('#dailyList article').count(),2);assert(!((await page.locator('#dailyList').innerText()).includes('DM PRIVATE')));assert(!((await page.locator('#dailyList').innerText()).includes('TIKTOK LEGACY')));
    assert.equal(await page.locator('#dayPlatform option').count(),6);
    await page.locator('#dayPlatform').selectOption('Weverse Reply');assert.equal(await page.locator('#dailyList article').count(),1);await page.locator('#dayPlatform').selectOption('全部平台');
    assert(await page.locator('#calendar button').filter({hasText:/^2$/}).evaluate(el=>el.classList.contains('has')));
    await page.locator('.slideActions button').last().click();assert.equal(await page.locator('.slideActions span').textContent(),'2 / 2');
    await page.screenshot({path:path.join(shots,'daily-'+width+'.png'),fullPage:true});
    assert.equal(await page.locator('#tabs a.journey-nav').count(),0);assert(await page.locator('#manageBtn').isHidden());assert.equal(await page.locator('input[type=file]:visible').count(),0);
    await page.goto(base+'/daily.html?tab=dm&month=2026-10');await page.waitForLoadState('networkidle');assert(await page.locator('#dmJourneyLink').isVisible());assert.equal(await page.locator('#dmJourneyLink').getAttribute('href'),'journey.html?month=2026-10');await page.locator('#dmMonth').fill('2026-11');await page.locator('#dmMonth').dispatchEvent('change');assert.equal(await page.locator('#dmJourneyLink').getAttribute('href'),'journey.html?month=2026-11');
    await page.goto(base+'/daily.html?tab=monthly&month=2026-10');await page.waitForLoadState('networkidle');assert(await page.locator('#monthly').isVisible());assert.equal(await page.locator('#monthList a').first().getAttribute('href'),'daily.html?tab=photos&month=2026-10');
   }
   if(['thoughts.html','fragments.html','stage.html','short-videos.html'].includes(file)){
    assert(await page.locator('#manage').isHidden());assert(await page.locator('#editorPanel').isHidden());assert.equal(await page.locator('input[type=file]:visible').count(),0);assert.equal(await page.locator('#records article').count(),file==='short-videos.html'?1:0);
   }
   if(file==='journey.html'){
    await page.locator('#journeyMonth').fill('2026-10');await page.locator('#journeyMonth').dispatchEvent('change');await page.waitForFunction(()=>document.querySelectorAll('[data-day]').length===31);
    await page.locator('[data-day="1"]').click();const start=await page.locator('#traveler').evaluate(e=>e.style.left);await page.locator('[data-day="2"]').click();assert.equal(await page.locator('#traveler').evaluate(e=>e.style.left),start);await page.locator('[data-day="24"]').click();assert.notEqual(await page.locator('#traveler').evaluate(e=>e.style.left),start);
    assert(await page.locator('svg.world').isVisible());assert.equal(await page.locator('input[type=file]').count(),0);assert.equal(await page.locator('#locationEditor').count(),0);
    await page.waitForTimeout(1400);
    await page.screenshot({path:path.join(shots,'journey-'+width+'.png'),fullPage:true});
    await page.locator('#journeyMonth').fill('2026-11');await page.locator('#journeyMonth').dispatchEvent('change');await page.waitForFunction(()=>document.querySelectorAll('[data-day]').length===30);assert(await page.locator('#traveler').isHidden());assert.equal(await page.locator('#numbers strong').first().textContent(),'—');
   }
   checked++;
  }
  // Both fetch and XHR writes must be blocked before reaching the network.
  const guard=await page.evaluate(async()=>{const response=await fetch('https://shwilnzlpychjoasvqtg.supabase.co/rest/v1/entries',{method:'POST',body:'{}'});let xhr=false;try{new XMLHttpRequest().open('POST','https://shwilnzlpychjoasvqtg.supabase.co/storage/v1/object/music-media/test');}catch{xhr=true;}return {status:response.status,xhr};});assert.deepEqual(guard,{status:403,xhr:true});assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  await context.close();console.log('PASS '+width+'px: public pages, two SELF sections, no public editors/uploads, DM COUNTS link, original Journey UI, monthly navigation, DM calendar, slider, no production writes');
 }
 console.log('PASS '+checked+' page/viewport combinations');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
