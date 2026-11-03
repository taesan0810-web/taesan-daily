const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const mediaFixture=require('./helpers/lyric-media.cjs');
const ADMIN='0c40000a-9f2c-46dc-8ba7-a0b016e6988e',user={id:ADMIN,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=[{alg:'HS256',typ:'JWT'},{sub:ADMIN,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.fixture';
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),records=new Map(),errors=[];let signedIn=false,uploads=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/lyric-worker.js',route=>route.fulfill({contentType:'application/javascript',body:`self.onmessage=({data})=>{if(data.language==='japanese')return self.postMessage({type:'error',message:'fixture failure'});self.postMessage({type:'progress',message:'fixture processing'});setTimeout(()=>self.postMessage({type:'result',chunks:[{text:'Hello world',timestamp:[1,3]},{text:'다시 만나',timestamp:[4,6]}]}),data.language==='english'?1000:0);};`}));
  await page.route('https://**/*',async route=>{const request=route.request(),url=new URL(request.url());if(!url.hostname.endsWith('.supabase.co'))return route.abort();
   if(url.pathname.endsWith('/auth/v1/token')){signedIn=true;return route.fulfill({json:{access_token:jwt,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user}});}if(url.pathname.endsWith('/auth/v1/user'))return route.fulfill({json:signedIn?user:{}});
   if(url.pathname.includes('/object/sign/')&&request.method()==='POST')return route.fulfill({json:{signedURL:'/object/sign/music-media/fixture.mp4?token=fixture'}});
   if(url.pathname.includes('/object/sign/')&&request.method()==='GET')return route.fulfill({contentType:'video/mp4',body:fs.readFileSync(mediaFixture)});
   if(url.pathname.includes('/storage/v1/object/')&&request.method()==='POST'){uploads++;return route.fulfill({json:{Key:url.pathname.split('/object/')[1]}});}
   const table=url.pathname.split('/').at(-1);if(table==='music_works'){
    if(request.method()==='POST'){const value=request.postDataJSON(),row=Array.isArray(value)?value[0]:value;records.set(row.id,row);return route.fulfill({json:row});}
    const offset=Number(url.searchParams.get('offset')||0);return route.fulfill({json:[...records.values()].slice(offset,offset+50)});
   }return route.fulfill({contentType:'application/json',headers:{'content-range':'0-0/0'},body:'[]'});
  });
  await page.goto('http://127.0.0.1:8000/admin.html?module=music');await page.locator('#openLogin').click();await page.locator('#email').fill(user.email);await page.locator('#password').fill('fixture-password');await page.locator('#loginForm [type=submit]').click();
  const frame=page.frameLocator('iframe[name="workspace-music"]');await frame.locator('#adminPanel').waitFor({state:'visible'});await frame.locator('#autoLyrics').waitFor({state:'attached'});await frame.locator('summary').filter({hasText:'歌词与时间轴'}).click();
  await frame.locator('#title').fill('Fixture music');await frame.locator('#lyricsKo').fill('Hello world\n다시 만나');await frame.locator('#lyricsZh').fill('你好世界\n再次相见');
  await frame.locator('#videoFile').setInputFiles(mediaFixture);await frame.locator('[data-upload=video]').click();await frame.locator('#uploadStatus').filter({hasText:'上传完成'}).waitFor();assert.equal(await frame.locator('#videoFile').inputValue(),'');
  await frame.locator('#autoLyrics').click();await frame.locator('#confirmAlignment').click();await frame.locator('#lyricStatus').filter({hasText:'已处理 2 句'}).waitFor({timeout:20000});assert.equal(await frame.locator('#lrc').inputValue(),'');assert.equal(records.size,0);
  await frame.locator('#applyLyrics').click();await frame.locator('#saveWork').click();await frame.locator('#editStatus').filter({hasText:'已保存为草稿'}).waitFor();const saved=[...records.values()][0];assert.equal(saved.lrc,'[00:01.00]Hello world\n[00:04.00]다시 만나');assert.equal(saved.lyrics_zh,'你好世界\n再次相见');assert.equal(saved.published,false);assert(saved.video_path.endsWith('.mp4'));assert.equal(uploads,1);
  await frame.locator('#workVisibility').selectOption('all');await frame.locator('#works button').filter({hasText:/^编辑$/}).click();assert.equal(await frame.locator('.lyric-row').count(),0);await frame.locator('#autoLyrics').click();await frame.locator('#lyricStatus').filter({hasText:'已处理 2 句'}).waitFor();assert.equal(uploads,1);
  await frame.locator('#newWork').click();assert.equal(await frame.locator('.lyric-row').count(),0);assert.equal(await frame.locator('#lrc').inputValue(),'');
  await frame.locator('#lyricsKo').fill('Hello world');await frame.locator('#lrc').fill('keep original');await frame.locator('#videoFile').setInputFiles(mediaFixture);await frame.locator('#alignLanguage').selectOption('english');await frame.locator('#autoLyrics').click();await frame.locator('#lyricStatus').filter({hasText:'fixture processing'}).waitFor();await frame.locator('#cancelAlignment').click();await page.waitForTimeout(1200);assert.equal(await frame.locator('.lyric-row').count(),0);assert.equal(await frame.locator('#lrc').inputValue(),'keep original');
  await frame.locator('#alignLanguage').selectOption('japanese');await frame.locator('#autoLyrics').click();await frame.locator('#lyricStatus').filter({hasText:'自动对齐失败'}).waitFor();assert.equal(await frame.locator('#lrc').inputValue(),'keep original');assert(!(await frame.locator('#manualLyrics').isDisabled()));
  await page.goto('http://127.0.0.1:8000/music.html');assert.equal(await page.locator('#autoLyrics').count(),0);assert(await page.locator('#adminPanel').isHidden());
  assert.deepEqual(errors,[]);await page.close();console.log('PASS music workbench '+width+'px: original admin login, MP4 upload clears field but retains alignment source, worker result review, explicit apply/save draft, new-work cleanup, public editor absent; isolated API/recognition fixtures');
 }
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
