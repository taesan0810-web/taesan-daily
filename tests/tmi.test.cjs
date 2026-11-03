const {chromium}=require('playwright'),assert=require('node:assert/strict');
const ADMIN='0c40000a-9f2c-46dc-8ba7-a0b016e6988e',user={id:ADMIN,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=[{alg:'HS256',typ:'JWT'},{sub:ADMIN,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.fixture';
const seed=(id,title,category,published)=>({id,title,category,published,content_zh:'测试内容 '+title,original_ko:'한국어 원문',translation_zh:'中文翻译',tags:['测试'],life_stage:null,public_date:'2026-10-01',source:'采访',source_url:'https://example.com/source',source_note:'fixture',images:[],created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'});
async function fixture(context){
 let signedIn=false,failure=null;const categories=['其他','基本资料','成长经历'],records=new Map([
  ['10000000-0000-4000-8000-000000000001',seed('10000000-0000-4000-8000-000000000001','公开基本资料','基本资料',true)],
  ['10000000-0000-4000-8000-000000000002',seed('10000000-0000-4000-8000-000000000002','公开童年档案','成长经历',true)],
  ['10000000-0000-4000-8000-000000000003',seed('10000000-0000-4000-8000-000000000003','不可泄露草稿','其他',false)]
 ]),writes=[];
 await context.route('https://**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(!url.hostname.endsWith('.supabase.co'))return route.abort();
  if(url.pathname.endsWith('/auth/v1/token')){signedIn=true;return route.fulfill({json:{access_token:jwt,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user}});}if(url.pathname.endsWith('/auth/v1/user'))return route.fulfill({json:signedIn?user:{}});
  if(url.pathname.endsWith('/auth/v1/logout')){signedIn=false;return route.fulfill({status:204});}
  const table=url.pathname.split('/').at(-1);
  if(table==='tmi_categories'){
   if(failure==='network')return route.abort();
   if(failure==='database')return route.fulfill({status:403,json:{code:'42501',message:'fixture permission denied'}});
   if(request.method()==='POST'){const value=request.postDataJSON();categories.push(value.name);writes.push({table,value});return route.fulfill({json:value});}
   return route.fulfill({json:categories.map(name=>({name}))});
  }
  if(table!=='tmi_records')return route.fulfill({json:[]});
  const id=url.searchParams.get('id')?.replace(/^eq\./,'');
  if(request.method()==='POST'){const value=request.postDataJSON(),row=Array.isArray(value)?value[0]:value;const record={...seed(row.id,'','其他',false),...row};records.set(row.id,record);writes.push({table,method:'POST',row:record});return route.fulfill({json:record});}
  if(request.method()==='PATCH'){const row={...records.get(id),...request.postDataJSON()};records.set(id,row);writes.push({table,method:'PATCH',id});return route.fulfill({json:row});}
  if(request.method()==='DELETE'){const row=records.get(id);records.delete(id);writes.push({table,method:'DELETE',id});return route.fulfill({json:row});}
  let rows=[...records.values()];for(const [key,value]of url.searchParams)if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===value.slice(3));
  const search=url.searchParams.get('search_text');if(search)rows=rows.filter(row=>(row.title+' '+row.content_zh).includes(search.slice(7,-1)));
  const count=rows.length,offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||24);rows=rows.slice(offset,offset+limit);
  return route.fulfill({headers:{'content-range':(rows.length?offset+'-'+(offset+rows.length-1):'*')+'/'+count,'access-control-expose-headers':'content-range'},json:rows});
 });return {records,writes,setFailure:value=>failure=value};
}
async function login(page){await page.locator('#openLogin').click();await page.locator('#email').fill(user.email);await page.locator('#password').fill('fixture-password');await page.locator('#loginForm [type=submit]').click();await page.locator('#identity').filter({hasText:'已登录'}).waitFor();}
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),api=await fixture(context),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:8000/self.html');await page.locator('a[href="tmi.html"]').first().click();await page.locator('#status').filter({hasText:'2 / 2'}).waitFor();assert.equal(await page.locator('#category option').count(),4);assert(!(await page.locator('#cards').textContent()).includes('不可泄露草稿'));
  await page.locator('#category').selectOption('基本资料');await page.locator('#status').filter({hasText:'1 / 1'}).waitFor();assert.equal(await page.locator('#cards article').count(),1);
  await page.goto('http://127.0.0.1:8000/admin.html?module=tmi');await login(page);let frame=page.frameLocator('iframe[name="workspace-tmi"]');await frame.locator('#editStatus').filter({hasText:'新档案'}).waitFor();
  const formType=await frame.locator('#editor').evaluate(form=>({type:form.constructor.name,resetType:typeof form.reset,resetMember:form.reset.id}));assert.deepEqual(formType,{type:'HTMLFormElement',resetType:'object',resetMember:'reset'});
  await frame.locator('#visibility').selectOption('all');await frame.locator('#status').filter({hasText:'3 / 3'}).waitFor();assert.equal(await frame.locator('#editCategory option').count(),3);
  const id=await frame.locator('#recordId').inputValue();await frame.locator('#title').fill('新增测试档案');await frame.locator('#content').fill('新增中文内容');await frame.locator('#korean').fill('한국어');await frame.locator('#translation').fill('中文');await frame.locator('#editCategory').selectOption('基本资料');await frame.locator('#date').fill('2026-10-02');await frame.locator('#source').fill('采访');await frame.locator('#save').click();await frame.locator('#editStatus').filter({hasText:'已保存为草稿'}).waitFor();await frame.locator('#status').filter({hasText:'4 / 4'}).waitFor();assert.equal(api.records.get(id).published,false);
  await frame.locator('#tmi-'+id+' button').filter({hasText:/^编辑$/}).click();await frame.locator('#content').fill('编辑后的中文内容');await frame.locator('#save').click();await frame.locator('#tmi-'+id).filter({hasText:'编辑后的中文内容'}).waitFor();assert.equal(api.records.size,4);assert.equal(api.records.get(id).content_zh,'编辑后的中文内容');
  await frame.locator('#reset').click();assert.equal(await frame.locator('#content').inputValue(),'');assert.notEqual(await frame.locator('#recordId').inputValue(),id);assert(!(await frame.locator('#published').isChecked()));
  await frame.locator('summary').filter({hasText:'新增分类'}).click();await frame.locator('#newCategory').fill('测试新分类');await frame.locator('#addCategory').click();await frame.locator('#editCategory option[value="测试新分类"]').waitFor({state:'attached'});assert.equal(await frame.locator('#editCategory').inputValue(),'测试新分类');
  await frame.locator('#tmi-'+id+' button').filter({hasText:/^发布$/}).click();await frame.locator('#tmi-'+id+' button').filter({hasText:'取消发布'}).waitFor();assert.equal(api.records.get(id).published,true);
  await page.reload();frame=page.frameLocator('iframe[name="workspace-tmi"]');await frame.locator('#editStatus').filter({hasText:'新档案'}).waitFor();await frame.locator('#visibility').selectOption('all');await frame.locator('#tmi-'+id).waitFor();assert((await frame.locator('#tmi-'+id).textContent()).includes('编辑后的中文内容'));
  await frame.locator('#tmi-'+id+' button').filter({hasText:/^删除$/}).click();await frame.locator('#tmi-'+id).waitFor({state:'detached'});assert.equal(api.records.size,3);assert(!api.records.has(id));
  await frame.locator('#new').click();assert.equal(await frame.locator('#content').inputValue(),'');await page.locator('#logout').click();await frame.locator('#admin').waitFor({state:'hidden'});
  await page.goto('http://127.0.0.1:8000/tmi.html');await page.locator('#status').filter({hasText:'2 / 2'}).waitFor();assert.equal(await page.locator('#cards article').count(),2);assert.deepEqual(errors,[]);
  await context.close();console.log('PASS TMI '+width+'px: SELF link, categories, public/draft isolation, actual form named-property collision, native reset, create/edit/publish/delete, new/cancel, category addition and refresh; isolated API fixtures');
 }
 for(const failure of ['network','database','script']){
  const context=await browser.newContext(),api=await fixture(context),page=await context.newPage();
  if(failure==='script'){await context.addInitScript(()=>{HTMLFormElement.prototype.reset=function(){throw new TypeError('fixture reset failure');};});await page.goto('http://127.0.0.1:8000/admin.html?module=tmi');await login(page);await page.frameLocator('iframe[name="workspace-tmi"]').locator('#status').filter({hasText:'页面脚本错误'}).waitFor();}
  else{api.setFailure(failure);await page.goto('http://127.0.0.1:8000/tmi.html');await page.locator('#status').filter({hasText:failure==='network'?'网络请求失败':'数据库请求失败'}).waitFor();}
  await context.close();console.log('PASS TMI distinct '+failure+' error reporting');
 }
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
