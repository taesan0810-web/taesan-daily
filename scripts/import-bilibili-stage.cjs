'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseArgs}=require('node:util'),sharp=require('sharp');
const MID=383798385,SEASON=9582384,OWNER='韩东旼_TaesanSilva',ROOT=path.resolve(__dirname,'..'),SITE='https://taesan0810-web.github.io/taesan-daily/';
const NAMESPACE=Buffer.from('42a5c90ef41b4fe9bbc4484b60670f4f','hex');
function recordId(bvid){const b=crypto.createHash('sha1').update(NAMESPACE).update('bilibili-stage:'+bvid).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
function normalize(payload){
 if(payload.code!==0)throw Error('Bilibili metadata request failed: '+payload.code);
 const data=payload.data,season=data?.ugc_season;
 if(data.owner?.mid!==MID||season?.id!==SEASON||season.title!=='直拍')throw Error('Unexpected uploader or collection');
 const episodes=season.sections.flatMap(section=>section.episodes||[]),seen=new Set();
 return episodes.map(episode=>{const arc=episode.arc,bvid=episode.bvid;
  if(!/^BV[0-9A-Za-z]{10}$/.test(bvid)||seen.has(bvid))throw Error('Invalid or duplicate BV: '+bvid);seen.add(bvid);
  if(arc?.state!==0||arc.author?.mid!==MID||!arc.title?.trim()||arc.title.length>300||!Number.isFinite(arc.pubdate)||arc.pubdate<=0)throw Error('Invalid public video: '+bvid);
  const image=new URL(arc.pic);image.protocol='https:';
  if(!/^i[0-2]\.hdslb\.com$/.test(image.hostname)||!image.pathname.startsWith('/bfs/archive/'))throw Error('Unexpected cover host');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(arc.pubdate*1000));
  return {id:recordId(bvid),bvid,title:arc.title,public_date:date,published_at:arc.pubdate,category:'个人直拍',kind:'stage',source:'B站 · '+OWNER,source_url:'https://www.bilibili.com/video/'+bvid+'/',original_cover_url:image.href,cover_download_url:image.href+'@960w.webp',collection_url:`https://space.bilibili.com/${MID}/lists/${SEASON}?type=season`,tags:['B站','直拍',bvid],published:true};
 }).sort((a,b)=>b.published_at-a.published_at||a.bvid.localeCompare(b.bvid));
}
function sqlFor(records){
 const payload=JSON.stringify(records.map(r=>({id:r.id,bvid:r.bvid,title:r.title,public_date:r.public_date,source:r.source,source_url:r.source_url,cover_url:r.cover_url,tags:r.tags}))).replaceAll("'","''");
 return `BEGIN;
SET LOCAL standard_conforming_strings = on;
SELECT pg_advisory_xact_lock(hashtext('taesan:bilibili:stage:9582384'));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','0c40000a-9f2c-46dc-8ba7-a0b016e6988e',true);
WITH candidates AS (
 SELECT * FROM jsonb_to_recordset('${payload}'::jsonb) AS item(id uuid,bvid text,title text,public_date date,source text,source_url text,cover_url text,tags text[])
), added AS (
 INSERT INTO public.archive_records(id,kind,title,public_date,category,source,source_url,cover_url,tags,published)
 SELECT c.id,'stage',c.title,c.public_date,'个人直拍',c.source,c.source_url,c.cover_url,c.tags,true FROM candidates c
 WHERE NOT EXISTS (SELECT 1 FROM public.archive_records old WHERE old.id=c.id OR (old.kind='stage' AND (old.source_url=c.source_url OR substring(old.source_url FROM '(BV[0-9A-Za-z]{10})')=c.bvid)))
 ON CONFLICT (id) DO NOTHING RETURNING id
)
SELECT jsonb_build_object('candidates',(SELECT count(*) FROM candidates),'inserted',(SELECT count(*) FROM added),'skipped',(SELECT count(*) FROM candidates)-(SELECT count(*) FROM added)) AS import_result;
COMMIT;
`;
}
async function main(){
 const {values}=parseArgs({options:{input:{type:'string'},'download-covers':{type:'boolean',default:false},sql:{type:'string'}}});
 if(!values.input)throw Error('Pass --input with public video API JSON. This script only prepares files/SQL, never writes to Supabase.');
 const records=normalize(JSON.parse(fs.readFileSync(values.input,'utf8'))),folder=path.join(ROOT,'assets/stage/bilibili');fs.mkdirSync(folder,{recursive:true});
 if(values['download-covers']){
  let next=0,completed=0;
  async function download(){while(next<records.length){const r=records[next++];const response=await fetch(r.cover_download_url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(r.bvid+' cover HTTP '+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>5242880)throw Error('Invalid cover size: '+r.bvid);
   const meta=await sharp(bytes).metadata(),ext={jpeg:'jpg',png:'png',webp:'webp'}[meta.format];if(!ext||!meta.width||!meta.height)throw Error('Invalid bitmap: '+r.bvid);
   r.cover_path=`assets/stage/bilibili/${r.bvid}.${ext}`;r.cover_url=SITE+r.cover_path;r.cover_sha256=crypto.createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(ROOT,r.cover_path),bytes);
   if(++completed%20===0||completed===records.length)console.log(`Covers ${completed}/${records.length}`);
  }}
  await Promise.all([download(),download(),download(),download()]);
  const backup=path.join(ROOT,'work/bilibili-cover-originals');fs.mkdirSync(backup,{recursive:true});
  for(const r of records)for(const ext of ['jpg','png']){const file=path.join(folder,r.bvid+'.'+ext);if(file!==path.join(ROOT,r.cover_path)&&fs.existsSync(file))fs.renameSync(file,path.join(backup,path.basename(file)));}
 }else for(const r of records){const file=fs.readdirSync(folder).find(name=>name.startsWith(r.bvid+'.'));if(!file)throw Error('Missing cover: '+r.bvid);r.cover_path='assets/stage/bilibili/'+file;r.cover_url=SITE+r.cover_path;r.cover_sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,file))).digest('hex');}
 const manifest={uploader:OWNER,mid:MID,season_id:SEASON,collection:'直拍',captured_at:new Date().toISOString(),total:records.length,date_basis:'Bilibili pubdate, Asia/Shanghai',records};
 fs.mkdirSync(path.join(ROOT,'data'),{recursive:true});fs.writeFileSync(path.join(ROOT,'data/bilibili-stage-9582384.json'),JSON.stringify(manifest,null,2)+'\n');
 if(values.sql){fs.mkdirSync(path.dirname(values.sql),{recursive:true});fs.writeFileSync(values.sql,sqlFor(records));}
 console.log(JSON.stringify({records:records.length,covers:records.length,bytes:records.reduce((sum,r)=>sum+fs.statSync(path.join(ROOT,r.cover_path)).size,0),date_range:[records.at(-1)?.public_date,records[0]?.public_date],sql_prepared:!!values.sql}));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={normalize,recordId,sqlFor};
