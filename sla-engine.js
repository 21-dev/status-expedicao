/* Pure Central SLA engine. Factory is also embedded in the existing CSV worker. */
function createSlaEngine(config = {}) {
  const zone = 'America/Sao_Paulo';
  const rules = config.rules || [
    {id:'expressa',group:'B2C Convencional',label:'Expressa',aliases:['expressa','entrega expressa'],cutoff:'19:00',days:1,end:'23:59'},
    {id:'normal',group:'B2C Convencional',label:'Normal',aliases:['normal','entrega normal'],cutoff:'23:59',days:2,end:'23:59'},
    {id:'economica',group:'B2C Convencional',label:'Econômica',aliases:['economica','entrega economica'],cutoff:'23:59',days:3,end:'23:59'},
    {id:'shopee',group:'Marketplace',label:'Shopee',aliases:['shopee'],cutoff:'13:00',days:0,end:'18:00',exact:true},
    {id:'amazon',group:'Marketplace',label:'Amazon',aliases:['amazon'],cutoff:'12:30',days:0,end:'15:30',exact:true},
    {id:'tiktok',group:'Marketplace',label:'TikTok',aliases:['tiktok','tik tok','tik-tok','tik tok shop','tiktok shop'],cutoff:'23:59',days:2,end:'23:59'}
  ].map(r=>({...r,active:true,operational:true,type:r.exact?'same-cycle':'operational-days'}));
  const calendarConfig = {weekdays:[1,2,3,4,5],holidays:[],closed:[],extra:[],...config.calendar};
  const closed = new Set([...calendarConfig.holidays,...calendarConfig.closed]), extra = new Set(calendarConfig.extra);
  if(!calendarConfig.weekdays.length) throw new Error('Calendário precisa de ao menos um dia semanal operacional.');
  const formatter = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const normalizedCache=new Map();
  function normalize(value) {
    if(normalizedCache.has(value))return normalizedCache.get(value);
    let text=String(value??'');
    const fixes={'Ã¡':'á','Ã¢':'â','Ã£':'ã','Ã©':'é','Ãª':'ê','Ã­':'í','Ã³':'ó','Ã´':'ô','Ãµ':'õ','Ãº':'ú','Ã§':'ç','Ã”':'Ô','Ã‰':'É','Ã‡':'Ç','Â':''};
    for(const [from,to] of Object.entries(fixes)) text=text.split(from).join(to);
    const result=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    if(normalizedCache.size<50000)normalizedCache.set(value,result);return result;
  }
  const aliases=new Map(); for(const rule of rules) if(rule.active) for(const alias of rule.aliases) aliases.set(normalize(alias),rule);
  const stages=new Map();
  for(const status of ['Importado','AG Formação de Romaneio','Aguardando Separação','Separação Iniciada','Separação Concluída','Conferência Iniciada']) stages.set(normalize(status),'billing');
  for(const status of ['Conferência Concluída','Enviado para Faturamento','Faturado','Coleta Iniciada']) stages.set(normalize(status),'shipping');
  function parts(stamp){return Object.fromEntries(formatter.formatToParts(new Date(stamp)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));}
  const pad=n=>String(n).padStart(2,'0');
  function dateKey(stamp){const p=parts(stamp);return `${p.year}-${pad(p.month)}-${pad(p.day)}`;}
  function offset(key,n){const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function isOperational(key){return extra.has(key)||(!closed.has(key)&&calendarConfig.weekdays.includes(new Date(key+'T12:00:00Z').getUTCDay()));}
  function next(key,include=false){let d=include?key:offset(key,1);for(let i=0;i<36600;i++,d=offset(d,1))if(isOperational(d))return d;throw new Error('Calendário sem próximo dia operacional.');}
  function add(key,days){let d=key;for(let i=0;i<days;i++)d=next(d);return d;}
  function timestamp(key,time,second=0){
    const [y,m,d]=key.split('-').map(Number),[h,min]=time.split(':').map(Number),target=Date.UTC(y,m-1,d,h,min,second);
    if(new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==key||h>23||min>59||second>59)return NaN;
    let stamp=target;for(let i=0;i<3;i++){const p=parts(stamp);stamp+=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);}
    const p=parts(stamp);return p.hour===h&&p.minute===min?stamp:NaN;
  }
  const parsed=new Map(),deadlines=new Map();
  function parse(value){
    if(parsed.has(value))return parsed.get(value);
    const text=String(value||'').trim();let stamp=NaN;
    let m=text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if(m)stamp=timestamp(`${m[3]}-${m[2]}-${m[1]}`,`${m[4]}:${m[5]}`,Number(m[6]||0));
    else {m=text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);if(m)stamp=timestamp(m[1],m[2],Number(m[3]||0));
      else if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(text)){const k=text.slice(0,10),d=new Date(k+'T12:00:00Z');stamp=Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===k?Date.parse(text):NaN;}}
    const result=Number.isFinite(stamp)?{stamp,key:dateKey(stamp),hour:parts(stamp).hour,minute:parts(stamp).minute}:null;
    if(parsed.size<200000)parsed.set(value,result);return result;
  }
  function identify(record){
    const market=aliases.get(normalize(record.marketplace));if(market?.group==='Marketplace')return market;
    for(const value of [record.service,record.modality]){const rule=aliases.get(normalize(value));if(rule)return rule;}
    return null;
  }
  function deadline(imported,rule){
    const after=imported.hour*60+imported.minute>rule.cutoff.split(':').reduce((h,m)=>Number(h)*60+Number(m));
    const cacheKey=[imported.key,rule.id,after].join('|');if(deadlines.has(cacheKey))return deadlines.get(cacheKey);
    const base=isOperational(imported.key)?(after?next(imported.key):imported.key):next(imported.key,true);
    const dueKey=rule.operational===false?offset(base,rule.days):add(base,rule.days);
    const result={cycleKey:base,afterCutoff:after,dueDateKey:dueKey,dueStamp:timestamp(dueKey,rule.end,rule.exact?0:59)+(rule.exact?0:999),cutoff:rule.cutoff,deadlineTime:rule.end};
    deadlines.set(cacheKey,result);return result;
  }
  function normalizeRecord(raw){
    const imported=parse(raw.importedRaw),rule=identify(raw),statusNormalized=normalize(raw.status);
    return {...raw,area:stages.get(statusNormalized)||'',statusNormalized,serviceNormalized:normalize(raw.service),search:normalize(raw.invoice+' '+raw.order),
      importedStamp:imported?.stamp??NaN,importDateKey:imported?.key||'',importDateLabel:imported?imported.key.split('-').reverse().join('/'):'Data inválida',importHour:imported?.hour??'',
      ruleId:rule?.id||'none',ruleLabel:rule?.label||'Sem regra',group:rule?.group||'Sem regra',exact:!!rule?.exact,
      ...(rule&&imported?deadline(imported,rule):{dueStamp:NaN,dueDateKey:''}),
      reason:!imported?'Data de importação inválida':!rule?`Sem regra: ${raw.marketplace||raw.service||raw.modality||'não informado'}`:'Prazo calculado em dias operacionais'};
  }
  function classify(record,now=Date.now(),today=dateKey(now)){
    if(!Number.isFinite(record.importedStamp))return 'DATA_INVALIDA';
    if(record.ruleId==='none')return 'SEM_REGRA';
    if(!record.area)return 'SEM_REGRA';
    if(now>record.dueStamp)return 'ATRASADO';
    if(record.cycleKey>today)return 'PROXIMO_CICLO';
    if(record.exact&&record.dueStamp-now<=7200000)return 'URGENTE';
    return record.dueDateKey===today?'VENCE_HOJE':'DENTRO_DO_PRAZO';
  }
  function collect(values,indexes,records,seen,diagnostics,rowIndex){
    const get=k=>String(values[indexes[k]]??'').trim();
    if(Number(normalize(get('series')).replace(',','.'))!==17||get('cancelledAt')||normalize(get('status'))==='cancelado')return;
    const invoice=get('invoice'),order=get('order'),id=invoice?'nf:'+normalize(invoice):order?'pedido:'+normalize(order):'linha:'+rowIndex;
    if(seen.has(id)){diagnostics.duplicateRows++;return;}seen.add(id);
    const r=normalizeRecord({id,invoice,order,identifier:invoice||order||`Linha ${rowIndex+1}`,identifierFallback:!invoice,missingIdentifier:!invoice&&!order,
      series:get('series'),status:get('status'),service:get('service'),marketplace:get('marketplace'),modality:get('modality'),importedRaw:get('imported'),carrier:get('carrier'),load:get('load'),wave:get('wave'),waveId:get('waveId'),volumes:get('volumes'),products:get('products'),responsible:get('weighingUser')});
    if(!r.area){const k=r.statusNormalized||'não informado';diagnostics.unknownStatuses[k]??={label:r.status||'Não informado',count:0};diagnostics.unknownStatuses[k].count++;r.reason='Status não reconhecido: '+(r.status||'vazio');}
    if(!Number.isFinite(r.importedStamp))diagnostics.invalidDates++;
    if(r.missingIdentifier){r.ruleId='none';r.reason='Nota Fiscal e Pedido de Venda vazios; linha preservada para diagnóstico.';}
    records.push(r);
  }
  function aggregate(records,now=Date.now()){
    const indexes=new Map(),items=[],today=dateKey(now);
    function push(key,r){if(!indexes.has(key))indexes.set(key,[]);indexes.get(key).push(r);}
    for(const original of records){const classification=classify(original,now,today),r={...original,classification,delayed:classification==='ATRASADO',priorityToday:classification==='VENCE_HOJE',delayReason:({ATRASADO:'Prazo de expedição ultrapassado. ',URGENTE:'Faltam até duas horas para expedição. ',VENCE_HOJE:'Prazo encerra hoje. ',DENTRO_DO_PRAZO:'Prazo em data futura. ',PROXIMO_CICLO:'Ciclo operacional ainda não iniciado. '}[classification]||'')+original.reason+(original.cycleKey?` · Ciclo ${original.cycleKey}, corte ${original.cutoff}, limite ${original.dueDateKey} ${original.deadlineTime}.`:'')};items.push(r);
      for(const key of ['all','class:'+classification,'area:'+r.area,'rule:'+r.ruleId,'group:'+r.group])push(key,r);
      for(const date of ['*',r.importDateKey])for(const hour of ['*',String(r.importHour)])for(const rule of ['*',r.ruleId])push(['matrix',r.area,date,hour,rule].join('|'),r);
      for(const key of ['class:'+classification,'area:'+r.area,'all'])push('rule:'+r.ruleId+'|'+key,r);
    }
    return {records:items,indexes,todayKey:today,d1Key:offset(today,-1),referenceStamp:now,get:key=>indexes.get(key)||[]};
  }
  return {rules,calendarConfig,normalize,parse,identify,deadline,normalizeRecord,classify,collect,aggregate,dateKey,timestamp,offset,calendar:{isOperational,next,add}};
}
const SLA_ENGINE_CONFIG = {calendar:{weekdays:[1,2,3,4,5],holidays:[],closed:[],extra:[]}};
if(typeof module!=='undefined')module.exports={createSlaEngine,SLA_ENGINE_CONFIG};
