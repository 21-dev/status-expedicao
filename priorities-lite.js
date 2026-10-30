    /* Prioridades da planilha: quantidades por linha, sem deduplicar pedidos. */
    window.LitePriorities = (() => {
      const channels = [
        ['Click Retire', '20:00', '24h', ['ENTREGA EXPRESSA - CLIENTE RETIRA']],
        ['Amazon', '11:00', '24h', ['ENTREGA NORMAL/TO DO']],
        ['TikTok', '12:00', '24h', ['ENTREGA NORMAL/BYTEDANCE']],
        ['Shopee', '13:00', '24h', ['ENTREGA NORMAL/SHOPPE']],
        ['Jadlog Marketplace', '11:00', '24h', ['ENTREGA ECONÔMICA/JAD', 'ENTREGA NORMAL/JAD'], true],
        ['L4B Marketplace', '11:00', '24h', ['ENTREGA ECONÔMICA/L4B', 'ENTREGA NORMAL/L4B'], true],
        ['Jadlog Normal', '11:00', '48h', ['ENTREGA NORMAL/JAD'], false],
        ['L4B Normal', '11:00', '48h', ['ENTREGA NORMAL/L4B'], false]
      ];
      const classes = ['ALOM-SPASA-VENDA FUNCION.', 'SPASA-REM AMC', 'VENDA OMN CHANNEL'];
      const pending = ['AG. FORMAÇÃO DE ROMANEIO/ONDA', 'AG. RESOLUÇÃO QUEBRA - PACKING', 'AG. SEPARAÇÃO', 'CONFERÊNCIA INICIADA', 'IMPORTADO', 'SEPARAÇÃO CONCLUÍDA', 'SEPARAÇÃO INICIADA'];
      const hourStatuses = [...pending, 'AG. RESOLUÇÃO QUEBRA - SEPARAÇÃO', 'GERADA COM CORTE'];
      const norm = value => normalizeHeader(value).toUpperCase();
      const includes = (list, value) => list.some(item => norm(item) === norm(value));
      const esc = value => escapeHtml(String(value));
      const day = stamp => { const d = new Date(stamp); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
      const dateLabel = key => key === 'Sem cadastro' ? key : key.split('-').reverse().join('/');
      let latest;
      const buckets = new Map();
      let bucketId=0, detailRows=[], detailPage=0, detailMetric='products', trigger;
      function quantity(rows, metric, label, scope, suffix='') {
        const total=rows.reduce((sum,r)=>sum+(Number(r[metric])||0),0);
        if(!rows.length)return '<span class="priority-zero">'+fmt(total)+suffix+'</span>';
        const id=scope+'-'+(++bucketId);
        buckets.set(id,{rows,metric,label});
        return '<button type="button" class="priority-quantity" data-priority-detail="'+id+'" aria-label="'+esc('Detalhar '+label+': '+fmt(total)+suffix)+'">'+fmt(total)+suffix+'</button>';
      }
      function matrix(records, channel) {
        if (!records.length) return '<div class="empty-state compact">Nenhuma pendência neste canal.</div>';
        const dates = [...new Set(records.map(r => r.registeredStamp ? day(r.registeredStamp) : 'Sem cadastro'))].sort();
        const statuses = pending.filter(s => records.some(r => norm(r.status) === norm(s)));
        return '<div class="priority-scroll"><table class="priority-table"><thead><tr><th>Status</th>'+dates.map(d=>'<th>'+dateLabel(d)+'</th>').join('')+'<th>Total</th></tr></thead><tbody>'+statuses.map(s=>{
          const rows=records.filter(r=>norm(r.status)===norm(s));
          return '<tr><th>'+esc(s)+'</th>'+dates.map(d=>'<td>'+quantity(rows.filter(r=>(r.registeredStamp?day(r.registeredStamp):'Sem cadastro')===d),'products',channel+' · '+s+' · '+dateLabel(d),'matrix')+'</td>').join('')+'<td>'+quantity(rows,'products',channel+' · '+s,'matrix')+'</td></tr>';
        }).join('')+'</tbody><tfoot><tr><th>Total de peças</th>'+dates.map(d=>'<td>'+quantity(records.filter(r=>(r.registeredStamp?day(r.registeredStamp):'Sem cadastro')===d),'products',channel+' · '+dateLabel(d),'matrix')+'</td>').join('')+'<td>'+quantity(records,'products',channel+' · Total','matrix')+'</td></tr></tfoot></table></div>';
      }
      function render(metrics) {
        closeDetails();
        for(const key of buckets.keys())if(key.startsWith('matrix-'))buckets.delete(key);
        latest=metrics;
        const root=document.querySelector('#priorities-content'); if(!root)return;
        const records=metrics.gembaOrders||[];
        const selected=document.querySelector('#priority-channel').value;
        const eligible=records.filter(r=>includes(classes,r.orderClassification)&&includes(pending,r.status));
        const groups=channels.map(c=>({c,rows:eligible.filter(r=>includes(c[3],r.service)&&(c[4]===undefined||Boolean(r.marketplace)===c[4]))}));
        root.innerHTML=metrics.fileName?groups.filter(({c})=>!selected||c[0]===selected).map(({c,rows})=>'<article class="card priority-card"><div class="card-head"><div><h2>'+esc(c[0])+'</h2><p>Horário de referência '+c[1]+' · Prazo indicado '+c[2]+'</p></div><strong>'+quantity(rows,'products',c[0]+' · Total','matrix',' peças')+'</strong></div>'+matrix(rows,c[0])+'</article>').join(''):'<article class="card"><div class="empty-state">Importe o CSV operacional para visualizar as prioridades B2C.</div></article>';
        const missing=metrics.priorityMissingColumns||[];
        document.querySelector('#priorities-notice').textContent=missing.length?'Colunas ausentes no CSV: '+missing.join(', ')+'. As visões podem estar incompletas.':'Peças por data de cadastro. Horários e prazos são referências da planilha; o vencimento não é calculado.';
        renderHours();
      }
      function renderHours() {
        closeDetails();
        for(const key of buckets.keys())if(key.startsWith('hours-'))buckets.delete(key);
        const records=latest?.gembaOrders||[];
        const service=document.querySelector('#priority-hour-service').value;
        const date=document.querySelector('#priority-hour-date').value;
        const rows=records.filter(r=>includes(hourStatuses,r.status)&&r.actualImportedStamp&&(!service||norm(r.service)===norm(service))&&(!date||day(r.actualImportedStamp)===date));
        const days=[...new Set(rows.map(r=>day(r.actualImportedStamp)))].sort();
        document.querySelector('#priority-hours').innerHTML=days.length?'<div class="priority-scroll"><table class="priority-table"><thead><tr><th>Data de importação</th>'+Array.from({length:24},(_,h)=>'<th>'+String(h).padStart(2,'0')+'h</th>').join('')+'<th>Total</th></tr></thead><tbody>'+days.map(d=>{
          const daily=rows.filter(r=>day(r.actualImportedStamp)===d);
          return '<tr><th>'+dateLabel(d)+'</th>'+Array.from({length:24},(_,h)=>'<td>'+quantity(daily.filter(r=>new Date(r.actualImportedStamp).getHours()===h),'skus',dateLabel(d)+' · '+h+'h · '+(service||'Todos os serviços'),'hours')+'</td>').join('')+'<td>'+quantity(daily,'skus',dateLabel(d)+' · Total','hours')+'</td></tr>';
        }).join('')+'</tbody><tfoot><tr><th>Total</th>'+Array.from({length:24},(_,h)=>'<td>'+quantity(rows.filter(r=>new Date(r.actualImportedStamp).getHours()===h),'skus',h+'h · Todas as datas selecionadas','hours')+'</td>').join('')+'<td>'+quantity(rows,'skus','Importação por hora · Total','hours')+'</td></tr></tfoot></table></div>':'<div class="empty-state compact">Nenhuma importação pendente para os filtros selecionados.</div>';
      }
      function closeDetails(){const modal=document.querySelector('#priority-detail-modal');if(modal?.open)modal.close();}
      function showDetails(button){
        const bucket=buckets.get(button.dataset.priorityDetail);if(!bucket)return;
        openRecords(bucket.rows,bucket.label,button,bucket.metric);
      }
      function openRecords(rows,label,button,metric='products'){
        trigger=button;detailRows=rows;detailMetric=metric;detailPage=0;
        document.querySelector('#priority-detail-title').textContent=label;
        document.querySelector('#priority-detail-search').value='';
        updateDetails();document.querySelector('#priority-detail-modal').showModal();document.querySelector('#priority-detail-search').focus();
      }
      function filteredDetails(){
        const query=norm(document.querySelector('#priority-detail-search').value);
        const fields=['invoice','order','client','status','carrier','service','marketplace','load','wave','waveId','orderClassification','weighingUser'];
        return query?detailRows.filter(r=>fields.some(f=>norm(r[f]).includes(query))):detailRows;
      }
      const detailHeaders=['Nota fiscal','Remessa / Pedido','Importado em','Cadastrado em','Status','Qtde. Total de Produto','Qtde. de Produto','Volumes','Transportadora','Serviço','Marketplace','Carga','Onda','Destinatário','Classificação','Conferido em','Usuário da Pesagem'];
      function detailValues(r){
        const date=stamp=>stamp?new Date(stamp).toLocaleString('pt-BR',{hour12:false}):'';
        return [r.invoice,r.order,date(r.actualImportedStamp),date(r.registeredStamp),r.status,r.products,r.skus,r.volumes,r.carrier,r.service,r.marketplace,r.load,r.wave||r.waveId,r.client,r.orderClassification,r.conferenceAt,r.weighingUser];
      }
      function exportDetails(){
        const rows=filteredDetails();if(!rows.length)return;
        const cell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
        const csv=[detailHeaders,...rows.map(detailValues)].map(row=>row.map(cell).join(';')).join('\r\n');
        const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
        const link=document.createElement('a');link.href=url;
        const title=normalizeHeader(document.querySelector('#priority-detail-title').textContent).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
        const page=document.querySelector('.page.active')?.id;
        const prefix=page==='page-produtividade'?'produtividade':page==='page-expedicao'?'expedicao':'prioridades';
        link.download=prefix+'-'+title+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      function updateDetails(){
        const query=document.querySelector('#priority-detail-search').value.trim(),rows=filteredDetails();
        const pages=Math.max(1,Math.ceil(rows.length/100));detailPage=Math.min(detailPage,pages-1);
        document.querySelector('#priority-detail-summary').textContent=fmt(rows.length)+' registros · '+fmt(new Set(rows.map(r=>r.order)).size)+' pedidos/remessas · '+fmt(rows.reduce((n,r)=>n+(Number(r[detailMetric])||0),0))+' '+(detailMetric==='skus'?'em Qtde. de Produto':'peças em Qtde. Total de Produto')+(query?' · resultado da busca':'');
        document.querySelector('#priority-detail-body').innerHTML=rows.slice(detailPage*100,(detailPage+1)*100).map(r=>'<tr>'+detailValues(r).map(v=>'<td>'+esc(v===undefined||v===null||v===''?'—':v)+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="17">Nenhum registro encontrado.</td></tr>';
        document.querySelector('#priority-detail-export').disabled=!rows.length;
        document.querySelector('#priority-detail-pagination').textContent='Página '+(detailPage+1)+' de '+pages;
        document.querySelector('#priority-detail-prev').disabled=detailPage===0;document.querySelector('#priority-detail-next').disabled=detailPage+1>=pages;
      }
      document.addEventListener('DOMContentLoaded',()=>{
        document.body.insertAdjacentHTML('beforeend','<dialog id="priority-detail-modal" class="priority-detail-modal" aria-labelledby="priority-detail-title" aria-describedby="priority-detail-summary"><div class="priority-detail-head"><div><small>DETALHAMENTO DAS PRIORIDADES</small><h2 id="priority-detail-title"></h2><p id="priority-detail-summary" aria-live="polite"></p></div><button type="button" class="btn secondary" id="priority-detail-close" aria-label="Fechar detalhes">Fechar ×</button></div><label class="priority-detail-search">Buscar nota, pedido, cliente, status ou transportadora<input type="search" id="priority-detail-search" placeholder="Digite para filtrar os registros"></label><div class="priority-detail-scroll" tabindex="0" role="region" aria-label="Registros da quantidade selecionada"><table class="priority-table"><thead><tr>'+['Nota fiscal','Remessa / Pedido','Importado em','Cadastrado em','Status','Qtde. Total de Produto','Qtde. de Produto','Volumes','Transportadora','Serviço','Marketplace','Carga','Onda','Destinatário','Classificação'].map(s=>'<th>'+s+'</th>').join('')+'</tr></thead><tbody id="priority-detail-body"></tbody></table></div><div class="priority-detail-footer"><button type="button" class="btn secondary" id="priority-detail-prev">Anterior</button><span id="priority-detail-pagination" aria-live="polite"></span><button type="button" class="btn secondary" id="priority-detail-next">Próxima</button></div></dialog>');
        const modal=document.querySelector('#priority-detail-modal');
        modal.querySelector('thead tr').innerHTML=detailHeaders.map(s=>'<th>'+s+'</th>').join('');
        modal.querySelector('.priority-detail-head small').textContent='DETALHAMENTO OPERACIONAL';
        document.querySelector('.priority-detail-search').insertAdjacentHTML('afterend','<div class="priority-detail-export-bar"><button type="button" class="btn primary" id="priority-detail-export">Exportar CSV</button><small>Exporta todos os registros da busca, incluindo as demais páginas.</small></div>');
        document.querySelector('#priority-detail-export').addEventListener('click',exportDetails);
        modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeDetails()}});
        document.querySelector('#page-prioridades')?.addEventListener('click',event=>{const button=event.target.closest('[data-priority-detail]');if(button)showDetails(button)});
        document.querySelector('#priority-detail-close').addEventListener('click',closeDetails);
        modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDetails()}});
        modal.addEventListener('close',()=>{detailRows=[];if(trigger?.isConnected)trigger.focus();trigger=null});
        document.querySelector('#priority-detail-search').addEventListener('input',()=>{detailPage=0;updateDetails()});
        document.querySelector('#priority-detail-prev').addEventListener('click',()=>{detailPage--;updateDetails()});document.querySelector('#priority-detail-next').addEventListener('click',()=>{detailPage++;updateDetails()});
        const select=document.querySelector('#priority-channel');if(!select)return;channels.forEach(c=>select.add(new Option(c[0],c[0])));
        const services=document.querySelector('#priority-hour-service');[...new Set(channels.flatMap(c=>c[3]))].forEach(s=>services.add(new Option(s,s)));services.value='ENTREGA NORMAL/BYTEDANCE';
        select.addEventListener('change',()=>render(latest));services.addEventListener('change',renderHours);document.querySelector('#priority-hour-date').addEventListener('change',renderHours);
        document.querySelector('#priority-import').addEventListener('click',()=>document.querySelector('#csv-input').click());
        if(latest)render(latest);
      });
      return {render,openRecords};
    })();
