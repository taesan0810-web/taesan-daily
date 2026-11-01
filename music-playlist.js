'use strict';
window.PlaylistFeature={install({getClient,getAdmin,onRows=()=>{}}){
const $=id=>document.getElementById(id);let musicRows=[],editingMusicId=null;
const make=(tag,text,cls)=>{let n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function requireAdmin(){if(!getAdmin()||!getClient())throw Error('请先用管理员账号登录');}
function link(box,label,url){if(!url||!/^https:\/\//i.test(url))return;let a=make('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}
function safeMusicLink(v){try{let u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}}
let musicCoverFallbacks=new Map();
let musicCoverFallbackError='';
const musicCoverKey=x=>JSON.stringify([x.title,x.artist]);
async function loadMusicCoverFallbacks(){
 try{
  const response=await fetch('./album-cover-data.json',{cache:'no-cache'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('封面数据格式异常');
  musicCoverFallbacks=new Map(rows.filter(x=>x.selected===true&&safeMusicLink(x.cover_url)).map(x=>[musicCoverKey(x),x.cover_url]));
  musicCoverFallbackError='';
 }catch(e){musicCoverFallbackError='备用封面数据加载失败：'+e.message}
}
function musicCover(row){
 // Preserve database artwork; use previous approved selections only for empty fields.
 const raw=typeof row.cover_url==='string'?row.cover_url.trim():'';
 return raw?safeMusicLink(raw):safeMusicLink(musicCoverFallbacks.get(musicCoverKey(row)));
}
function musicCoverElement(x){
 const box=make('div',undefined,'music-cover-box');
 const cover=musicCover(x);
 if(!cover){
  box.append(make('div',x.cover_url?'封面地址无效':'暂无封面','music-cover-placeholder'));
  return box;
 }
 const img=make('img');img.className='music-cover';img.alt=(x.album||x.title)+' 专辑封面';
 img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
 const message=make('div','封面加载中…','music-cover-status');
 const retry=make('button','重试','smallbtn');retry.type='button';retry.hidden=true;
 const original=make('a','打开封面原图','music-cover-original');original.href=cover;original.target='_blank';original.rel='noopener noreferrer';original.hidden=true;
 img.onload=()=>{message.textContent='';retry.hidden=true;original.hidden=true;img.hidden=false};
 img.onerror=()=>{img.hidden=true;message.textContent='封面加载失败，请重试或打开原图';retry.hidden=false;original.hidden=false};
 retry.onclick=()=>{message.textContent='正在重试封面…';retry.hidden=true;original.hidden=true;img.hidden=false;img.removeAttribute('src');img.src=cover};
 img.src=cover;box.append(img,message,retry,original);return box;
}
function renderMusic(){
 const box=$('musicList');box.replaceChildren();
 let q=($('musicSearch').value||'').trim().toLowerCase();
 let a=musicRows.filter(x=>(x.title+' '+x.artist+' '+x.album).toLowerCase().includes(q));
 const sort=$('musicSort')?.value;if(sort)a.sort((x,y)=>{if(!x.recommended_date)return y.recommended_date?1:0;if(!y.recommended_date)return -1;return x.recommended_date.localeCompare(y.recommended_date)*(sort==='asc'?1:-1)});
 const missing=a.filter(x=>!musicCover(x)).length;
 $('musicTotal').textContent=`${a.length} / ${musicRows.length} 首 · ${missing} 首暂无可用封面`+(musicCoverFallbackError?' · '+musicCoverFallbackError:'');
 if(!a.length){box.append(make('p','暂无匹配歌曲。','tiny'));return}
 a.forEach(x=>{
  let row=make('article',undefined,'record music-track');row.append(musicCoverElement(x));
  let info=make('div',undefined,'music-info');info.append(make('h3',x.title+' · '+x.artist));
  if(x.album)info.append(make('div','专辑：'+x.album,'tiny'));
  info.append(make('div',x.recommended_date?`推荐日期：${x.recommended_date}`:'推荐日期待补充','tiny'));
  if(!x.source_url)info.append(make('div','原帖来源待补充','tiny'));
  let links=make('div',undefined,'links');let qq=safeMusicLink(x.qq_url);
  if(qq&&/^https:\/\/(?:y\.qq\.com|c\.y\.qq\.com|c6\.y\.qq\.com)\//i.test(qq))link(links,'🎵 QQ 音乐',qq);
  link(links,'🎧 Spotify',safeMusicLink(x.spotify_url));link(links,'↗ 推荐原帖',safeMusicLink(x.source_url));
  info.append(links);if(x.notes)info.append(make('p',x.notes));row.append(info);box.append(row);
 })
}
function renderMusicManage(){let box=$('musicManageList');box.replaceChildren();if(!getAdmin())return;$('musicManageStatus').textContent=`共 ${musicRows.length} 首，可编辑、删除或新增`;musicRows.forEach(x=>{let row=make('div',x.title+' · '+x.artist,'record');let edit=make('button','编辑','smallbtn');edit.onclick=()=>{editingMusicId=x.id;let fields={musicTitle:'title',musicArtist:'artist',musicAlbum:'album',musicCover:'cover_url',musicQQ:'qq_url',musicSpotify:'spotify_url',musicDate:'recommended_date',musicPlatform:'source_platform',musicSource:'source_url',musicNotes:'notes'};Object.entries(fields).forEach(([id,key])=>$(id).value=x[key]||'');$('musicCoverFile').value='';updateMusicCoverPreview();$('musicCoverUploadStatus').textContent='可从相册选择新封面上传';$('musicForm').scrollIntoView({behavior:'smooth'})};let del=make('button','删除','smallbtn');del.onclick=async()=>{if(!confirm(`确定删除 ${x.title}？`))return;try{requireAdmin();let {error}=await getClient().from('music_tracks').delete().eq('id',x.id);if(error)throw error;await refreshMusic()}catch(e){alert('删除失败：'+e.message)}};row.append(' ',edit,del);box.append(row)})}
function resetMusicForm(){editingMusicId=null;$('musicForm').reset();$('musicCoverFile').value='';$('musicCoverUploadStatus').textContent='选择 JPG、PNG 或 WebP，单张不超过 5 MB；iPhone HEIC 请先转成 JPG。';updateMusicCoverPreview()}
function updateMusicCoverPreview(){const url=safeMusicLink($('musicCover').value.trim()),img=$('musicCoverPreview');if(url){img.src=url;img.classList.remove('hidden')}else{img.removeAttribute('src');img.classList.add('hidden')}}
$('musicCover').addEventListener('input',updateMusicCoverPreview);
$('musicCoverUpload').onclick=async()=>{
 const file=$('musicCoverFile').files?.[0];if(!file){alert('请先选择一张专辑封面图片');return}
 try{requireAdmin()}catch(e){alert(e.message);return}
 const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(!types[file.type]){alert('目前支持 JPG、PNG、WebP。iPhone 的 HEIC 图片请先转换为 JPG。');return}
 if(file.size>5*1024*1024){alert('封面超过 5 MB，请先压缩图片');return}
 const btn=$('musicCoverUpload'),hint=$('musicCoverUploadStatus');btn.disabled=true;hint.textContent='正在上传封面，请稍候…';
 try{
  const uid=crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const path='entries/album-covers/'+uid+'.'+types[file.type];
  const {error}=await getClient().storage.from('daily-photos').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
  const {data}=getClient().storage.from('daily-photos').getPublicUrl(path);if(!data?.publicUrl)throw Error('没有生成公开图片地址');
  $('musicCover').value=data.publicUrl;updateMusicCoverPreview();$('musicCoverFile').value='';
  hint.textContent='✅ 封面上传成功！请继续点击「♡ 保存歌曲」，封面才会关联到这首歌。';
 }catch(e){hint.textContent='上传失败：'+e.message;alert('封面上传失败：'+e.message+'。如提示权限不足，请检查 daily-photos 的 Storage 上传权限。')}finally{btn.disabled=false}
};
$('musicCancel').onclick=resetMusicForm;
$('musicSearch').oninput=renderMusic;
$('musicForm').onsubmit=async e=>{e.preventDefault();let btn=$('musicSave');btn.disabled=true;try{requireAdmin();let qq=safeMusicLink($('musicQQ').value.trim()),spotify=safeMusicLink($('musicSpotify').value.trim());if(!qq&&!spotify)throw Error('请至少填写一个有效的 HTTPS 播放链接');let id=editingMusicId||((crypto.randomUUID&&crypto.randomUUID())||'song-'+Date.now());let x={id,title:$('musicTitle').value.trim(),artist:$('musicArtist').value.trim(),album:$('musicAlbum').value.trim(),cover_url:safeMusicLink($('musicCover').value.trim()),qq_url:qq,spotify_url:spotify,recommended_date:$('musicDate').value||null,source_platform:$('musicPlatform').value.trim(),source_url:safeMusicLink($('musicSource').value.trim()),notes:$('musicNotes').value.trim()};let {error}=await getClient().from('music_tracks').upsert(x,{onConflict:'id'});if(error)throw error;resetMusicForm();await refreshMusic();alert('歌曲已保存 ♡')}catch(e){alert('保存失败：'+e.message)}finally{btn.disabled=false}};
async function refreshMusic(){if(!getClient())return;try{
 await loadMusicCoverFallbacks();
 let all=[],pageSize=50;
 // Small explicit pages also work when PostgREST's server row cap is below 1000.
 for(let from=0;;from+=pageSize){
  let {data,error}=await getClient().from('music_tracks').select('*').order('title',{ascending:true}).order('id',{ascending:true}).range(from,from+pageSize-1);
  if(error)throw error;if(!Array.isArray(data))throw Error('音乐数据格式异常');
  all.push(...data);if(data.length===0)break;
 }
 musicRows=all;onRows(all);renderMusic();renderMusicManage();
 }catch(e){$('musicTotal').textContent='音乐数据尚未连接：'+e.message}}


if($('musicSort'))$('musicSort').onchange=renderMusic;return {renderMusic,renderMusicManage,refreshMusic};}};

