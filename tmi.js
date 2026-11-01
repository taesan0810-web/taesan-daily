'use strict';
(() => {
const ADMIN='0c40000a-9f2c-46dc-8ba7-a0b016e6988e', PAGE=24, BUCKET='tmi-images';
const $=id=>document.getElementById(id), el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let client,admin=false,categories=[],rows=[],offset=0,generation=0,images=[],pending=[],busy=false,importBusy=false,searchTimer;
const uuid=()=>crypto.randomUUID(), safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function checkDate(s){return !s||(/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='1900-01-01'&&s<='2100-12-31'&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s);}
function normalized(s){return String(s||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();}
function valid(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('记录必须为对象');
 const x={id:raw.id||uuid(),title:String(raw.title||''),content_zh:String(raw.content_zh||'').trim(),original_ko:String(raw.original_ko||''),translation_zh:String(raw.translation_zh||''),category:raw.category||'其他',tags:raw.tags||[],life_stage:raw.life_stage||null,public_date:raw.public_date||null,source:String(raw.source||''),source_url:String(raw.source_url||''),source_note:String(raw.source_note||''),images:raw.images||[],published:raw.published===true};
 if(!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(x.id))throw Error('ID 不是有效 UUID');
 if(!x.content_zh||x.content_zh.length>50000)throw Error('中文内容必填，最多50000字');
 if(!categories.includes(x.category))throw Error('分类不存在：'+x.category);
 if(!checkDate(x.public_date))throw Error('公开日期无效');
 if(x.life_stage&&!['上学前','小学','中学','未明确'].includes(x.life_stage))throw Error('学段无效');
 if(!Array.isArray(x.tags)||x.tags.some(t=>typeof t!=='string')||x.tags.length>40)throw Error('标签必须为文字数组，最多40个');
 if(!Array.isArray(x.images)||x.images.some(p=>typeof p!=='string'||!p.startsWith(x.id+'/')||p.includes('..')||p.includes('://')))throw Error('图片必须为本条档案 UUID 下的存储路径');
 if(x.source_url&&!safeUrl(x.source_url))throw Error('来源链接必须为 HTTPS');
 if(x.source.trim().toUpperCase()==='DM'&&(x.original_ko||x.translation_zh||x.images.length))throw Error('DM 仅允许摘要，不保存付费原文、翻译和图片');
 return x;
}
function status(s){$('status').textContent=s;}
function button(text,fn){let b=el('button',text);b.type='button';b.onclick=fn;return b;}
async function imageUrl(path){const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,300);if(error)throw error;return data.signedUrl;}
async function fillImage(img,path){try{img.src=await imageUrl(path);}catch{img.alt='图片暂时无法读取';}}
async function showImage(path){try{$('largeImage').src=await imageUrl(path);$('lightbox').showModal();}catch(e){status('图片加载失败：'+e.message);}}
function draw(row){
 const card=el('article',undefined,'card');card.id='tmi-'+row.id;
 const meta=el('div',undefined,'meta');meta.append(el('span','ARCHIVE / '+row.id.slice(0,8)),el('span',row.public_date||'公开日期未明确'));card.append(meta);
 if(row.title)card.append(el('h2',row.title));const text=el('div',row.content_zh,'body excerpt');card.append(text);
 const chips=el('div',undefined,'chips');[row.category,row.life_stage,...row.tags,!row.published?'草稿':null].filter(Boolean).forEach(t=>chips.append(el('span',t,'chip')));card.append(chips);
 const detail=el('div');detail.hidden=true;
 for(const [value,label,cls] of [[row.original_ko,'韩文原文','ko'],[row.translation_zh,'中文翻译','']])if(value){const block=el('div',undefined,'bilingual '+cls);block.append(el('div',label,'caption'),el('div',value));if(cls)block.lang='ko';detail.append(block);}
 if(row.images.length){const photos=el('div',undefined,'photos');row.images.forEach(path=>{const b=button('',()=>showImage(path)),img=el('img');img.alt='档案图片，点击放大';img.loading='lazy';b.append(img);photos.append(b);fillImage(img,path);});detail.append(photos);}
 const source=el('div',undefined,'source');source.append(el('div','来源：'+(row.source||'待补充')));if(row.source_note)source.append(el('div',row.source_note));if(safeUrl(row.source_url)){const a=el('a','查看原始来源');a.href=safeUrl(row.source_url);a.target='_blank';a.rel='noopener noreferrer';source.append(a);}source.append(el('div','建立 '+new Date(row.created_at).toLocaleDateString('zh-CN')+' · 更新 '+new Date(row.updated_at).toLocaleDateString('zh-CN')));detail.append(source);card.append(detail);
 const actions=el('div',undefined,'actions');const toggle=button('展开档案',()=>{detail.hidden=!detail.hidden;text.classList.toggle('excerpt',detail.hidden);toggle.textContent=detail.hidden?'展开档案':'收起档案';toggle.setAttribute('aria-expanded',String(!detail.hidden));});toggle.setAttribute('aria-expanded','false');actions.append(toggle);
 const a=el('a','独立链接');a.href='tmi.html?id='+encodeURIComponent(row.id);actions.append(a);
 if(admin){actions.append(button('编辑',()=>edit(row)),button(row.published?'取消发布':'发布',async()=>{if(!confirm(row.published?'将这条档案转为草稿？':'确认公开发布这条档案？'))return;try{const {error}=await client.from('tmi_records').update({published:!row.published}).eq('id',row.id).select().single();if(error)throw error;await load(true);}catch(e){status('操作失败：'+e.message);}}),button('删除',async()=>{if(!confirm('确定删除这条档案？建议先导出备份。'))return;try{const {error}=await client.from('tmi_records').delete().eq('id',row.id).select().single();if(error)throw error;await load(true);}catch(e){status('删除失败：'+e.message);}}));}
 card.append(actions);if(new URLSearchParams(location.search).get('id')===row.id)toggle.click();return card;
}
async function load(reset=false){
 const token=++generation;if(reset){rows=[];offset=0;$('cards').replaceChildren();} $('more').disabled=true;status('正在读取档案……');
 try{let q=client.from('tmi_records').select('*',{count:'exact'});const id=new URLSearchParams(location.search).get('id');if(id){if(!/^[\da-f-]{36}$/i.test(id))throw Error('档案链接无效');q=q.eq('id',id);}const cat=$('category').value,stage=$('stage').value,word=$('search').value.trim();
 if(cat)q=q.eq('category',cat);if(stage==='all')q=q.not('life_stage','is',null);else if(stage)q=q.eq('life_stage',stage);
 if(word)q=q.ilike('search_text','%'+word.replace(/[\\%_]/g,'\\$&')+'%');
 if(!admin||$('visibility').value==='published')q=q.eq('published',true);else if($('visibility').value==='draft')q=q.eq('published',false);
 const {data,error,count}=await q.order('public_date',{ascending:$('sort').value==='asc',nullsFirst:false}).order('id').range(offset,offset+PAGE-1);if(error)throw error;if(token!==generation)return;
 rows.push(...data);offset+=data.length;data.forEach(r=>$('cards').append(draw(r)));$('more').hidden=offset>=count;status(count?`已展示 ${offset} / ${count} 份档案 · 未明确日期排在最后`:'暂无匹配档案，或此档案尚未公开。');
 }catch(e){if(token===generation){status('档案读取失败：'+e.message);$('more').hidden=true;}}finally{if(token===generation)$('more').disabled=false;}
}
async function getCategories(){const {data,error}=await client.from('tmi_categories').select('name').order('name');if(error)throw error;categories=data.map(x=>x.name);for(const id of ['category','editCategory']){const selected=$(id).value;$(id).replaceChildren();if(id==='category'){const o=el('option','全部分类');o.value='';$(id).append(o);}categories.forEach(c=>{const o=el('option',c);o.value=c;$(id).append(o);});if(categories.includes(selected)||!selected&&id==='category')$(id).value=selected;}}
function edit(row){$('recordId').value=row.id;for(const [id,key]of Object.entries({title:'title',content:'content_zh',korean:'original_ko',translation:'translation_zh',editCategory:'category',editStage:'life_stage',date:'public_date',source:'source',url:'source_url',note:'source_note'}))$(id).value=row[key]||'';$('tags').value=row.tags.join('，');$('published').checked=row.published;images=row.images.slice();$('files').value='';previewImages();$('editStatus').textContent='正在编辑 '+row.id.slice(0,8);$('admin').scrollIntoView({behavior:'smooth'});}
function reset(){if(busy)return;$('editor').reset();$('recordId').value=uuid();$('editCategory').value='其他';images=[];previewImages();$('editStatus').textContent='新档案 · 默认保存为草稿';}
function previewImages(){const box=$('previews');box.replaceChildren();images.forEach((path,i)=>{const f=el('figure'),img=el('img');img.alt='待保存图片 '+(i+1);fillImage(img,path);f.append(img,button('↑',()=>{if(i){[images[i-1],images[i]]=[images[i],images[i-1]];previewImages();}}),button('↓',()=>{if(i<images.length-1){[images[i+1],images[i]]=[images[i],images[i+1]];previewImages();}}),button('移除',()=>{images.splice(i,1);previewImages();}));box.append(f);});}
async function auth(){const {data,error}=await client.auth.getUser();admin=!error&&data.user?.id===ADMIN;$('admin').hidden=!admin;$('visibilityLabel').hidden=!admin;if(admin){$('identity').textContent='已验证管理员 · '+data.user.email;await getCategories();reset();}else{$('admin').hidden=true;$('visibility').value='published';$('previews').replaceChildren();images=[];pending=[];$('importPreview').replaceChildren();$('confirmImport').disabled=true;}await load(true);}
async function allRecords(){let all=[];for(let n=0;;n+=1000){const {data,error}=await client.from('tmi_records').select('*').order('id').range(n,n+999);if(error)throw error;all.push(...data);if(data.length<1000)return all;}}
function drawImport(){const b=$('importPreview');b.replaceChildren();pending.forEach(p=>b.append(el('p',`${p.index+1}. ${p.row?.title||p.row?.content_zh?.slice(0,35)||'无标题'} — ${p.error||p.status||'待导入'}`,p.error?'error':'')));$('confirmImport').disabled=importBusy||!pending.some(p=>!p.error&&p.status!=='成功'&&p.status!=='已有 ID，跳过');}
async function init(){
 try{if(!window.supabase||!window.TAESAN_SUPABASE_PUBLISHABLE_KEY)throw Error('连接组件未加载，请刷新页面');client=window.supabase.createClient('https://shwilnzlpychjoasvqtg.supabase.co',window.TAESAN_SUPABASE_PUBLISHABLE_KEY);await getCategories();await auth();client.auth.onAuthStateChange((event,session)=>{const next=session?.user?.id===ADMIN;if(next!==admin)setTimeout(()=>auth().catch(e=>status(e.message)),0);});}
 catch(e){status('连接失败：'+e.message);return;}
 $('manage').onclick=()=>{if(admin)$('admin').scrollIntoView({behavior:'smooth'});else $('login').showModal();};$('closeLogin').onclick=()=>$('login').close();$('closeImage').onclick=()=>$('lightbox').close();
 $('loginForm').onsubmit=async e=>{e.preventDefault();const b=$('loginForm').querySelector('button[type=submit]');b.disabled=true;try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw error;if(data.user.id!==ADMIN){await client.auth.signOut();throw Error('此账号没有管理员权限');}$('login').close();await auth();$('admin').scrollIntoView({behavior:'smooth'});}catch(err){$('loginStatus').textContent=err.message;}finally{b.disabled=false;}};
 $('logout').onclick=async()=>{await client.auth.signOut();await auth();};$('new').onclick=reset;$('reset').onclick=reset;$('more').onclick=()=>load();
 for(const id of ['category','stage','sort','visibility'])$(id).onchange=()=>load(true);$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(true),300);};
 $('files').onchange=async()=>{if(!admin||busy)return;const list=[...$('files').files];if($('source').value.trim().toUpperCase()==='DM'){alert('DM 不上传图片');$('files').value='';return;}if(list.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5242880)){alert('只支持5MB以内 JPG、PNG、WebP');return;}busy=true;$('save').disabled=true;try{for(const f of list){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[f.type],path=$('recordId').value+'/'+uuid()+'.'+ext;const {error}=await client.storage.from(BUCKET).upload(path,f,{contentType:f.type,upsert:false});if(error)throw error;images.push(path);}previewImages();$('editStatus').textContent='图片已暂存，记得保存档案';}catch(e){$('editStatus').textContent='图片上传中断：'+e.message;previewImages();}finally{busy=false;$('save').disabled=false;$('files').value='';}};
 $('editor').onsubmit=async e=>{e.preventDefault();if(!admin||busy)return;busy=true;$('save').disabled=true;try{const x=valid({id:$('recordId').value,title:$('title').value,content_zh:$('content').value,original_ko:$('korean').value,translation_zh:$('translation').value,category:$('editCategory').value,life_stage:$('editStage').value,tags:$('tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean),public_date:$('date').value,source:$('source').value,source_url:$('url').value,source_note:$('note').value,images,published:$('published').checked});const {error}=await client.from('tmi_records').upsert(x,{onConflict:'id'}).select().single();if(error)throw error;$('editStatus').textContent='已保存'+(x.published?'并公开发布':'为草稿');await load(true);}catch(err){$('editStatus').textContent='保存失败：'+err.message;}finally{busy=false;$('save').disabled=false;}};
 $('addCategory').onclick=async()=>{const name=$('newCategory').value.trim();if(!name)return;try{const {error}=await client.from('tmi_categories').insert({name});if(error)throw error;await getCategories();$('newCategory').value='';$('editCategory').value=name;}catch(e){alert('添加失败：'+e.message);}};
 $('export').onclick=async()=>{try{const data=await allRecords();const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,records:data},null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download='taesan-tmi-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){alert(e.message);}};
 $('importFile').onchange=async()=>{if(importBusy)return;try{const file=$('importFile').files[0];if(!file)return;if(file.size>5242880)throw Error('JSON 最大5MB');let input=JSON.parse(await file.text());input=Array.isArray(input)?input:input.records;if(!Array.isArray(input)||input.length>1000)throw Error('必须为 records 数组，最多1000条');const existing=await allRecords(),ids=new Set(existing.map(r=>r.id)),texts=new Set(existing.map(r=>normalized(r.content_zh)));pending=input.map((raw,index)=>{try{const row=valid(raw),key=normalized(row.content_zh);if(ids.has(row.id))return{row,index,status:'已有 ID，跳过'};if(texts.has(key))return{row,index,error:'疑似重复内容，请核对并修改文件后重新预览'};ids.add(row.id);texts.add(key);return{row,index,status:row.published?'待导入并公开发布':'待导入草稿'};}catch(e){return{index,error:e.message};}});drawImport();}catch(e){pending=[];drawImport();$('importPreview').append(el('p',e.message,'error'));}};
 $('confirmImport').onclick=async()=>{if(importBusy||!admin||!confirm('确认导入预览中有效的记录？标为发布的记录会公开显示。'))return;importBusy=true;$('importFile').disabled=true;$('cancelImport').disabled=true;drawImport();try{for(const p of pending){if(p.error||p.status==='成功'||p.status==='已有 ID，跳过')continue;const {data,error}=await client.from('tmi_records').upsert(p.row,{onConflict:'id',ignoreDuplicates:true}).select('id');p.status=error?'失败：'+error.message:data.length?'成功':'已有 ID，跳过';drawImport();}await load(true);}finally{importBusy=false;$('importFile').disabled=false;$('cancelImport').disabled=false;drawImport();}};
 $('cancelImport').onclick=()=>{if(importBusy)return;pending=[];$('importFile').value='';drawImport();};
}
document.addEventListener('DOMContentLoaded',init);
})();

