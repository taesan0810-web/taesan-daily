'use strict';
(() => {
const $=id=>document.getElementById(id),BASE='https://shwilnzlpychjoasvqtg.supabase.co',ADMIN='0c40000a-9f2c-46dc-8ba7-a0b016e6988e';
let stats=[],locations=[],seed={},client,admin=false,day=1,timer=null,previousCity=null,generation=0;
const localKey='taesan-journey-locations-v1';
let local=[];try{local=JSON.parse(localStorage.getItem(localKey)||'[]');if(!Array.isArray(local))local=[];}catch{}
function safe(s){try{return new URL(s).protocol==='https:';}catch{return false;}}
function monthValue(){const m=$('journeyMonth').value;return /^\d{4}-(0[1-9]|1[0-2])$/.test(m)?m:new Date().toISOString().slice(0,7);}
function dateFor(n){return monthValue()+'-'+String(n).padStart(2,'0');}
function daysInMonth(){const [y,m]=monthValue().split('-').map(Number);return new Date(y,m,0).getDate();}
function stop(){clearInterval(timer);timer=null;$('playJourney').textContent='播放';}
function mergedLocations(){const map=new Map();for(const x of [...(seed.locations||[]),...locations,...local])if(x.date.startsWith(monthValue()))map.set(x.date,x);return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function placeFor(date){return mergedLocations().filter(x=>x.date<=date).at(-1)||null;}
function render(n){
 day=Math.min(Math.max(n,1),daysInMonth());const date=dateFor(day),p=placeFor(date),row=stats.find(x=>x.date===date),avatar=$('traveler');
 $('journeyDate').textContent=date;$('journeyLocation').textContent=p?p.city:'地点待补充';
 if(p){avatar.hidden=false;if(previousCity!==p.city||!avatar.style.left)avatar.style.left=p.x+'%';previousCity=p.city;}else{avatar.hidden=true;previousCity=null;}
 $('journeyNumbers').replaceChildren();for(const [k,label]of [['text','文字'],['voice','语音'],['photos','图片'],['videos','视频']]){const box=document.createElement('div'),num=document.createElement('b'),title=document.createElement('span');num.textContent=row?String(Number(row[k])||0):'—';title.textContent=label;box.append(num,title);$('journeyNumbers').append(box);}
 document.querySelectorAll('[data-day]').forEach(b=>{b.classList.toggle('active',+b.dataset.day===day);b.setAttribute('aria-pressed',String(+b.dataset.day===day));});
 $('previousDay').disabled=day===1;$('nextDay').disabled=day===daysInMonth();$('locationDate').value=date;
}
function drawMonth(){
 const [year,m]=monthValue().split('-').map(Number);$('journeyTitle').textContent=new Intl.DateTimeFormat('en',{month:'long'}).format(new Date(year,m-1,1)).toUpperCase()+' JOURNEY';
 $('monthlyLink').href='daily.html?tab=monthly&month='+monthValue();$('journeyDays').replaceChildren();
 for(let n=1;n<=daysInMonth();n++){const b=document.createElement('button');b.dataset.day=n;b.textContent=n;b.title=dateFor(n);b.onclick=()=>{stop();render(n);};$('journeyDays').append(b);}
 const places=new Map();for(const row of mergedLocations())places.set(row.city,row);$('journeyPlaces').replaceChildren();for(const p of places.values()){const label=document.createElement('span');label.className='journey-place';label.style.left=p.x+'%';label.textContent=p.city;$('journeyPlaces').append(label);}
 previousCity=null;$('traveler').style.left='';render(1);
}
async function load(){
 stop();const token=++generation,m=monthValue(),url=new URL(location.href);url.searchParams.set('month',m);history.replaceState(null,'',url);$('journeyStatus').textContent='正在读取…';let message='';
 stats=(seed.stats||[]).filter(x=>x.date.startsWith(m));locations=[];
 if(client){const next=new Date(m+'-01T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const end=next.toISOString().slice(0,10);
 try{const {data,error}=await client.from('dm_stats').select('*').gte('date',m+'-01').lt('date',end).order('date');if(error)throw error;if(token!==generation)return;stats=data;message=data.length?'云端 DM 数量 / '+data.length+' 天':'本月暂无 DM 数量记录';}catch{message='云端读取失败'+(stats.length?' / 显示原版 October 备份':' / 暂无可用备份');}
 try{const {data,error}=await client.from('journey_locations').select('*').gte('date',m+'-01').lt('date',end).order('date');if(error)throw error;if(token!==generation)return;locations=data;}catch{message+=' / 地点使用已保存行程';}
 }else message=stats.length?'原版 October Journey 数量备份':'暂无记录';
 if(token!==generation)return;$('journeyStatus').textContent=message;drawMonth();
}
async function init(){
 try{const response=await fetch('journey-seed.json');if(response.ok)seed=await response.json();}catch{}
 if(window.supabase&&window.TAESAN_SUPABASE_PUBLISHABLE_KEY){client=window.supabase.createClient(BASE,window.TAESAN_SUPABASE_PUBLISHABLE_KEY);const {data,error}=await client.auth.getUser();admin=!error&&data.user?.id===ADMIN;}
 const m=new URLSearchParams(location.search).get('month');$('journeyMonth').value=/^\d{4}-(0[1-9]|1[0-2])$/.test(m||'')?m:new Date().toISOString().slice(0,7);
 $('journeyMonth').onchange=()=>{if($('journeyMonth').value)void load();};$('previousDay').onclick=()=>{stop();render(day-1);};$('nextDay').onclick=()=>{stop();render(day+1);};
 $('playJourney').onclick=()=>{if(timer){stop();return;}if(day===daysInMonth())render(1);$('playJourney').textContent='暂停';timer=setInterval(()=>{if(day===daysInMonth()){stop();return;}render(day+1);},1800);};
 $('journeyManage').onclick=()=>{if(admin||window.TAESAN_PREVIEW){$('locationEditor').hidden=false;$('locationEditor').scrollIntoView({behavior:'smooth'});}else location.href='daily.html?tab=manage';};
 $('locationForm').onsubmit=async e=>{e.preventDefault();try{const row={date:$('locationDate').value,city:$('city').value.trim(),x:Number($('cityX').value),source_url:$('locationSource').value.trim()};if(!row.city||row.x<8||row.x>92||row.source_url&&!safe(row.source_url))throw Error('请检查城市、位置及 HTTPS 来源链接');if(window.TAESAN_PREVIEW){local=local.filter(x=>x.date!==row.date);local.push(row);localStorage.setItem(localKey,JSON.stringify(local));$('locationStatus').textContent='已保存本机地点草稿';}else{if(!admin)throw Error('请先登录管理员');const {error}=await client.from('journey_locations').upsert(row,{onConflict:'date'});if(error)throw error;$('locationStatus').textContent='已保存云端地点';}await load();}catch(e){$('locationStatus').textContent='保存失败：'+e.message;}};
 $('exportLocations').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({locations:mergedLocations()},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='journey-'+monthValue()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);await load();
}
document.addEventListener('DOMContentLoaded',init);
})();
