(function(){
  'use strict';
  const E=window.ExpeditionEngine, esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={date:E.day(),records:[],schedules:{},types:{},filters:{search:'',stage:'',late:false,type:'',sort:'earliest'},ready:false,error:'',loading:false,request:0,timer:null,editing:null,busy:false,lastPoll:0,identity:''};
  const $=s=>document.querySelector(s), active=()=>$('#page-transportadoras')?.classList.contains('active');
  const drafts=new Map(),draftKey=(id,field)=>JSON.stringify([state.date,id,field]);
  function blockedReason(record){
    if(!navigator.onLine)return 'Sem conexão';
    if(!state.ready)return state.error.includes('ainda não habilitado')?'Banco pendente de ativação':'Aguardando conexão com o banco';
    if(!cloudState.user||!hasAccess('leader'))return 'Entre como Líder ou Gestão';
    return !canEdit(record)?'Prazo de 24h encerrado · somente Gestão':'';
  }
  const canEdit=(record)=>{
    if(!state.ready||!navigator.onLine||!cloudState.user||!hasAccess('leader'))return false;
    if(hasAccess('manager')||!record?.id)return true;
    const created=Date.parse(record.created_at);
    return Number.isFinite(created)&&Date.now()<=created+24*60*60*1000;
  };
  function rows(){const merged=new Map(E.schedule(state.date,state.schedules,state.types).map(r=>[r.schedule_id,r]));state.records.forEach(r=>merged.set(r.schedule_id,r));return [...merged.values()];}
  function displayed(){return E.visible(rows(),state.filters);}
  function button(field,r){
    const value=r[field],editable=canEdit(r),draft=drafts.get(draftKey(r.schedule_id,field));
    return `<div class="ex-inline-time"><input type="time" step="60" class="ex-hour-input" data-time-record="${esc(r.schedule_id)}" data-time-field="${field}" value="${esc(draft?draft.value:value?E.time(value):'')}" title="${esc(editable?'Preencha o horário e clique em Salvar horário':blockedReason(r))}" aria-label="${labels[field]} · ${esc(r.carrier)}" ${editable?'':'disabled'}>${editable?`<button type="button" class="ex-time-details" data-edit="${esc(r.schedule_id)}" data-field="${field}" aria-label="Revisar e salvar ${labels[field]} · ${esc(r.carrier)}">${draft?'Salvar horário':value?'Editar data / apagar':'Registrar'}</button>`:`<small class="ex-input-lock">${esc(blockedReason(r))}</small>`}${value&&E.day(value)!==state.date?'<small class="ex-day">'+esc(E.day(value))+'</small>':''}</div>`;
  }
  const labels={arrival_at:'Chegada no pátio',entry_at:'Entrada no CD',exit_at:'Saída do CD'};
  function rowHtml(r){const stage=E.stage(r),punctual=E.punctuality(r),tone=stage==='CONCLUÍDA'?'ok':stage==='AGUARDANDO'?'pending':'progress';return `<td><strong>${esc(r.carrier)}</strong>${r.updated_at?`<small class="ex-audit">Última atualização por ${esc(r.updated_by_name)} às ${E.time(r.updated_at)} · ${E.day(r.updated_at)}</small>`:''}</td><td><span class="ex-type ${r.transport_type==='B2C'?'consumer':''}">${esc(r.transport_type||'Não definido')}</span></td><td><strong>${E.time(r.cutoff_at)}</strong></td>${E.fields.map(f=>'<td>'+button(f,r)+'</td>').join('')}<td><span class="ex-badge ${tone}">${esc(stage)}</span></td><td><span class="ex-badge ${punctual==='ATRASADO'?'late':punctual==='OK'?'ok':'pending'}">${punctual==='OK'?'✓ ':punctual==='ATRASADO'?'! ':'◷ '}${punctual}</span></td><td>${canEdit(r)?`<button class="ex-action" data-edit="${esc(r.schedule_id)}" data-field="arrival_at">Editar</button>`:'<span class="ex-readonly">'+(cloudState.user&&hasAccess('leader')?'Somente Gestão · após 24h':'Consulta')+'</span>'}</td>`;}
  function render(){
    if(!$('#ex-rows'))return;
    const visible=displayed(),body=$('#ex-rows'),present=new Map([...body.querySelectorAll('tr[data-key]')].map(n=>[n.dataset.key,n]));
    body.querySelector('.ex-empty-row')?.remove();
    visible.forEach((r,index)=>{let tr=present.get(r.schedule_id);if(!tr){tr=document.createElement('tr');tr.dataset.key=r.schedule_id;}present.delete(r.schedule_id);const html=rowHtml(r),typing=canEdit(r)&&tr.contains(document.activeElement)&&document.activeElement.matches('.ex-hour-input');if(!typing&&tr.innerHTML!==html)tr.innerHTML=html;tr.className=E.punctuality(r)==='ATRASADO'?'ex-late-row':E.stage(r)==='CONCLUÍDA'?'ex-complete-row':'';if(body.children[index]!==tr)body.insertBefore(tr,body.children[index]||null);});present.forEach(n=>n.remove());
    if(!visible.length)body.innerHTML=`<tr class="ex-empty-row"><td colspan="9">${state.loading?'Carregando programação e registros…':state.error?'Não foi possível carregar os dados compartilhados.':rows().length?'Nenhuma transportadora corresponde aos filtros.':Object.keys(state.schedules).length?'Nenhuma transportadora programada para esta data.':'Programação vazia. Cadastre a grade em Configurações.'}</td></tr>`;
    const icons=['⇢','◷','▱','⌂','✓','!'];$('#ex-cards').innerHTML=Object.entries(E.totals(visible)).map(([label,n],i)=>`<article class="ex-card"><span class="ex-card-icon ex-icon-${i}">${icons[i]}</span><div><strong>${n}</strong><small>${label}</small></div></article>`).join('');
    $('#ex-count').textContent=`${visible.length} de ${rows().length} coletas · totais da visão filtrada`;
    $('#ex-notice').textContent=state.loading?'Carregando dados compartilhados…':state.error||(!canEdit()?'Consulta · autentique-se como Líder ou Gestão para registrar horários.':hasAccess('manager')?'Gestão · edição liberada, inclusive após 24 horas. Dados compartilhados.':'Edição até 24 horas após o primeiro registro da coleta; depois, somente Gestão.');
    $('#ex-notice').classList.toggle('ex-error',Boolean(state.error));
    $('#ex-clear').hidden=!(state.filters.search||state.filters.stage||state.filters.late||state.filters.type||state.filters.sort!=='earliest'||state.date!==E.day());
    $('#ex-export').disabled=!state.ready||state.loading;updateNext();
  }
  function updateNext(){const node=$('#ex-next');if(!node)return;const now=Date.now(),all=rows().filter(r=>!r.arrival_at).sort((a,b)=>Date.parse(a.cutoff_at)-Date.parse(b.cutoff_at)),next=all.find(r=>Date.parse(r.cutoff_at)>=now)||all[0];if(!next){node.innerHTML='<small>Próximo corte</small><strong>Sem cortes pendentes</strong><span>Programação do dia selecionado</span>';return;}const minutes=Math.ceil(Math.abs(Date.parse(next.cutoff_at)-now)/60000),late=now>Date.parse(next.cutoff_at);node.innerHTML=`<small>${late?'Corte pendente':'Próximo corte'}</small><strong>${E.time(next.cutoff_at)} · ${esc(next.carrier)}</strong><span>${late?'Atrasado há':'Faltam'} ${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}min · ${E.punctuality(next,now)}</span>`;}
  async function load(background=false){
    if(state.loading||state.busy)return;const request=++state.request,date=state.date;state.loading=true;if(!background)render();
    try{
      if(!navigator.onLine)throw Error('Conexão indisponível. Os horários não serão salvos offline.');
      if(!cloudState.client)throw Error('A conexão compartilhada ainda não está disponível. Tente atualizar.');
      const [settings,result]=await Promise.all([cloudState.client.from('system_settings').select('payload').eq('setting_key','pickup_schedules').maybeSingle(),cloudState.client.from('daily_pickups').select('*').eq('operation_date',date)]);
      if(request!==state.request||date!==state.date)return;
      if(settings.error)throw settings.error;if(result.error)throw result.error;
      state.schedules=settings.data?.payload||{};state.records=result.data||[];state.ready=true;state.error='';
      if(state.editing){const current=state.records.find(r=>r.schedule_id===state.editing.record.schedule_id);if((current?.version||0)!==state.editing.record.version){state.editing.conflict=true;$('#ex-form-message').textContent='Registro alterado por outro usuário. Cancele e reabra para revisar os novos horários.';$('#ex-save').disabled=true;}}
    }catch(error){if(request!==state.request)return;state.ready=false;state.error=error.code==='42P01'||error.code==='PGRST205'?'Registro compartilhado ainda não habilitado. A migração precisa ser aplicada pelo responsável.':error.code==='42501'?'Sem permissão para acessar os registros.':'Falha na sincronização. '+(error.message||'Verifique a conexão e tente novamente.');}
    finally{if(request===state.request){state.loading=false;state.lastPoll=Date.now();render();}}
  }
  function openEditor(id,field,opener,snapshot){
    const current=rows().find(r=>r.schedule_id===id),record=snapshot||current;if(!record||!canEdit(current||record))return;
    state.editing={record:{...record},field,opener,conflict:false};$('#ex-modal-title').textContent=labels[field];$('#ex-modal-subtitle').textContent=record.carrier+' · corte '+E.time(record.cutoff_at)+' · operação '+state.date;
    $('#ex-field').value=field;$('#ex-event-date').min=state.date;$('#ex-event-date').value=record[field]?E.day(record[field]):state.date;$('#ex-event-time').value=record[field]?E.time(record[field]):'';$('#ex-type').value=record.transport_type||'';
    const conflict=(current?.version||0)!==record.version;state.editing.conflict=conflict;
    $('#ex-form-message').textContent=conflict?'Registro alterado por outro usuário. Cancele e reabra para revisar os novos horários.':'';$('#ex-save').disabled=conflict;$('#ex-delete').disabled=conflict;$('#ex-delete').hidden=!record[field];$('#ex-dialog').showModal();$('#ex-event-time').focus();
  }
  function closeEditor(){if(state.busy)return;const opener=state.editing?.opener;if(state.editing)drafts.delete(draftKey(state.editing.record.schedule_id,state.editing.field));$('#ex-dialog').close();state.editing=null;render();if(opener?.isConnected)opener.focus();}
  async function save(remove=false){
    const editing=state.editing;if(!editing||state.busy)return;
    const message=$('#ex-form-message');message.textContent='';
    if(!canEdit(editing.record)){message.textContent='Edição indisponível. Após 24 horas do primeiro registro, somente Gestão pode alterar. Verifique também sua conexão e acesso.';return;}
    if(editing.conflict){message.textContent='Registro alterado por outro usuário. Cancele e reabra.';return;}
    if(remove&&!confirm('Apagar '+labels[editing.field]+' de '+editing.record.carrier+'?'))return;
    const record={...editing.record};try{record[editing.field]=remove?null:E.timestamp($('#ex-event-date').value,$('#ex-event-time').value);record.transport_type=$('#ex-type').value||null;E.validate(record);}catch(error){message.textContent=error.message;return;}
    state.busy=true;$('#ex-dialog').querySelectorAll('button,input,select').forEach(n=>n.disabled=true);message.textContent='Salvando horário…';
    try{
      const values={transport_type:record.transport_type,...Object.fromEntries(E.fields.map(f=>[f,record[f]]))};let query;
      if(record.id)query=cloudState.client.from('daily_pickups').update({...values,version:record.version}).eq('id',record.id).eq('version',record.version).select('*').maybeSingle();
      else query=cloudState.client.from('daily_pickups').insert({...values,operation_date:record.operation_date,schedule_id:record.schedule_id,carrier:record.carrier,cutoff_at:record.cutoff_at}).select('*').single();
      const {data,error}=await query;if(error)throw error;if(!data)throw {code:'40001'};
      const index=state.records.findIndex(r=>r.schedule_id===data.schedule_id);if(index<0)state.records.push(data);else state.records[index]=data;
      state.busy=false;closeEditor();render();$('#ex-feedback').textContent='Horário atualizado com sucesso · '+data.carrier+' · '+E.time(data.updated_at);
    }catch(error){const conflict=['23505','40001'].includes(error.code);message.textContent=conflict?'Registro alterado por outro usuário. Cancele e reabra para revisar antes de salvar.':error.code==='42501'?'Sem permissão ou prazo de 24 horas encerrado. Após esse prazo, somente Gestão pode alterar.':'Erro ao salvar. Nenhuma alteração foi confirmada. '+(error.message||'Verifique sua conexão e tente novamente.');editing.conflict=conflict;}
    finally{state.busy=false;$('#ex-dialog').querySelectorAll('button,input,select').forEach(n=>n.disabled=false);$('#ex-save').disabled=Boolean(state.editing?.conflict)||(state.editing&&!canEdit(state.editing.record));if(state.editing?.conflict)load(true);}
  }
  function exportCsv(){if(!state.ready)return;const blob=new Blob([E.csv(displayed())],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='transportadoras-'+state.date+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function lifecycle(){
    const enabled=active()&&!document.hidden;
    if(!enabled){clearInterval(state.timer);state.timer=null;if(state.editing&&!state.busy)closeEditor();return;}
    if(!state.timer){load();let status='';state.timer=setInterval(()=>{updateNext();const nextStatus=rows().map(r=>E.punctuality(r)+':'+canEdit(r)).join('|')+canEdit();if(nextStatus!==status){status=nextStatus;render();}if(state.editing&&!state.busy&&!canEdit(state.editing.record)){$('#ex-save').disabled=true;$('#ex-delete').disabled=true;$('#ex-form-message').textContent='Edição indisponível. Após 24 horas do primeiro registro, somente Gestão pode alterar.';}if(Date.now()-state.lastPoll>=15000)load(true);},1000);}
    const identity=cloudState.role+':'+(cloudState.user?.id||'');if(identity!==state.identity){state.identity=identity;render();load(true);}
  }
  function refresh(){
    if(!$('#ex-rows'))mount();
    // Only build this small lookup on the existing render path (never on manual saves).
    const types=new Map();for(const r of currentMetrics.gembaOrders||[]){const type=r.segment==='b2c'?'B2C':r.segment==='b2bFranchise'||r.segment==='b2b'?'B2B':null;if(type){if(!types.has(r.carrier))types.set(r.carrier,new Set());types.get(r.carrier).add(type);}}
    state.types=Object.fromEntries([...types].filter(([,v])=>v.size===1).map(([k,v])=>[k,[...v][0]]));
    if(!state.ready)state.schedules=pickupSchedules;render();lifecycle();if(active()&&!state.ready&&!state.loading&&cloudState.client)load(true);
  }
  function mount(){
    $('#pickup-dashboard').innerHTML=`<div class="ex-summary"><div id="ex-cards"></div><article id="ex-next"></article></div><div class="ex-toolbar"><label class="ex-search"><span class="sr-only">Buscar transportadora</span><input id="ex-search" type="search" placeholder="⌕  Buscar transportadora"></label><div class="ex-tabs" role="group" aria-label="Etapa operacional">${[['','Todo o dia'],['AGUARDANDO','Aguardando'],['NO PÁTIO','No pátio'],['NO CD','No CD'],['CONCLUÍDA','Concluídas']].map(([value,label])=>`<button data-stage="${value}" aria-pressed="${!value}">${label}</button>`).join('')}</div><label class="ex-late-filter"><input id="ex-late" type="checkbox"> Atrasadas</label><select id="ex-type-filter" aria-label="Filtrar tipo"><option value="">B2B + B2C</option><option>B2B</option><option>B2C</option></select><select id="ex-sort" aria-label="Ordenar por"><option value="earliest">Corte mais cedo</option><option value="latest">Corte mais tarde</option><option value="carrier">Transportadora</option><option value="late">Atrasadas primeiro</option><option value="stage">Etapa operacional</option></select><button id="ex-clear" class="ex-action" hidden>Limpar filtros</button></div><div class="ex-status"><span id="ex-notice" role="status"></span><button id="ex-refresh" class="ex-action">↻ Atualizar</button></div><div class="ex-table-wrap" tabindex="0" aria-label="Coletas do dia, role para ver todas as colunas"><table class="ex-table"><thead><tr>${['Transportadora','Tipo','Corte Transporte','Chegada no Pátio','Entrada no CD','Saída do CD','Etapa','Pontualidade','Ações'].map(t=>'<th scope="col">'+t+'</th>').join('')}</tr></thead><tbody id="ex-rows"></tbody></table></div><footer class="ex-footer"><span>ⓘ Pontualidade calculada pela chegada no pátio em relação ao corte.</span><span id="ex-count"></span></footer><p id="ex-feedback" role="status"></p>`;
    const dialog=document.createElement('dialog');dialog.id='ex-dialog';dialog.className='ex-dialog';dialog.setAttribute('aria-labelledby','ex-modal-title');dialog.innerHTML=`<form id="ex-form"><small>REGISTRO OPERACIONAL · SÃO PAULO</small><h2 id="ex-modal-title"></h2><p id="ex-modal-subtitle"></p><label>Marco operacional<select id="ex-field">${E.fields.map(f=>`<option value="${f}">${labels[f]}</option>`).join('')}</select></label><div class="ex-form-grid"><label>Data do evento<input type="date" id="ex-event-date" required></label><label>Horário<input type="time" id="ex-event-time" required></label></div><button type="button" id="ex-now" class="ex-action">◷ Registrar horário atual</button><label>Tipo da coleta<select id="ex-type"><option value="">Não definido</option><option>B2B</option><option>B2C</option></select></label><p class="ex-help">Para operações após a meia-noite, selecione a data real do evento. A data operacional permanece a mesma.</p><p id="ex-form-message" role="status"></p><div class="ex-dialog-actions"><button type="button" id="ex-delete" class="ex-delete">Apagar horário</button><button type="button" id="ex-cancel" class="btn secondary">Cancelar</button><button type="submit" id="ex-save" class="btn primary">Salvar</button></div></form>`;document.body.append(dialog);
    $('#ex-date').value=state.date;$('#ex-date').onchange=()=>{if(!E.validDate($('#ex-date').value))return;state.date=$('#ex-date').value;state.request++;state.loading=false;state.records=[];state.ready=false;$('#ex-feedback').textContent='';render();load();};
    $('#ex-search').oninput=e=>{state.filters.search=e.target.value;render();};$('#ex-late').onchange=e=>{state.filters.late=e.target.checked;render();};$('#ex-type-filter').onchange=e=>{state.filters.type=e.target.value;render();};$('#ex-sort').onchange=e=>{state.filters.sort=e.target.value;render();};
    $('.ex-tabs').onclick=e=>{const b=e.target.closest('[data-stage]');if(!b)return;state.filters.stage=b.dataset.stage;$('.ex-tabs').querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));render();};
    $('#ex-clear').onclick=()=>{state.filters={search:'',stage:'',late:false,type:'',sort:'earliest'};$('#ex-search').value='';$('#ex-late').checked=false;$('#ex-type-filter').value='';$('#ex-sort').value='earliest';$('.ex-tabs button').click();if(state.date!==E.day()){$('#ex-date').value=E.day();$('#ex-date').onchange();}else render();};
    $('#ex-rows').onclick=e=>{const b=e.target.closest('[data-edit]');if(!b)return;const draft=drafts.get(draftKey(b.dataset.edit,b.dataset.field));openEditor(b.dataset.edit,b.dataset.field,b,draft?.record);if(draft&&state.editing){if(draft.value)$('#ex-event-time').value=draft.value;else if(!state.editing.conflict)$('#ex-form-message').textContent='Para remover o horário, use Apagar horário e confirme a exclusão.';}};$('#ex-refresh').onclick=()=>load();$('#ex-export').onclick=exportCsv;
    $('#ex-rows').addEventListener('focusin',e=>{const input=e.target.closest('.ex-hour-input');if(!input)return;const record=drafts.get(draftKey(input.dataset.timeRecord,input.dataset.timeField))?.record||rows().find(r=>r.schedule_id===input.dataset.timeRecord);input.pickupSnapshot=record?{...record}:null;});
    $('#ex-rows').addEventListener('input',e=>{
      const input=e.target.closest('.ex-hour-input');if(!input)return;
      const field=input.dataset.timeField,record=input.pickupSnapshot,value=input.value;
      if(!record||!canEdit(record))return;
      // Preserve unsaved typing across polling; open confirmation only on an explicit click.
      drafts.set(draftKey(input.dataset.timeRecord,field),{record,value});
      const action=input.parentElement.querySelector('[data-edit]');if(action)action.textContent='Salvar horário';
    });
    $('#ex-form').onsubmit=e=>{e.preventDefault();save();};$('#ex-cancel').onclick=closeEditor;$('#ex-delete').onclick=()=>save(true);$('#ex-now').onclick=()=>{$('#ex-event-date').value=E.day();$('#ex-event-time').value=E.time(Date.now());};
    $('#ex-field').onchange=e=>{const editing=state.editing,value=editing.record[e.target.value];editing.field=e.target.value;$('#ex-modal-title').textContent=labels[editing.field];$('#ex-event-date').value=value?E.day(value):state.date;$('#ex-event-time').value=value?E.time(value):'';$('#ex-delete').hidden=!value;$('#ex-form-message').textContent='';};
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
    new MutationObserver(lifecycle).observe($('#page-transportadoras'),{attributes:true,attributeFilter:['class']});
    new MutationObserver(lifecycle).observe(document.body,{attributes:true,attributeFilter:['data-access']});
    document.addEventListener('visibilitychange',lifecycle);window.addEventListener('pagehide',()=>{clearInterval(state.timer);state.timer=null;});window.addEventListener('pageshow',lifecycle);window.addEventListener('online',()=>active()&&load());window.addEventListener('offline',()=>{state.ready=false;state.error='Conexão indisponível. Reconecte para consultar e salvar dados atualizados.';render();});
  }
  window.DailyExpedition={refresh,exportCsv};
})();
