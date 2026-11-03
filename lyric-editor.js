import './vendor/diff.js';
import './lyric-alignment.js';

export function install({isAdmin,getMedia,getWorkId}){
 const $=id=>document.getElementById(id),core=globalThis.LyricAlignment;
 const style=document.createElement('link');style.rel='stylesheet';style.href='lyric-editor.css';document.head.append(style);
 const panel=document.createElement('section');panel.className='lyric-tools';
 panel.innerHTML=`<div class="fields"><label>导入文字歌词<input id="lyricTextFile" type="file" accept=".txt,.lrc,text/plain"></label><label>导入至<select id="lyricImportTarget"><option value="lyricsKo">原文歌词</option><option value="lyricsZh">中文翻译</option></select></label></div>
 <div class="toolbar"><button id="splitLyrics" type="button">拆分交替双语歌词</button><select id="alignLanguage" aria-label="演唱语言"><option value="korean">韩语</option><option value="english">英语</option><option value="chinese">中文</option><option value="japanese">日语</option></select><button id="autoLyrics" type="button">自动对齐 MP4 · 测试版</button><button id="cancelAlignment" type="button" hidden>停止处理</button><button id="manualLyrics" type="button">试听校准</button></div>
 <progress id="lyricProgress" hidden></progress><p id="lyricStatus" role="status" aria-live="polite"></p>
 <video id="lyricPreview" controls playsinline preload="metadata" hidden></video><div id="lyricRows" class="lyric-rows"></div>
 <div class="toolbar"><button type="button" id="applyLyrics" disabled>应用到 LRC</button><button type="button" id="undoLyrics" disabled>撤销应用</button><button type="button" id="downloadLyrics">导出 LRC</button></div>`;
 $('lrc').closest('details').append(panel);
 const consent=document.createElement('dialog');consent.className='lyric-consent';consent.innerHTML=`<h2>本机自动对齐</h2><p>首次使用需下载约 100 MB 语音模型，建议连接 Wi-Fi。视频与歌词在本机处理，不另传识别服务。手机可能较慢，处理期间请保持页面打开。</p><p>歌唱识别可能不准确，生成结果需要试听校准。不会自动保存或覆盖现有 LRC。</p><div class="toolbar"><button type="button" id="confirmAlignment">下载并开始</button><button type="button" id="dismissAlignment">取消</button></div>`;document.body.append(consent);
 let worker,epoch=0,localMedia,localKind,previewUrl,rows=[],snapshot,undo=null,busy=false,consented=false;
 const status=text=>$('lyricStatus').textContent=text;
 const checkAdmin=()=>{if(!isAdmin())throw Error('请先登录管理员账号');};
 function setBusy(value){busy=value;$('autoLyrics').disabled=value;$('manualLyrics').disabled=value;$('cancelAlignment').hidden=!value;$('lyricProgress').hidden=!value;$('applyLyrics').disabled=value||!rows.length;}
 function stop(message){epoch++;worker?.terminate();worker=null;setBusy(false);if(message)status(message);}
 function clearPreview(){const media=$('lyricPreview');media.pause();media.removeAttribute('src');media.load();media.hidden=true;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;}
 function reset(){stop();localMedia=null;localKind=null;clearPreview();rows=[];snapshot=null;undo=null;$('undoLyrics').disabled=true;$('lyricRows').replaceChildren();$('applyLyrics').disabled=true;status('');consent.close();}
 function capture(){return {id:getWorkId(),ko:$('lyricsKo').value,zh:$('lyricsZh').value};}
 function unchanged(s){return s&&s.id===getWorkId()&&s.ko===$('lyricsKo').value&&s.zh===$('lyricsZh').value;}
 async function prepare(token){
  checkAdmin();const source=localMedia||await getMedia();if(token!==epoch)return null;if(!source)throw Error('请先选择或上传对应的 MP4 视频');
  if(source instanceof Blob&&(!source.size||source.size>52428800))throw Error('音视频文件不能为空或超过 50 MB');
  clearPreview();previewUrl=source instanceof Blob?URL.createObjectURL(source):source;
  const media=$('lyricPreview');media.hidden=false;
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>done(Error('视频读取超时，请重新选择 MP4')),30000);function done(error){clearTimeout(timeout);media.removeEventListener('loadedmetadata',loaded);media.removeEventListener('error',failed);error?reject(error):resolve();}const loaded=()=>done(),failed=()=>done(Error('浏览器无法读取此媒体，请换用带 AAC 音轨的 MP4'));media.addEventListener('loadedmetadata',loaded,{once:true});media.addEventListener('error',failed,{once:true});media.src=previewUrl;media.load();});
  if(token!==epoch)return null;if(!Number.isFinite(media.duration)||media.duration<=0||media.duration>600)throw Error('自动对齐支持 10 分钟以内的音视频，请先裁剪片段');
  return {source,duration:media.duration};
 }
 function render(){const box=$('lyricRows');box.replaceChildren();rows.forEach((row,index)=>{
  const item=document.createElement('div');item.className='lyric-row'+(row.review?' needs-review':'');
  const input=document.createElement('input');input.type='number';input.min='0';input.step='.01';input.max=String($('lyricPreview').duration||600);input.placeholder='待补点';input.value=row.time===null?'':row.time.toFixed(2);input.setAttribute('aria-label','第 '+(index+1)+' 句起始秒数');input.oninput=()=>{row.time=input.value===''?null:Number(input.value);row.review=false;item.classList.remove('needs-review');sub.textContent=row.time===null?'请补点':'已手动校准';};
  const text=document.createElement('p');text.textContent=row.text;const sub=document.createElement('small');sub.textContent=row.time===null?'未匹配，请补点':row.review?'自动结果 · 待试听':'已手动校准';text.append(sub);
  function action(label,icon,fn){const button=document.createElement('button');button.type='button';button.title=label;button.setAttribute('aria-label',label);const img=document.createElement('img');img.src='assets/'+icon+'.svg';img.alt='';img.className='lyric-icon';button.append(img);button.onclick=fn;return button;}
  item.append(input,text,action('试听第 '+(index+1)+' 句','play',()=>{const media=$('lyricPreview');media.currentTime=row.time??0;void media.play().catch(error=>status('播放失败：'+error.message));}),action('以当前播放位置标记第 '+(index+1)+' 句','timer',()=>{row.time=$('lyricPreview').currentTime;row.review=false;render();}));box.append(item);
 });$('applyLyrics').disabled=busy||!rows.length;}
 async function manual(){stop();const token=epoch;snapshot=capture();try{if(!core.lines(snapshot.ko||snapshot.zh).length)throw Error('请先填写或导入歌词');setBusy(true);const media=await prepare(token);if(!media||token!==epoch)return;
  const text=core.lines(snapshot.ko||snapshot.zh),existing=String($('lrc').value).split(/\r?\n/).map(line=>{const match=line.match(/^\[(\d+):([0-5]\d(?:\.\d+)?)\](.*)$/);return match?{time:Number(match[1])*60+Number(match[2]),text:match[3]}:null;}).filter(Boolean);
  if(!unchanged(snapshot))throw Error('歌词已变更，请重新开始校准');rows=text.map((text,index)=>({text,time:existing[index]?.text===text?existing[index].time:null,review:false}));render();status('试听已就绪 · '+rows.length+' 句');
 }catch(error){if(token===epoch)status(error.message);}finally{if(token===epoch)setBusy(false);}}
 async function start(){stop();const token=epoch;snapshot=capture();try{checkAdmin();if(!core.lines(snapshot.ko||snapshot.zh).length)throw Error('请先填写或导入歌词');setBusy(true);status('正在读取音轨…');const media=await prepare(token);if(!media||token!==epoch)return;
  const response=media.source instanceof Blob?null:await fetch(media.source);if(response&&!response.ok)throw Error('已上传的视频读取失败，请重新选择 MP4');
  const data=await (response?response.arrayBuffer():media.source.arrayBuffer());if(token!==epoch)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('此浏览器不支持音轨读取，请使用试听校准');
  const context=new Audio();let decoded;try{decoded=await context.decodeAudioData(data);}catch{throw Error('未能读取音轨，请使用带 AAC 音轨的 MP4 或试听校准');}finally{await context.close();}if(token!==epoch)return;
  const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();const audio=(await offline.startRendering()).getChannelData(0);if(token!==epoch)return;
  status('正在加载本机语音模型…');worker=new Worker(new URL('./lyric-worker.js',import.meta.url),{type:'module'});
  worker.onerror=()=>{if(token===epoch){stop();status('模型未能加载，可能是网络或内存不足。可以改用试听校准。');}};
  worker.onmessage=({data})=>{if(token!==epoch)return;if(data.type==='progress')status(data.message);else if(data.type==='error'){stop();status('自动对齐失败：'+data.message+'。可以改用试听校准。');}else if(data.type==='result'){
   try{checkAdmin();if(!unchanged(snapshot))throw Error('歌词或作品已变更，结果未应用，请重新对齐');rows=core.align(snapshot.ko||snapshot.zh,data.chunks,media.duration,globalThis.Diff.diffChars);render();const missing=rows.filter(row=>row.time===null).length;status('已处理 '+rows.length+' 句 · '+missing+' 句未匹配 · 请试听校准后应用到 LRC');}catch(error){status(error.message);}finally{stop();}
  }};worker.postMessage({audio,language:$('alignLanguage').value},[audio.buffer]);
 }catch(error){if(token===epoch){setBusy(false);status(error.message);}}}
 for(const kind of ['video','audio'])$(kind+'File').addEventListener('change',()=>{stop();localMedia=$(kind+'File').files[0]||null;localKind=kind;clearPreview();rows=[];$('lyricRows').replaceChildren();$('applyLyrics').disabled=true;});
 $('autoLyrics').onclick=()=>{try{checkAdmin();if(!core.lines($('lyricsKo').value||$('lyricsZh').value).length)throw Error('请先填写或导入歌词');if(consented)void start();else consent.showModal();}catch(error){status(error.message);}};
 $('confirmAlignment').onclick=()=>{consented=true;consent.close();void start();};$('dismissAlignment').onclick=()=>consent.close();$('cancelAlignment').onclick=()=>stop('已停止处理，原有歌词与 LRC 未改动');$('manualLyrics').onclick=manual;
 $('applyLyrics').onclick=()=>{try{checkAdmin();if(!unchanged(snapshot))throw Error('歌词已修改，请重新对齐或校准');const lrc=core.toLrc(rows,$('lyricPreview').duration);if($('lrc').value&&$('lrc').value!==lrc&&!confirm('用当前校准结果替换 LRC？原内容可以撤销恢复。'))return;undo={before:$('lrc').value,after:lrc};$('lrc').value=lrc;$('undoLyrics').disabled=false;status('已应用到 LRC，尚未保存作品');}catch(error){status(error.message);}};
 $('undoLyrics').onclick=()=>{if(!undo)return;if($('lrc').value!==undo.after){status('LRC 已再次编辑，未覆盖当前内容');return;}$('lrc').value=undo.before;undo=null;$('undoLyrics').disabled=true;status('已恢复应用前的 LRC');};
 $('downloadLyrics').onclick=()=>{if(!$('lrc').value.trim()){status('暂无可导出的 LRC');return;}const url=URL.createObjectURL(new Blob([$ ('lrc').value],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='lyrics.lrc';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('lyricTextFile').onchange=async()=>{try{checkAdmin();const file=$('lyricTextFile').files[0];if(!file)return;if(file.size>1048576)throw Error('歌词文件最大 1 MB');const work=getWorkId(),target=$('lyricImportTarget').value,text=await file.text();if(work!==getWorkId())return;if($(target).value&&!confirm('替换当前'+(target==='lyricsKo'?'原文歌词':'中文翻译')+'？'))return;stop();$(target).value=text.replace(/^\uFEFF/,'').replace(/\[\d+:\d+(?:\.\d+)?\]/g,'');status('已导入歌词，尚未保存作品');}catch(error){status(error.message);}finally{$('lyricTextFile').value='';}};
 $('splitLyrics').onclick=()=>{const all=core.lines($('lyricsKo').value);if(!all.length||all.length%2){status('交替双语歌词需按原文、译文各占一行，行数为偶数');return;}if(!confirm('按原文、译文交替拆分？将更新两个歌词输入框。'))return;stop();$('lyricsKo').value=all.filter((_,i)=>i%2===0).join('\n');$('lyricsZh').value=all.filter((_,i)=>i%2===1).join('\n');status('已拆分双语歌词，尚未保存作品');};
 window.addEventListener('taesan-auth-changed',event=>{if(!event.detail.admin)reset();});window.addEventListener('pagehide',reset);
 return {reset,clearMedia(kind){if(!['audio','video'].includes(kind))return;$(kind+'File').value='';if(kind===localKind){localMedia=null;localKind=null;}stop();clearPreview();rows=[];$('lyricRows').replaceChildren();$('applyLyrics').disabled=true;}};
}
