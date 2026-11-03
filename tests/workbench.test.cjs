const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const ADMIN='0c40000a-9f2c-46dc-8ba7-a0b016e6988e',base='http://127.0.0.1:8000';
const user={id:ADMIN,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=[{alg:'HS256',typ:'JWT'},{sub:ADMIN,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.fixture';
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);let signedIn=false;const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',async route=>{const req=route.request(),url=new URL(req.url());if(!url.hostname.endsWith('.supabase.co'))return route.abort();
   if(url.pathname.endsWith('/auth/v1/token')){signedIn=true;return route.fulfill({json:{access_token:jwt,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user}});}
   if(url.pathname.endsWith('/auth/v1/user'))return route.fulfill({json:signedIn?user:{}});
   if(url.pathname.endsWith('/auth/v1/logout')){signedIn=false;return route.fulfill({status:204});}
   if(req.method()!=='GET')writes.push(req.method()+' '+url.pathname);
   const table=url.pathname.split('/').at(-1);if(['archive_records','journey_locations'].includes(table))return route.fulfill({status:404,json:{code:'PGRST205',message:'Fixture missing table'}});
   let data=table==='tmi_categories'?[{name:'其他'}]:[];return route.fulfill({contentType:'application/json',headers:{'content-range':'0-0/'+data.length},body:JSON.stringify(data)});
  });
  await page.goto(base+'/admin.html?module=thoughts',{waitUntil:'networkidle'});
  const getFrame=async name=>{await page.locator('iframe[name="workspace-'+name+'"]').waitFor({state:'attached'});await page.waitForFunction(name=>document.querySelector('iframe[name="workspace-'+name+'"]')?.contentWindow?.TAESAN_WORKSPACE===true,name);const frame=page.frame('workspace-'+name);await frame.waitForLoadState('networkidle');return frame;};
  let thoughts=await getFrame('thoughts');await thoughts.locator('#editorPanel').waitFor({state:'visible'});assert.equal(await thoughts.locator('input[type=password]:visible').count(),0);
  await thoughts.locator('#title').fill('UNSAVED THOUGHT');await thoughts.locator('#content').fill('本机中文草稿');await thoughts.locator('#korean').fill('한국어 원문');
  await page.locator('[data-module=stage]').click();const stage=await getFrame('stage');await stage.locator('#editorPanel').waitFor({state:'visible'});await stage.locator('#title').fill('STAGE DRAFT');
  await page.locator('[data-module=thoughts]').click();assert.equal(await thoughts.locator('#title').inputValue(),'UNSAVED THOUGHT');await thoughts.locator('#saveLocal').click();assert.match(await thoughts.locator('#editStatus').textContent(),/已保存本机/);
  await page.locator('#openLogin').click();await page.locator('#email').fill(user.email);await page.locator('#password').fill('fixture-password');await page.locator('#loginForm [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#identity').textContent.includes('已登录'));
  for(const [module,form]of [['daily','#entryForm'],['tmi','#editor'],['music','#workForm'],['shorts','#editor'],['journey','#locationForm']]){
   await page.locator('[data-module='+module+']').click();const frame=await getFrame(module);await frame.locator(form).waitFor({state:'visible'});assert.equal(await frame.locator('input[type=password]:visible').count(),0);
   assert.equal(await frame.evaluate(()=>window.TAESAN_WORKSPACE),true);
   const overflow=await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);if(overflow)console.log(await frame.evaluate(()=>[...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(-10).map(el=>({tag:el.tagName,id:el.id,cls:el.className,width:el.getBoundingClientRect().width}))));assert(!overflow,module+' iframe overflow '+width);
   if(module==='daily'){assert(await frame.locator('#entryPhotoFile').isVisible());assert(await frame.locator('#entryVideoFile').isVisible());assert(await frame.locator('#musicForm').isHidden());}
   if(module==='music')assert(await frame.locator('#audioFile').isVisible());
  }
  await page.locator('[data-module=thoughts]').click();assert.equal(await thoughts.locator('#title').inputValue(),'UNSAVED THOUGHT');
  await page.screenshot({path:'work/screenshots/workbench-'+width+'.png',fullPage:true});
  await page.locator('#logout').click();await page.waitForFunction(()=>document.querySelector('#identity').textContent==='未登录');
  await page.locator('[data-module=tmi]').click();const tmi=await getFrame('tmi');await tmi.locator('#admin').waitFor({state:'hidden'});
  await page.goto(base+'/thoughts.html',{waitUntil:'networkidle'});assert(await page.locator('#editorPanel').isHidden());assert.equal(await page.locator('#records article').count(),0);
  await page.goto(base+'/daily.html?tab=manage');await page.waitForURL('**/admin.html?module=daily');
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await context.close();console.log('PASS '+width+'px: unified login/logout, all seven modules, uploads confined to workbench, draft retention, no public draft leakage, legacy admin redirect, no production writes');
 }
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
