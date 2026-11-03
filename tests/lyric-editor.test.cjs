const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const mediaFixture=require('./helpers/lyric-media.cjs');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('https://**/*',route=>route.abort());
  await page.goto('http://127.0.0.1:8000/music.html');
  // Exercise the actual editor in isolation without signing in or writing to Supabase.
  await page.evaluate(async()=>{const {install}=await import('./lyric-editor.js');document.documentElement.classList.remove('public-view');document.documentElement.classList.add('workspace-view');window.fixtureAdmin=true;window.fixtureWork='first';window.editor=install({isAdmin:()=>window.fixtureAdmin,getWorkId:()=>window.fixtureWork,getMedia:async()=>null});document.querySelector('#adminPanel').hidden=false;document.querySelector('#lrc').closest('details').open=true;});
  await page.locator('#lyricTextFile').setInputFiles({name:'lyrics.txt',mimeType:'text/plain',buffer:Buffer.from('Hello world\n你好世界\nAnd so my fellow Americans\n我的美国同胞们')});
  await page.waitForFunction(()=>document.querySelector('#lyricsKo').value.includes('Hello world'));
  await page.locator('#splitLyrics').click();assert.equal(await page.locator('#lyricsKo').inputValue(),'Hello world\nAnd so my fellow Americans');assert.equal(await page.locator('#lyricsZh').inputValue(),'你好世界\n我的美国同胞们');
  await page.locator('#lyricsKo').fill('And so my fellow Americans\nAsk not what your country can do for you');
  await page.locator('#videoFile').setInputFiles(mediaFixture);await page.locator('#manualLyrics').click();await page.locator('#lyricStatus').filter({hasText:'试听已就绪'}).waitFor();assert.equal(await page.locator('.lyric-row').count(),2);
  await page.locator('#applyLyrics').click();assert((await page.locator('#lyricStatus').textContent()).includes('请补齐'));
  await page.locator('.lyric-row input').nth(0).fill('1.5');await page.locator('.lyric-row input').nth(1).fill('5.2');
  await page.locator('#lrc').fill('[00:00.00]old');await page.locator('#applyLyrics').click();assert((await page.locator('#lrc').inputValue()).startsWith('[00:01.50]And so'));await page.locator('#undoLyrics').click();assert.equal(await page.locator('#lrc').inputValue(),'[00:00.00]old');
  await page.locator('#applyLyrics').click();await page.locator('#lrc').fill('manual edit');await page.locator('#undoLyrics').click();assert.equal(await page.locator('#lrc').inputValue(),'manual edit');
  await page.locator('#autoLyrics').click();assert(await page.locator('.lyric-consent').isVisible());await page.locator('#dismissAlignment').click();assert.equal(await page.locator('#lrc').inputValue(),'manual edit');
  await page.locator('#lyricsKo').fill('changed');await page.locator('#applyLyrics').click();assert((await page.locator('#lyricStatus').textContent()).includes('歌词已修改'));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow);
  await page.screenshot({path:'work/screenshots/lyrics-'+width+'.png',fullPage:true});
  await page.evaluate(()=>{window.fixtureAdmin=false;dispatchEvent(new CustomEvent('taesan-auth-changed',{detail:{admin:false}}));});assert.equal(await page.locator('.lyric-row').count(),0);assert(await page.locator('#lyricPreview').isHidden());
  assert.deepEqual(errors,[]);await page.close();console.log('PASS lyric editor '+width+'px: TXT import, bilingual split, actual MP4 decode/preview, manual timing, LRC apply/undo, stale edit protection, logout cleanup');
 }
 }finally{await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
