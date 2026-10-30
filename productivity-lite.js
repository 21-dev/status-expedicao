window.LiteProductivity=(()=>{
  let latest,records=[],buckets=new Map(),date='',stage='bench',selectedShift='',dateMode='day',periodStart='',periodEnd='';
  const esc=v=>escapeHtml(String(v??''));
  const zone='America/Sao_Paulo';
  const dayFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
  const hourFormat=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',hourCycle:'h23'});
  const shifts=[['night','Madrugada','00h–05h59'],['first','1º turno','06h–14h59'],['second','2º turno','15h–23h59']];
  const shift=hour=>hour<6?'night':hour<15?'first':'second';
  const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);
  const number=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n);
  const label=key=>key.split('-').reverse().join('/');
  const selectionLabel=()=>dateMode==='period'?label(periodStart)+' a '+label(periodEnd):label(date);
  function stats(rows){const hours=new Set(rows.map(r=>r.productivityDate+'|'+r.productivityHour)).size;return {pieces:sum(rows,'products'),orders:rows.length,volumes:sum(rows,'volumes'),hours,average:hours?sum(rows,'products')/hours:0}}
  function quantity(rows,metric,title){
    const value=metric==='orders'?rows.length:sum(rows,metric);if(!rows.length||!window.LitePriorities)return '<span>'+fmt(value)+'</span>';
    const id=String(buckets.size);buckets.set(id,{rows,title});return '<button type="button" class="priority-quantity" data-productivity-detail="'+id+'" aria-label="'+esc('Detalhar '+title)+'">'+fmt(value)+'</button>';
  }
  function render(metrics){
    latest=metrics;const root=document.querySelector('#productivity-content');if(!root)return;
    const seen=new Set();records=[];let missing=0;
    for(const row of metrics.gembaOrders||[]){
      if(!['b2b','b2c'].includes(row.segment))continue;
      const activityAt=stage==='bench'?row.conferenceAt:row.separatedAt;
      if(!String(activityAt||'').trim())continue;
      const stamp=stage==='bench'?row.conferenceStamp:row.separatedStamp;if(!stamp){missing++;continue}
      if(seen.has(row.order))continue;seen.add(row.order);
      const hour=Number(hourFormat.format(new Date(stamp)));
      records.push({...row,productivityUser:stage==='bench'?row.weighingUser:row.separationUser,productivityDate:dayFormat.format(new Date(stamp)),productivityHour:hour,productivityShift:shift(hour)});
    }
    if(!date)date=dayFormat.format(new Date());
    if(!periodStart)periodStart=date;if(!periodEnd)periodEnd=date;
    root.innerHTML='<div class="card priority-filters"><label>Etapa<select id="productivity-stage"><option value="bench">Bancada - Conferido em</option><option value="separation">Separação - Separado em</option></select></label><label>Turno<select id="productivity-shift"><option value="">Todos os turnos</option><option value="night">Madrugada - 00h-05h59</option><option value="first">1º turno - 06h-14h59</option><option value="second">2º turno - 15h-23h59</option></select></label><label>Analisar<select id="productivity-mode"><option value="day">Por dia</option><option value="period">Por período</option></select></label><label>Data da atividade<input type="date" id="productivity-date" value="'+date+'"></label><label id="productivity-start-field">Data inicial<input type="date" id="productivity-start" value="'+periodStart+'"></label><label id="productivity-end-field">Data final<input type="date" id="productivity-end" value="'+periodEnd+'"></label><label>Categoria<select id="productivity-category"><option value="">B2B e B2C</option><option value="b2c">B2C</option><option value="b2b">B2B</option></select></label><button type="button" class="btn secondary" data-screen-export="png">Exportar PNG</button><button type="button" class="btn secondary" data-screen-export="csv">Exportar CSV</button><button type="button" class="btn secondary" id="productivity-import">Atualizar CSV</button></div><p class="priority-notice">Produção por '+(stage==='bench'?'Conferido em (bancada)':'Separado em (separação)')+', no horário de Brasília. Média = peças ÷ quantidade de faixas horárias com atividade; não representa horas trabalhadas. Cada pedido é contado uma vez, mantendo o primeiro registro com conferência válida. Cancelados ficam fora da visão.'+(missing?' '+fmt(missing)+' registros com data de conferência inválida.':'')+'</p><div id="productivity-dashboard"></div>';
    document.querySelector('#productivity-mode').value=dateMode;
    function updateDateFields(){
      document.querySelector('#productivity-date').parentElement.style.display=dateMode==='period'?'none':'';
      document.querySelector('#productivity-start-field').style.display=dateMode!=='period'?'none':'';
      document.querySelector('#productivity-end-field').style.display=dateMode!=='period'?'none':'';
      document.querySelector('#productivity-start').max=periodEnd;
      document.querySelector('#productivity-end').min=periodStart;
    }
    updateDateFields();
    document.querySelector('#productivity-mode').addEventListener('change',event=>{dateMode=event.target.value;updateDateFields();dashboard()});
    for(const edge of ['start','end'])document.querySelector('#productivity-'+edge).addEventListener('change',event=>{
      if(edge==='start')periodStart=event.target.value;else periodEnd=event.target.value;
      updateDateFields();dashboard();
    });
    document.querySelector('#productivity-stage').value=stage;
    document.querySelector('#productivity-shift').value=selectedShift;
    document.querySelector('#productivity-stage').addEventListener('change',event=>{stage=event.target.value;render(latest)});
    document.querySelector('#productivity-shift').addEventListener('change',event=>{selectedShift=event.target.value;dashboard()});
    document.querySelector('#productivity-category').value=render.category||'';
    document.querySelector('#productivity-date').addEventListener('change',event=>{date=event.target.value||dayFormat.format(new Date());event.target.value=date;dashboard()});
    document.querySelector('#productivity-category').addEventListener('change',event=>{render.category=event.target.value;dashboard()});
    document.querySelector('#productivity-import').addEventListener('click',()=>document.querySelector('#csv-input').click());
    root.onclick=event=>{const button=event.target.closest('[data-productivity-detail]');if(button){const b=buckets.get(button.dataset.productivityDetail);if(b)window.LitePriorities.openRecords(b.rows,b.title,button)}};
    dashboard();
  }
  function dashboard(){
    buckets.clear();const root=document.querySelector('#productivity-dashboard');
    if(!latest?.fileName){root.innerHTML='<article class="card"><div class="empty-state">Importe o CSV para visualizar a produtividade.</div></article>';return}
    if(dateMode==='period'&&(!periodStart||!periodEnd||periodStart>periodEnd)){root.innerHTML='<article class="card"><div class="empty-state" role="status">Selecione um período válido: a data inicial deve ser anterior ou igual à data final.</div></article>';return}
    const source=records.filter(r=>(!render.category||r.segment===render.category)&&(!selectedShift||r.productivityShift===selectedShift)),rows=source.filter(r=>dateMode==='period'?r.productivityDate>=periodStart&&r.productivityDate<=periodEnd:r.productivityDate===date),total=stats(rows);
    const context='Produtividade · '+selectionLabel();
    root.innerHTML='<div class="prod-kpis">'+[['Peças conferidas','products'],['Pedidos / remessas','orders'],['Volumes','volumes']].map(([title,key])=>'<article class="card"><small>'+title+'</small><strong>'+quantity(rows,key,context+' · '+title)+'</strong></article>').join('')+'<article class="card"><small>Peças por hora com produção</small><strong>'+number(total.average)+'</strong><span>'+total.hours+' faixas horárias com conferência</span></article></div>'+
      turnCards(rows)+'<div class="prod-segments">'+['b2c','b2b'].filter(s=>!render.category||s===render.category).map(s=>{const list=rows.filter(r=>r.segment===s),v=stats(list);return '<article class="card"><div class="card-head"><div><h2>'+s.toUpperCase()+'</h2><p>'+(s==='b2c'?'Série 17':'Séries 11, 14 ou vazia')+'</p></div></div><div class="prod-segment-values"><div><small>Peças</small><strong>'+quantity(list,'products',context+' · '+s.toUpperCase())+'</strong></div><div><small>Pedidos</small><strong>'+quantity(list,'orders',context+' · '+s.toUpperCase())+'</strong></div><div><small>Volumes</small><strong>'+quantity(list,'volumes',context+' · '+s.toUpperCase())+'</strong></div><div><small>Peças/hora</small><strong>'+number(v.average)+'</strong></div></div></article>'}).join('')+'</div>'+
      '<article class="card prod-block"><div class="card-head"><div><h2>Produção por hora</h2><p>Peças conferidas · '+selectionLabel()+' · <span class="prod-legend-b2c">B2C</span> / <span class="prod-legend-b2b">B2B</span></p></div></div>'+hourChart(rows)+hourTable(rows)+'</article>'+
      '<article class="card prod-block"><div class="card-head"><div><h2>Comparativo dos turnos</h2><p>Produção por categoria, incluindo a madrugada</p></div></div>'+turnTable(rows)+'</article>'+
      '<article class="card prod-block"><div class="card-head"><div><h2>Produção por colaborador</h2><p>'+(stage==='bench'?'Usuário da Pesagem':'Usuário da Separação')+' - destaques por peças/hora com produção, comparando o mesmo turno e B2C/B2B. Empates mantêm o destaque; sem usuário fica fora do ranking. Horas com produção não são horas trabalhadas.</p></div></div>'+userTable(rows)+'</article>'+
      '<article class="card prod-block"><div class="card-head"><div><h2>Histórico diário</h2><p>'+(dateMode==='period'?'Todas as datas com produção no período selecionado':'Últimas 14 datas com produção na base')+' · respeita categoria e turno selecionados</p></div></div>'+history(dateMode==='period'?rows:source)+'</article>';
  }
  function turnCards(rows){
    return '<section class="prod-turn-summary" aria-label="Produ\u00e7\u00e3o por turno"><div class="card-head"><div><h2>Produ\u00e7\u00e3o por turno \u00b7 B2C e B2B</h2><p>Pe\u00e7as, pedidos e volumes \u00b7 '+(stage==='bench'?'Bancada':'Separa\u00e7\u00e3o')+' \u00b7 '+selectionLabel()+'</p></div></div><div class="prod-turn-grid">'+shifts.filter(([id])=>!selectedShift||selectedShift===id).map(([id,title,time])=>'<article class="card prod-turn-card"><h3>'+title+'</h3><small>'+time+'</small>'+['b2c','b2b'].filter(segment=>!render.category||render.category===segment).map(segment=>{const list=rows.filter(row=>row.productivityShift===id&&row.segment===segment);return '<div class="prod-turn-channel '+segment+'"><strong>'+segment.toUpperCase()+' \u00b7 '+quantity(list,'products',title+' \u00b7 '+segment.toUpperCase()+' \u00b7 '+selectionLabel())+' pe\u00e7as</strong><small>'+fmt(list.length)+' pedidos \u00b7 '+fmt(sum(list,'volumes'))+' volumes</small></div>'}).join('')+'</article>').join('')+'</div></section>';
  }
  function table(headers,body){return '<div class="priority-scroll"><table class="priority-table"><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>'}
  function hourChart(rows){
    const points=Array.from({length:24},(_,h)=>['b2c','b2b'].map(s=>rows.filter(r=>r.productivityHour===h&&r.segment===s)));
    const max=Math.max(1,...points.flatMap(p=>p.map(v=>sum(v,'products'))));
    return '<div class="prod-chart-scroll"><div class="prod-chart" role="img" aria-label="Gráfico de peças pesadas por hora e categoria. Valores detalhados na tabela abaixo.">'+points.map((p,h)=>'<div class="prod-hour"><div class="prod-bars">'+p.map((v,i)=>'<div class="prod-bar '+(i?'b2b':'b2c')+'" style="height:'+sum(v,'products')/max*100+'%" title="'+h+'h · '+(i?'B2B':'B2C')+': '+fmt(sum(v,'products'))+' peças"></div>').join('')+'</div><span>'+String(h).padStart(2,'0')+'h</span></div>').join('')+'</div></div>';
  }
  function hourTable(rows){return table(['Hora','B2C · peças','B2B · peças','Total de peças','Pedidos','Volumes'],Array.from({length:24},(_,h)=>{const list=rows.filter(r=>r.productivityHour===h),title=selectionLabel()+' · '+h+'h';return '<tr><th>'+String(h).padStart(2,'0')+'h</th><td>'+quantity(list.filter(r=>r.segment==='b2c'),'products',title+' · B2C')+'</td><td>'+quantity(list.filter(r=>r.segment==='b2b'),'products',title+' · B2B')+'</td><td>'+quantity(list,'products',title)+'</td><td>'+quantity(list,'orders',title)+'</td><td>'+quantity(list,'volumes',title)+'</td></tr>'}).join(''))}
  function turnTable(rows){return table(['Turno','Categoria','Peças','Pedidos','Volumes','Horas com produção','Peças/hora'],shifts.flatMap(([id,title,time])=>['b2c','b2b'].filter(s=>!render.category||render.category===s).map(s=>{const list=rows.filter(r=>r.productivityShift===id&&r.segment===s),v=stats(list);return '<tr><th>'+title+' · '+time+'</th><td>'+s.toUpperCase()+'</td><td>'+quantity(list,'products',selectionLabel()+' · '+title+' · '+s.toUpperCase())+'</td><td>'+quantity(list,'orders',title)+'</td><td>'+quantity(list,'volumes',title)+'</td><td>'+v.hours+'</td><td>'+number(v.average)+'</td></tr>'})).join(''))}
  function userTable(rows){
    const users=new Map();rows.forEach(r=>{const key=JSON.stringify([r.productivityUser||'N\u00e3o informado',r.productivityShift,r.segment]);if(!users.has(key))users.set(key,[]);users.get(key).push(r)});
    const peers=new Map();
    for(const [key,list] of users){const [user,turn,segment]=JSON.parse(key);if(!list[0].productivityUser?.trim())continue;const group=turn+'|'+segment;if(!peers.has(group))peers.set(group,[]);peers.get(group).push(stats(list).average)}
    function highlight(list){
      if(!list[0].productivityUser?.trim())return ['','Sem usu\u00e1rio'];
      const values=peers.get(list[0].productivityShift+'|'+list[0].segment)||[],value=stats(list).average;
      if(values.length<2)return ['','Sem compara\u00e7\u00e3o'];
      const max=Math.max(...values),min=Math.min(...values);
      if(max===min)return ['','Empate'];
      if(value===max)return ['prod-best','Maior produtividade'];
      if(value===min)return ['prod-worst','Menor produtividade'];
      return ['','Intermedi\u00e1rio'];
    }
    return users.size?table(['Colaborador','Destaque','Turno','Modelo de entrega','Peças B2C','Peças B2B','Total de peças','Pedidos','Volumes','Horas com produção','Peças/hora'],[...users].sort((a,b)=>sum(b[1],'products')-sum(a[1],'products')).map(([key,list])=>{const [user,turn,segment]=JSON.parse(key),v=stats(list),[tone,badge]=highlight(list);return '<tr class="'+tone+'"><th>'+esc(user)+'</th><td><span class="prod-rank '+tone+'">'+badge+'</span></td><td>'+shifts.find(s=>s[0]===turn)[1]+'</td><td>'+segment.toUpperCase()+'</td>'+['b2c','b2b'].map(s=>'<td>'+quantity(list.filter(r=>r.segment===s),'products',user+' · '+s.toUpperCase()+' · '+selectionLabel())+'</td>').join('')+'<td>'+quantity(list,'products',user+' · '+selectionLabel())+'</td><td>'+quantity(list,'orders',user)+'</td><td>'+quantity(list,'volumes',user)+'</td><td>'+v.hours+'</td><td>'+number(v.average)+'</td></tr>'}).join('')):'<div class="empty-state compact">Nenhuma atividade na data ou período e filtros selecionados.</div>';
  }
  function history(rows){const days=[...new Set(rows.map(r=>r.productivityDate))].sort().reverse().slice(0,dateMode==='period'?undefined:14);return days.length?table(['Data','Peças B2C','Peças B2B','Total de peças','Pedidos','Volumes','Peças/hora'],days.map(d=>{const list=rows.filter(r=>r.productivityDate===d);return '<tr><th>'+label(d)+'</th>'+['b2c','b2b'].map(s=>'<td>'+quantity(list.filter(r=>r.segment===s),'products',label(d)+' · '+s.toUpperCase())+'</td>').join('')+'<td>'+quantity(list,'products',label(d))+'</td><td>'+quantity(list,'orders',label(d))+'</td><td>'+quantity(list,'volumes',label(d))+'</td><td>'+number(stats(list).average)+'</td></tr>'}).join('')):'<div class="empty-state compact">Nenhuma conferência válida na base.</div>'}
  return {render};
})();
