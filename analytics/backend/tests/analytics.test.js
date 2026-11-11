import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {summary,reportPlan} from '../src/reporting.js';
import worker from '../src/worker.js';
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 return {sql,prepare(query){return {bind(...params){return {async run(){return sql.prepare(query).run(...params)},async all(){return {results:sql.prepare(query).all(...params)}}}}}},async batch(statements){return Promise.all(statements.map(s=>s.all()))}};
}
function add(db,{hour,site='bors',event='pageview',hits=1,detail='',seconds=0}){db.sql.prepare('INSERT INTO analytics_hourly VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(hour,site,event,detail,'github','desktop','Firefox','CH','BE','Bern',hits,seconds);}
test('SQL groups historical BORS and GreenRoute, filters sites and counts the previous period',async()=>{
 const db=database(),now=new Date();now.setUTCMinutes(0,0,0);const hour=new Date(now-3600000).toISOString(),prior=new Date(now-8*86400000).toISOString();
 add(db,{hour,hits:3});add(db,{hour,site:'greenroute',hits:2});add(db,{hour,site:'portfolio',hits:9});add(db,{hour:prior,hits:4});
 add(db,{hour,event:'link_click',detail:'bors-demo',hits:2});add(db,{hour,event:'engagement',hits:1,seconds:60});
 const result=await summary(db,7,'greenroute');assert.equal(result.totals.find(r=>r.event==='pageview').hits,5);assert.equal(result.previous[0].hits,4);assert.equal(result.clicks[0].detail,'github:GreenRoute-demo');assert.equal(result.daily.find(r=>r.event==='engagement').seconds,60);assert.equal(result.countries[0].hits,5);assert.equal(result.hours.reduce((n,r)=>n+r.hits,0),5);assert(!JSON.stringify(result).includes('ip'));db.sql.close();
});
test('range excludes the current incomplete UTC hour and previous comparison is bounded by retention',()=>{
 const p=reportPlan(120,'all',new Date('2026-11-11T12:34:00Z'));assert.equal(p.meta.until,'2026-11-11T12:00:00.000Z');assert.equal(p.meta.comparisonComplete,false);assert(new Date(p.meta.previousSince)>=new Date('2026-05-15T12:34:00Z'));assert.throws(()=>reportPlan(7,"all' OR 1=1 --"));
});
test('collector rejects malformed data, forbidden origins and protects admin data',async()=>{
 const db=database();const base='https://worker.example/collect';
 for(const body of ['null','[]','"text"'])assert.equal((await worker.fetch(new Request(base,{method:'POST',headers:{Origin:'https://jonasbader7.github.io'},body}),{DB:db})).status,400);
 assert.equal((await worker.fetch(new Request(base,{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),{DB:db})).status,403);
 assert.equal((await worker.fetch(new Request('https://worker.example/admin/summary'),{DB:db})).status,401);db.sql.close();
});
test('collector accepts coarse features and maps the new name to historical storage',async()=>{
 const db=database();const body={site:'greenroute',event:'feature_click',detail:'view:scroll_50',source:'github',device:'desktop',browser:'Firefox'};
 const res=await worker.fetch(new Request('https://worker.example/collect',{method:'POST',headers:{Origin:'https://jonasbader7.github.io'},body:JSON.stringify(body)}),{DB:db});assert.equal(res.status,204);assert.equal(db.sql.prepare('SELECT site FROM analytics_hourly').get().site,'bors');assert.equal(db.sql.prepare('SELECT count(*) n FROM security_access').get().n,0);db.sql.close();
});
function client({site='portfolio',local=false,gpc=false,dnt=false,path='/Portfoliopage/',now=0}={}){
 const sent=[],handlers={};const context={URL,URLSearchParams,Set,JSON,Blob,performance:{now:()=>now},innerHeight:800,scrollY:0,location:{protocol:local?'http:':'https:',hostname:local?'localhost':'jonasbader7.github.io',href:'https://jonasbader7.github.io'+path,pathname:path,search:'?secret=private'},window:{JB_ANALYTICS_CONFIG:{endpoint:'https://worker.example/collect'},addEventListener:(k,fn)=>handlers[k]=fn},document:{currentScript:{dataset:{analyticsSite:site}},referrer:'https://github.com/Jonasbader7?private=ignored',visibilityState:'visible',readyState:'complete',documentElement:{scrollHeight:2000},addEventListener:(k,fn)=>handlers[k]=fn},navigator:{userAgent:'Firefox/100',globalPrivacyControl:gpc,doNotTrack:dnt?'1':'0'},fetch:(_url,v)=>{sent.push(JSON.parse(v.body));return Promise.resolve()}};
 vm.runInNewContext(readFileSync(new URL('../../../analytics-client.js',import.meta.url),'utf8'),context);return {sent,handlers,context,setNow:v=>now=v};
}
test('client respects local / GPC / DNT; does not leak query strings, paths or company IDs',()=>{
 assert.equal(client({local:true}).sent.length,0);assert.equal(client({gpc:true}).sent.length,0);assert.equal(client({dnt:true}).sent.length,0);
 const c=client({site:'transparenz',path:'/Projekt-Transparenz/fonds-PRIVATE123.html'});assert.equal(c.sent[1].detail,'view:page_analyse');assert.equal(c.sent[0].source,'github');assert(!JSON.stringify(c.sent).includes('PRIVATE123'));assert(!JSON.stringify(c.sent).includes('secret'));
});
test('foreground accounting handles performance zero and flushes once; scroll thresholds deduplicate',()=>{
 const c=client();c.setNow(5000);c.handlers.pagehide();c.handlers.pagehide();assert.equal(c.sent.filter(r=>r.event==='engagement').length,1);assert.equal(c.sent.at(-1).duration,5);
 c.context.scrollY=1200;c.handlers.scroll();c.handlers.scroll();assert.equal(c.sent.filter(r=>r.detail.startsWith('view:scroll_')).length,4);
});
