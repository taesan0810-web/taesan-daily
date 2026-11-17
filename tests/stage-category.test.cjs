const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE||'http://127.0.0.1:8010',manifest=require('../data/bilibili-stage-9582384.json');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const rows=manifest.records.map(r=>({...r,content_zh:'',original_ko:'',event_name:'',collaborators:'',image_urls:[],images:[]}));
  rows.push({...rows[0],id:'group-fixture',category:'BOYNEXTDOOR 团体舞台',title:'Group fixture'});rows.push({...rows[0],id:'collaboration-fixture',category:'个人及队外合作舞台',title:'Collaboration fixture'});
  await page.route('https://**/*',route=>{const request=route.request(),url=new URL(request.url());
   if(url.hostname==='taesan0810-web.github.io'&&url.pathname.includes('/assets/stage/bilibili/')){const record=manifest.records.find(r=>r.cover_url===url.href);return record?route.fulfill({contentType:'image/webp',body:fs.readFileSync(record.cover_path)}):route.abort();}
   if(!url.hostname.endsWith('.supabase.co'))return route.abort();
   if(url.pathname.endsWith('/auth/v1/user'))return route.fulfill({json:{}});
   let data=rows;for(const [key,value]of url.searchParams)if(value.startsWith('eq.'))data=data.filter(r=>String(r[key])===value.slice(3));
   const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||100);return route.fulfill({json:data.slice(offset,offset+limit)});
  });
  await page.goto(base+'/stage.html?category='+encodeURIComponent('个人直拍'));await page.locator('#status').filter({hasText:'24 / 190'}).waitFor();
  assert.equal(await page.locator('.stage-categories button').count(),4);assert.equal(await page.locator('.stage-categories button[aria-pressed=true]').textContent(),'个人直拍');assert(await page.locator('#category').isHidden());
  assert((await page.locator('#records article .meta').first().textContent()).startsWith('2026-10-21'));
  await page.locator('#records img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));await page.waitForFunction(()=>[...document.querySelectorAll('#records img')].every(image=>image.complete&&image.naturalWidth>0));
  assert(await page.locator('#editorPanel').isHidden());assert.equal(await page.locator('#records a:has(img)').count(),24);
  await page.screenshot({path:'work/screenshots/stage-import-'+width+'.png',fullPage:true});
  while(await page.locator('#more').isVisible())await page.locator('#more').click();assert.equal(await page.locator('#records article').count(),190);
  await page.locator('#sort').selectOption('asc');assert((await page.locator('#records article .meta').first().textContent()).startsWith('2023-05-31'));
  await page.locator('#search').fill(manifest.records[0].bvid);assert.equal(await page.locator('#records article').count(),1);assert.equal(await page.locator('#records a:has(img)').getAttribute('href'),manifest.records[0].source_url);
  await page.locator('#search').fill('');await page.getByRole('button',{name:'团体舞台',exact:true}).click();assert.equal(await page.locator('#records article').count(),1);assert((await page.locator('#records').textContent()).includes('Group fixture'));
  await page.getByRole('button',{name:'合作舞台',exact:true}).click();assert((await page.locator('#records').textContent()).includes('Collaboration fixture'));
  await page.getByRole('button',{name:'个人直拍',exact:true}).click();assert(new URL(page.url()).searchParams.get('category')==='个人直拍');assert.equal(await page.locator('#records article').count(),24);
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));assert.deepEqual(errors,[]);await page.close();console.log('PASS '+width+'px: STAGE personal-fancam section, 190 records, cover decoding/links, publication-date sort, BV search, pagination, independent group/collaboration categories and no public editor');
 }
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
