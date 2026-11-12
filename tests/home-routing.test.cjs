const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();await page.route('https://**/*',route=>route.abort());
 for(const [entry,target]of [['index.html','daily.html'],['index.html?tab=monthly','daily.html?tab=monthly'],['index.html#dm','daily.html?tab=dm'],['index.html#self','self.html'],['index.html#work','work.html'],['index.html?tab=manage','admin.html'],['index.html?tab=music','music.html?section=playlist']]){
  await page.goto('http://127.0.0.1:8000/'+entry);await page.waitForURL('http://127.0.0.1:8000/'+target);assert.equal(await page.locator('.mood,.zine,.scribble').count(),0);
 }
 assert.equal(await page.locator('h1').count(),1);console.log('PASS home routes: direct records, legacy monthly/DM/SELF/WORK/manage/music links; no exhibition homepage');
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
