'use strict';
(() => {
const ADMIN='0c40000a-9f2c-46dc-8ba7-a0b016e6988e',BASE='https://shwilnzlpychjoasvqtg.supabase.co',TABLE='archive_records',BUCKET='archive-images';
const definitions={thoughts:{title:'想法',subtitle:'想法 / 采访 / 公开文字',parent:'self',categories:['采访','Behind','直播','其他公开内容']},fragments:{title:'片段',subtitle:'故事 / 习惯 / 喜好 / 人物细节',parent:'self',categories:['小故事','习惯','喜好','人物细节']},stage:{title:'舞台',subtitle:'舞台与直拍',parent:'work',categories:['个人直拍','BOYNEXTDOOR 团体舞台','个人及队外合作舞台']},shorts:{title:'短视频',subtitle:'SOLO TIKTOK / SPECIAL TIKTOK',parent:'work',categories:['单人 TikTok','Special TikTok']}};
const kind=document.body.dataset.module,cfg=definitions[kind],$=id=>document.getElementById(id),make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const key='taesan-archive-drafts-v1-'+kind;
let client,admin=false,cloud=[],drafts=[],images=[],busy=false,loadToken=0,visible=24,available=false,loadFailed=false,legacy=[];
const safe=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const action=(text,fn)=>{const b=make('button',text);b.type='button';b.onclick=fn;return b;};
const note=s=>{$('status').textContent=s;};
function readDrafts(){try{const value=JSON.parse(localStorage.getItem(key)||'[]');drafts=Array.isArray(value)?value:[];}catch{drafts=[];note('本机草稿无法读取，请检查浏览器存储权限。');}}
function writeDrafts(){localStorage.setItem(key,JSON.stringify(drafts));}
function checkDate(s){return !s||(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s);}
function formValue(){
 const date=$('date').value;if(!checkDate(date))throw Error('日期无效');
 const title=$('title').value.trim();if(!title)throw Error('请填写标题');
 for(const id of ['sourceUrl','coverUrl'])if($(id).value&&!safe($(id).value))throw Error('链接必须使用 HTTPS');
 const urls=$('imageUrls').value.split('\n').map(s=>s.trim()).filter(Boolean);if(urls.some(u=>!safe(u)))throw Error('图片链接必须使用 HTTPS');
 if(!cfg.categories.includes($('editCategory').value))throw Error('请选择有效分类');
 return {id:$('recordId').value,kind,title,public_date:date||null,category:$('editCategory').value,content_zh:$('content').value.trim(),original_ko:$('korean').value.trim(),event_name:$('event').value.trim(),collaborators:$('collaborators').value.trim(),source:$('source').value.trim(),source_url:$('sourceUrl').value.trim(),cover_url:$('coverUrl').value.trim(),image_urls:urls,images:images.slice(),tags:$('tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean).slice(0,40),published:$('published').checked};
}
function reset(){if(busy)return;$('editor').reset();$('recordId').value=crypto.randomUUID();images=[];renderImages();$('editStatus').textContent='新档案';}
function edit(row){if(busy)return;reset();for(const [id,col]of Object.entries({recordId:'id',title:'title',date:'public_date',editCategory:'category',content:'content_zh',korean:'original_ko',event:'event_name',collaborators:'collaborators',source:'source',sourceUrl:'source_url',coverUrl:'cover_url'}))$(id).value=row[col]||'';$('tags').value=(row.tags||[]).join(', ');$('imageUrls').value=(row.image_urls||[]).join('\n');$('published').checked=row.published;images=[...(row.images||[])];renderImages();$('editorPanel').hidden=false;$('editorPanel').scrollIntoView({behavior:'smooth'});}
function renderImages(){const box=$('uploadedImages');box.replaceChildren();images.forEach((path,i)=>box.append(action('移除图片 '+(i+1),()=>{images.splice(i,1);renderImages();})));}
async function signed(img,path){try{const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,300);if(error)throw error;img.src=data.signedUrl;}catch{img.alt='图片暂时无法读取';}}
function draw(row,local=false){
 const article=make('article',undefined,'archive-record');article.append(make('div',(row.public_date||'日期待补充')+' / '+row.category+(local?' / 本机草稿':row.published?'':' / 云端草稿'),'meta'));
 if(safe(row.cover_url)){const img=make('img');img.src=safe(row.cover_url);img.alt=row.title+' 封面';img.loading='lazy';img.className='cover';article.append(img);}
 article.append(make('h2',row.title));if(row.event_name)article.append(make('p',row.event_name,'meta'));if(row.collaborators)article.append(make('p','合作 / '+row.collaborators,'meta'));if(row.content_zh)article.append(make('p',row.content_zh));if(row.original_ko){const ko=make('blockquote',row.original_ko);ko.lang='ko';article.append(ko);}
 const photos=make('div',undefined,'photos');for(const u of row.image_urls||[])if(safe(u)){const img=make('img');img.src=safe(u);img.alt=row.title;img.loading='lazy';photos.append(img);}for(const p of row.images||[]){const img=make('img');img.alt=row.title;img.loading='lazy';photos.append(img);if(client)void signed(img,p);}if(photos.childElementCount)article.append(photos);
 const tags=make('div',undefined,'archive-tags');for(const t of row.tags||[])tags.append(make('span','#'+t));article.append(tags);
 if(safe(row.source_url)){const a=make('a',(row.source||'官方来源')+' ↗');a.href=safe(row.source_url);a.target='_blank';a.rel='noopener noreferrer';article.append(a);}
 if(row.legacy&&window.TAESAN_WORKSPACE){const a=make('a','原始记录管理 ↗');a.href='admin.html?module=daily';a.target='_top';article.append(a);}else if(!row.legacy&&window.TAESAN_WORKSPACE&&(admin||local)){const actions=make('div',undefined,'archive-actions');actions.append(action('编辑',()=>edit(row)));if(local)actions.append(action('删除本机草稿',()=>{if(!confirm('删除这份本机草稿？'))return;drafts=drafts.filter(x=>x.id!==row.id);writeDrafts();render();}));else actions.append(action('删除',async()=>{if(window.TAESAN_PREVIEW){$('editStatus').textContent='预览版禁止修改生产数据';return;}if(!confirm('确定删除这条档案？'))return;try{const {error}=await client.from(TABLE).delete().eq('id',row.id).eq('kind',kind);if(error)throw error;await load();}catch(e){note('删除失败：'+e.message);}}));article.append(actions);}return article;
}
function render(){
 const word=$('search').value.trim().toLowerCase(),cat=$('category').value;
 const all=[...cloud.map(row=>({row,local:false})),...legacy.map(row=>({row,local:false})),...drafts.map(row=>({row,local:true}))].filter(({row})=>(!cat||row.category===cat)&&(!word||[row.title,row.content_zh,row.original_ko,row.event_name,row.collaborators,...(row.tags||[])].join(' ').toLowerCase().includes(word))).sort((a,b)=>{const date=(a.row.public_date||'').localeCompare(b.row.public_date||'');return ($('sort').value==='asc'?date:-date)||a.row.id.localeCompare(b.row.id);});
 $('records').replaceChildren();all.slice(0,visible).forEach(({row,local})=>$('records').append(draw(row,local)));$('more').hidden=all.length<=visible;
 if(loadFailed)note('云端读取失败，请重试。当前仅展示可读取的本机草稿。');else if(available)note(all.length?`${Math.min(all.length,visible)} / ${all.length} 份档案`:'暂无匹配档案');else note('此模块尚未启用云端数据。');
 if(!all.length)$('records').append(make('p',available?'暂无匹配档案。':'档案待整理。'));
}
async function load(){const token=++loadToken;note('正在读取档案…');if(!client){render();return;}try{let all=[];for(let start=0;;start+=100){let q=client.from(TABLE).select('*').eq('kind',kind);if(!admin)q=q.eq('published',true);const {data,error}=await q.order('public_date',{ascending:false,nullsFirst:false}).order('id').range(start,start+99);if(error)throw error;all.push(...data);if(data.length<100)break;}if(token!==loadToken)return;cloud=all;available=true;loadFailed=false;}catch(e){if(token!==loadToken)return;available=false;loadFailed=!['PGRST205','42P01'].includes(e.code);cloud=[];}render();}
async function auth(){if(!client)return;const {data,error}=await client.auth.getUser();admin=!!window.TAESAN_WORKSPACE&&!error&&data.user?.id===ADMIN;$('logout').hidden=!admin;$('saveCloud').disabled=!!window.TAESAN_PREVIEW||!admin;$('files').disabled=!!window.TAESAN_PREVIEW||!admin;$('editorPanel').hidden=!window.TAESAN_WORKSPACE||(!admin&&!window.TAESAN_PREVIEW);await load();}
async function init(){
 document.title=cfg.title+' / TAESAN PERSONAL ARCHIVE';$('moduleTitle').textContent=cfg.title;$('moduleSubtitle').textContent=cfg.subtitle;$('parent').textContent='← '+cfg.parent.toUpperCase();$('parent').href=cfg.parent+'.html';
 const video=['stage','shorts'].includes(kind);$('koreanLabel').hidden=video;$('eventLabel').hidden=kind!=='stage';$('collaboratorsLabel').hidden=kind!=='shorts';$('content').required=!video;
 for(const id of ['category','editCategory']){if(id==='category'){const o=make('option','全部分类');o.value='';$(id).append(o);}for(const c of cfg.categories){const o=make('option',c);o.value=c;$(id).append(o);}}
 if(window.TAESAN_WORKSPACE)readDrafts();reset();$('editorPanel').hidden=!window.TAESAN_WORKSPACE||!window.TAESAN_PREVIEW;$('saveCloud').disabled=true;$('files').disabled=true;
 $('manage').onclick=()=>{if(window.TAESAN_PREVIEW||admin){$('editorPanel').hidden=false;$('editorPanel').scrollIntoView({behavior:'smooth'});}else $('login').showModal();};
 $('closeLogin').onclick=()=>$('login').close();$('newRecord').onclick=reset;$('cancel').onclick=reset;
 for(const id of ['search','category','sort'])$(id).addEventListener(id==='search'?'input':'change',()=>{visible=24;render();});$('more').onclick=()=>{visible+=24;render();};
 $('saveLocal').onclick=()=>{try{if(!$('editor').reportValidity())return;const row=formValue();drafts=drafts.filter(r=>r.id!==row.id);drafts.push(row);writeDrafts();render();$('editStatus').textContent='已保存本机草稿，尚未写入云端';}catch(e){$('editStatus').textContent='保存失败：'+e.message;}};
 $('editor').onsubmit=async e=>{e.preventDefault();if(busy||window.TAESAN_PREVIEW||!admin)return;busy=true;$('saveCloud').disabled=true;try{const row=formValue();if(['stage','shorts'].includes(kind)&&!safe(row.source_url))throw Error('请填写官方视频来源链接');const {error}=await client.from(TABLE).upsert(row,{onConflict:'id'}).select().single();if(error)throw error;drafts=drafts.filter(r=>r.id!==row.id);writeDrafts();await load();$('editStatus').textContent='已保存到云端';}catch(e){$('editStatus').textContent='保存失败：'+e.message;}finally{busy=false;$('saveCloud').disabled=false;}};
 $('files').onchange=async()=>{if(busy||window.TAESAN_PREVIEW||!admin)return;busy=true;$('saveCloud').disabled=true;try{const files=[...$('files').files];if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5242880))throw Error('仅支持 5MB 内 JPG、PNG、WebP');for(const f of files){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[f.type],path=$('recordId').value+'/'+crypto.randomUUID()+'.'+ext;const {error}=await client.storage.from(BUCKET).upload(path,f,{contentType:f.type,upsert:false});if(error)throw error;images.push(path);renderImages();}$('editStatus').textContent='图片已暂存，请保存档案';}catch(e){$('editStatus').textContent='上传失败：'+e.message;}finally{busy=false;$('files').value='';$('saveCloud').disabled=false;}};
 $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,kind,records:cloud,drafts},null,2)],{type:'application/json'})),a=make('a');a.href=url;a.download='taesan-'+kind+'-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('loginForm').onsubmit=async e=>{e.preventDefault();try{if(!client)throw Error('连接组件未加载');const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw error;if(data.user.id!==ADMIN){await client.auth.signOut();throw Error('此账号没有管理员权限');}$('login').close();await auth();}catch(e){$('loginStatus').textContent=e.message;}};
 $('logout').onclick=async()=>{await client.auth.signOut();await auth();};
 window.addEventListener('taesan-auth-changed',()=>{void auth();});
 if(window.supabase&&window.TAESAN_SUPABASE_PUBLISHABLE_KEY){client=window.supabase.createClient(BASE,window.TAESAN_SUPABASE_PUBLISHABLE_KEY);client.auth.onAuthStateChange(()=>setTimeout(()=>auth().catch(e=>note(e.message)),0));
 if(kind==='shorts'){try{let rows=[];for(let from=0;;from+=100){const {data,error}=await client.from('entries').select('*').eq('platform','TikTok').order('date',{ascending:false}).order('id').range(from,from+99);if(error)throw error;rows.push(...data);if(data.length<100)break;}legacy=rows.map(r=>({id:r.id,kind,title:r.title,public_date:r.date,category:'待分类 / 原有 TikTok',content_zh:r.summary,source_url:safe(r.official)||safe(r.weibo),cover_url:(r.photos||[])[0]||r.photo||'',image_urls:r.photos||[],tags:[],legacy:true}));}catch{note('原有 TikTok 记录暂时无法读取');}}
 await auth();}else render();
}
document.addEventListener('DOMContentLoaded',init);
})();
