(function(root){
 'use strict';
 const normalize=text=>String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const lines=text=>String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 function align(text,chunks,duration,diff){
  const source=lines(text),owners=[],times=[];let expected='',heard='';
  source.forEach((line,index)=>{const value=normalize(line);expected+=value;for(let n=0;n<value.length;n++)owners.push(index);});
  for(const chunk of chunks){const time=chunk.timestamp?.[0],value=normalize(chunk.text);if(!Number.isFinite(time)||time<0||time>duration)continue;heard+=value;for(let n=0;n<value.length;n++)times.push(time);}
  if(expected.length>15000||heard.length>25000)throw Error('歌词过长，请分段对齐');
  const matches=source.map(()=>[]);let a=0,b=0;
  for(const part of diff(expected,heard,{timeout:4000})||[]){if(part.added)b+=part.value.length;else if(part.removed)a+=part.value.length;else{for(let n=0;n<part.value.length;n++)matches[owners[a+n]].push({offset:a+n,time:times[b+n]});a+=part.value.length;b+=part.value.length;}}
  let start=0;
  return source.map((text,index)=>{const size=normalize(text).length,found=matches[index],coverage=size?found.length/size:0;
   // Only retain an observed timestamp when the beginning and most of the line matched.
   const first=found[0],usable=coverage>=.55&&first&&first.offset-start<=Math.max(1,size*.2);
   start+=size;return {text,time:usable?first.time:null,coverage,review:true};
  });
 }
 function stamp(time){const cs=Math.round(time*100);return String(Math.floor(cs/6000)).padStart(2,'0')+':'+String(Math.floor(cs/100)%60).padStart(2,'0')+'.'+String(cs%100).padStart(2,'0');}
 function toLrc(rows,duration){let last=-1;return rows.map(row=>{if(!Number.isFinite(row.time)||row.time<0||row.time>duration||row.time<last)throw Error('请补齐时间，并按歌词顺序校准时间点');last=row.time;return '['+stamp(row.time)+']'+row.text;}).join('\n');}
 const api={normalize,lines,align,stamp,toLrc};if(typeof module!=='undefined')module.exports=api;else root.LyricAlignment=api;
})(typeof globalThis!=='undefined'?globalThis:this);
