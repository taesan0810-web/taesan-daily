const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const ADMIN='0c40000a-9f2c-46dc-8ba7-a0b016e6988e',user={id:ADMIN,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=[{alg:'HS256',typ:'JWT'},{sub:ADMIN,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.fixture';
(async()=>{let browser;try{browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
for(const width of [390,1440]){const page=await browser.newPage({viewport:{width,height:900}}),records=new Map(),uploads=[],errors=[];let signedIn=false;page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
await page.route('**/preview-config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.TAESAN_PREVIEW=false;'}));
await page.route('https://**/*',async route=>{const request=route.request(),url=new URL(request.url());if(!url.hostname.endsWith('.supabase.co'))return route.abort();
if(url.pathname.endsWith('/auth/v1/token')){signedIn=true;return route.fulfill({json:{access_token:jwt,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user}});}if(url.pathname.endsWith('/auth/v1/user'))return route.fulfill({json:signedIn?user:{}});
if(url.pathname.includes('/object/sign/'))return route.fulfill({json:{signedURL:'/object/sign/fixture?token=fixture'}});
if(url.pathname.includes('/storage/v1/object/')&&request.method()==='POST'){uploads.push(url.pathname);return route.fulfill({json:{Key:url.pathname.split('/object/')[1]}});}
if(url.pathname.includes('/storage/v1/'))return route.fulfill({contentType:'image/png',body:fs.readFileSync('october-journey/cat.png')});
const table=url.pathname.split('/').at(-1);if(table==='archive_records'){
if(request.method()==='POST'){const value=request.postDataJSON(),row=Array.isArray(value)?value[0]:value;records.set(row.id,row);return route.fulfill({json:row});}
if(request.method()==='DELETE'){const id=url.searchParams.get('id')?.slice(3);records.delete(id);return route.fulfill({json:[]});}
let rows=[...records.values()];for(const [key,value]of url.searchParams)if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===value.slice(3));return route.fulfill({json:rows});}
return route.fulfill({contentType:'application/json',headers:{'content-range':'0-0/0'},body:JSON.stringify(table==='tmi_categories'?[{name:'其他'}]:[])});
});
await page.goto('http://127.0.0.1:8000/admin.html?module=thoughts');await page.locator('#openLogin').click();await page.locator('#email').fill(user.email);await page.locator('#password').fill('fixture-password');await page.locator('#loginForm [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#identity').textContent.includes('已登录'));
for(const [module,title]of [['thoughts','PRODUCTION THOUGHT'],['stage','PRODUCTION STAGE'],['shorts','PRODUCTION SHORT']]){
await page.locator('#modulePicker').selectOption(module);const frame=page.frameLocator('iframe[name="workspace-'+module+'"]');await frame.locator('#editorPanel').waitFor({state:'visible'});await frame.locator('#title').fill(title);await frame.locator('#content').fill('Fixture public content');await frame.locator('#sourceUrl').fill('https://www.youtube.com/watch?v=fixture');if(module==='thoughts'){await frame.locator('#files').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:fs.readFileSync('october-journey/cat.png')});await frame.locator('#editStatus').filter({hasText:'图片已暂存'}).waitFor();}
assert(!(await frame.locator('#saveCloud').isDisabled()));await frame.locator('#saveCloud').click();await frame.locator('#editStatus').filter({hasText:'已保存到云端'}).waitFor();assert.equal([...records.values()].filter(row=>row.title===title).length,1);await frame.locator('#records button').filter({hasText:/^编辑$/}).click();await frame.locator('#content').fill('Edited fixture content');await frame.locator('#published').check();await frame.locator('#saveCloud').click();await frame.locator('#editStatus').filter({hasText:'已保存到云端'}).waitFor();assert([...records.values()].find(row=>row.title===title).published);
await frame.locator('#records button').filter({hasText:/^删除$/}).click();await frame.locator('#records article').waitFor({state:'hidden'});
}
assert.equal(uploads.length,1);assert.equal(records.size,0);assert.deepEqual(errors,[]);await page.close();console.log('PASS production mode '+width+'px: shared login, enabled private image upload, cloud create/edit/publish/delete for THOUGHTS/STAGE/SHORT VIDEOS; isolated API fixtures only');}
}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
