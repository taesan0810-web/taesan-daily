// Keep legacy records available to management and photo archives.
const publicPlatforms=['Weverse','Weverse Post','Weverse 回复','Weverse Reply','Weverse Live','成员推 / X','X','Instagram'];
const publicEntries=()=>entries().filter(x=>publicPlatforms.includes(x.platform)&&!/^DM$/i.test(x.kind||''));
const platformName=x=>isWeverseReply(x)?'Weverse Reply':x.platform==='Weverse'?'Weverse Post':x.platform==='成员推 / X'?'X':x.platform;
function publicFilter(list,value){return value==='全部平台'?list:list.filter(x=>platformName(x)===value);}
function renderPublicDaily(){
 const day=publicEntries().filter(x=>x.date===chosen),dm=dms().find(x=>x.date===chosen);
 stats($('dayStats'),[[day.length,'公开营业条目'],[['text','voice','photos','videos'].reduce((s,k)=>s+(Number(dm?.[k])||0),0),'DM 条数'],[day.filter(x=>!isWeverseReply(x)).reduce((s,x)=>s+(Number(x.photo_count)||0),0)+(Number(dm?.photos)||0),'图片'],[day.reduce((s,x)=>s+(Number(x.video_count)||0),0)+(Number(dm?.videos)||0),'视频']]);
 const list=$('dailyList');list.replaceChildren();const rows=publicFilter(day,$('dayPlatform').value).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
 if(!rows.length)list.append(make('p','这一天暂无公开营业记录。','tiny'));rows.forEach(x=>list.append(record(x)));renderCalendar();
}
function renderPublicMonth(){
 const rows=publicFilter(publicEntries().filter(x=>x.date.startsWith(month)),$('monthPlatform').value),dm=dms().filter(x=>x.date.startsWith(month));
 $('monthTitle').textContent=month+' / MONTHLY ARCHIVE';
 const active=new Set([...rows.map(x=>x.date),...dm.filter(x=>['text','voice','photos','videos'].some(k=>Number(x[k])>0)).map(x=>x.date)]);
 stats($('monthStats'),[[rows.length,'公开营业条目'],[active.size,'营业日期（含 DM）'],[rows.filter(x=>platformName(x)==='Weverse Post').length,'Weverse Post'],[rows.filter(isWeverseReply).length,'Weverse Reply']]);
 const box=$('monthList');box.replaceChildren();const links=make('div',undefined,'archive-actions');
 for(const [label,url]of [['DM JOURNEY','journey.html?month='+month],['PHOTO WALL','daily.html?tab=photos&month='+month],['DM COUNTS','daily.html?tab=dm&month='+month]]){const a=make('a',label+' ↗');a.href=url;links.append(a);}box.append(links);
 const dates=[...new Set(rows.map(x=>x.date))].sort();if(!dates.length)box.append(make('p','这个月暂无公开营业记录。','tiny'));
 for(const date of dates){const group=make('details',undefined,'dateblock'),summary=make('summary',date+' / '+rows.filter(x=>x.date===date).length+' 条');group.append(summary);rows.filter(x=>x.date===date).forEach(row=>group.append(record(row)));box.append(group);}
}
renderDaily=renderPublicDaily;renderMonth=renderPublicMonth;
for(const id of ['dayPlatform','monthPlatform']){const select=$(id);select.replaceChildren();for(const value of ['全部平台','Weverse Post','Weverse Reply','Weverse Live','X','Instagram']){const o=make('option',value);o.value=value;select.append(o);}}
$('dayPlatform').onchange=renderDaily;$('monthPlatform').onchange=renderMonth;
$('dayPicker').onchange=e=>{if(!e.target.value)return;chosen=e.target.value;calMonth=chosen.slice(0,7);renderDaily();};
$('monthPicker').onchange=e=>{if(!e.target.value)return;month=e.target.value;renderMonth();};
document.querySelector('.brand').textContent='DAILY / THE DAYS';
document.querySelector('.hero').innerHTML='<div class="eyebrow">03 / THE DAYS</div><h1>DAILY ARCHIVE</h1><div>每天的公开记录</div>';
const names={daily:'DAILY LOG',monthly:'MONTHLY ARCHIVE',dm:'DM COUNTS',photos:'PHOTO WALL',yearly:'YEARLY',manage:'管理'};
document.querySelectorAll('#tabs button').forEach(b=>{b.textContent=names[b.dataset.tab]||b.textContent;});
const journey=make('a','DM JOURNEY ↗');journey.href='journey.html';journey.className='journey-nav';journey.style.cssText='padding:10px 13px;text-decoration:none';$('tabs').insertBefore(journey,$('tabs').children[2]);
document.querySelectorAll('.tmi-nav,.music-nav').forEach(a=>a.remove());
const originalTab=tab;
tab=function(name){originalTab(name);if(name!=='music'){const url=new URL(location.href);url.searchParams.set('tab',name);history.replaceState(null,'',url);}};
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$('manageBtn').onclick=()=>tab('manage');
function applyDailyLocation(){const p=new URLSearchParams(location.search),m=p.get('month');if(/^\d{4}-(0[1-9]|1[0-2])$/.test(m||'')){month=m;calMonth=m;for(const id of ['monthPicker','photoMonth','dmMonth'])$(id).value=m;}const name=p.get('tab')||location.hash.slice(1);if(Object.hasOwn(names,name))originalTab(name);render();}
applyDailyLocation();
const managementLinks=make('nav',undefined,'archive-actions');managementLinks.setAttribute('aria-label','档案管理入口');
for(const [label,path]of [['THOUGHTS','thoughts.html'],['FRAGMENTS','fragments.html'],['STAGE','stage.html'],['SHORT VIDEOS','short-videos.html'],['TMI','tmi.html'],['MUSIC','music.html'],['JOURNEY','journey.html']]){const a=make('a',label+' ↗');a.href=path;managementLinks.append(a);}
$('manage').prepend(managementLinks);
