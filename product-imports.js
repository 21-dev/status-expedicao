/* Product imports: all non-cancelled CSV rows, quantity in Qtde. Total de Produto. */
window.ProductImports = (() => {
  const groups=[['economica','Econômica/L4B','#00819b'],['expressa','Expressa · Cliente retira','#0064e8'],['jad','Normal/JAD','#edab00'],['shopee','Normal/Shopee','#823ed2'],['outros','Outras entregas','#64748b']];
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const statusKey=value=>{
    let key=norm(value).replace(/[.]/g,'').replace(/\s*\/\s*/g,'/');
    if(key==='ag formacao de romaneio/onda')key='ag formacao de romaneio';
    return key||'__missing__';
  };
  const defaultStatuses={imports:['AG. FORMAÇÃO DE ROMANEIO','AG. SEPARAÇÃO','CONFERÊNCIA INICIADA','GERADA COM CORTE','IMPORTADO','SEPARAÇÃO CONCLUÍDA','SEPARAÇÃO INICIADA'],billed:['CONFERÊNCIA CONCLUÍDA','FATURADO','COLETA INICIADA']};
  const selectedStatuses={imports:new Set(defaultStatuses.imports.map(statusKey)),billed:new Set(defaultStatuses.billed.map(statusKey))};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const percent=(n,total)=>total?fmt(n/total*100)+'%':'0%';
  const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
  function time(stamp){if(!stamp)return {day:'',hour:-1};const p=Object.fromEntries(parts.formatToParts(new Date(stamp)).map(p=>[p.type,p.value]));return {day:p.year+'-'+p.month+'-'+p.day,hour:Number(p.hour)};}
  function marketplace(r){const m=norm(r.marketplace),s=norm(r.service);if(/shopee|shoppe|shps/.test(m+' '+s))return 'shopee';if(/bytedance|tiktok/.test(m+' '+s))return 'bytedance';if(/to\s*do|amazon/.test(m+' '+s))return 'todo';return 'outros';}
  function delivery(r){const s=norm(r.service);if(s.includes('expressa'))return 'expressa';if(/shopee|shoppe/.test(s))return 'shopee';if(s.includes('/jad'))return 'jad';if(s.includes('/l4b')&&s.includes('economica'))return 'economica';return 'outros';}
  function shipmentDeadline(record,now=Date.now()){
    const service=norm(record.service),status=statusKey(record.status);
    const shipped=record.processed===true||String(record.processed)==='1'||/^(expedido|expedida|enviado|despachado|despachada)$/.test(status);
    if(shipped||String(record.processedAt||'').trim())return {overdue:false,due:0,reason:'Pedido já expedido'};
    const stamp=Number(record.actualImportedStamp)||0;
    if(!stamp)return {overdue:false,due:0,reason:'Sem data de importação'};
    const market=marketplace(record)!=='outros'||Boolean(String(record.marketplace||'').trim());
    if(market){
      const p=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp)).map(p=>[p.type,p.value]));
      const afterCutoff=Number(p.hour)*3600+Number(p.minute)*60+Number(p.second)>13*3600;
      const date=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+(afterCutoff?1:0),19));
      const target=date.getTime();let due=target;
      for(let i=0;i<2;i++){
        const z=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(due)).map(p=>[p.type,p.value]));
        due+=target-Date.UTC(Number(z.year),Number(z.month)-1,Number(z.day),Number(z.hour),Number(z.minute),Number(z.second));
      }
      return {overdue:now>due,due,reason:'Marketplace: importado '+(afterCutoff?'após 13h; expedir até 19h do dia seguinte':'até 13h; expedir até 19h do mesmo dia')};
    }
    if(!/economica|normal/.test(service))return {overdue:false,due:0,reason:'Serviço sem prazo definido'};
    const due=stamp+48*3600000;
    return {overdue:now>due,due,reason:'Prazo de 48 horas após a importação'};
  }
  function model(metrics,filter={}){
    const rows=(metrics.gembaOrders||[]).filter(r=>norm(r.service)).map(r=>({...r,...time(r.actualImportedStamp),quantity:Math.max(0,Number(r.products)||0),shipmentSla:shipmentDeadline(r),market:marketplace(r),delivery:delivery(r)})).filter(r=>(!filter.service||norm(r.service)===filter.service)&&(!filter.market||r.market===filter.market)&&(!filter.date||r.day===filter.date)&&(!Array.isArray(filter.statuses)||filter.statuses.includes(statusKey(r.status))));
    const sum=rs=>rs.reduce((n,r)=>n+r.quantity,0),total=sum(rows),hours=Array.from({length:24},(_,h)=>({hour:h,values:groups.map(g=>sum(rows.filter(r=>r.hour===h&&r.delivery===g[0]))),total:sum(rows.filter(r=>r.hour===h))}));
    return {rows,total,hours,groups:groups.map(g=>({id:g[0],label:g[1],color:g[2],total:sum(rows.filter(r=>r.delivery===g[0]))})),undated:sum(rows.filter(r=>!r.day)),sum};
  }
  let latest={};
  const detailBuckets=new Map();
  const dayExpansionOverrides=new Map();
  function dayIsCollapsed(key){
    if(dayExpansionOverrides.has(key))return dayExpansionOverrides.get(key);
    const day=key.split('|').pop(),today=time(Date.now()).day;
    const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
    return day!==today&&day!==yesterday;
  }
  function renderServiceFilter(){
    let select=document.querySelector('#imports-service');
    if(!select){document.querySelector('.imports-filters').insertAdjacentHTML('beforeend','<label for="imports-service">Serviço da transportadora<select id="imports-service"><option value="">Todos os serviços</option></select></label>');select=document.querySelector('#imports-service');select.addEventListener('change',draw);}
    const previous=select.value,services=new Map();for(const r of latest.gembaOrders||[])if(norm(r.service))services.set(norm(r.service),r.service.trim());
    select.innerHTML='<option value="">Todos os serviços</option>'+[...services].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).map(([key,label])=>'<option value="'+esc(key)+'">'+esc(label)+'</option>').join('');
    select.value=services.has(previous)?previous:'';
  }
  function detailQuantity(rows,label){
    const total=rows.reduce((n,r)=>n+r.quantity,0);if(!rows.length)return '<span class="priority-zero">0</span>';
    const id=String(detailBuckets.size);detailBuckets.set(id,{rows,label});
    const late=rows.filter(r=>r.shipmentSla?.overdue),lateOrders=new Set(late.map(r=>r.order||r.invoice).filter(Boolean)).size;
    const due=late.length?Math.min(...late.map(r=>r.shipmentSla.due)):0;
    const alert=late.length?' · '+(lateOrders||late.length)+' pedidos não expedidos fora do prazo. Primeiro vencimento: '+new Date(due).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';

    return '<button type="button" class="priority-quantity" data-import-detail="'+id+'" title="'+esc(label+alert)+'" aria-label="'+esc('Detalhar '+label+': '+fmt(total)+' produtos'+alert)+'">'+(late.length?'<span class="imports-shipment-alert" aria-hidden="true">!</span> ':'')+fmt(total)+'</button>';
  }
  function pivot(rows,title,id){
    const services=[...new Map(rows.map(r=>[norm(r.service),r.service.trim()]))].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
    if(!rows.length)return '<article class="card imports-panel imports-pivot" id="'+id+'"><h3>'+esc(title)+'</h3><p class="imports-empty">Nenhum registro para os filtros selecionados.</p></article>';
    const buckets=new Map();for(const r of rows){const key=r.day||'Sem data';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}
    const sum=records=>records.reduce((n,r)=>n+r.quantity,0);
    const line=(label,records,kind,dayKey='',rowId='')=>'<tr class="'+kind+'"'+(dayKey?' data-import-day="'+esc(dayKey)+'"':'')+(rowId?' id="'+rowId+'"':'')+(kind==='imports-hour-detail'&&dayIsCollapsed(dayKey)?' hidden':'')+'><th scope="row">'+(kind==='imports-day-total'?'<button type="button" class="imports-day-toggle" data-import-day-toggle="'+esc(dayKey)+'" aria-expanded="'+(!dayIsCollapsed(dayKey))+'"><span aria-hidden="true">'+(dayIsCollapsed(dayKey)?'▸':'▾')+'</span> '+esc(label)+'</button>':esc(label))+'</th>'+services.map(([service,name])=>{const subset=records.filter(r=>norm(r.service)===service),value=sum(subset),tone=value===0?'empty':value<=10?'good':value<=30?'warn':'bad';return '<td class="imports-matrix-value '+tone+'">'+detailQuantity(subset,title+' · '+label+' · '+name)+'</td>';}).join('')+'<td class="imports-matrix-total">'+detailQuantity(records,title+' · '+label+' · Total')+'</td></tr>';
    let body='';for(const [day,records] of [...buckets].sort((a,b)=>a[0].localeCompare(b[0]))){const label=day==='Sem data'?'Sem data de importação':day.split('-').reverse().join('/');const dayKey=id+'|'+day;body+=line(label+' · subtotal',records,'imports-day-total',dayKey);const hours=[...new Set(records.map(r=>r.hour))].sort((a,b)=>a-b);for(const hour of hours)body+=line(label+' · '+(hour<0?'Sem horário':String(hour).padStart(2,'0')+'h'),records.filter(r=>r.hour===hour),'imports-hour-detail',dayKey);}
    const headers=services.map(([key,name])=>{
      const record=rows.find(r=>norm(r.service)===key),carrier=String(record.carrier||'').trim()||name.split('/').pop();
      return '<th scope="col"><div class="imports-service-heading"><img src="'+esc(carrierLogoData(carrier))+'" alt=""><span>'+esc(name)+'<small>'+esc(carrier)+'</small></span></div></th>';
    }).join('');
    return '<article class="card imports-panel imports-pivot imports-conference-matrix" id="'+id+'"><h3>'+esc(title)+'</h3><p class="imports-pivot-hint">Produtos por data e hora de importação · selecione uma quantidade para consultar notas e pedidos.</p><div class="imports-scroll" tabindex="0" role="region" aria-label="'+esc(title+' por dia, hora e serviço')+'"><table><thead><tr><th scope="col">Data / hora</th>'+headers+'<th scope="col">Total</th></tr></thead><tbody>'+body+'</tbody><tfoot>'+line('Total geral',rows,'')+'</tfoot></table></div><div class="imports-matrix-legend"><span><i class="empty"></i>Sem produtos</span><span><i class="good"></i>Até 10 produtos</span><span><i class="warn"></i>11 a 30 produtos</span><span><i class="bad"></i>Acima de 30 produtos</span><span>Cores indicam quantidade de produtos.</span><span><b class="imports-shipment-alert">!</b> Pedido não expedido fora do prazo</span></div></article>';
  }
  function detailedViews(m,billedModel){
    detailBuckets.clear();
    const billed=billedModel.rows;
    const marketRows=rows=>rows.filter(r=>r.market!=='outros'||String(r.marketplace||'').trim());
    return '<section class="imports-deep" aria-labelledby="imports-deep-title"><h2 class="imports-area" id="imports-deep-title">Detalhamento por dia, hora e serviço</h2><p class="imports-notice">Importados e Faturados usam suas próprias seleções de status. Todos os quadros usam a data de importação. A visão marketplace inclui os canais identificados pelo serviço ou pelo campo Marketplace.</p><div class="imports-pivot-grid">'+pivot(m.rows,'Importado · Geral','imports-pivot-general')+pivot(marketRows(m.rows),'Importado · Marketplaces','imports-pivot-market')+pivot(billed,'Faturado · Geral','imports-pivot-billed')+pivot(marketRows(billed),'Faturado · Marketplaces','imports-pivot-billed-market')+'</div></section>';
  }
  function renderStatusFilter(){
    for(const scope of ['imports','billed']){
      const prefix=scope==='imports'?'imports':'billed',panelId=prefix+'-status-filter';
      let panel=document.getElementById(panelId);
      if(!panel){
        document.querySelector('#imports-notice').insertAdjacentHTML('beforebegin','<fieldset class="imports-status-filter" id="'+panelId+'"><legend>Status das notas fiscais · '+(scope==='imports'?'Importados':'Faturados')+'</legend><div class="imports-status-actions"><span>'+(scope==='imports'?'Aplicados aos indicadores, gráfico e quadros de importados.':'Aplicados somente aos quadros de faturados.')+'</span><button type="button" class="btn secondary" data-imports-status-action="default">Restaurar padrão</button><button type="button" class="btn secondary" data-imports-status-action="all">Selecionar todos</button><button type="button" class="btn secondary" data-imports-status-action="none">Limpar seleção</button></div><div id="'+prefix+'-status-options" class="imports-status-options"></div><p id="'+prefix+'-status-summary" role="status"></p></fieldset>');
        panel=document.getElementById(panelId);
        panel.addEventListener('change',event=>{
          if(!event.target.matches('input[data-imports-status]'))return;
          selectedStatuses[scope]=new Set([...panel.querySelectorAll('input:checked')].map(input=>input.value));draw();
        });
        panel.addEventListener('click',event=>{
          const action=event.target.closest('[data-imports-status-action]');if(!action)return;
          selectedStatuses[scope]=action.dataset.importsStatusAction==='all'?null:action.dataset.importsStatusAction==='default'?new Set(defaultStatuses[scope].map(statusKey)):new Set();
          renderStatusFilter();draw();
        });
      }
      const options=new Map(defaultStatuses[scope].map(label=>[statusKey(label),label]));
      for(const r of latest.gembaOrders||[]){if(!norm(r.service))continue;const key=statusKey(r.status);if(!options.has(key))options.set(key,String(r.status||'').trim()||'Não informado');}
      document.getElementById(prefix+'-status-options').innerHTML=[...options].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).map(([key,label])=>'<label><input type="checkbox" data-imports-status value="'+esc(key)+'" '+(selectedStatuses[scope]===null||selectedStatuses[scope].has(key)?'checked':'')+'><span>'+esc(label)+'</span></label>').join('');
    }
    updateStatusSummary();
  }
  function updateStatusSummary(){
    for(const prefix of ['imports','billed']){
      const inputs=[...document.querySelectorAll('#'+prefix+'-status-options input')],count=inputs.filter(input=>input.checked).length;
      const summary=document.getElementById(prefix+'-status-summary');
      if(summary)summary.textContent=count+' de '+inputs.length+' status selecionados'+(count===0?' · Nenhum produto será exibido neste grupo.':'');
    }
  }
  const table=(head,body,foot='')=>'<div class="imports-scroll"><table><thead><tr>'+head.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody>'+foot+'</table></div>';
  const cells=values=>'<tr>'+values.map((v,i)=>'<'+(i?'td':'th scope="row"')+'>'+esc(v)+'</'+(i?'td':'th')+'>').join('')+'</tr>';
  const period=h=>String(h).padStart(2,'0')+' – '+String(h+1).padStart(2,'0')+'h';
  function marketplaceChart(rows){
    const categories=[['shopee','Shopee','#ee4d2d'],['todo','To Do','#edab00'],['bytedance','ByteDance','#823ed2'],['outros','Outros marketplaces','#00819b']];
    const orders=new Map();let unidentified=0;
    for(const r of rows){
      if(r.market==='outros'&&!String(r.marketplace||'').trim())continue;
      const key=String(r.order||'').trim()||String(r.invoice||'').trim();
      if(!key){unidentified++;continue;}
      if(!orders.has(key))orders.set(key,r.market);
    }
    const total=orders.size,counts=categories.map(([id,label,color])=>({id,label,color,count:[...orders.values()].filter(m=>m===id).length}));
    let angle=0;const gradient=counts.map(g=>{const start=angle;angle+=total?g.count/total*100:0;return g.color+' '+start+'% '+angle+'%';}).join(',');
    return '<article class="card imports-panel imports-market-chart"><h3>Pedidos por marketplace</h3><div class="imports-distribution"><div class="imports-donut" role="img" aria-label="'+esc('Distribuição de '+fmt(total)+' pedidos por marketplace: '+counts.map(g=>g.label+' '+g.count).join(', '))+'" style="background:'+(total?'conic-gradient('+gradient+')':'#dce5ed')+'"><span>'+fmt(total)+'<small>pedidos</small></span></div><ul>'+counts.filter(g=>g.id!=='outros'||g.count).map(g=>'<li data-market-chart="'+g.id+'"><i style="background:'+g.color+'"></i><span>'+esc(g.label)+'<small>'+fmt(g.count)+' pedidos · '+percent(g.count,total)+'</small></span></li>').join('')+'</ul></div><p class="imports-pivot-hint">Pedidos únicos pelo Pedido de Venda; na ausência, pela Nota Fiscal. Apenas marketplaces identificados, conforme os filtros.'+(unidentified?' '+fmt(unidentified)+' registros sem pedido e nota fiscal não entram no gráfico.':'')+'</p>'+(!total?'<p class="imports-empty">Nenhum pedido de marketplace para os filtros selecionados.</p>':'')+'</article>';
  }
  function render(metrics){latest=metrics;renderServiceFilter();renderStatusFilter();draw();}
  function draw(){
    const root=document.querySelector('#imports-content');if(!root)return;updateStatusSummary();
    const market=document.querySelector('#imports-market').value,date=document.querySelector('#imports-date').value,filters={market,date,service:document.querySelector('#imports-service')?.value||''},m=model(latest,{...filters,statuses:selectedStatuses.imports===null?undefined:[...selectedStatuses.imports]}),billedModel=model(latest,{...filters,statuses:selectedStatuses.billed===null?undefined:[...selectedStatuses.billed]});
    document.querySelector('#imports-updated').textContent=latest.fileName?'Última atualização: '+window.BrowserData.updatedLabel(latest):'Aguardando importação do CSV';
    const missing=(latest.priorityMissingColumns||[]).filter(c=>['Importado em','Serviço da Transportadora','Marketplace'].includes(c));
    document.querySelector('#imports-notice').textContent=missing.length?'Colunas ausentes: '+missing.join(', ')+'. Reimporte o CSV completo.':'Quantidades em produtos · Qtde. Total de Produto · status selecionados · somente serviços preenchidos · notas canceladas não fazem parte da base · horário de Brasília.';
    if(!latest.fileName){root.innerHTML='<article class="card empty-state">Importe o CSV operacional para visualizar os indicadores de produtos.</article>';return;}
    const kpi=(label,n,sub,color)=>'<article class="imports-kpi" style="--import-tone:'+color+'"><span>'+esc(label)+'</span><strong>'+fmt(n)+'</strong><small>'+esc(sub)+'</small></article>';
    root.innerHTML='<h2 class="imports-area">Importado geral</h2><div class="imports-kpis">'+kpi('Total de produtos',m.total,'100% do total','#00819b')+[['retira','Cliente retira','#0064e8'],['todo','To Do/Amazon','#edab00'],['shopee','SHPS/Shopee','#ee4d2d'],['bytedance','ByteDance/TikTok','#823ed2']].map(([id,label,color])=>{const qty=m.sum(m.rows.filter(r=>id==='retira'?/cliente\s*retir|click\s*(e\s*)?retir/.test(norm(r.service)):r.market===id));return kpi(label,qty,percent(qty,m.total)+' do total',color);}).join('')+'</div>';
    root.insertAdjacentHTML('beforeend',marketplaceChart(m.rows));
    root.insertAdjacentHTML('beforeend','<h2 class="imports-area">Marketplaces · produtos</h2><div class="imports-markets">'+[['shopee','Shopee'],['todo','To Do'],['bytedance','ByteDance'],['outros','Outros / não informado']].map(([id,label])=>{const qty=m.sum(m.rows.filter(r=>r.market===id));return kpi(label,qty,percent(qty,m.total)+' do total','#00819b');}).join('')+'</div>'+(!m.rows.length?'<p class="imports-empty" role="status">Nenhum produto encontrado para os filtros selecionados.</p>':''));
    root.insertAdjacentHTML('beforeend',detailedViews(m,billedModel));
    const unique=new Map();for(const [index,r] of [...m.rows,...billedModel.rows].entries())if(r.shipmentSla.overdue)unique.set(r.order||r.invoice||'row-'+index,r);
    const late=unique.size;
    root.insertAdjacentHTML('afterbegin','<div class="imports-sla-notice" role="status"><strong>'+(late?'⚠ '+fmt(late)+' pedidos não expedidos fora do prazo':'Nenhum pedido com atraso identificado nos filtros atuais')+'</strong><span>Econômica e Normal: 48h após a importação. Marketplaces: até 13h → expedir até 19h do mesmo dia; após 13h → até 19h do dia seguinte. Horário de Brasília. Demais serviços e registros sem data não recebem prazo automático.</span></div>');
  }
  document.addEventListener('click',event=>{
    const toggle=event.target.closest('[data-import-day-toggle]');
    if(toggle){
      const key=toggle.dataset.importDayToggle,collapsed=!dayIsCollapsed(key);
      dayExpansionOverrides.set(key,collapsed);
      toggle.setAttribute('aria-expanded',String(!collapsed));
      toggle.querySelector('span').textContent=collapsed?'▸':'▾';
      toggle.closest('table').querySelectorAll('.imports-hour-detail').forEach(row=>{if(row.dataset.importDay===key)row.hidden=collapsed;});
      return;
    }
    const button=event.target.closest('[data-import-detail]');if(!button)return;const bucket=detailBuckets.get(button.dataset.importDetail);if(bucket)window.LitePriorities.openRecords(bucket.rows,bucket.label,button,'products');});
  document.addEventListener('DOMContentLoaded',()=>{['imports-market','imports-date'].forEach(id=>document.getElementById(id)?.addEventListener('change',draw));document.querySelector('#imports-refresh')?.addEventListener('click',()=>document.querySelector('#csv-input').click());});
  setInterval(()=>{if(document.querySelector('#page-importacoes.active')&&latest.fileName)draw();},60000);
  return {render,model,shipmentDeadline};
})();