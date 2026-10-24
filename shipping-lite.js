/* Painel de expedição derivado exclusivamente do último CSV importado. */
window.LiteShipping=(()=>{
  let latest,groups=new Map(),onlyD1=false;
  const dayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
  const hourFormatter=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'});
  const dateKey=stamp=>dayFormatter.format(new Date(stamp));
  function yesterday(){const today=dateKey(Date.now());return new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10)}
  const isD1=(r,key)=>Boolean(r.actualImportedStamp)&&dateKey(r.actualImportedStamp)===key;
  const oldest=rows=>rows.reduce((stamp,r)=>r.actualImportedStamp?Math.min(stamp,r.actualImportedStamp):stamp,Infinity);
  const ready=['CONFERENCIA CONCLUIDA','ENVIADO PARA FATURAMENTO','FATURADO','COLETA INICIADA'];
  const norm=v=>normalizeHeader(v).toUpperCase();
  const esc=v=>escapeHtml(String(v??''));
  const hasLoad=r=>!['','0','SEM CARGA','NAO INFORMADO','-'].includes(norm(r.load));
  const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);
  const count=rows=>new Set(rows.map(r=>r.order)).size;
  function button(rows,label){
    if(!rows.length)return '0';
    const key=String(groups.size);groups.set(key,{rows,label});
    return '<button type="button" class="priority-quantity" data-shipping-detail="'+key+'" aria-label="'+esc('Detalhar '+label)+'">'+fmt(count(rows))+'</button>';
  }
  function summary(rows,label){return '<div class="shipping-summary"><div><small>Pedidos / remessas</small><strong>'+button(rows,label)+'</strong></div><div><small>Peças</small><strong>'+fmt(sum(rows,'products'))+'</strong></div><div><small>Volumes</small><strong>'+fmt(sum(rows,'volumes'))+'</strong></div></div>'}
  function carrierTable(rows,label){
    if(!rows.length)return '<div class="empty-state compact">Nenhum pedido fora de carga para os filtros selecionados.</div>';
    const carriers=[...new Set(rows.map(r=>r.carrier||'Não informada'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const slots=new Map();
    rows.forEach(row=>{
      const stamp=row.conferenceStamp||0;
      const key=stamp?dateKey(stamp)+'|'+hourFormatter.format(new Date(stamp)):'~|';
      if(!slots.has(key))slots.set(key,[]);slots.get(key).push(row);
    });
    return '<div class="priority-scroll shipping-matrix-scroll" tabindex="0" role="region" aria-label="'+esc(label+' por dia, hora e transportadora')+'"><table class="priority-table shipping-matrix"><thead><tr><th>Dia da conferência</th><th>Hora</th>'+carriers.map(c=>'<th>'+esc(c)+'</th>').join('')+'<th>Total de pedidos</th></tr></thead><tbody>'+[...slots].sort(([a],[b])=>a.localeCompare(b)).map(([key,list])=>{
      const [day,hour]=key.split('|'),dayLabel=day==='~'?'Sem data de conferência':day.split('-').reverse().join('/');
      const title=label+' · '+dayLabel+(hour?' · '+hour+'h':'');
      return '<tr><th>'+esc(dayLabel)+'</th><td>'+(hour?hour+'h–'+hour+'h59':'—')+'</td>'+carriers.map(carrier=>'<td>'+button(list.filter(r=>(r.carrier||'Não informada')===carrier),title+' · '+carrier)+'</td>').join('')+'<td>'+button(list,title+' · Todas as transportadoras')+'</td></tr>';
    }).join('')+'</tbody><tfoot><tr><th colspan="2">Total por transportadora</th>'+carriers.map(carrier=>'<td>'+button(rows.filter(r=>(r.carrier||'Não informada')===carrier),label+' · '+carrier+' · Todos os dias')+'</td>').join('')+'<td>'+button(rows,label+' · Total')+'</td></tr></tfoot></table></div>';
  }
  function render(metrics){
    latest=metrics;const root=document.querySelector('#shipping-content');if(!root)return;
    groups.clear();
    const updated=document.querySelector('#shipping-updated');if(updated)updated.textContent=metrics.fileName?'Última atualização: '+window.BrowserData.updatedLabel(metrics)+' · Arquivo: '+metrics.fileName+' · Dados mantidos até o próximo upload.':'Aguardando upload do CSV.';
    if(!metrics.fileName){root.innerHTML='<article class="card"><div class="empty-state">Importe o CSV operacional para consultar os pedidos para expedição.</div></article>';return}
    const search=norm(document.querySelector('#shipping-search').value),category=document.querySelector('#shipping-category').value;
    const carrierSelect=document.querySelector('#shipping-carrier'),selectedCarrier=carrierSelect.value,selectedDate=document.querySelector('#shipping-date').value;
    const seen=new Set();
    const all=(metrics.gembaOrders||[]).filter(r=>{
      if(!ready.includes(norm(r.status))||r.processed||String(r.processedAt||'').trim()||!['b2b','b2c'].includes(r.segment)||seen.has(r.order))return false;
      seen.add(r.order);return true;
    });
    const carriers=[...new Set(all.map(r=>r.carrier||'Não informada'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    carrierSelect.innerHTML='<option value="">Todas as transportadoras</option>'+carriers.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
    carrierSelect.value=carriers.includes(selectedCarrier)?selectedCarrier:'';
    const rows=all.filter(r=>(!category||r.segment===category)&&(!carrierSelect.value||(r.carrier||'Não informada')===carrierSelect.value)&&(!selectedDate||(r.conferenceStamp&&dateKey(r.conferenceStamp)===selectedDate))&&(!search||['order','invoice','load','carrier','client','service','status'].some(key=>norm(r[key]).includes(search))));
    const outside=rows.filter(r=>!hasLoad(r)),allLoaded=rows.filter(hasLoad),d1=yesterday();
    const priorityLoads=new Set(allLoaded.filter(r=>isD1(r,d1)).map(r=>r.load));
    const loaded=onlyD1?allLoaded.filter(r=>priorityLoads.has(r.load)):allLoaded;
    const d1Rows=allLoaded.filter(r=>isD1(r,d1));
    root.innerHTML='<div class="actions"><button type="button" class="btn secondary" data-screen-export="png">Exportar PNG</button><button type="button" class="btn secondary" data-screen-export="csv">Exportar CSV</button></div><div class="shipping-grid">'+['b2c','b2b'].filter(s=>!category||s===category).map(s=>{
      const list=outside.filter(r=>r.segment===s),label=s.toUpperCase()+' · Fora de carga';
      return '<article class="card priority-card"><div class="card-head"><div><h2>'+label+'</h2><p>Pedidos prontos · Dia e hora de Conferido em · Cada célula representa pedidos</p></div></div>'+summary(list,label)+carrierTable(list,label)+'</article>';
    }).join('')+'</div><article class="card shipping-loaded"><div class="card-head"><div><h2>Em carga · Aguardando finalização no WMS</h2><p>B2C primeiro; depois B2B. Em cada modelo, cargas com pedidos de D−1 aparecem primeiro · Importado em '+d1.split('-').reverse().join('/')+' · horário de Brasília</p></div></div><div class="shipping-d1-focus"><div><small>FOCO D−1 · DIA ANTERIOR</small><strong>'+fmt(priorityLoads.size)+' cargas com '+button(d1Rows,'Pedidos importados em D−1 · '+d1.split('-').reverse().join('/'))+' pedidos de D−1</strong><p>O filtro mantém todos os pedidos das cargas selecionadas, incluindo os importados em outros dias.</p></div><label><input type="checkbox" id="shipping-only-d1" '+(onlyD1?'checked':'')+'> Somente cargas com pedidos de D−1</label></div>'+summary(loaded,'Em carga · Aguardando finalização no WMS')+loadTable(loaded,d1,priorityLoads)+'</article><p class="priority-notice">'+fmt(count(rows))+' pedidos na visão filtrada · '+fmt(count(all))+' pedidos na base. Quantidades de peças e volumes somadas por registro do CSV. Clique na quantidade de pedidos para consultar e exportar os detalhes.</p>';
  }
  function loadTable(rows,d1,priorityLoads){
    if(!rows.length)return '<div class="empty-state compact">Nenhuma carga com pedidos aguardando finalização para estes filtros.</div>';
    const loads=new Map();rows.forEach(r=>{const key=JSON.stringify([r.load,r.segment,r.carrier]);if(!loads.has(key))loads.set(key,[]);loads.get(key).push(r)});
    const oldestByLoad=new Map();rows.forEach(r=>{if(r.actualImportedStamp)oldestByLoad.set(r.load,Math.min(oldestByLoad.get(r.load)??Infinity,r.actualImportedStamp))});
    return '<div class="priority-scroll"><table class="priority-table"><thead><tr><th>Carga</th><th>Categoria</th><th>Transportadora</th><th>Pedidos</th><th>Pedidos D−1</th><th>Importação mais antiga</th><th>Peças</th><th>Volumes</th><th>Status presentes</th></tr></thead><tbody>'+[...loads.values()].sort((a,b)=>Number(b[0].segment==='b2c')-Number(a[0].segment==='b2c')||Number(priorityLoads.has(b[0].load))-Number(priorityLoads.has(a[0].load))||((oldestByLoad.get(a[0].load)??Infinity)-(oldestByLoad.get(b[0].load)??Infinity)||0)||a[0].load.localeCompare(b[0].load,'pt-BR',{numeric:true})).map(list=>{
      const r=list[0],previous=list.filter(item=>isD1(item,d1)),first=oldest(list),unknown=list.filter(item=>!item.actualImportedStamp).length;
      return '<tr class="'+(priorityLoads.has(r.load)?'shipping-d1-row':'')+'"><th>'+esc(r.load)+(priorityLoads.has(r.load)?'<span class="shipping-d1-badge">PRIORIDADE D−1</span>':'')+'</th><td>'+r.segment.toUpperCase()+'</td><td>'+esc(r.carrier||'Não informada')+'</td><td>'+button(list,'Carga '+r.load+' · '+r.segment.toUpperCase()+' · '+(r.carrier||'Não informada'))+'</td><td>'+button(previous,'Carga '+r.load+' · '+r.segment.toUpperCase()+' · Pedidos de D−1')+'</td><td>'+(Number.isFinite(first)?esc(new Date(first).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',hour12:false})):'Não informada')+(unknown?'<small class="shipping-missing-date">'+fmt(unknown)+' sem data de importação</small>':'')+'</td><td>'+fmt(sum(list,'products'))+'</td><td>'+fmt(sum(list,'volumes'))+'</td><td>'+esc([...new Set(list.map(r=>r.status))].join(' · '))+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('#shipping-import').addEventListener('click',()=>document.querySelector('#csv-input').click());
    document.querySelector('#shipping-search').addEventListener('input',()=>render(latest));document.querySelector('#shipping-category').addEventListener('change',()=>render(latest));
    document.querySelector('#shipping-carrier').addEventListener('change',()=>render(latest));
    document.querySelector('#shipping-date').addEventListener('change',()=>render(latest));
    document.querySelector('#shipping-content').addEventListener('click',event=>{const button=event.target.closest('[data-shipping-detail]');if(!button)return;const group=groups.get(button.dataset.shippingDetail);if(group)window.LitePriorities.openRecords(group.rows,group.label,button)});
    document.querySelector('#shipping-content').addEventListener('change',event=>{if(event.target.id==='shipping-only-d1'){onlyD1=event.target.checked;render(latest)}});
    if(latest)render(latest);
  });
  return {render};
})();
