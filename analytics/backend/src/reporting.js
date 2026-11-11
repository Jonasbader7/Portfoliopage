// All labels and filters are allowlisted; user input is bound, never interpolated in SQL.
const SITE = "CASE WHEN site IN ('bors','greenroute') THEN 'greenroute' ELSE site END";
export function reportPlan(days, selected, now = new Date()) {
  const allowed = ['all','portfolio','greenroute','transparenz'];
  if (!allowed.includes(selected)) throw new Error('Invalid site');
  const until = new Date(now); until.setUTCMinutes(0,0,0);
  const since = new Date(until.getTime()-days*86400000);
  const previousSince = new Date(Math.max(until.getTime()-2*days*86400000, now.getTime()-180*86400000));
  const filter = selected === 'all' ? '' : ` AND ${SITE} = ?`;
  const where = `hour>=? AND hour<?${filter}`;
  const bind = (start,end) => [start.toISOString(),end.toISOString(),...(selected === 'all' ? [] : [selected])];
  const current = bind(since,until), previous = bind(previousSince,since);
  const select = (fields,tail='',extra='') => `SELECT ${fields} FROM analytics_hourly WHERE ${where}${extra} ${tail}`;
  const queries = [
    ['totals',select(`${SITE} site,event,SUM(hits) hits,SUM(duration_seconds) seconds`,'GROUP BY 1,event'),current],
    ['previous',select(`${SITE} site,event,SUM(hits) hits,SUM(duration_seconds) seconds`,'GROUP BY 1,event'),previous],
    ['countries',select(`${SITE} site,country,SUM(hits) hits`,'GROUP BY 1,country ORDER BY hits DESC LIMIT 300'," AND event='pageview'"),current],
    ['regions',select(`${SITE} site,country,region,city,SUM(hits) hits`,'GROUP BY 1,country,region,city ORDER BY hits DESC LIMIT 300'," AND event='pageview'"),current],
    ['devices',select(`${SITE} site,device,browser,SUM(hits) hits`,'GROUP BY 1,device,browser ORDER BY hits DESC'," AND event='pageview'"),current],
    ['clicks',select(`${SITE} site,event,CASE WHEN detail='bors-demo' THEN 'github:GreenRoute-demo' WHEN detail='github:BORS' THEN 'github:GreenRoute' ELSE detail END detail,SUM(hits) hits`,'GROUP BY 1,event,3 ORDER BY hits DESC LIMIT 300'," AND event IN ('link_click','feature_click')"),current],
    ['sources',select(`${SITE} site,source,SUM(hits) hits`,'GROUP BY 1,source ORDER BY hits DESC'," AND event='pageview'"),current],
    ['daily',select(`substr(hour,1,10) day,${SITE} site,event,SUM(hits) hits,SUM(duration_seconds) seconds`,'GROUP BY day,2,event ORDER BY day'),current],
    ['hours',select(`strftime('%w',hour) weekday,strftime('%H',hour) hour,SUM(hits) hits`,'GROUP BY weekday,2 ORDER BY weekday,2'," AND event='pageview'"),current]
  ];
  return {queries,meta:{days,site:selected,generatedAt:now.toISOString(),since:since.toISOString(),until:until.toISOString(),previousSince:previousSince.toISOString(),comparisonComplete:days<=90,note:'Aggregierte Events, keine Personen oder Sitzungen. Volle UTC-Stunden; die laufende Stunde wird ausgeschlossen. Listen maximal 300 Zeilen. Historische BORS-Zähler erscheinen als GreenRoute.'}};
}
export async function summary(db, days, site) {
  const {queries,meta}=reportPlan(days,site);
  const output={...meta};
  const results=await db.batch(queries.map(([,sql,params])=>db.prepare(sql).bind(...params)));
  queries.forEach(([name],i)=>{output[name]=results[i].results||[];});
  return output;
}
