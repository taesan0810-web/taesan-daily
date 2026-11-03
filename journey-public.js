'use strict';
(() => {
 const $=id=>document.getElementById(id),BASE='https://shwilnzlpychjoasvqtg.supabase.co';
 let seed={},rows=[],locations=[],day=1,timer=null,previousCity=null,generation=0,client;
 const month=()=>$('journeyMonth').value;
 const dateFor=d=>month()+'-'+String(d).padStart(2,'0');
 const days=()=>{const [y,m]=month().split('-').map(Number);return new Date(y,m,0).getDate();};
 function allLocations(){const map=new Map();for(const row of [...(seed.locations||[]),...locations])if(row.date.startsWith(month()))map.set(row.date,row);return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));}
 function placeFor(date){return allLocations().filter(row=>row.date<=date).at(-1)||null;}
 function stop(){clearInterval(timer);timer=null;$('play').textContent='▶ 自动播放';}
 function render(n){
  day=Math.min(days(),Math.max(1,n));const date=dateFor(day),place=placeFor(date),row=rows.find(x=>x.date===date),traveler=$('traveler');
  $('date').textContent=date.slice(5).replace('-','.');$('location').textContent=place?'📍 '+place.city:'地点待补充';
  $('numbers').replaceChildren();for(const [key,icon,label]of icons){const box=document.createElement('div');box.className='num';box.innerHTML='<div class="symbol">'+icon+'</div>';const value=document.createElement('strong'),title=document.createElement('small');value.textContent=row?String(Number(row[key])||0):'—';title.textContent=label;box.append(value,title);$('numbers').append(box);}
  document.querySelectorAll('.city').forEach(el=>{const active=!!place&&el.dataset.city===place.city;el.classList.toggle('current',active);const bubble=el.querySelector('.bubble');bubble.replaceChildren();if(active){for(const [key,icon]of icons){const line=document.createElement('div');line.className='line';line.innerHTML='<span class="ico">'+icon+'</span>';const count=document.createElement('span');count.textContent=row?String(Number(row[key])||0):'—';line.append(count);bubble.append(line);}}});
  traveler.hidden=!place;if(place){if(previousCity!==place.city||!traveler.style.left){traveler.style.left=place.x+'%';traveler.style.top='31%';}previousCity=place.city;}else previousCity=null;
  document.querySelectorAll('[data-day]').forEach(button=>{const active=+button.dataset.day===day;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  const selected=$('day'+day);if(selected)$('timeline').scrollTo({left:selected.offsetLeft-$('timeline').offsetLeft-$('timeline').clientWidth/2+selected.clientWidth/2,behavior:'smooth'});
  $('prev').disabled=day===1;$('next').disabled=day===days();
 }
 function draw(){
  const [year,m]=month().split('-').map(Number),name=new Intl.DateTimeFormat('en',{month:'long'}).format(new Date(year,m-1,1)).toUpperCase();
  $('journeyTitle').textContent='TAESAN · '+name+' JOURNEY';document.title='TAESAN · '+name+' JOURNEY';$('countsLink').href='daily.html?tab=dm&month='+month();$('journeyFooter').textContent=month()+' / 每日 DM 数量记录';
  $('map').querySelectorAll('.city').forEach(el=>el.remove());const cities=new Map();for(const location of allLocations())cities.set(location.city,location);
  const known={首尔:'Seoul',北京:'Beijing',洛杉矶:'Los Angeles',达拉斯:'Dallas'};
  for(const place of cities.values()){const city=document.createElement('div');city.className='city';city.dataset.city=place.city;city.style.left=place.x+'%';const names=document.createElement('div'),en=document.createElement('div'),bubble=document.createElement('div');names.className='names';names.textContent=place.city;en.className='en';en.textContent=known[place.city]||'';bubble.className='bubble';city.append(names,en,bubble);$('map').append(city);}
  $('timeline').replaceChildren();for(let d=1;d<=days();d++){const button=document.createElement('button');button.type='button';button.id='day'+d;button.dataset.day=d;button.className='day'+(rows.some(x=>x.date===dateFor(d))?'':' missing');const number=document.createElement('b'),city=document.createElement('small');number.textContent=d;city.textContent=placeFor(dateFor(d))?.city||'待补充';button.append(number,city);button.onclick=()=>{stop();render(d);};$('timeline').append(button);}
  previousCity=null;$('traveler').style.left='';render(1);
 }
 async function load(){
  stop();const token=++generation,m=month();if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))return;
  const url=new URL(location.href);url.searchParams.set('month',m);history.replaceState(null,'',url);rows=(seed.stats||[]).filter(x=>x.date.startsWith(m));locations=[];let status=rows.length?'原版记录备份':'本月暂无数量记录';$('journeyStatus').textContent='正在读取…';
  if(client){const next=new Date(m+'-01T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const end=next.toISOString().slice(0,10);
   try{const {data,error}=await client.from('dm_stats').select('*').gte('date',m+'-01').lt('date',end).order('date');if(error)throw error;if(token!==generation)return;rows=data;status=rows.length?rows.length+' 天 DM 数量记录':'本月暂无数量记录';}catch{status=rows.length?'暂时无法连接，显示原版记录备份':'暂时无法读取本月记录';}
   try{const {data,error}=await client.from('journey_locations').select('*').gte('date',m+'-01').lt('date',end).order('date');if(!error&&token===generation)locations=data;}catch{}
  }
  if(token!==generation)return;$('journeyStatus').textContent=status;draw();
 }
 async function init(){
  try{const response=await fetch('journey-seed.json');if(response.ok)seed=await response.json();}catch{}
  if(window.supabase&&window.TAESAN_SUPABASE_PUBLISHABLE_KEY)client=window.supabase.createClient(BASE,window.TAESAN_SUPABASE_PUBLISHABLE_KEY);
  const value=new URLSearchParams(location.search).get('month');$('journeyMonth').value=/^\d{4}-(0[1-9]|1[0-2])$/.test(value||'')?value:'2026-10';
  $('journeyMonth').onchange=()=>{if($('journeyMonth').value)void load();};$('prev').onclick=()=>{stop();render(day-1);};$('next').onclick=()=>{stop();render(day+1);};$('play').onclick=()=>{if(timer){stop();return;}if(day===days())render(1);$('play').textContent='Ⅱ 暂停播放';timer=setInterval(()=>{if(day===days()){stop();return;}render(day+1);},1800);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);await load();
 }
 document.addEventListener('DOMContentLoaded',init);
})();
