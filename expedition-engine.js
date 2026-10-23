/* Pure daily collection rules. No dependency on CSV processing or Central SLA. */
(function(root){
  'use strict';
  const zone='America/Sao_Paulo', fields=['arrival_at','entry_at','exit_at'];
  const parts=value=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  function day(value=Date.now()){const p=parts(value);return `${p.year}-${p.month}-${p.day}`;}
  function time(value){if(!value)return '—';const p=parts(value);return `${p.hour}:${p.minute}`;}
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
  function timestamp(date,clock){
    if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))throw Error('Informe uma data e um horário válidos.');
    const target=Date.parse(date+'T'+clock+':00Z');let stamp=target;
    for(let i=0;i<3;i++){const p=parts(stamp),local=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);stamp+=target-local;}
    if(day(stamp)!==date||time(stamp)!==clock)throw Error('Horário inexistente no fuso America/Sao_Paulo.');
    return new Date(stamp).toISOString();
  }
  function scheduleId(carrier,weekday,cutoff){return JSON.stringify([carrier,Number(weekday),cutoff]);}
  function schedule(date,schedules,types={}){
    if(!validDate(date))return [];
    const weekday=new Date(date+'T12:00:00Z').getUTCDay();
    return Object.entries(schedules).flatMap(([carrier,week])=>[...new Set(week[weekday]||[])].filter(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)).map(cutoff=>({operation_date:date,schedule_id:scheduleId(carrier,weekday,cutoff),carrier,cutoff_at:timestamp(date,cutoff),transport_type:types[carrier]||null,arrival_at:null,entry_at:null,exit_at:null,version:0}))).sort((a,b)=>a.cutoff_at.localeCompare(b.cutoff_at)||a.carrier.localeCompare(b.carrier));
  }
  const stage=r=>r.exit_at?'CONCLUÍDA':r.entry_at?'NO CD':r.arrival_at?'NO PÁTIO':'AGUARDANDO';
  const punctuality=(r,now=Date.now())=>r.arrival_at?(Date.parse(r.arrival_at)<=Date.parse(r.cutoff_at)?'OK':'ATRASADO'):(now>Date.parse(r.cutoff_at)?'ATRASADO':'PENDENTE');
  function validate(r){
    for(const f of fields)if(r[f]&&(isNaN(Date.parse(r[f]))||day(r[f])<r.operation_date))throw Error('O horário deve ter data igual ou posterior à data operacional.');
    if(r.entry_at&&(!r.arrival_at||Date.parse(r.entry_at)<Date.parse(r.arrival_at)))throw Error('Entrada no CD exige chegada no pátio em horário igual ou anterior.');
    if(r.exit_at&&(!r.entry_at||Date.parse(r.exit_at)<Date.parse(r.entry_at)))throw Error('Saída do CD exige entrada no CD em horário igual ou anterior.');
    return r;
  }
  function visible(rows,filters,now=Date.now()){
    const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const result=rows.filter(r=>(!filters.search||normalize(r.carrier).includes(normalize(filters.search)))&&(!filters.stage||stage(r)===filters.stage)&&(!filters.late||punctuality(r,now)==='ATRASADO')&&(!filters.type||r.transport_type===filters.type));
    const stages=['AGUARDANDO','NO PÁTIO','NO CD','CONCLUÍDA'];
    return result.sort((a,b)=>{const cut=Date.parse(a.cutoff_at)-Date.parse(b.cutoff_at);return (filters.sort==='latest'?-cut:filters.sort==='carrier'?a.carrier.localeCompare(b.carrier,'pt-BR'):filters.sort==='late'?Number(punctuality(b,now)==='ATRASADO')-Number(punctuality(a,now)==='ATRASADO'):filters.sort==='stage'?stages.indexOf(stage(a))-stages.indexOf(stage(b)):cut)||cut||a.carrier.localeCompare(b.carrier);});
  }
  function totals(rows,now=Date.now()){return {Programadas:rows.length,Aguardando:rows.filter(r=>stage(r)==='AGUARDANDO').length,'No pátio':rows.filter(r=>stage(r)==='NO PÁTIO').length,'No CD':rows.filter(r=>stage(r)==='NO CD').length,Concluídas:rows.filter(r=>stage(r)==='CONCLUÍDA').length,Atrasadas:rows.filter(r=>punctuality(r,now)==='ATRASADO').length};}
  function csv(rows,now=Date.now()){
    const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
    return '\uFEFF'+[['Data operacional','Transportadora','Tipo','Corte','Chegada no pátio','Entrada no CD','Saída do CD','Etapa','Pontualidade'],...rows.map(r=>[r.operation_date,r.carrier,r.transport_type||'Não definido',time(r.cutoff_at),...fields.map(f=>r[f]?day(r[f])+' '+time(r[f]):''),stage(r),punctuality(r,now)])].map(row=>row.map(cell).join(';')).join('\r\n');
  }
  const api={zone,fields,day,time,timestamp,validDate,scheduleId,schedule,stage,punctuality,validate,visible,totals,csv};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ExpeditionEngine=api;
})(typeof globalThis==='object'?globalThis:this);
