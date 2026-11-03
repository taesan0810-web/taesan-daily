const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const sizes=[[320,568],[390,844],[768,1024],[1440,900],[1920,1080],[1440,650]];
 for(const [width,height]of sizes){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('https://**/*',route=>route.abort());await page.goto('http://127.0.0.1:8000/index.html');await page.waitForTimeout(1200);
  await page.locator('img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
  await page.screenshot({path:'work/screenshots/collage-'+width+'x'+height+'.png',fullPage:true});
  const layout=await page.evaluate(()=>{const title=document.querySelector('h1').getBoundingClientRect(),cta=document.querySelector('.enter').getBoundingClientRect(),intro=document.querySelector('.intro').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1,titleLeft:title.left,titleRight:title.right,ctaBottom:cta.bottom,introBottom:intro.bottom};});
  assert(!layout.overflow,JSON.stringify({width,height,...layout}));assert(layout.titleLeft>=0&&layout.titleRight<=width+1,JSON.stringify({width,height,...layout}));assert(layout.ctaBottom<=layout.introBottom+1);
  assert.equal(await page.locator('img[src^="assets/home-"]').count(),2);assert.equal(await page.locator('img').count(),5);assert.equal(await page.locator('.little-things').count(),0);assert.equal(await page.locator('.home-nav a[href="admin.html"]').count(),1);
  for(const [name,source]of [['work','zine-1.jpeg'],['self','zine-2.jpeg'],['daily','zine-3.jpeg']])assert.equal(await page.locator('a.tile.'+name+' img').getAttribute('src'),'assets/'+source);
  assert.equal((await page.locator('.mood .note').textContent()).trim(),'dear, taesan');
  assert.equal(await page.locator('.archive-arrow').count(),5);
  assert(!(await page.locator('body').textContent()).includes('\u2197'));
  for(const arrow of await page.locator('.archive-arrow').all()){
   assert.equal(await arrow.getAttribute('aria-hidden'),'true');
   const icon=await arrow.evaluate(el=>{const css=getComputedStyle(el);return {mask:css.maskImage||css.webkitMaskImage,width:el.offsetWidth,height:el.offsetHeight,color:css.backgroundColor};});
   assert(icon.mask.includes('assets/arrow-up-right.svg'));assert(icon.width>0&&icon.height>0);assert.notEqual(icon.color,'rgba(0, 0, 0, 0)');
  }
  assert((await page.request.get('http://127.0.0.1:8000/assets/arrow-up-right.svg')).ok());
  await page.screenshot({path:'work/screenshots/collage-'+width+'x'+height+'.png',fullPage:true});
  await page.locator('.enter').click();await page.waitForTimeout(800);assert(await page.locator('#contents').evaluate(el=>el.getBoundingClientRect().top<innerHeight&&el.getBoundingClientRect().bottom>0));
  for(const name of ['work','self','daily']){assert.equal(await page.locator('a.tile.'+name).getAttribute('href'),name+'.html');await page.locator('a.tile.'+name).click();await page.waitForURL('**/'+name+'.html');await page.locator('h1').first().waitFor({state:'visible'});await page.goto('http://127.0.0.1:8000/index.html');}
  const motion=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});await motion.route('https://**/*',route=>route.abort());await motion.goto('http://127.0.0.1:8000/index.html');assert.equal(await motion.locator('.mood img').first().evaluate(el=>getComputedStyle(el).animationName),'none');await motion.close();
  assert.deepEqual(errors,[]);await page.close();console.log('PASS '+width+'x'+height+': hero photos only, original three entry photos/layout, no added bottom section, small note without heart, navigation and reduced motion');
 }
}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
