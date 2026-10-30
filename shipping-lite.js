/* Painel de expedição derivado exclusivamente do último CSV importado. */
window.LiteShipping=(()=>{
  let latest,groups=new Map(),onlyD1=false;
  const dayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
  const hourFormatter=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'});
  const dateKey=stamp=>dayFormatter.format(new Date(stamp));
  function yesterday(){const today=dateKey(Date.now());return new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10)}
  const isD1=(r,key)=>Boolean(r.actualImportedStamp)&&dateKey(r.actualImportedStamp)===key;

  const ready=['CONFERENCIA CONCLUIDA','ENVIADO PARA FATURAMENTO','FATURADO','COLETA INICIADA'];
  const norm=v=>normalizeHeader(v).toUpperCase();
  const esc=v=>escapeHtml(String(v??''));
  const hasLoad=r=>!['','0','SEM CARGA','NAO INFORMADO','-'].includes(norm(r.load));
  const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);
  const count=rows=>new Set(rows.map(r=>r.order)).size;
  function button(rows,label,metric='orders'){
    if(!rows.length)return '0';
    const key=String(groups.size);groups.set(key,{rows,label});
    return '<button type="button" class="priority-quantity" data-shipping-detail="'+key+'" aria-label="'+esc('Detalhar '+label)+'">'+fmt(metric==='orders'?count(rows):sum(rows,metric))+'</button>';
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
    const rows=all.filter(r=>(!category||r.segment===category)&&(!carrierSelect.value||(r.carrier||'Não informada')===carrierSelect.value)&&(!selectedDate||(r.conferenceStamp&&dateKey(r.conferenceStamp)===selectedDate))&&(!search||['order','invoice','load','carrier','client','service','marketplace','status'].some(key=>norm(r[key]).includes(search))));
    const outside=rows.filter(r=>!hasLoad(r)),allLoaded=rows.filter(hasLoad),d1=yesterday();
    const priorityLoads=new Set(allLoaded.filter(r=>isD1(r,d1)).map(r=>r.load));
    const loaded=onlyD1?allLoaded.filter(r=>priorityLoads.has(r.load)):allLoaded;
    const d1Rows=allLoaded.filter(r=>isD1(r,d1));
    root.innerHTML='<div class="actions"><button type="button" class="btn secondary" data-screen-export="png">Exportar PNG</button><button type="button" class="btn secondary" data-screen-export="csv">Exportar CSV</button></div><div class="shipping-grid">'+['b2c','b2b'].filter(s=>!category||s===category).map(s=>{
      const list=outside.filter(r=>r.segment===s),label=s.toUpperCase()+' · Fora de carga';
      return '<article class="card priority-card"><div class="card-head"><div><h2>'+label+'</h2><p>Pedidos prontos · Dia e hora de Conferido em · Cada célula representa pedidos</p></div></div>'+summary(list,label)+carrierTable(list,label)+'</article>';
    }).join('')+'</div><article class="card shipping-loaded"><div class="card-head"><div><h2>Em carga · Aguardando finalização no WMS</h2><p>Marketplaces e transportadoras separados · Peças por status e data de cadastro · Foco em cargas com pedidos de D−1 · Importado em '+d1.split('-').reverse().join('/')+' · horário de Brasília</p></div></div><div class="shipping-d1-focus"><div><small>FOCO D−1 · DIA ANTERIOR</small><strong>'+fmt(priorityLoads.size)+' cargas com '+button(d1Rows,'Pedidos importados em D−1 · '+d1.split('-').reverse().join('/'))+' pedidos de D−1</strong><p>O filtro mantém todos os pedidos das cargas selecionadas, incluindo os importados em outros dias.</p></div><label><input type="checkbox" id="shipping-only-d1" '+(onlyD1?'checked':'')+'> Somente cargas com pedidos de D−1</label></div>'+summary(loaded,'Em carga · Aguardando finalização no WMS')+loadedChannels(loaded)+'</article><p class="priority-notice">'+fmt(count(rows))+' pedidos na visão filtrada · '+fmt(count(all))+' pedidos na base. Quantidades de peças e volumes somadas por registro do CSV. Clique na quantidade de pedidos para consultar e exportar os detalhes.</p>';
  }
  function loadedChannels(rows){
    const channel=r=>{
      const market=norm(r.marketplace),service=norm(r.service),carrier=norm(r.carrier),value=market+' '+service+' '+carrier;
      if(/SHOPEE|SHOPPE/.test(value))return 'Shopee';
      if(/AMAZON/.test(value)||service==='ENTREGA NORMAL/TO DO')return 'Amazon';
      if(/TIKTOK|TIK TOK|BYTEDANCE/.test(value))return 'TikTok';
      if(/CLIENTE RETIRA|CLICK.*RETIR|CLIQUE.*RETIR/.test(value))return 'Click Retire';
      if(/L4B|L4 B/.test(value))return 'L4B';
      if(/JADLOG/.test(value)||/\/(JAD)$/.test(service))return 'Jadlog';
      return 'Outros canais';
    };
    const labels=['CONFERÊNCIA CONCLUÍDA','ENVIADO PARA FATURAMENTO','FATURADO','COLETA INICIADA'];
    const date=r=>r.registeredStamp?dateKey(r.registeredStamp):'Sem cadastro';
    const dateLabel=d=>d==='Sem cadastro'?d:d.split('-').reverse().join('/');
    function matrix(list,title){
      if(!list.length)return '<div class="empty-state compact">Nenhum pedido em carga neste canal para os filtros selecionados.</div>';
      const days=[...new Set(list.map(date))].sort();
      const cell=(items,label)=>'<td>'+button(items,label,'products')+'</td>';
      return '<div class="priority-scroll"><table class="priority-table"><thead><tr><th>Status</th>'+days.map(d=>'<th>'+esc(dateLabel(d))+'</th>').join('')+'<th>Total de peças</th></tr></thead><tbody>'+labels.map(status=>{
        const items=list.filter(r=>norm(r.status)===norm(status));
        return '<tr><th>'+status+'</th>'+days.map(d=>cell(items.filter(r=>date(r)===d),title+' · '+status+' · '+dateLabel(d))).join('')+cell(items,title+' · '+status)+'</tr>';
      }).join('')+'</tbody><tfoot><tr><th>Total de peças</th>'+days.map(d=>cell(list.filter(r=>date(r)===d),title+' · '+dateLabel(d))).join('')+cell(list,title+' · Total')+'</tr></tfoot></table></div>';
    }
    return [['Marketplaces',['Shopee','Amazon','TikTok']],['Transportadoras',['Click Retire','L4B','Jadlog']],['Demais canais',['Outros canais']]].map(([section,names])=>{
      if(section==='Demais canais'&&!rows.some(r=>channel(r)==='Outros canais'))return '';
      return '<section class="shipping-channel-section"><div class="card-head"><h3>'+section+'</h3><p>Peças por status e data de cadastro · pedidos em carga aguardando finalização no WMS</p></div><div class="priority-cards">'+names.map(name=>{
        const list=rows.filter(r=>channel(r)===name);
        return '<article class="card priority-card" data-shipping-channel="'+name+'"><div class="card-head"><div><h2>'+name+'</h2><p>Conferência concluída · Enviado para faturamento · Faturado · Coleta iniciada</p></div><strong>'+fmt(sum(list,'products'))+' peças</strong></div>'+summary(list,name+' · Em carga')+matrix(list,name)+'</article>';
      }).join('')+'</div></section>';
    }).join('');
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
