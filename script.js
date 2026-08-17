"use strict";

/**
 * LUFT · Status Operacional
 *
 * MAPA DE MANUTENÇÃO
 * 1. Acesso e Supabase: autenticação, papéis e sincronização das configurações.
 * 2. Importação do CSV: leitura, normalização, deduplicação e cálculo de métricas.
 * 3. Renderização: Dashboard, GEMBA, Central SLA, Conferência e Coletas.
 * 4. Perfis SLA: cadastro da regra V5 e cálculo do prazo de cada serviço.
 * 5. Exportações: textos, CSV e imagens gerados localmente pelo navegador.
 * 6. Eventos e navegação: listeners, rotas por hash e inicialização da aplicação.
 *
 * CONVENÇÕES IMPORTANTES
 * - Dados operacionais do CSV permanecem no navegador; apenas configurações são
 *   sincronizadas com o Supabase.
 * - Comparações de textos operacionais devem passar por normalizeHeader() ou
 *   normalizeSlaCentralValue() para tolerar acentos, espaços e mojibake.
 * - A Central SLA usa o fuso America/Sao_Paulo. Não substitua os helpers de data
 *   por Date local sem validar virada de dia e horário de verão.
 */

const $ = (selector) => document.querySelector(selector);

/* ===================== ACESSO E SINCRONIZAÇÃO ===================== */

// A chave anon é pública por definição; a autorização de escrita deve permanecer protegida por RLS no Supabase.
const SUPABASE_CONFIG={url:"https://ywicdcngxlagtkjbfjep.supabase.co",anonKey:"sb_publishable_R_TpeEkM0E9j3LVhW9OMhw_ZAP0mBaC"};
const cloudState={client:null,user:null,role:"operation",isManager:false,syncing:false,lastSync:null,gatewayRequired:true};
const ACCESS_LEVELS={operation:0,leader:1,manager:2,admin:3};
function accessLevel(role){return ACCESS_LEVELS[role]??ACCESS_LEVELS.operation}
function hasAccess(required){return accessLevel(cloudState.role)>=accessLevel(required||"operation")}
function ensureUnifiedNavigation(){
  const sidebar=$("#sidebar"),operationTitle=sidebar?.querySelector(".nav-title"),operationNav=operationTitle?.nextElementSibling,managerNavigation=$("#manager-navigation");
  if(!sidebar||!operationTitle||!operationNav||!managerNavigation||sidebar.querySelector(".command-navigation"))return;
  operationTitle.textContent="CENTRAL DE COMANDO";
  const commandNav=document.createElement("nav"),dashboardButton=operationNav.querySelector('[data-page="dashboard"]'),gembaButton=operationNav.querySelector('[data-page="gemba"]');
  commandNav.className="command-navigation";operationTitle.after(commandNav);if(dashboardButton)commandNav.append(dashboardButton);if(gembaButton)commandNav.append(gembaButton)
  const operationLabel=document.createElement("p");operationLabel.className="nav-title";operationLabel.textContent="OPERAÇÃO";commandNav.after(operationLabel);operationLabel.after(operationNav);
  managerNavigation.querySelector(".nav-title").textContent="ADMINISTRAÇÃO";
}
function createAccessGateway(){if($("#access-gateway"))return;const logo=document.querySelector(".brand .logo")?.src||"";document.body.insertAdjacentHTML("beforeend",'<div class="access-gateway show" id="access-gateway"><div class="gateway-shell"><section class="gateway-copy"><img class="gateway-logo" src="'+logo+'" alt="Luft"><small>LUFT · STATUS OPERACIONAL</small><h1>Como você deseja acessar?</h1><p>Escolha o ambiente adequado para sua rotina. O modo Operação mantém o painel simples e seguro; o modo Gestor libera os controles administrativos.</p></section><section class="gateway-modes"><button class="gateway-mode" id="gateway-operation"><span class="gateway-icon">▦</span><span><strong>Entrar no Modo Operação</strong><small>Visualizar indicadores, importar CSV, pesquisar pedidos e exportar relatórios. Não exige login.</small></span><span class="gateway-arrow">→</span></button><button class="gateway-mode manager" id="gateway-manager"><span class="gateway-icon">⚙</span><span><strong>Entrar como Gestor</strong><small>Visualização completa, configurações, perfis de SLA, metas e sincronização com o banco.</small></span><span class="gateway-arrow">→</span></button><div class="gateway-foot">As permissões de edição são validadas pelo Supabase.</div></section></div></div>');const right=$(".header-right");if(right&&!$("#operation-ribbon"))right.insertAdjacentHTML("afterbegin",'<span class="mode-ribbon operation" id="operation-ribbon">● Operação · leitura</span><span class="mode-ribbon manager" id="manager-ribbon">● Gestor · edição</span>');$("#gateway-operation").addEventListener("click",enterOperationMode);$("#gateway-manager").addEventListener("click",()=>{$("#access-gateway").classList.remove("show");showAuthModal()})}
function enterOperationMode(){cloudState.gatewayRequired=false;sessionStorage.setItem("luft-access-mode","operation");cloudState.role="operation";cloudState.isManager=false;applyAccessMode();$("#access-gateway")?.classList.remove("show");hideAuthModal();showToast("Modo Operação ativo · acesso somente visual.")}
function enterManagerMode(){cloudState.gatewayRequired=false;sessionStorage.setItem("luft-access-mode","manager");applyAccessMode();$("#access-gateway")?.classList.remove("show");hideAuthModal()}
function showAccessGateway(){cloudState.gatewayRequired=true;$("#auth-backdrop")?.classList.remove("show");$("#access-gateway")?.classList.add("show")}
function supabaseConfigured(){return /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_CONFIG.url)&&SUPABASE_CONFIG.anonKey&&!SUPABASE_CONFIG.anonKey.startsWith("COLE_AQUI")&&window.supabase}
function ensureDatabaseStatusUi(){if($("#database-status-title"))return;const page=$("#page-configuracoes"),intro=page&&page.querySelector(".intro");if(!page||!intro)return;intro.insertAdjacentHTML("afterend",'<article class="card database-status"><div class="database-status-icon">☁</div><div><small>SUPABASE</small><strong id="database-status-title">Banco não configurado</strong><p id="database-status-detail">Informe a URL e a chave pública no bloco SUPABASE_CONFIG do arquivo.</p></div><button class="btn secondary" id="database-sync">Sincronizar agora</button></article>')}
function updateDatabaseStatus(title,detail){ensureDatabaseStatusUi();if($("#database-status-title"))$("#database-status-title").textContent=title;if($("#database-status-detail"))$("#database-status-detail").textContent=detail}
function showAuthModal(){const authenticated=hasAccess("leader");$("#auth-backdrop").classList.add("show");$("#manager-login-form").hidden=authenticated;$("#auth-session").hidden=!authenticated;if(authenticated)$("#auth-session-email").textContent=cloudState.user?.email||"Usuário autenticado"}
function hideAuthModal(){$("#auth-backdrop").classList.remove("show");$("#auth-error").textContent=""}
function closeAuthModal(){if(cloudState.gatewayRequired)showAccessGateway();else hideAuthModal()}
function applyAccessMode(){const manager=cloudState.isManager,authenticated=hasAccess("leader"),roleLabels={operation:"Operação",leader:"Líder",manager:"Gestor",admin:"Administrador"};$("#manager-navigation").hidden=!manager;document.querySelectorAll("[data-min-role]").forEach(element=>element.hidden=!hasAccess(element.dataset.minRole));$("#access-avatar").textContent=manager?(cloudState.role==="admin"?"AD":"GE"):authenticated?"LI":"OP";$("#access-name").textContent=authenticated?(cloudState.user?.user_metadata?.name||cloudState.user?.email||roleLabels[cloudState.role]):"Modo Operação";$("#access-role").textContent=authenticated?roleLabels[cloudState.role]+" · acesso autenticado":"Acesso visual";document.body.dataset.access=cloudState.role;const pickupSettings=$("#pickup-go-settings");if(pickupSettings)pickupSettings.hidden=!manager;const active=document.querySelector(".page.active"),required=active?.dataset.minRole||(active&&["page-configuracoes","page-sla-profiles"].includes(active.id)?"manager":"operation");if(active&&!hasAccess(required))navigateToPage("dashboard",{replaceHash:true});if($("#gemba-goals-form"))updateGembaGoalAccess()}
async function verifyAccessProfile(user){if(!user||!cloudState.client)return"operation";const {data,error}=await cloudState.client.from("manager_profiles").select("role,active").eq("user_id",user.id).maybeSingle();if(error||!data?.active)return"operation";return Object.prototype.hasOwnProperty.call(ACCESS_LEVELS,data.role)?data.role:"operation"}
async function verifyManager(user){return accessLevel(await verifyAccessProfile(user))>=accessLevel("manager")}
async function applyCloudSettings(rows){const map=Object.fromEntries((rows||[]).map(row=>[row.setting_key,row.payload]));if(Array.isArray(map.sla_profiles)){slaProfiles=map.sla_profiles;localStorage.setItem("luft-sla-profiles-v1",JSON.stringify(slaProfiles))}if(map.pickup_schedules&&typeof map.pickup_schedules==="object"){pickupSchedules=map.pickup_schedules;localStorage.setItem("luft-pickup-schedules",JSON.stringify(pickupSchedules))}const cloudGemba=map.gemba_config;if(cloudGemba&&typeof cloudGemba==="object"){gembaConfig=sanitizeGembaConfig(cloudGemba);localStorage.setItem("luft-gemba-config",JSON.stringify(gembaConfig))}invalidateOperationalCaches();render(currentMetrics)}
async function pullCloudSettings(showMessage){if(!cloudState.client)return false;cloudState.syncing=true;updateDatabaseStatus("Sincronizando…","Buscando as configurações operacionais do banco.");const {data,error}=await cloudState.client.from("system_settings").select("setting_key,payload,updated_at");cloudState.syncing=false;if(error){updateDatabaseStatus("Falha na sincronização",error.message);if(showMessage)showToast("Não foi possível sincronizar com o banco.",true);return false}await applyCloudSettings(data);cloudState.lastSync=new Date();updateDatabaseStatus("Banco conectado","Última sincronização às "+cloudState.lastSync.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));if(showMessage)showToast("Configurações sincronizadas com o Supabase.");return true}
async function pushCloudSetting(key,payload){if(!cloudState.client||!cloudState.isManager)return false;const {error}=await cloudState.client.from("system_settings").upsert({setting_key:key,payload,updated_by:cloudState.user.id},{onConflict:"setting_key"});if(error){showToast("Alteração salva localmente, mas não sincronizada: "+error.message,true);return false}cloudState.lastSync=new Date();updateDatabaseStatus("Banco conectado","Alteração sincronizada às "+cloudState.lastSync.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));return true}
async function syncAllSettings(){if(!cloudState.client)return showToast("Configure o Supabase antes de sincronizar.",true);if(!cloudState.isManager)return pullCloudSettings(true);updateDatabaseStatus("Sincronizando…","Enviando as configurações locais e conferindo o banco.");const rows=[{setting_key:"sla_profiles",payload:slaProfiles,updated_by:cloudState.user.id},{setting_key:"pickup_schedules",payload:pickupSchedules,updated_by:cloudState.user.id},{setting_key:"gemba_config",payload:gembaConfig,updated_by:cloudState.user.id}];const {error}=await cloudState.client.from("system_settings").upsert(rows,{onConflict:"setting_key"});if(error){updateDatabaseStatus("Falha na sincronização",error.message);return showToast("Não foi possível sincronizar as configurações.",true)}await pullCloudSettings(false);showToast("Todas as configurações foram sincronizadas.")}
async function initializeSupabase(){ensureDatabaseStatusUi();const savedMode=sessionStorage.getItem("luft-access-mode");if(!supabaseConfigured()){updateDatabaseStatus("Banco aguardando configuração","Cole a URL do projeto e a chave pública anon no bloco SUPABASE_CONFIG.");applyAccessMode();if(savedMode==="operation")enterOperationMode();else showAccessGateway();return}cloudState.client=window.supabase.createClient(SUPABASE_CONFIG.url,SUPABASE_CONFIG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data:{session}}=await cloudState.client.auth.getSession();cloudState.user=session?.user||null;cloudState.role=await verifyAccessProfile(cloudState.user);cloudState.isManager=hasAccess("manager");applyAccessMode();await pullCloudSettings(false);if(hasAccess("leader"))enterManagerMode();else if(savedMode==="operation")enterOperationMode();else showAccessGateway();cloudState.client.auth.onAuthStateChange(async(event,sessionValue)=>{cloudState.user=sessionValue?.user||null;cloudState.role=await verifyAccessProfile(cloudState.user);cloudState.isManager=hasAccess("manager");applyAccessMode()})}

/* ===================== ESTADO OPERACIONAL E PERSISTÊNCIA ===================== */

const fmt = (value) => Number(value || 0).toLocaleString("pt-BR");
const zeroSummary = () => ({ orders: 0, products: 0, volumes: 0 });
function greetingForTime(referenceDate=new Date()){const hour=referenceDate.getHours();return hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite"}
let currentMetrics = createEmptyMetrics();
let slaRuntimeCache={metrics:null,profiles:null,pickups:null,minute:-1,records:[]};
function invalidateOperationalCaches(){slaRuntimeCache={metrics:null,profiles:null,pickups:null,minute:-1,records:[]}}

function createEmptyMetrics() {
  return {
    triaged: 0, processedToday: 0, withoutPdf: 0, pinRequests: 0, volumesToday: 0,
    recordCount: 0, receivedRows: 0, rejectedRows: 0, fileName: "", importedAt: "", triagedSummary: zeroSummary(),
    withoutPdfSummary: zeroSummary(), dispatchedToday: zeroSummary(), dispatchedYesterday: zeroSummary(),
    b2cHourly: [], b2bHourly: [], pinDetails: [], lastDispatch: null, d1Date: "",
    triagedByCarrier: [], productivity: { days: [] }, slaRecords: [], gembaOrders: [], slaCentralRecords: [],
    slaCentralDiagnostics: { missingColumns:[], invalidDates:0, unknownStatuses:{}, duplicateRows:0 }
  };
}

function normalizeHeader(value) {
  return String(value || "").replace(/^\ufeff/, "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

let pickupSchedules = loadPickupSchedules();
let slaProfiles = loadSlaProfiles();
const pickupDayNames = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
// As mesmas chaves locais são mantidas por compatibilidade com instalações já em uso.
function loadPickupSchedules(){try{return JSON.parse(localStorage.getItem("luft-pickup-schedules")||"{}")||{}}catch(error){return {}}}
function savePickupSchedules(){invalidateOperationalCaches();localStorage.setItem("luft-pickup-schedules",JSON.stringify(pickupSchedules));pushCloudSetting("pickup_schedules",pickupSchedules)}
function loadSlaProfiles(){try{const data=JSON.parse(localStorage.getItem("luft-sla-profiles-v1")||"[]");return Array.isArray(data)?data:[]}catch(error){return []}}
function saveSlaProfiles(){invalidateOperationalCaches();localStorage.setItem("luft-sla-profiles-v1",JSON.stringify(slaProfiles));pushCloudSetting("sla_profiles",slaProfiles)}
function validPickupTimes(value){return Array.from(new Set(String(value||"").split(/[,;\s]+/).map(item=>item.trim()).filter(item=>/^([01]\d|2[0-3]):[0-5]\d$/.test(item)))).sort()}
function carrierSchedule(carrier){const exact=pickupSchedules[carrier];if(exact)return exact;const key=Object.keys(pickupSchedules).find(name=>normalizeHeader(name)===normalizeHeader(carrier));return key?pickupSchedules[key]:null}
function nextPickupForCarrier(carrier,afterDate){const schedule=carrierSchedule(carrier);if(!schedule)return null;const after=new Date(afterDate);for(let offset=0;offset<15;offset++){const day=new Date(after);day.setDate(day.getDate()+offset);day.setHours(0,0,0,0);const times=schedule[String(day.getDay())]||[];for(const time of times){const [hour,minute]=time.split(":").map(Number),candidate=new Date(day);candidate.setHours(hour,minute,0,0);if(candidate>after)return candidate}}return null}

/* ===================== REGRA DE PERFIL SLA V5 ===================== */

function normalizedListIncludes(list,value){
  const target=normalizeHeader(value);
  return (list||[]).some(item=>normalizeHeader(item)===target);
}
// Os fallbacks em match/rule permitem abrir perfis V3/V4 sem migração destrutiva.
function profileServiceValues(profile){
  if(Array.isArray(profile?.services))return profile.services;
  if(Array.isArray(profile?.match?.services))return profile.match.services;
  return [];
}
function profileCutoff(profile){
  const value=profile?.cutoff||profile?.rule?.cutoff||"20:00";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)?value:"20:00";
}
function profileDeadlineTime(profile){
  const value=profile?.deadlineTime||profile?.rule?.deadlineTime||"23:59";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)?value:"23:59";
}
function profileDispatchDay(profile){
  const legacyNextDay=profile?.rule?.type==="next_business_day";
  const value=profile?.dispatchDay||(legacyNextDay?"next_day":"same_day");
  return value==="next_day"?"next_day":"same_day";
}
function profileMatchesRecord(profile,record){
  return Boolean(profile&&profile.active&&profileServiceValues(profile).length&&normalizedListIncludes(profileServiceValues(profile),record.service));
}
function matchingSlaProfile(record){
  return slaProfiles
    .filter(profile=>profileMatchesRecord(profile,record))
    .sort((a,b)=>(Number(a.priority)||9999)-(Number(b.priority)||9999)||String(a.name).localeCompare(String(b.name),"pt-BR"))[0]||null;
}
function dateKey(date){return String(date.getDate()).padStart(2,"0")+"/"+String(date.getMonth()+1).padStart(2,"0")+"/"+date.getFullYear()}

/**
 * Calcula o prazo final de um pedido a partir do perfil que corresponde ao serviço.
 *
 * Regra V5 (dias corridos):
 * - base "Mesmo dia": dentro do corte = D0; após o corte = D+1.
 * - base "Dia seguinte": dentro do corte = D+1; após o corte = D+2.
 * - sem perfil: importação + 48 horas exatas.
 *
 * O vencimento ocorre no último segundo do minuto configurado. Ex.: 18:00 aceita
 * o pedido até 18:00:59 e passa a vencido a partir de 18:01:00.
 *
 * @param {object} record Pedido com importedStamp e service.
 * @param {object|null} profile Perfil ativo encontrado para o serviço.
 * @returns {object|null} Prazo calculado e metadados usados pela Central SLA.
 */
function slaProfileDeadline(record,profile){
  if(!record?.importedStamp)return null;
  if(!profile){
    const due=record.importedStamp+48*3600000;
    return{due,dueDateKey:slaCentralDateKeyFromStamp(due),source:"Regra automática · 48 horas corridas após a importação",profileApplied:false,cutoff:"",deadlineTime:"",dispatchDay:""};
  }

  const imported=slaCentralZonedParts(record.importedStamp);
  const cutoffText=profileCutoff(profile);
  const [cutoffHour,cutoffMinute]=cutoffText.split(":").map(Number);
  const deadlineTime=profileDeadlineTime(profile);
  const [deadlineHour,deadlineMinute]=deadlineTime.split(":").map(Number);
  const afterCutoff=imported.hour*60+imported.minute>cutoffHour*60+cutoffMinute;
  const dispatchDay=profileDispatchDay(profile);
  const baseOffset=dispatchDay==="next_day"?1:0;
  const totalOffset=baseOffset+(afterCutoff?1:0);
  const importDateKey=slaCentralDateKeyFromStamp(record.importedStamp);
  const dueDateKey=slaCentralOffsetDateKey(importDateKey,totalOffset);
  const [year,month,day]=dueDateKey.split("-").map(Number);
  const due=slaCentralTimestamp(year,month,day,deadlineHour,deadlineMinute,59);
  const dayLabel=totalOffset===0?"mesmo dia":totalOffset===1?"dia seguinte":"D+"+totalOffset;

  return{due,dueDateKey,source:"Perfil "+profile.name+" · importar até "+cutoffText+" · expedir até "+deadlineTime+" no "+dayLabel,profileApplied:true,cutoff:cutoffText,deadlineTime,dispatchDay,afterCutoff,totalOffset};
}

/* ===================== LEITURA E NORMALIZAÇÃO DO CSV ===================== */

/**
 * Percorre o CSV sem criar uma matriz completa em memória. Isso mantém arquivos
 * grandes utilizáveis e respeita campos entre aspas, separadores e quebras de linha.
 */
function forEachCsvRow(text, callback) {
  let separator=",",probeQuoted=false,commas=0,semicolons=0;
  for(let probe=0;probe<Math.min(text.length,65536);probe++){const char=text[probe];if(char==='"'){if(probeQuoted&&text[probe+1]==='"'){probe++;continue}probeQuoted=!probeQuoted}else if(!probeQuoted&&(char==='\n'||char==='\r')){if(commas||semicolons)break}else if(!probeQuoted&&char===',')commas++;else if(!probeQuoted&&char===';')semicolons++}
  if(semicolons>commas)separator=";";
  let row = [], cell = "", quoted = false, rowIndex = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === separator && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) callback(row, rowIndex++);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim() !== "")) callback(row, rowIndex);
}

function parseBrazilianDateTime(value) {
  const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function slaState(dueStamp, referenceStamp, alertMinutes) {
  const now = new Date(referenceStamp || Date.now()), due = new Date(dueStamp), remaining = due - now;
  if (remaining < 0) return "overdue";
  if (alertMinutes>0&&remaining <= alertMinutes * 60000) return "critical";
  if (due.toDateString() === now.toDateString()) return "today";
  return "safe";
}

function operationalSector(status) {
  const value = normalizeHeader(status);
  if (value.includes("separ") || value.includes("importado") || value.includes("formacao")) return "Triagem";
  if (value.includes("conferencia")) return "Conferência";
  if (value.includes("fatur")) return "Faturamento";
  return "Expedição";
}

/* Regras de classificação exclusivas da Central SLA (Série 17). */
const SLA_CENTRAL_TIME_ZONE="America/Sao_Paulo";
// Alterar estes grupos muda em qual tabela cada status será contabilizado.
const SLA_CENTRAL_STATUS_GROUPS=Object.freeze({
  billing:Object.freeze(["importado","ag formacao de romaneio","aguardando separacao","separacao iniciada","separacao concluida","conferencia iniciada"]),
  shipping:Object.freeze(["coleta iniciada","faturado","conferencia concluida","enviado para faturamento"])
});

// Corrige textos UTF-8 interpretados incorretamente antes de normalizar acentos.
function repairCommonMojibake(value){
  let text=String(value==null?"":value);
  const replacements=[["ÃƒÂ","Ã"],["Ã¡","á"],["Ã¢","â"],["Ã£","ã"],["Ã¤","ä"],["Ã©","é"],["Ãª","ê"],["Ã­","í"],["Ã³","ó"],["Ã´","ô"],["Ãµ","õ"],["Ã¶","ö"],["Ãº","ú"],["Ã¼","ü"],["Ã§","ç"],["Ã","Á"],["Ã‚","Â"],["Ãƒ","Ã"],["Ã‰","É"],["ÃŠ","Ê"],["Ã","Í"],["Ã“","Ó"],["Ã”","Ô"],["Ã•","Õ"],["Ãš","Ú"],["Ã‡","Ç"],["Â "," "],["Â",""]];
  replacements.forEach(pair=>{text=text.split(pair[0]).join(pair[1])});
  return text;
}

function normalizeSlaCentralValue(value){
  return repairCommonMojibake(value).replace(/^\ufeff/,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
}

function slaCentralAreaForStatus(value){
  const normalized=normalizeSlaCentralValue(value);
  if(SLA_CENTRAL_STATUS_GROUPS.billing.includes(normalized))return"billing";
  if(SLA_CENTRAL_STATUS_GROUPS.shipping.includes(normalized))return"shipping";
  return"";
}

function slaCentralZonedParts(stamp){
  const values={};
  new Intl.DateTimeFormat("en-CA",{timeZone:SLA_CENTRAL_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(stamp)).forEach(part=>{if(part.type!=="literal")values[part.type]=Number(part.value)});
  return{year:values.year,month:values.month,day:values.day,hour:values.hour,minute:values.minute,second:values.second};
}

function slaCentralTimestamp(year,month,day,hour,minute,second){
  const target=Date.UTC(year,month-1,day,hour,minute,second),valid=new Date(Date.UTC(year,month-1,day));
  if(valid.getUTCFullYear()!==year||valid.getUTCMonth()!==month-1||valid.getUTCDate()!==day)return NaN;
  let stamp=target;
  for(let index=0;index<3;index++){const parts=slaCentralZonedParts(stamp),represented=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);stamp+=target-represented}
  const checked=slaCentralZonedParts(stamp);
  return checked.year===year&&checked.month===month&&checked.day===day&&checked.hour===hour&&checked.minute===minute?stamp:NaN;
}

function parseSlaCentralImportedAt(value){
  const match=String(value||"").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if(!match)return null;
  const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]||0);
  if(hour>23||minute>59||second>59)return null;
  const stamp=slaCentralTimestamp(year,month,day,hour,minute,second);
  if(!Number.isFinite(stamp))return null;
  return{stamp,dateKey:year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0"),dateLabel:String(day).padStart(2,"0")+"/"+String(month).padStart(2,"0")+"/"+year,hour};
}

/**
 * Fonte única das métricas exibidas no site. Ao adicionar uma coluna do CSV,
 * registre seu índice aqui e inclua o valor apenas nas estruturas consumidoras.
 * A Central SLA deduplica por Nota Fiscal; quando não existe NF, usa o Pedido.
 */
function calculateMetrics(csvText, fileName) {
  const metrics = createEmptyMetrics();
  const billingStatuses = new Set(["ENVIADO PARA FATURAMENTO", "FATURADO", "COLETA INICIADA"]);
  const breakStatuses = new Set(["AG RESOLUCAO DE QUEBRA", "AG RESOLUCAO QUEBRA"]);
  const triagedStatuses = new Set(["CONFERENCIA CONCLUIDA", "ENVIADO PARA FATURAMENTO", "FATURADO", "COLETA INICIADA", ...breakStatuses]);
  const withoutPdfStatuses = new Set([...billingStatuses, ...breakStatuses]);
  const hourlyStatuses = new Set(["CONFERENCIA CONCLUIDA", "ENVIADO PARA FATURAMENTO", "FATURADO"]);
  const allowedSeries = new Set(["17", "14", ""]);
  const triagedSeries = new Set(["17", "14", "11", ""]);
  const pinStates = new Set(["AC", "AM", "AP", "RO", "RR"]);
  const seen = {
    triaged: new Set(), processedToday: new Set(), withoutPdf: new Set(), pin: new Set(), sla: new Set(),
    triagedSummary: new Set(), withoutPdfSummary: new Set(), today: new Set()
  };
  const b2c = new Map(), b2b = new Map(), pinDetailByOrder=new Map();
  const productivityMap = new Map();
  const triagedCarriers = new Map();
  const processedByDate = new Map();
  const slaCentralSeen = new Set();
  let indexes = null;
  const now = new Date();
  const dateKey = (date) => String(date.getDate()).padStart(2, "0") + "/" + String(date.getMonth() + 1).padStart(2, "0") + "/" + date.getFullYear();
  const today = dateKey(now);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const addSummary = (summary, ordersSeen, order, products, volumes) => {
    if (ordersSeen.has(order)) return;
    ordersSeen.add(order); summary.orders++; summary.products += products; summary.volumes += volumes;
  };

  forEachCsvRow(csvText, (values, rowIndex) => {
    if (rowIndex === 0) {
      const headers = values.map(normalizeHeader);
      const column = (name) => headers.indexOf(normalizeHeader(name));
      indexes = {
        order: column("Pedido de Venda"), series: column("Série"), status: column("Status da Nota Fiscal"),
        processed: column("Processado"), processedAt: column("Processado em"), volumes: column("Qtde. de Volumes"),
        uf: column("UF Destinatário"), products: column("Qtde. Total de Produto"),
        load: column("Carga"), weighedAt: column("Pesado em"), carrier: column("Transportadora"),
        invoice: column("Nota Fiscal"), wave: column("Onda"), waveId: column("idOnda"), service: column("Serviço da Transportadora"),
        imported: column("Importado em"), registered: column("Cadastrada em"), client: column("Destinatário"), cancelledAt: column("Cancelado em"),
        skuQty: column("Qtde. de Produto"), separatedAt: column("Separado em"), billedAt: column("Faturado em"), conferenceAt: column("Conferido em"), conferenceStarted: column("Conferência Iniciada"),
        serviceCode: column("Código do Serviço"), weighingUser: column("Usuário da Pesagem"), shipment: column("Título Romaneio"), orderClassification: column("Classificação Tipo Pedido")
      };
      const slaCentralRequired=[["Pedido de Venda",indexes.order],["Nota Fiscal",indexes.invoice],["Série",indexes.series],["Status da Nota Fiscal",indexes.status],["Importado em",indexes.imported],["Serviço da Transportadora",indexes.service]];
      metrics.slaCentralDiagnostics.missingColumns=slaCentralRequired.filter(item=>item[1]<0).map(item=>item[0]);
      const required = [["Pedido de Venda",indexes.order],["Série",indexes.series],["Status da Nota Fiscal",indexes.status],["Processado",indexes.processed],["Processado em",indexes.processedAt],["Qtde. de Volumes",indexes.volumes],["Qtde. Total de Produto",indexes.products],["Carga",indexes.load],["Transportadora",indexes.carrier]];
      const missing=required.filter(item=>item[1]<0).map(item=>item[0]);
      if(missing.length)throw new Error("Colunas obrigatórias ausentes: "+missing.join(", ")+".");
      return;
    }
    const order = (values[indexes.order] || "").trim();
    metrics.receivedRows++;
    if (!order) { metrics.rejectedRows++; return; }
    const series = (values[indexes.series] || "").trim();
    const status = normalizeHeader(values[indexes.status] || "").toUpperCase();
    const processedAt = (values[indexes.processedAt] || "").trim();
    const productsRaw=String(values[indexes.products]||"").trim(),volumesRaw=String(values[indexes.volumes]||"").trim();
    const products = Number(productsRaw.replace(",", ".")) || 0;
    const volumes = Number(volumesRaw.replace(",", ".")) || 0;
    if ((productsRaw&&!Number.isFinite(Number(productsRaw.replace(",","."))))||(volumesRaw&&!Number.isFinite(Number(volumesRaw.replace(",","."))))){metrics.rejectedRows++;return}
    metrics.recordCount++;
    const carrier = (values[indexes.carrier] || "").trim();
    const load = (values[indexes.load] || "").trim();
    const weighedAt = (values[indexes.weighedAt] || "").trim();
    const isBillingStatus = billingStatuses.has(status);
    const isBreakStatus = status.startsWith("AG") && status.includes("RESOLUCAO") && status.includes("QUEBRA");
    const isTriagedStatus = triagedStatuses.has(status) || isBreakStatus;
    const isWithoutPdfStatus = withoutPdfStatuses.has(status) || isBreakStatus;
    const isFedex = normalizeHeader(carrier).includes("fedex");
    const isFlBrasil = normalizeHeader(carrier).includes("fl brasil");

    const isProcessed = (values[indexes.processed] || "").trim() === "1";
    const cancelledAt = indexes.cancelledAt >= 0 ? (values[indexes.cancelledAt] || "").trim() : "";
    const isCancelled = Boolean(cancelledAt) || status === "CANCELADO";
    if(!isCancelled&&!metrics.slaCentralDiagnostics.missingColumns.length){
      const normalizedSeries=normalizeSlaCentralValue(values[indexes.series]),seriesNumber=Number(normalizedSeries.replace(",","."));
      const serviceRaw=repairCommonMojibake(values[indexes.service]).replace(/\s+/g," ").trim();
      if((normalizedSeries==="17"||seriesNumber===17)&&serviceRaw){
        const statusRaw=repairCommonMojibake(values[indexes.status]).replace(/\s+/g," ").trim(),area=slaCentralAreaForStatus(statusRaw);
        if(!area){
          const key=normalizeSlaCentralValue(statusRaw)||"nao informado",unknown=metrics.slaCentralDiagnostics.unknownStatuses[key]||{label:statusRaw||"Não informado",count:0};
          unknown.count++;metrics.slaCentralDiagnostics.unknownStatuses[key]=unknown;
        }else{
          const importedRaw=String(values[indexes.imported]||"").trim(),imported=parseSlaCentralImportedAt(importedRaw);
          if(!imported)metrics.slaCentralDiagnostics.invalidDates++;
          else{
            const invoice=String(values[indexes.invoice]||"").trim(),fallback=!invoice,identifier=invoice||order,uniqueKey=(fallback?"pedido:":"nf:")+normalizeSlaCentralValue(identifier);
            if(slaCentralSeen.has(uniqueKey))metrics.slaCentralDiagnostics.duplicateRows++;
            else{
              slaCentralSeen.add(uniqueKey);
              metrics.slaCentralRecords.push({
                id:uniqueKey,identifier,identifierFallback:fallback,invoice,order,area,status:statusRaw,statusNormalized:normalizeSlaCentralValue(statusRaw),
                service:serviceRaw,serviceNormalized:normalizeSlaCentralValue(serviceRaw),series:String(values[indexes.series]||"").trim(),importedRaw,importedStamp:imported.stamp,importDateKey:imported.dateKey,importDateLabel:imported.dateLabel,importHour:imported.hour,
                carrier:carrier||"Transportadora não informada",load:load||"Sem carga",wave:indexes.wave>=0?(values[indexes.wave]||"").trim():"",waveId:indexes.waveId>=0?(values[indexes.waveId]||"").trim():"",
                volumes,products,responsible:indexes.weighingUser>=0?(values[indexes.weighingUser]||"").trim():""
              });
            }
          }
        }
      }
    }
    if (!isCancelled) {
      const gembaImportedRaw = (indexes.imported >= 0 ? values[indexes.imported] : "") || (indexes.registered >= 0 ? values[indexes.registered] : "");
      const gembaImportedAt = parseBrazilianDateTime(gembaImportedRaw);
      const gembaSegment = series === "17" ? "b2c" : (["", "11", "14"].includes(series) ? "b2b" : null);
      metrics.gembaOrders.push({
        order, segment:gembaSegment||"other", series:series || "Vazia", wave:indexes.wave >= 0 ? (values[indexes.wave] || "").trim() : "",
        waveId:indexes.waveId >= 0 ? (values[indexes.waveId] || "").trim() : "", status:(values[indexes.status] || "").trim(),
        products, skus:indexes.skuQty >= 0 ? Number(String(values[indexes.skuQty] || "0").replace(",",".")) || 0 : 0,
        separatedAt:indexes.separatedAt >= 0 ? (values[indexes.separatedAt] || "").trim() : "", billedAt:indexes.billedAt >= 0 ? (values[indexes.billedAt] || "").trim() : "", weighedAt,
        conferenceStarted:indexes.conferenceStarted >= 0 ? (values[indexes.conferenceStarted] || "").trim() === "1" : false,
        processed:isProcessed, importedStamp:gembaImportedAt ? gembaImportedAt.getTime() : 0, carrier, load,
        orderClassification:indexes.orderClassification>=0?(values[indexes.orderClassification]||"").trim():""
      });
    }
    if (!isCancelled && !seen.sla.has(order)) {
      const importedRaw = indexes.imported >= 0 ? values[indexes.imported] : "", registeredRaw=indexes.registered>=0?values[indexes.registered]:"", billedRaw=indexes.billedAt>=0?values[indexes.billedAt]:"", conferenceRaw=indexes.conferenceAt>=0?values[indexes.conferenceAt]:"";
      const importedAt = parseBrazilianDateTime(importedRaw), registeredAt=parseBrazilianDateTime(registeredRaw), billedAt=parseBrazilianDateTime(billedRaw), conferenceAt=parseBrazilianDateTime(conferenceRaw), referenceAt=importedAt||registeredAt||billedAt||conferenceAt;
      if (referenceAt) {
        seen.sla.add(order);
        const service = indexes.service >= 0 ? (values[indexes.service] || "").trim() : "";
        const hour = referenceAt.getHours();
        metrics.slaRecords.push({
          id: order, order, invoice: indexes.invoice >= 0 ? (values[indexes.invoice] || "").trim() : "",
          wave: indexes.wave >= 0 ? (values[indexes.wave] || "").trim() : "", waveId: indexes.waveId >= 0 ? (values[indexes.waveId] || "").trim() : "",
          load: load || "Sem carga", carrier: carrier || "Transportadora não informada", service: service || "Serviço não informado",
          status: (values[indexes.status] || "").trim() || "Não informado", processed:isProcessed, importedRaw:String(importedRaw||"").trim(), importedStamp:importedAt?importedAt.getTime():0, registeredRaw:String(registeredRaw||"").trim(), registeredStamp:registeredAt?registeredAt.getTime():0, billedRaw:String(billedRaw||"").trim(), billedStamp:billedAt?billedAt.getTime():0, conferenceRaw:String(conferenceRaw||"").trim(), conferenceStamp:conferenceAt?conferenceAt.getTime():0,
          dueStamp:null, baseDueStamp:null, slaRule:"Perfil não configurado", products, volumes, series: series || "Vazia",
          client: indexes.client >= 0 ? (values[indexes.client] || "").trim() : "", importDate: referenceAt.getFullYear() + "-" + String(referenceAt.getMonth() + 1).padStart(2,"0") + "-" + String(referenceAt.getDate()).padStart(2,"0"),
          importHour: String(hour).padStart(2,"0") + "h", shift: hour >= 6 && hour <= 14 ? "1º turno" : hour >= 15 ? "2º turno" : "Madrugada", sector: operationalSector(values[indexes.status] || "")
        });
      }
    }

    if (triagedSeries.has(series) && isTriagedStatus && !seen.triaged.has(order)) {
      seen.triaged.add(order);
      addSummary(metrics.triagedSummary, seen.triagedSummary, order, products, volumes);
      const carrierName = carrier || "Transportadora não informada";
      if (!triagedCarriers.has(carrierName)) triagedCarriers.set(carrierName, { carrier: carrierName, orders: 0, volumes: 0 });
      const carrierData = triagedCarriers.get(carrierName);
      carrierData.orders++;
      carrierData.volumes += volumes;
    }
    if (allowedSeries.has(series) && (values[indexes.processed] || "").trim() === "1" && processedAt.startsWith(today)) {
      seen.processedToday.add(order); addSummary(metrics.dispatchedToday, seen.today, order, products, volumes);
    }
    if (allowedSeries.has(series) && (values[indexes.processed] || "").trim() === "1" && processedAt && !processedAt.startsWith(today)) {
      const processedDate = processedAt.slice(0, 10);
      const dateMatch = processedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dateMatch) {
        if (!processedByDate.has(processedDate)) {
          processedByDate.set(processedDate, {
            date: processedDate,
            stamp: Number(dateMatch[3] + dateMatch[2] + dateMatch[1]),
            summary: zeroSummary(),
            seen: new Set()
          });
        }
        const dayData = processedByDate.get(processedDate);
        addSummary(dayData.summary, dayData.seen, order, products, volumes);
      }
    }
    if ((series === "" || series === "11") && isWithoutPdfStatus && !isFedex) {
      seen.withoutPdf.add(order); addSummary(metrics.withoutPdfSummary, seen.withoutPdfSummary, order, products, volumes);
    }
    const uf = (values[indexes.uf] || "").trim().toUpperCase();
    if (isBillingStatus && pinStates.has(uf) && isFlBrasil) {
      if (!seen.pin.has(order)) {
        seen.pin.add(order);
        const detail={ order, uf, series:series || "Vazia", status:(values[indexes.status] || "").trim() || "Não informado", load: load || "Sem carga" };metrics.pinDetails.push(detail);pinDetailByOrder.set(order,detail);
      } else if (load) {
        const pinDetail = pinDetailByOrder.get(order);
        if (pinDetail) {
          const loads = pinDetail.load === "Sem carga" ? [] : pinDetail.load.split(", ");
          if (!loads.includes(load)) loads.push(load);
          pinDetail.load = loads.join(", ");
        }
      }
    }

    if ((values[indexes.processed] || "").trim() === "1" && processedAt) {
      const dateMatch = processedAt.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (dateMatch) {
        const stamp = Number(dateMatch[3] + dateMatch[2] + dateMatch[1] + dateMatch[4] + dateMatch[5] + dateMatch[6]);
        if (!metrics.lastDispatch || stamp > metrics.lastDispatch.stamp) {
          metrics.lastDispatch = { stamp, carrier: carrier || "Transportadora não informada", processedAt };
        }
      }
    }

    const productivityMatch = weighedAt.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):/);
    if (productivityMatch) {
      const hour = Number(productivityMatch[4]);
      const segment = series === "17" ? "b2c" : (["", "11", "14"].includes(series) ? "b2b" : null);
      const shift = hour >= 6 && hour <= 14 ? "shift1" : hour >= 15 && hour <= 23 ? "shift2" : null;
      if (segment && shift) {
        const date = productivityMatch[1] + "/" + productivityMatch[2] + "/" + productivityMatch[3];
        if (!productivityMap.has(date)) productivityMap.set(date, { b2c: { shift1: new Map(), shift2: new Map() }, b2b: { shift1: new Map(), shift2: new Map() } });
        const hourly = productivityMap.get(date)[segment][shift];
        if (!hourly.has(hour)) hourly.set(hour, new Map());
        const orders = hourly.get(hour);
        if (!orders.has(order)) orders.set(order, products);
      }
    }

    if (hourlyStatuses.has(status) && (values[indexes.load] || "").trim() === "" && weighedAt) {
      const match = weighedAt.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):/);
      if (match) {
        const label = match[1] + "/" + match[2] + " · " + match[4] + "h";
        const weighedUtc = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        const daysOld = Math.floor((todayUtc - weighedUtc) / 86400000);
        const target = series === "17" ? b2c : (series === "14" || series === "" ? b2b : null);
        const descriptor = carrier || "Transportadora não informada";
        if (target) {
          const bucketKey = label + "||" + descriptor;
          if (!target.has(bucketKey)) target.set(bucketKey, { orders: new Map(), alert: false });
          const bucket = target.get(bucketKey);
          if (!bucket.orders.has(order)) bucket.orders.set(order, { invoice:indexes.invoice>=0?(values[indexes.invoice]||"").trim():"", order, shipment:indexes.shipment>=0?(values[indexes.shipment]||"").trim():"", orderClassification:indexes.orderClassification>=0?(values[indexes.orderClassification]||"").trim():"", serviceCode:indexes.serviceCode>=0?(values[indexes.serviceCode]||"").trim():"", carrier:descriptor, weighedAt, weighingUser:indexes.weighingUser>=0?(values[indexes.weighingUser]||"").trim():"", volumes });
          if ((series === "17" && daysOld >= 1) || (series !== "17" && daysOld >= 2)) bucket.alert = true;
        }
      }
    }
  });

  if(!indexes)throw new Error("O arquivo CSV não possui uma linha de cabeçalho válida.");
  if(metrics.receivedRows===0)throw new Error("O CSV contém apenas o cabeçalho e não possui registros.");
  if(metrics.recordCount===0)throw new Error("Nenhum registro válido foi encontrado. Verifique Pedido de Venda, produtos e volumes.");
  const buckets = (map) => Array.from(map, ([key, bucket]) => {
    const parts = key.split("||");
    const details=Array.from(bucket.orders.values());
    return { label: parts[0], descriptor: parts.slice(1).join("||"), orders: bucket.orders.size, volumes: details.reduce((sum, item) => sum + item.volumes, 0), alert: bucket.alert, details };
  }).sort((a, b) => {
    const value = (label) => {
      const match = label.match(/^(\d{2})\/(\d{2}) · (\d{2})h$/);
      return match ? Number(match[2]) * 10000 + Number(match[1]) * 100 + Number(match[3]) : 0;
    };
    return value(a.label) - value(b.label);
  });
  metrics.triaged = seen.triaged.size;
  metrics.triagedByCarrier = Array.from(triagedCarriers.values())
    .sort((a, b) => b.volumes - a.volumes || b.orders - a.orders || a.carrier.localeCompare(b.carrier, "pt-BR"));
  metrics.volumesToday = metrics.triagedSummary.volumes;
  metrics.processedToday = seen.processedToday.size;
  metrics.withoutPdf = seen.withoutPdf.size;
  metrics.pinRequests = seen.pin.size;
  const d1 = Array.from(processedByDate.values()).sort((a, b) => b.stamp - a.stamp)[0];
  if (d1) {
    metrics.dispatchedYesterday = d1.summary;
    metrics.d1Date = d1.date;
  }
  metrics.b2cHourly = buckets(b2c);
  metrics.b2bHourly = buckets(b2b);
  const emptyShift = (startHour, endHour) => ({ products: 0, orders: 0, activeHours: 0, productsPerHour: 0, ordersPerHour: 0, hourly: Array.from({ length: endHour - startHour + 1 }, (_, index) => ({ hour: startHour + index, products: 0, orders: 0 })) });
  const summarizeShift = (hourMap, startHour, endHour) => {
    const result = emptyShift(startHour, endHour);
    if (!hourMap) return result;
    result.hourly = result.hourly.map(point => {
      const orders = hourMap.get(point.hour) || new Map();
      const products = Array.from(orders.values()).reduce((sum, value) => sum + value, 0);
      return { hour: point.hour, products, orders: orders.size };
    });
    result.products = result.hourly.reduce((sum, point) => sum + point.products, 0);
    result.orders = result.hourly.reduce((sum, point) => sum + point.orders, 0);
    result.activeHours = result.hourly.filter(point => point.orders > 0).length;
    result.productsPerHour = result.activeHours ? result.products / result.activeHours : 0;
    result.ordersPerHour = result.activeHours ? result.orders / result.activeHours : 0;
    return result;
  };
  const utcDateKey = (stamp) => {
    const date = new Date(stamp);
    return String(date.getUTCDate()).padStart(2, "0") + "/" + String(date.getUTCMonth() + 1).padStart(2, "0") + "/" + date.getUTCFullYear();
  };
  metrics.productivity.days = Array.from({ length: 5 }, (_, offset) => {
    const stamp = todayUtc - offset * 86400000;
    const date = utcDateKey(stamp), source = productivityMap.get(date);
    return {
      date, isToday: offset === 0,
      b2c: { shift1: summarizeShift(source && source.b2c.shift1, 6, 14), shift2: summarizeShift(source && source.b2c.shift2, 15, 23) },
      b2b: { shift1: summarizeShift(source && source.b2b.shift1, 6, 14), shift2: summarizeShift(source && source.b2b.shift2, 15, 23) }
    };
  });
  metrics.fileName = fileName;
  metrics.importedAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return metrics;
}

// Tenta UTF-8 primeiro e recua para Windows-1252 apenas quando encontra caracteres inválidos.
function decodeCsvBuffer(buffer){if(typeof buffer==="string")return buffer;const bytes=new Uint8Array(buffer),utf8=new TextDecoder("utf-8").decode(bytes);if(utf8.includes("\uFFFD"))try{return new TextDecoder("windows-1252").decode(bytes)}catch(error){}return utf8}

// Processa bases grandes em Web Worker; o fallback síncrono mantém compatibilidade com navegadores restritos.
function calculateMetricsAsync(csvBuffer, fileName) {
  if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
    return Promise.resolve().then(() => calculateMetrics(decodeCsvBuffer(csvBuffer), fileName));
  }
  const workerSource = [
    '"use strict";',
    'const zeroSummary = ' + zeroSummary.toString() + ';',
    createEmptyMetrics.toString(),
    normalizeHeader.toString(),
    forEachCsvRow.toString(),
    decodeCsvBuffer.toString(),
    parseBrazilianDateTime.toString(),
    operationalSector.toString(),
    'const SLA_CENTRAL_TIME_ZONE = "America/Sao_Paulo";',
    'const SLA_CENTRAL_STATUS_GROUPS = ' + JSON.stringify(SLA_CENTRAL_STATUS_GROUPS) + ';',
    repairCommonMojibake.toString(),
    normalizeSlaCentralValue.toString(),
    slaCentralAreaForStatus.toString(),
    slaCentralZonedParts.toString(),
    slaCentralTimestamp.toString(),
    parseSlaCentralImportedAt.toString(),
    calculateMetrics.toString(),
    'self.onmessage = function(event) { try { const csvText=decodeCsvBuffer(event.data.csvBuffer); self.postMessage({ ok:true, metrics:calculateMetrics(csvText,event.data.fileName) }); } catch (error) { self.postMessage({ ok:false, message:error && error.message ? error.message : String(error) }); } };'
  ].join("\n");
  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type:"text/javascript" }));
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl);
    const finish = () => { worker.terminate(); URL.revokeObjectURL(workerUrl); };
    worker.onmessage = event => {
      finish();
      if (event.data && event.data.ok) resolve(event.data.metrics);
      else reject(new Error(event.data && event.data.message || "Falha ao processar o CSV."));
    };
    worker.onerror = event => { finish(); reject(new Error(event.message || "Falha ao iniciar o processamento em segundo plano.")); };
    if(csvBuffer instanceof ArrayBuffer)worker.postMessage({csvBuffer,fileName},[csvBuffer]);
    else worker.postMessage({csvBuffer,fileName});
  });
}

/* ===================== COMPONENTES E RENDERIZAÇÃO OPERACIONAL ===================== */

// Todo texto originado do CSV deve passar por escapeHtml() antes de entrar em innerHTML.
function summaryHtml(data) {
  return [
    ["Pedidos de venda", data.orders], ["Qtde. total de produto", data.products], ["Qtde. de volumes", data.volumes]
  ].map(item => '<div><span>' + item[0] + '</span><strong>' + fmt(item[1]) + '</strong></div>').join("");
}

function heatClass(value) { return value === 0 ? "empty" : value <= 10 ? "good" : value <= 30 ? "warn" : "bad"; }

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function carrierShort(value) {
  const normalized = normalizeHeader(value);
  if (normalized.includes("shoppe") || normalized.includes("shps")) return "SHOPEE";
  if (normalized.includes("l4b")) return "L4B";
  if (normalized.includes("jad")) return "JAD";
  if (normalized.includes("fedex")) return "FEDEX";
  if (normalized.includes("dhl")) return "DHL";
  if (normalized.includes("correios") || normalized.includes("empresa brasileira")) return "ECT";
  if (normalized.includes("bytedance")) return "BYTE";
  if (normalized.includes("patrus")) return "PATRUS";
  if (normalized.includes("to do")) return "TO DO";
  if (normalized.includes("nextday") || normalized.includes("cliente retira")) return "CR";
  const words = String(value || "").match(/[A-Za-zÀ-ÿ0-9]+/g) || ["N/D"];
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

function carrierVisual(value) {
  const normalized = normalizeHeader(value);
  if (normalized.includes("shoppe") || normalized.includes("shopee") || normalized.includes("shps tecnologia")) return { short: "SH", color: "#ee4d2d" };
  if (normalized.includes("fedex")) return { short: "FX", color: "#4d148c", accent: "#ff6600" };
  if (normalized.includes("patrus")) return { short: "P", color: "#c62828" };
  if (normalized.includes("fl brasil")) return { short: "FL", color: "#1769aa" };
  if (normalized.includes("viviane malvesi")) return { short: "VM", color: "#16856b" };
  if (normalized.includes("l4b")) return { short: "L4B", color: "#2563eb" };
  if (normalized.includes("jad")) return { short: "JAD", color: "#f2b705", text: "#222" };
  if (normalized.includes("correios") || normalized.includes("empresa brasileira")) return { short: "ECT", color: "#f5c400", text: "#123f82" };
  if (normalized.includes("dhl")) return { short: "DHL", color: "#ffcc00", text: "#d40511" };
  return { short: carrierShort(value), color: "#315b9d" };
}

function carrierLogoData(value) {
  const visual = carrierVisual(value);
  const fontSize = visual.short.length > 2 ? 17 : 22;
  const accent = visual.accent ? '<rect x="43" y="0" width="21" height="64" fill="' + visual.accent + '"/>' : '';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="' + visual.color + '"/>' + accent + '<text x="32" y="34" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="' + fontSize + '" font-weight="800" fill="' + (visual.text || '#fff') + '">' + escapeHtml(visual.short) + '</text></svg>';
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function carrierDisplayName(value) {
  const normalized = normalizeHeader(value);
  if (normalized.includes("shps tecnologia") || normalized.includes("shoppe") || normalized.includes("shopee")) return "Shopee";
  if (normalized.includes("fl brasil")) return "FL Brasil";
  if (normalized.includes("fedex")) return "FedEx";
  if (normalized.includes("patrus")) return "Patrus";
  if (normalized.includes("viviane malvesi")) return "Viviane Malvesi";
  if (normalized.includes("correios") || normalized.includes("empresa brasileira")) return "Correios";
  return String(value || "Não informado");
}

function matrixHeaderHtml(descriptor) {
  const main = carrierDisplayName(descriptor);
  const detail = carrierShort(descriptor);
  return '<div class="matrix-cell matrix-header" title="' + escapeHtml(descriptor) + '"><div class="matrix-title"><img class="matrix-carrier-logo" src="' + carrierLogoData(descriptor) + '" alt=""><span>' +
    escapeHtml(main) + '</span></div><small>' + escapeHtml(detail) + '</small></div>';
}

function conferenceSummaryHtml(data, showVolumes) {
  const orders = data.reduce((sum, item) => sum + item.orders, 0);
  const volumes = data.reduce((sum, item) => sum + (item.volumes || 0), 0);
  const carriers = new Set(data.map(item => item.descriptor)).size;
  const hours = new Set(data.map(item => item.label)).size;
  const delayed = data.reduce((sum, item) => sum + (item.alert ? item.orders : 0), 0);
  const stats = showVolumes
    ? [["Pedidos", orders], ["Volumes", volumes], ["Transportadoras", carriers], ["Em alerta", delayed, "alert"]]
    : [["Pedidos", orders], ["Transportadoras", carriers], ["Faixas horárias", hours], ["Em alerta", delayed, "alert"]];
  return stats.map(item => '<div class="conference-stat ' + (item[2] || '') + '"><small>' + item[0] + '</small><strong>' + fmt(item[1]) + '</strong></div>').join("");
}

function pendingMatrixHtml(data, showVolumes) {
  if (!data.length) return '<div class="pending-empty">Importe o arquivo CSV para visualizar os horários.</div>';
  const descriptors = Array.from(new Set(data.map(item => item.descriptor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const labels = Array.from(new Set(data.map(item => item.label)));
  const dates = new Set(labels.map(label => label.split(" · ")[0]));
  const values = new Map(data.map(item => [item.label + "||" + item.descriptor, item]));
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const availableHeight = Math.max(300, viewportHeight - 285);
  const cellHeight = Math.max(15, Math.min(38, Math.floor((availableHeight - 58) / Math.max(1, labels.length + 1))));
  const headerHeight = Math.max(38, Math.min(52, cellHeight + 16));
  const denseRows = labels.length > 18;
  const cellFont = denseRows ? 7 : descriptors.length > 10 ? 7 : descriptors.length > 7 ? 8 : 10;
  const headerFont = denseRows || descriptors.length > 10 ? 6 : descriptors.length > 7 ? 7 : 8;
  const edgeWidth = descriptors.length > 10 ? 48 : 62;
  const columns = edgeWidth + 'px repeat(' + descriptors.length + ', minmax(0, 1fr)) ' + edgeWidth + 'px';
  let cells = '<div class="matrix-cell matrix-header matrix-edge">Hora</div>' +
    descriptors.map(matrixHeaderHtml).join("") +
    '<div class="matrix-cell matrix-header matrix-edge">Total</div>';

  labels.forEach(label => {
    const hourLabel = dates.size === 1 ? (label.split(" · ")[1] || label) : label;
    let rowTotal = 0, rowVolumes = 0;
    cells += '<div class="matrix-cell matrix-hour" title="Data e hora da pesagem: ' + escapeHtml(label) + '"><span>' + escapeHtml(hourLabel) + '</span></div>';
    descriptors.forEach(descriptor => {
      const item = values.get(label + "||" + descriptor);
      const value = item ? item.orders : 0;
      const volumeValue = item ? item.volumes : 0;
      rowTotal += value; rowVolumes += volumeValue;
      const hasAlert = Boolean(item && item.alert);
      const alert = hasAlert ? '<span class="age-alert" aria-hidden="true">!</span>' : '';
      const volumesHtml = showVolumes ? '<span class="matrix-volume-count">(' + fmt(volumeValue) + ')</span>' : '';
      const detailTitle = carrierDisplayName(descriptor) + ' · ' + label + ' · ' + fmt(value) + ' pedido(s)' + (showVolumes ? ' · ' + fmt(volumeValue) + ' volume(s)' : '') + (hasAlert ? ' · PENDÊNCIA ANTIGA' : '');
      const detailKey = item && value ? label + "||" + descriptor : "";
      cells += '<div class="matrix-cell matrix-value ' + heatClass(value) + (hasAlert ? ' has-age-alert' : '') + '"' + (detailKey ? ' data-conference-key="' + escapeHtml(detailKey) + '"' : '') + ' title="' + escapeHtml(detailTitle) + '" aria-label="' + escapeHtml(detailTitle) + '">' + alert + fmt(value) + volumesHtml + '</div>';
    });
    cells += '<div class="matrix-cell matrix-total">' + fmt(rowTotal) + (showVolumes ? '<span class="matrix-volume-count">(' + fmt(rowVolumes) + ')</span>' : '') + '</div>';
  });

  cells += '<div class="matrix-cell matrix-total">TOTAL</div>';
  let grandTotal = 0, grandVolumes = 0;
  descriptors.forEach(descriptor => {
    const totals = labels.reduce((sum, label) => {
      const item = values.get(label + "||" + descriptor);
      sum.orders += item ? item.orders : 0; sum.volumes += item ? item.volumes : 0;
      return sum;
    }, { orders: 0, volumes: 0 });
    grandTotal += totals.orders; grandVolumes += totals.volumes;
    cells += '<div class="matrix-cell matrix-total" data-conference-total="' + escapeHtml(descriptor) + '" title="Clique para ver todos os pedidos desta transportadora">' + fmt(totals.orders) + (showVolumes ? '<span class="matrix-volume-count">(' + fmt(totals.volumes) + ')</span>' : '') + '</div>';
  });
  cells += '<div class="matrix-cell matrix-total">' + fmt(grandTotal) + (showVolumes ? '<span class="matrix-volume-count">(' + fmt(grandVolumes) + ')</span>' : '') + '</div>';

  return '<div class="matrix-grid" style="grid-template-columns:' + columns + ';--cell-height:' + cellHeight +
    'px;--header-height:' + headerHeight + 'px;--cell-font:' + cellFont + 'px;--header-font:' + headerFont + 'px">' + cells + '</div>' +
    '<div class="matrix-legend">' + (showVolumes ? '<span><b>Formato:</b> pedidos (volumes)</span>' : '') + '<span><i class="zero"></i>Sem pedidos</span><span><i class="good"></i>1 a 10</span><span><i class="warn"></i>11 a 30</span><span><i class="bad"></i>Acima de 30</span><span><b class="alert-mark">!</b>Pendência antiga</span></div>';
}

function groupPinDetails(data) {
  const groups = new Map();
  data.forEach(item => {
    const loads = item.load && item.load !== "Sem carga" ? item.load.split(",").map(load => load.trim()).filter(Boolean) : ["Sem carga"];
    loads.forEach(load => {
      if (!groups.has(load)) groups.set(load, new Map());
      groups.get(load).set(item.order, { order: item.order, series:item.series || "Vazia", status:item.status || "Não informado", uf: item.uf });
    });
  });
  return Array.from(groups, ([load, orders]) => ({ load, orders: Array.from(orders.values()).sort((a, b) => a.order.localeCompare(b.order, "pt-BR", { numeric: true })) }))
    .sort((a, b) => a.load === "Sem carga" ? 1 : b.load === "Sem carga" ? -1 : a.load.localeCompare(b.load, "pt-BR", { numeric: true }));
}

function pinHtml(data) {
  const groups = groupPinDetails(data);
  if (!groups.length) return '<article class="card pin-empty"><div class="pending-empty">Importe o arquivo CSV para visualizar as solicitações PIN.</div></article>';
  return groups.map(group => '<article class="card pin-group"><div class="pin-group-head"><div><small>Carga</small><strong>' + escapeHtml(group.load) + '</strong></div><span class="pin-count">' + fmt(group.orders.length) + '</span></div><div class="pin-orders"><div class="pin-order-head"><span>Pedido de venda</span><span>Série</span><span>Status NF</span><span>UF</span></div>' + group.orders.map(item => '<div class="pin-order-row"><strong>' + escapeHtml(item.order) + '</strong><span>' + escapeHtml(item.series) + '</span><span title="' + escapeHtml(item.status) + '">' + escapeHtml(item.status) + '</span><span>' + escapeHtml(item.uf) + '</span></div>').join("") + '</div></article>').join("");
}

function triagedCarrierListHtml(data) {
  if (!data.length) return '<div class="pending-empty">Importe o arquivo CSV para visualizar o ranking.</div>';
  const rows = data.map((item, index) =>
    '<div class="carrier-list-row"><span class="carrier-rank" title="' + escapeHtml(item.carrier) + '">' +
    '<b class="rank-number">' + (index + 1) + '</b><strong>' + escapeHtml(item.carrier) + '</strong></span>' +
    '<span>' + fmt(item.orders) + '</span><span class="carrier-volume">' + fmt(item.volumes) + '</span></div>'
  ).join("");
  return '<div class="carrier-list-head"><span>Transportadora</span><span>Pedidos</span><span>Volumes</span></div>' + rows;
}

function triagedCarrierChartHtml(data) {
  if (!data.length) return '<div class="pending-empty">Importe o arquivo CSV para visualizar o gráfico.</div>';
  const maximum = Math.max(1, ...data.flatMap(item => [item.orders, item.volumes]));
  const groups = data.map(item => {
    const ordersHeight = Math.max(2, item.orders / maximum * 100);
    const volumesHeight = Math.max(2, item.volumes / maximum * 100);
    return '<div class="bar-group" title="' + escapeHtml(item.carrier) + '">' +
      '<div class="bar-area"><div class="bar orders" style="height:' + ordersHeight + '%"><span class="bar-value">' + fmt(item.orders) + '</span></div>' +
      '<div class="bar volumes" style="height:' + volumesHeight + '%"><span class="bar-value">' + fmt(item.volumes) + '</span></div></div>' +
      '<div class="bar-label">' + escapeHtml(carrierShort(item.carrier)) + '</div></div>';
  }).join("");
  return '<div class="bar-chart">' + groups + '</div><div class="chart-legend"><span><i class="orders"></i>Pedidos</span><span><i class="volumes"></i>Volumes</span></div>';
}

function decimalFmt(value) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function productivityShiftHtml(title, data) {
  return '<div class="shift-card"><strong>' + title + '</strong><div class="shift-metrics">' +
    '<div><small>Total de produtos</small><b>' + fmt(data.products) + '</b></div>' +
    '<div><small>Média produtos/h</small><b>' + decimalFmt(data.productsPerHour) + '</b></div>' +
    '<div><small>Pedidos/h</small><b>' + decimalFmt(data.ordersPerHour) + '</b></div></div></div>';
}

function productivityWaveHtml(days) {
  const chronological = days.slice().reverse();
  const series = [
    { label: "B2C · 1º turno", color: "#2563eb", values: chronological.map(day => day.b2c.shift1.products) },
    { label: "B2C · 2º turno", color: "#06b6d4", values: chronological.map(day => day.b2c.shift2.products) },
    { label: "B2B · 1º turno", color: "#8b5cf6", values: chronological.map(day => day.b2b.shift1.products) },
    { label: "B2B · 2º turno", color: "#f59e0b", values: chronological.map(day => day.b2b.shift2.products) }
  ];
  const maximum = Math.max(1, ...series.flatMap(item => item.values));
  const left = 62, right = 970, top = 22, bottom = 245, width = right - left, height = bottom - top;
  const x = index => left + index * (width / Math.max(1, chronological.length - 1));
  const y = value => bottom - value / maximum * height;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = maximum * (4 - index) / 4, lineY = top + index * height / 4;
    return '<line class="wave-grid" x1="' + left + '" y1="' + lineY + '" x2="' + right + '" y2="' + lineY + '"/><text class="wave-axis" x="54" y="' + (lineY + 3) + '" text-anchor="end">' + decimalFmt(value) + '</text>';
  }).join("");
  const lines = series.map(item => {
    const points = item.values.map((value, index) => x(index) + ',' + y(value)).join(' ');
    const dots = item.values.map((value, index) => '<circle class="wave-dot" cx="' + x(index) + '" cy="' + y(value) + '" r="4" fill="' + item.color + '"><title>' + item.label + ': ' + fmt(value) + ' produtos</title></circle>').join('');
    return '<polyline class="wave-line" stroke="' + item.color + '" points="' + points + '"/>' + dots;
  }).join("");
  const labels = chronological.map((day, index) => '<text class="wave-axis" x="' + x(index) + '" y="270" text-anchor="middle">' + day.date.slice(0, 5) + (day.isToday ? ' · hoje' : '') + '</text>').join("");
  return '<div class="wave-chart"><svg viewBox="0 0 1000 285" role="img" aria-label="Evolução do total de produtos nos últimos cinco dias">' + grid + lines + labels + '</svg><div class="wave-legend">' + series.map(item => '<span><i style="background:' + item.color + '"></i>' + item.label + '</span>').join('') + '</div></div>';
}

function productivityHtml(productivity) {
  if (!productivity.days.length) return '<div class="card productivity-empty">Importe o CSV para visualizar a produtividade.</div>';
  const today = productivity.days[0];
  const segment = (title, series, rule) => '<div class="productivity-segment"><div class="segment-title"><strong>' + title + '</strong><div class="segment-total"><b>' + fmt(series.shift1.products + series.shift2.products) + '</b><small>total do dia</small></div><span>' + rule + '</span></div><div class="shift-grid">' + productivityShiftHtml('1º turno · 06h–14h59', series.shift1) + productivityShiftHtml('2º turno · 15h–23h59', series.shift2) + '</div></div>';
  const history = productivity.days.slice(1).map(day => {
    const line = (label, data) => '<div class="history-line"><strong>' + label + '</strong><span>' + fmt(data.products) + ' prod.</span><span>' + decimalFmt(data.productsPerHour) + '/h · ' + decimalFmt(data.ordersPerHour) + ' ped/h</span></div>';
    const b2cTotal=day.b2c.shift1.products+day.b2c.shift2.products,b2bTotal=day.b2b.shift1.products+day.b2b.shift2.products;
    return '<article class="card history-card"><h3>' + day.date + '</h3><div class="history-totals"><div class="history-total"><small>Total B2C</small><strong>'+fmt(b2cTotal)+'</strong></div><div class="history-total"><small>Total B2B</small><strong>'+fmt(b2bTotal)+'</strong></div></div><div class="history-lines">' + line('B2C T1', day.b2c.shift1) + line('B2C T2', day.b2c.shift2) + line('B2B T1', day.b2b.shift1) + line('B2B T2', day.b2b.shift2) + '</div></article>';
  }).join("");
  return '<article class="card productivity-today"><div class="productivity-head"><div><small>Produtividade do dia</small><h2>Produtos pesados por turno</h2></div><div class="productivity-date">' + today.date + '</div></div><div class="productivity-segments">' + segment('B2C', today.b2c, 'Série 17') + segment('B2B', today.b2b, 'Séries vazia, 11 e 14') + '</div></article><div class="history-grid">' + history + '</div><article class="card productivity-chart-card"><div class="card-head"><div><h2>Evolução da produção diária</h2><p>Total de produtos por dia · cada linha representa um segmento e turno</p></div></div>' + productivityWaveHtml(productivity.days) + '</article>';
}

/* ===================== GEMBA ===================== */

const slaUi = { status: "", war: false, drawerRecords: [], drawerTitle: "", drawerPage:0, drawerPageSize:100 };
const GEMBA_FLOW_CATEGORIES=Object.freeze([
  {id:"b2c",label:"B2C",classifications:Object.freeze(["VENDA OMN CHANNEL","ALOM-SPASA-VENDA FUNCION.","SPASA-REM AMC"])},
  {id:"b2bFranchise",label:"B2B - FRANQ.",classifications:Object.freeze(["ALHV-SPASA-VENDA FRANQUIA","ALHV-SPASA-VD FRANQUEADOS","ALHV-SPASA-VENDA PROD/MAT"])},
  {id:"sample",label:"AMOSTRA",classifications:Object.freeze(["ALHV-SPASA- AMOSTRA"])},
  {id:"storeTransfer",label:"TRANSF. LOJA",classifications:Object.freeze(["ALHV-SPASA-TRANSF. LOJAS"])},
  {id:"promo",label:"PROMO",classifications:Object.freeze(["ALHV-SPASA- ENV.MAT.PROMO"])},
  {id:"consumer",label:"CONSUMIDOR",classifications:Object.freeze(["ALHV-SPASA-VD. CONSUMIDOR"])},
  {id:"apollo",label:"APOLLO",classifications:Object.freeze(["ALHV-YPEM-CUST"])},
  {id:"distributionCenterTransfer",label:"TRANSF. CD",classifications:Object.freeze(["ALTC-SPASA-TRANSF. CD"])},
  {id:"ecommerce",label:"E-COMMERCE",classifications:Object.freeze(["ALHV-SPASA-VENDA ECOMMERC"])},
  {id:"exportation",label:"EXPORTAÇÃO",classifications:Object.freeze(["ALHV-YEXR"])}
]);
const GEMBA_FLOW_STATUS_GROUPS=Object.freeze({
  general:Object.freeze(["SEPARAÇÃO CONCLUÍDA","IMPORTADO","SEPARAÇÃO INICIADA","AG. SEPARAÇÃO","AG. FORMAÇÃO DE ROMANEIO/ONDA","CONFERÊNCIA INICIADA"]),
  imported:Object.freeze(["IMPORTADO","AG. FORMAÇÃO DE ROMANEIO/ONDA"]),
  inFlow:Object.freeze(["SEPARAÇÃO CONCLUÍDA","SEPARAÇÃO INICIADA","CONFERÊNCIA INICIADA"]),
  waiting:Object.freeze(["AG. SEPARAÇÃO"])
});
const GEMBA_ABS_TYPES=Object.freeze(["Falta injustificada","Atestado","Declaração","Ausente"]);
const gembaDefaults=Object.freeze({metaB2c:0,metaB2b:0});
let gembaConfig=loadGembaConfig();
let gembaAbs=loadGembaAbs();

function nonNegativeNumber(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,number):0}
function sanitizeGembaConfig(value){return{metaB2c:nonNegativeNumber(value?.metaB2c),metaB2b:nonNegativeNumber(value?.metaB2b)}}
function loadGembaConfig(){try{const saved=JSON.parse(localStorage.getItem("luft-gemba-config")||"null");return saved?sanitizeGembaConfig(saved):{...gembaDefaults}}catch(error){return{...gembaDefaults}}}
function saveGembaConfig(){gembaConfig=sanitizeGembaConfig(gembaConfig);localStorage.setItem("luft-gemba-config",JSON.stringify(gembaConfig));pushCloudSetting("gemba_config",gembaConfig)}
function loadGembaAbs(){try{const data=JSON.parse(localStorage.getItem("gemba_abs")||"[]");return Array.isArray(data)?data.filter(item=>item&&item.id&&String(item.nome||"").trim()&&GEMBA_ABS_TYPES.includes(item.tipo)).map(item=>({id:String(item.id),nome:String(item.nome).trim(),tipo:item.tipo})):[]}catch(error){return[]}}
function saveGembaAbs(){localStorage.setItem("gemba_abs",JSON.stringify(gembaAbs));renderGembaAbs();renderGembaSummary()}
function resetGembaAbs(){gembaAbs=[];localStorage.removeItem("gemba_abs");renderGembaAbs();renderGembaSummary()}

// Produção considera a data de pesagem; registros de outras datas não entram na meta do dia.
function calculateGembaProduction(metrics,referenceDate=new Date()){
  const today=String(referenceDate.getDate()).padStart(2,"0")+"/"+String(referenceDate.getMonth()+1).padStart(2,"0")+"/"+referenceDate.getFullYear();
  return(metrics.gembaOrders||[]).reduce((result,item)=>{if(!String(item.weighedAt||"").startsWith(today))return result;if(item.segment==="b2c")result.b2c+=nonNegativeNumber(item.products);else if(item.segment==="b2b")result.b2b+=nonNegativeNumber(item.products);return result},{b2c:0,b2b:0});
}

// Compensação transfere somente o excedente real entre B2C e B2B, sem criar produção artificial.
function calculateForecastCompensation(metaB2c,producedB2c,metaB2b,producedB2b){
  const originalB2c=nonNegativeNumber(metaB2c),originalB2b=nonNegativeNumber(metaB2b),actualB2c=nonNegativeNumber(producedB2c),actualB2b=nonNegativeNumber(producedB2b);
  const deficitB2c=Math.max(0,originalB2c-actualB2c),deficitB2b=Math.max(0,originalB2b-actualB2b);
  const compensationB2c=deficitB2b,compensationB2b=deficitB2c*2;
  const adjustedB2c=originalB2c+compensationB2c,adjustedB2b=originalB2b+compensationB2b;
  return{b2c:{meta:originalB2c,produced:actualB2c,deficit:deficitB2c,compensation:compensationB2c,adjusted:adjustedB2c,remaining:Math.max(0,adjustedB2c-actualB2c),above:Math.max(0,actualB2c-adjustedB2c)},b2b:{meta:originalB2b,produced:actualB2b,deficit:deficitB2b,compensation:compensationB2b,adjusted:adjustedB2b,remaining:Math.max(0,adjustedB2b-actualB2b),above:Math.max(0,actualB2b-adjustedB2b)}};
}

function calculateGembaFlow(metrics){
  const orders=metrics.gembaOrders||[],sum=list=>list.reduce((total,item)=>total+nonNegativeNumber(item.products),0);
  const normalizedGroups=Object.fromEntries(Object.entries(GEMBA_FLOW_STATUS_GROUPS).map(([key,statuses])=>[key,statuses.map(normalizeSlaCentralValue)]));
  const prepared=orders.map(item=>({...item,normalizedStatus:normalizeSlaCentralValue(item.status),normalizedClassification:normalizeSlaCentralValue(item.orderClassification)}));
  const items=GEMBA_FLOW_CATEGORIES.map(category=>{
    const classifications=category.classifications.map(normalizeSlaCentralValue),classified=prepared.filter(item=>classifications.includes(item.normalizedClassification));
    const recordsFor=group=>classified.filter(item=>normalizedGroups[group].includes(item.normalizedStatus)),eligible=recordsFor("general");
    return{id:category.id,label:category.label,orders:new Set(eligible.map(item=>item.order)).size,general:sum(eligible),imported:sum(recordsFor("imported")),inFlow:sum(recordsFor("inFlow")),waiting:sum(recordsFor("waiting")),visible:eligible.length>0};
  }).filter(item=>item.visible);
  return{items,classificationAvailable:orders.some(item=>String(item.orderClassification||"").trim())};
}

function calculateGembaMetrics(metrics){const production=calculateGembaProduction(metrics),forecast=calculateForecastCompensation(gembaConfig.metaB2c,production.b2c,gembaConfig.metaB2b,production.b2b);return{flow:calculateGembaFlow(metrics),production,forecast}}
function gembaFlowValue(label,value){return '<div class="gemba-flow-value"><span>'+escapeHtml(label)+'</span><strong>'+fmt(value)+'</strong></div>'}
function gembaFlowCard(item,index){const tones=["#2563eb","#8b5cf6","#f59e0b","#06b6d4","#ec4899","#14b8a6","#6366f1","#f97316","#22c55e","#64748b"],values=gembaFlowValue("Fluxo geral",item.general)+gembaFlowValue("Importado",item.imported)+gembaFlowValue("Em fluxo",item.inFlow)+gembaFlowValue("Aguardando separação",item.waiting);return '<article class="gemba-flow-item" style="--tone:'+tones[index%tones.length]+'"><h3>'+escapeHtml(item.label)+'</h3><div>'+values+'</div></article>'}
function renderGembaFlow(flow,hasFile){if(!hasFile)return '<div class="empty-state">Importe o CSV para calcular o fluxo operacional.</div>';if(!flow.classificationAvailable)return '<div class="empty-state">A coluna Classificação Tipo Pedido não está disponível ou não possui valores.</div>';if(!flow.items.length)return '<div class="empty-state">Nenhum pedido encontrado nas classificações e status monitorados.</div>';return '<div class="gemba-flow-grid">'+flow.items.map(gembaFlowCard).join("")+'</div><p class="gemba-rule-note">Somente classificações e status configurados são exibidos. Cards sem pedidos elegíveis permanecem ocultos.</p>'}
function gembaForecastCard(label,data,tone){const percent=data.adjusted?Math.min(100,data.produced/data.adjusted*100):100,status=data.remaining?'<strong class="gemba-remaining">Faltam produzir '+fmt(data.remaining)+'</strong>':'<strong class="gemba-achieved">Meta atingida'+(data.above?' · +'+fmt(data.above)+' acima da necessidade':'')+'</strong>';return '<article class="gemba-forecast-item '+tone+'"><div class="gemba-forecast-title"><h3>'+label+'</h3><span>'+decimalFmt(percent)+'%</span></div><div class="gemba-progress"><i style="width:'+percent+'%"></i></div><div class="gemba-forecast-values"><span>Meta original <b>'+fmt(data.meta)+'</b></span><span>Produzido <b>'+fmt(data.produced)+'</b></span><span>Déficit original <b>'+fmt(data.deficit)+'</b></span><span>Compensação recebida <b>+'+fmt(data.compensation)+'</b></span><span>Necessidade ajustada <b>'+fmt(data.adjusted)+'</b></span></div>'+status+'</article>'}
function updateGembaGoalAccess(){const editable=cloudState.isManager;["#gemba-meta-b2c","#gemba-meta-b2b","#gemba-save-goals"].forEach(selector=>{const element=$(selector);if(element)element.disabled=!editable});if($("#gemba-goals-access"))$("#gemba-goals-access").textContent=editable?"Metas sincronizadas com as configurações da gestão.":"Somente Gestor ou Administrador pode alterar as metas."}
function renderGembaAbs(){if(!$("#gemba-abs-list"))return;$("#gemba-abs-count").textContent="ABS: "+fmt(gembaAbs.length);$("#gemba-abs-list").innerHTML=gembaAbs.length?gembaAbs.map(item=>'<div class="gemba-abs-row"><span><strong>'+escapeHtml(item.nome)+'</strong><small>'+escapeHtml(item.tipo)+'</small></span><span><button data-gemba-abs-action="edit" data-gemba-abs-id="'+escapeHtml(item.id)+'">Editar</button><button class="danger-mini" data-gemba-abs-action="delete" data-gemba-abs-id="'+escapeHtml(item.id)+'">Excluir</button></span></div>').join(""):'<div class="empty-state compact">Nenhum ABS registrado.</div>'}
function generateGembaSummary(metrics=currentMetrics,referenceDate=new Date()){
  const date=referenceDate,gemba=calculateGembaMetrics(metrics),lines=[greetingForTime(date)+"!","Segue informações do GEMBA",String(date.getDate()).padStart(2,"0")+"/"+String(date.getMonth()+1).padStart(2,"0")];
  if(metrics.fileName){
    gemba.flow.items.forEach(item=>lines.push("",item.label,"Fluxo geral: "+fmt(item.general),"Importado: "+fmt(item.imported),"Em fluxo: "+fmt(item.inFlow),"Aguardando separação: "+fmt(item.waiting)));
    lines.push("","Faturado até o momento","B2B: "+fmt(gemba.production.b2b),"B2C: "+fmt(gemba.production.b2c));
  }
  lines.push("","ABS: "+fmt(gembaAbs.length));gembaAbs.forEach(item=>lines.push(item.nome+" — "+item.tipo));return lines.join("\n")
}
function renderGembaSummary(){if($("#gemba-summary-preview"))$("#gemba-summary-preview").textContent=generateGembaSummary()}
function renderGemba(metrics){const gemba=calculateGembaMetrics(metrics),now=new Date();$("#gemba-updated").textContent=metrics.fileName?now.toLocaleDateString("pt-BR")+" · atualizado às "+metrics.importedAt:"Aguardando importação do CSV";$("#gemba-flow").innerHTML=renderGembaFlow(gemba.flow,Boolean(metrics.fileName));$("#gemba-meta-b2c").value=gembaConfig.metaB2c;$("#gemba-meta-b2b").value=gembaConfig.metaB2b;$("#gemba-forecast").innerHTML='<div class="gemba-forecast-grid">'+gembaForecastCard("B2C",gemba.forecast.b2c,"blue")+gembaForecastCard("B2B",gemba.forecast.b2b,"violet")+'</div>';updateGembaGoalAccess();renderGembaAbs();renderGembaSummary()}
function openGembaAbs(item){$("#gemba-abs-id").value=item?.id||"";$("#gemba-abs-name").value=item?.nome||"";$("#gemba-abs-type").value=item?.tipo||"";$("#gemba-abs-title").textContent=item?"Editar ABS":"Adicionar ABS";$("#gemba-abs-error").textContent="";$("#gemba-abs-modal").classList.add("show");$("#gemba-abs-modal").setAttribute("aria-hidden","false");setTimeout(()=>$("#gemba-abs-name").focus(),0)}
function closeGembaAbs(){$("#gemba-abs-modal").classList.remove("show");$("#gemba-abs-modal").setAttribute("aria-hidden","true");$("#gemba-abs-form").reset();$("#gemba-abs-id").value="";$("#gemba-abs-error").textContent=""}
async function writeClipboardText(text){if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(text);const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.append(area);try{area.select();if(!document.execCommand("copy"))throw new Error("Cópia não suportada")}finally{area.remove()}}
async function copyGemba(){if(!currentMetrics.fileName)return showToast("Importe um CSV antes de copiar o GEMBA.",true);try{await writeClipboardText(generateGembaSummary());showToast("GEMBA copiado com sucesso.")}catch(error){showToast("Não foi possível copiar o GEMBA neste navegador.",true)}}
/* ===================== CENTRAL SLA E DETALHAMENTOS ===================== */

const slaStatusMeta = {
  overdue: { label: "SLA vencido", color: "#ef4444" }, critical: { label: "Em risco", color: "#f97316" },
  today: { label: "Vence hoje", color: "#eab308" }, safe: { label: "Dentro do SLA", color: "#22c55e" },
  notApplicable: { label: "Sem SLA aplicável", color: "#94a3b8" }
};

function humanDuration(milliseconds) {
  const overdue = milliseconds < 0, totalMinutes = Math.max(0, Math.floor(Math.abs(milliseconds) / 60000));
  const days = Math.floor(totalMinutes / 1440), hours = Math.floor((totalMinutes % 1440) / 60), minutes = totalMinutes % 60;
  const value = [days ? days + "d" : "", hours ? hours + "h" : "", (!days && minutes) || (!days && !hours) ? minutes + "min" : ""].filter(Boolean).join(" ");
  return overdue ? value + " em atraso" : "vence em " + value;
}

function enrichedSlaRecords() {
  const now=Date.now(),minute=Math.floor(now/60000);
  if(slaRuntimeCache.metrics===currentMetrics&&slaRuntimeCache.profiles===slaProfiles&&slaRuntimeCache.pickups===pickupSchedules&&slaRuntimeCache.minute===minute)return slaRuntimeCache.records;
  const records=currentMetrics.slaRecords.map(record => {
    const profile=matchingSlaProfile(record),deadline=slaProfileDeadline(record,profile),applicable=Boolean(deadline&&Number.isFinite(deadline.due)),alertMinutes=0;
    return { ...record, profileId:profile?profile.id:null, profileName:profile?profile.name:"Regra automática 48h", profileSummary:profile?profileRuleSummary(profile):"Prazo de 48 horas corridas após a importação.", alertMinutes, dueStamp:applicable?deadline.due:null, pickupStamp:null, deadlineSource:applicable?deadline.source:"Data/Hora Importação não informada", slaApplicable:applicable, slaStatus:applicable?slaState(deadline.due,now,alertMinutes):"notApplicable", remaining:applicable?deadline.due-now:null };
  });
  slaRuntimeCache={metrics:currentMetrics,profiles:slaProfiles,pickups:pickupSchedules,minute,records};
  return records;
}

function renderSlaDrawerPage(){const limit=(slaUi.drawerPage+1)*slaUi.drawerPageSize,visible=slaUi.drawerRecords.slice(0,limit);$("#sla-drawer-body").innerHTML=visible.map((record,index)=>{const meta=slaStatusMeta[record.slaStatus];return '<button class="drawer-order" data-sla-record-index="'+index+'"><span><strong>Pedido '+escapeHtml(record.order)+'</strong><small>NF '+escapeHtml(record.invoice||"—")+'</small></span><span><strong>'+escapeHtml(record.load)+'</strong><small>Onda '+escapeHtml(record.wave||record.waveId||"—")+'</small></span><span><strong>'+escapeHtml(carrierShort(record.carrier))+'</strong><small>'+escapeHtml(record.status)+'</small></span><strong style="color:'+meta.color+'">'+escapeHtml(record.slaApplicable?humanDuration(record.remaining):meta.label)+'</strong></button>'}).join("")+(visible.length<slaUi.drawerRecords.length?'<button class="btn secondary" id="sla-drawer-more">Mostrar mais '+fmt(Math.min(slaUi.drawerPageSize,slaUi.drawerRecords.length-visible.length))+' pedidos</button>':'')}
function openSlaDrawer(records,title) {
  slaUi.drawerRecords=records.slice().sort((a,b)=>(a.slaApplicable===b.slaApplicable?a.dueStamp-b.dueStamp:a.slaApplicable?-1:1)); slaUi.drawerTitle=title;slaUi.drawerPage=0; $("#sla-drawer-title").textContent=title; $("#sla-drawer-subtitle").textContent=fmt(records.length)+" pedidos"; $("#sla-drawer-kicker").textContent="DRILL DOWN OPERACIONAL";
  renderSlaDrawerPage();
  $("#sla-drawer").classList.add("show"); $("#sla-drawer-backdrop").classList.add("show");
}

function showSlaRecord(index) {
  const record=slaUi.drawerRecords[index]; if(!record)return; const meta=slaStatusMeta[record.slaStatus], date=record.slaApplicable?new Date(record.dueStamp).toLocaleString("pt-BR"):"Não calculado";
  const fields=[["Nota Fiscal",record.invoice||"—"],["Pedido",record.order],["Cliente",record.client||"—"],["Onda",record.wave||record.waveId||"—"],["Carga",record.load],["Transportadora",record.carrier],["Serviço",record.service],["Status atual",record.status],["Data/Hora Importação",record.importedRaw||"—"],["Perfil de SLA",record.profileName],["Prazo operacional",date],["Prazo definido por",record.deadlineSource],["Próxima coleta após origem",record.pickupStamp?new Date(record.pickupStamp).toLocaleString("pt-BR"):"Não cadastrada"],["Resumo da regra",record.profileSummary],["Tempo restante ou atraso",record.slaApplicable?humanDuration(record.remaining):"SLA não configurado"],["Produtos",fmt(record.products)],["Volumes",fmt(record.volumes)],["Série",record.series],["Setor responsável",record.sector]];
  $("#sla-drawer-title").textContent="Pedido "+record.order; $("#sla-drawer-subtitle").textContent=meta.label;
  $("#sla-drawer-body").innerHTML='<div class="drawer-actions"><button class="btn secondary" id="sla-back-list">← Voltar à lista</button><button class="btn primary" disabled title="Configure a URL do WMS para habilitar este acesso">Abrir pedido no WMS</button></div><div class="drawer-detail-grid">'+fields.map(field=>'<div><small>'+escapeHtml(field[0])+'</small><strong>'+escapeHtml(field[1])+'</strong></div>').join("")+'</div>';
  $("#sla-back-list").addEventListener("click",()=>openSlaDrawer(slaUi.drawerRecords,slaUi.drawerTitle));
}

function closeSlaDrawer(){$("#sla-drawer").classList.remove("show");$("#sla-drawer-backdrop").classList.remove("show");slaCentralUi.drawerOpen=false}

// Estado efêmero da interface: expansões e filtros não são persistidos entre sessões.
const slaCentralUi={
  model:null,contexts:new Map(),contextSequence:0,importToken:"",
  expanded:{billing:new Set(),shipping:new Set()},drawerOpen:false,drawerRecords:[],filteredDrawerRecords:[],drawerTitle:"",drawerLimit:200
};

function slaCentralDateKeyFromStamp(stamp){const parts=slaCentralZonedParts(stamp);return parts.year+"-"+String(parts.month).padStart(2,"0")+"-"+String(parts.day).padStart(2,"0")}
function slaCentralOffsetDateKey(dateKey,offset){const parts=dateKey.split("-").map(Number),date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]+offset));return date.getUTCFullYear()+"-"+String(date.getUTCMonth()+1).padStart(2,"0")+"-"+String(date.getUTCDate()).padStart(2,"0")}
function slaCentralDateLabel(dateKey){const parts=dateKey.split("-");return parts[2]+"/"+parts[1]+"/"+parts[0]}
// Enriquece o registro sem mutar a linha original importada do CSV.
function classifySlaCentralDelay(record,todayKey,referenceStamp){
  const profile=matchingSlaProfile(record),deadline=slaProfileDeadline(record,profile),dueStamp=deadline?.due,delayed=Number.isFinite(dueStamp)&&referenceStamp>dueStamp,priorityToday=deadline?.dueDateKey===todayKey;
  const delayReason=profile
    ?(deadline.afterCutoff?"Importado após "+deadline.cutoff+"; prazo avançado em um dia adicional e expedição até "+deadline.deadlineTime+".":"Importado dentro do corte; expedição até "+deadline.deadlineTime+" no "+(deadline.dispatchDay==="next_day"?"dia seguinte":"mesmo dia")+".")
    :"Serviço sem perfil: prazo automático de 48 horas corridas após a importação.";
  return{profileId:profile?.id||null,profileName:profile?.name||"Regra automática 48h",profileApplied:Boolean(profile),cutoff:deadline?.cutoff||"",deadlineTime:deadline?.deadlineTime||"",dispatchDay:deadline?.dispatchDay||"",dueStamp,dueDateKey:deadline?.dueDateKey||"",deadlineSource:deadline?.source||"",priorityToday,automatic48h:!profile,delayed,delayKind:delayed?(profile?"profile-overdue":"automatic-overdue"):(priorityToday?"due-today":"within-deadline"),delayReason};
}

/**
 * Monta o modelo compartilhado por KPIs, matrizes, drawer e exportação.
 * Manter todos esses consumidores na mesma fonte evita divergência de contagens.
 */
function buildSlaCentralModel(metrics,referenceStamp=Date.now()){
  const todayKey=slaCentralDateKeyFromStamp(referenceStamp),d1Key=slaCentralOffsetDateKey(todayKey,-1);
  const records=(metrics.slaCentralRecords||[]).map(record=>Object.assign({},record,{carrierNormalized:normalizeSlaCentralValue(record.carrier)},classifySlaCentralDelay(record,todayKey,referenceStamp)));
  const serviceMap=new Map();records.forEach(record=>{if(!serviceMap.has(record.serviceNormalized))serviceMap.set(record.serviceNormalized,record.service)});
  const services=Array.from(serviceMap,([normalized,label])=>({normalized,label})).sort((a,b)=>a.normalized.localeCompare(b.normalized,"pt-BR",{numeric:true}));
  const carrierMap=new Map();records.forEach(record=>{if(!carrierMap.has(record.carrierNormalized))carrierMap.set(record.carrierNormalized,record.carrier)});
  const carriers=Array.from(carrierMap,([normalized,label])=>({normalized,label})).sort((a,b)=>a.normalized.localeCompare(b.normalized,"pt-BR",{numeric:true}));
  const areas={};
  ["billing","shipping"].forEach(area=>{
    const areaRecords=records.filter(record=>record.area===area),dates=new Map();
    areaRecords.forEach(record=>{
      if(!dates.has(record.importDateKey))dates.set(record.importDateKey,{key:record.importDateKey,label:record.importDateLabel,records:[],hours:new Map()});
      const group=dates.get(record.importDateKey);group.records.push(record);
      if(!group.hours.has(record.importHour))group.hours.set(record.importHour,[]);
      group.hours.get(record.importHour).push(record);
    });
    areas[area]={records:areaRecords,dates:Array.from(dates.values()).sort((a,b)=>a.key.localeCompare(b.key))};
  });
  const delayed=records.filter(record=>record.delayed).sort((a,b)=>a.dueStamp-b.dueStamp),priorityToday=records.filter(record=>record.priorityToday&&!record.delayed).sort((a,b)=>a.dueStamp-b.dueStamp),automatic=records.filter(record=>record.automatic48h),urgent=[...records].sort((a,b)=>a.dueStamp-b.dueStamp)[0]||null;
  return{todayKey,d1Key,referenceStamp,records,services,carriers,areas,delayed,priorityToday,automatic,urgent};
}

function registerSlaCentralContext(records,title){
  const id="sla_ctx_"+(++slaCentralUi.contextSequence);
  slaCentralUi.contexts.set(id,{records:[...records],title});
  return id;
}

function slaCentralCountMarkup(records,title){
  if(!records.length)return"";
  const delayed=records.filter(record=>record.delayed).length,dueToday=records.filter(record=>record.priorityToday&&!record.delayed).length,id=registerSlaCentralContext(records,title),signal=delayed?'<small>'+fmt(delayed)+' vencido'+(delayed===1?'':'s')+'</small>':dueToday?'<small>'+fmt(dueToday)+' para hoje</small>':'';
  return '<button class="sla-count-button" data-sla-context="'+id+'"><strong>'+fmt(records.length)+'</strong>'+signal+'</button>';
}

function slaCentralRecordsFor(records,serviceNormalized){return serviceNormalized?records.filter(record=>record.serviceNormalized===serviceNormalized):records}
function slaCentralRecordsForCarrier(records,carrierNormalized){return carrierNormalized?records.filter(record=>record.carrierNormalized===carrierNormalized):records}

function slaCentralTableHtml(area,model){
  const areaData=model.areas[area],areaLabel=area==="billing"?"Faturamento":"Expedição";
  if(!areaData.records.length)return'<div class="sla-central-empty">Nenhum pedido encontrado em '+areaLabel.toLowerCase()+' com Série 17 e serviço preenchido.</div>';
  const carriers=model.carriers.filter(carrier=>areaData.records.some(record=>record.carrierNormalized===carrier.normalized));
  const header=carriers.map(carrier=>'<th>'+escapeHtml(carrier.label)+'</th>').join("");
  const rows=[];
  areaData.dates.forEach(date=>{
    const isToday=date.key===model.todayKey,isD1=date.key===model.d1Key,expanded=slaCentralUi.expanded[area].has(date.key),suffix=isToday?" — Hoje":isD1?" — D-1":"";
    const delayed=date.records.filter(record=>record.delayed).length,dueToday=date.records.some(record=>record.priorityToday&&!record.delayed),rowClass=delayed?"sla-row-overdue":dueToday?"sla-row-alert":"";
    const cells=carriers.map(carrier=>{const records=slaCentralRecordsForCarrier(date.records,carrier.normalized);return'<td>'+slaCentralCountMarkup(records,areaLabel+" · "+date.label+" · "+carrier.label)+'</td>'}).join("");
    const toggle='<button class="sla-date-toggle" data-sla-toggle-area="'+area+'" data-sla-toggle-date="'+date.key+'" aria-expanded="'+expanded+'" aria-label="'+(expanded?"Recolher":"Expandir")+' horários de '+escapeHtml(date.label)+'" title="'+(expanded?"Recolher":"Expandir")+' horários">'+(expanded?"−":"+")+'</button>';
    const scopeClass=isToday?"sla-scope-today":isD1?"sla-scope-d1":"sla-scope-older";
    rows.push('<tr class="sla-date-row '+scopeClass+' '+rowClass+'"><th>'+toggle+'<span>'+escapeHtml(date.label+suffix)+'</span></th>'+cells+'<td class="sla-total-cell">'+slaCentralCountMarkup(date.records,areaLabel+" · total de "+date.label)+'</td></tr>');
    if(expanded)Array.from(date.hours.entries()).sort((a,b)=>a[0]-b[0]).forEach(([hour,hourRecords])=>{
      const hourDelayed=hourRecords.filter(record=>record.delayed).length,hourDueToday=hourRecords.some(record=>record.priorityToday&&!record.delayed),hourClass=hourDelayed?"sla-row-overdue":hourDueToday?"sla-row-alert":"";
      const hourCells=carriers.map(carrier=>{const records=slaCentralRecordsForCarrier(hourRecords,carrier.normalized);return'<td>'+slaCentralCountMarkup(records,areaLabel+" · "+date.label+" · "+String(hour).padStart(2,"0")+"h · "+carrier.label)+'</td>'}).join("");
      rows.push('<tr class="sla-hour-row '+scopeClass+' '+hourClass+'"><th><span>↳ '+String(hour).padStart(2,"0")+'h</span></th>'+hourCells+'<td class="sla-total-cell">'+slaCentralCountMarkup(hourRecords,areaLabel+" · "+date.label+" · "+String(hour).padStart(2,"0")+"h")+'</td></tr>');
    });
  });
  const carrierTotals=carriers.map(carrier=>{const records=slaCentralRecordsForCarrier(areaData.records,carrier.normalized);return'<td>'+slaCentralCountMarkup(records,areaLabel+" · total de "+carrier.label)+'</td>'}).join("");
  const footer='<tr class="sla-grand-total"><th>Total por transportadora</th>'+carrierTotals+'<td>'+slaCentralCountMarkup(areaData.records,areaLabel+" · total geral")+'</td></tr>';
  return'<div class="sla-matrix-scroll"><table class="sla-central-matrix"><thead><tr><th>Dia/horário</th>'+header+'<th>Total</th></tr></thead><tbody>'+rows.join("")+'</tbody><tfoot>'+footer+'</tfoot></table></div>';
}

function renderSlaCentralDiagnostics(metrics){
  const diagnostics=metrics.slaCentralDiagnostics||{},messages=[];
  if((diagnostics.missingColumns||[]).length)messages.push('<div class="sla-diagnostic error"><strong>Colunas obrigatórias não encontradas</strong><span>'+escapeHtml(diagnostics.missingColumns.join(", "))+'</span></div>');
  if(diagnostics.invalidDates)messages.push('<div class="sla-diagnostic warning"><strong>Datas não interpretadas</strong><span>'+fmt(diagnostics.invalidDates)+' registro(s) ignorado(s) porque “Importado em” não contém data e hora válidas.</span></div>');
  const unknown=Object.values(diagnostics.unknownStatuses||{});
  if(unknown.length)messages.push('<div class="sla-diagnostic info"><strong>Status não classificados</strong><span>'+unknown.sort((a,b)=>b.count-a.count).map(item=>escapeHtml(item.label)+" ("+fmt(item.count)+")").join(" · ")+'</span></div>');
  $("#sla-central-diagnostics").innerHTML=messages.join("");
}

function renderSlaNormalBreakdown(model){
  if(!model.records.length){$("#sla-normal-breakdown").innerHTML='<div class="sla-central-empty compact">Importe o CSV para visualizar as prioridades.</div>';return}
  const statusGroups=[{label:"SLA vencido",records:model.delayed},{label:"Prioridade de hoje",records:model.priorityToday},{label:"Regra automática 48h",records:model.automatic}];
  const byStatus=statusGroups.map(group=>{const id=registerSlaCentralContext(group.records,group.label);return'<button data-sla-context="'+id+'" '+(group.records.length?'':'disabled')+'><span>'+group.label+'</span><strong>'+fmt(group.records.length)+'</strong></button>'}).join("");
  const urgent=model.records.filter(record=>record.delayed||record.priorityToday),byService=model.services.map(service=>{const records=urgent.filter(record=>record.serviceNormalized===service.normalized);if(!records.length)return"";const id=registerSlaCentralContext(records,"Prioridade SLA · "+service.label);return'<button data-sla-context="'+id+'"><span>'+escapeHtml(service.label)+'</span><strong>'+fmt(records.length)+'</strong></button>'}).join("")||'<span class="sla-breakdown-empty">Nenhum serviço vencido ou com prioridade para hoje.</span>';
  $("#sla-normal-breakdown").innerHTML='<div class="sla-breakdown-section"><small>Por condição</small><div>'+byStatus+'</div></div><div class="sla-breakdown-section"><small>Serviços urgentes</small><div>'+byService+'</div></div>';
}

function setSlaCentralCardContext(cardName,records,title){
  const card=document.querySelector('[data-sla-card="'+cardName+'"]');if(!card)return;
  card.dataset.slaContext=records.length?registerSlaCentralContext(records,title):"";
  card.disabled=!records.length;
}

function renderSlaCentral(){
  const metrics=currentMetrics,model=buildSlaCentralModel(metrics),token=metrics.fileName+"|"+metrics.importedAt+"|"+model.todayKey;
  if(token!==slaCentralUi.importToken){slaCentralUi.importToken=token;slaCentralUi.expanded={billing:new Set([model.d1Key,model.todayKey]),shipping:new Set([model.d1Key,model.todayKey])}}
  slaCentralUi.model=model;slaCentralUi.contexts.clear();slaCentralUi.contextSequence=0;
  $("#sla-central-updated").textContent=metrics.fileName?"CSV "+metrics.fileName+" · atualizado às "+metrics.importedAt+" · fuso "+SLA_CENTRAL_TIME_ZONE:"Importe o CSV para calcular os pedidos pendentes";
  renderSlaCentralDiagnostics(metrics);
  $("#sla-central-billing").textContent=fmt(model.areas.billing.records.length);$("#sla-central-shipping").textContent=fmt(model.areas.shipping.records.length);$("#sla-central-delayed").textContent=fmt(model.delayed.length);$("#sla-central-previous").textContent=fmt(model.priorityToday.length);$("#sla-central-today-before").textContent=fmt(model.automatic.length);
  $("#sla-central-oldest").textContent=model.urgent?new Date(model.urgent.dueStamp).toLocaleString("pt-BR",{timeZone:SLA_CENTRAL_TIME_ZONE,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";$("#sla-central-oldest-wait").textContent=model.urgent?(model.urgent.delayed?slaCentralPendingDuration(model.referenceStamp-model.urgent.dueStamp)+" em atraso":humanDuration(model.urgent.dueStamp-model.referenceStamp)):"Nenhum pedido pendente";
  setSlaCentralCardContext("billing",model.areas.billing.records,"Pendentes de faturamento");setSlaCentralCardContext("shipping",model.areas.shipping.records,"Pendentes de expedição");setSlaCentralCardContext("delayed",model.delayed,"Pedidos com SLA vencido");setSlaCentralCardContext("previous",model.priorityToday,"Prioridade de hoje");setSlaCentralCardContext("today-before",model.automatic,"Serviços com regra automática de 48h");setSlaCentralCardContext("oldest",model.urgent?[model.urgent]:[],"Pedido com prazo mais urgente");
  renderSlaNormalBreakdown(model);
  const missing=(metrics.slaCentralDiagnostics?.missingColumns||[]).length;
  const state=!metrics.fileName?'<div class="sla-central-empty">Nenhum CSV importado.</div>':missing?'<div class="sla-central-empty error">Não foi possível montar a tabela. Verifique as colunas obrigatórias informadas acima.</div>':null;
  $("#sla-billing-table").innerHTML=state||slaCentralTableHtml("billing",model);$("#sla-shipping-table").innerHTML=state||slaCentralTableHtml("shipping",model);
}

function slaCentralPendingDuration(milliseconds){
  const totalMinutes=Math.max(0,Math.floor(milliseconds/60000)),days=Math.floor(totalMinutes/1440),hours=Math.floor(totalMinutes%1440/60),minutes=totalMinutes%60;
  return[days?days+"d":"",hours?hours+"h":"",(!days||!hours)&&minutes?minutes+"min":""].filter(Boolean).join(" ")||"0min";
}

function slaCentralFilterOptions(records,field,label){
  const values=Array.from(new Map(records.map(record=>[String(record[field]),record[field]])).values()).filter(value=>value!==""&&value!=null).sort((a,b)=>String(a).localeCompare(String(b),"pt-BR",{numeric:true}));
  return'<option value="">'+label+'</option>'+values.map(value=>'<option value="'+escapeHtml(value)+'">'+escapeHtml(field==="importHour"?String(value).padStart(2,"0")+"h":value)+'</option>').join("");
}

function openSlaCentralDrawer(records,title){
  if(!records.length)return;
  slaCentralUi.drawerOpen=true;slaCentralUi.drawerRecords=[...records].sort((a,b)=>a.importedStamp-b.importedStamp);slaCentralUi.drawerTitle=title;slaCentralUi.drawerLimit=200;
  $("#sla-drawer-kicker").textContent="DETALHAMENTO · EXPEDIÇÃO PEDIDOS";$("#sla-drawer-title").textContent=title;$("#sla-drawer-subtitle").textContent=fmt(records.length)+" pedido(s) único(s)";
  $("#sla-drawer-body").innerHTML='<div class="sla-detail-toolbar"><div class="sla-field span-2"><label>Pesquisa</label><input id="sla-detail-search" placeholder="Nota Fiscal ou Pedido de Venda"></div><div class="sla-field"><label>Data</label><input type="date" id="sla-detail-date"></div><div class="sla-field"><label>Horário</label><select id="sla-detail-hour">'+slaCentralFilterOptions(records,"importHour","Todos")+'</select></div><div class="sla-field"><label>Status</label><select id="sla-detail-status">'+slaCentralFilterOptions(records,"status","Todos")+'</select></div><div class="sla-field"><label>Serviço</label><select id="sla-detail-service">'+slaCentralFilterOptions(records,"service","Todos")+'</select></div><div class="sla-field"><label>Prazo</label><select id="sla-detail-delay"><option value="">Todos</option><option value="delayed">Atrasados</option><option value="on-time">Dentro do prazo</option></select></div><button class="btn secondary" id="sla-detail-export">Exportar CSV</button></div><div id="sla-detail-results"></div>';
  renderSlaCentralDrawerResults();$("#sla-drawer").classList.add("show");$("#sla-drawer-backdrop").classList.add("show");
}

function filteredSlaCentralDrawerRecords(){
  const query=normalizeSlaCentralValue($("#sla-detail-search")?.value||""),date=$("#sla-detail-date")?.value||"",hour=$("#sla-detail-hour")?.value||"",status=$("#sla-detail-status")?.value||"",service=$("#sla-detail-service")?.value||"",delay=$("#sla-detail-delay")?.value||"";
  return slaCentralUi.drawerRecords.filter(record=>{
    if(query&&!normalizeSlaCentralValue(record.invoice+" "+record.order).includes(query))return false;
    if(date&&record.importDateKey!==date)return false;if(hour!==""&&String(record.importHour)!==hour)return false;if(status&&record.status!==status)return false;if(service&&record.service!==service)return false;
    if(delay==="delayed"&&!record.delayed)return false;if(delay==="on-time"&&record.delayed)return false;return true;
  });
}

function slaCentralDetailRecordHtml(record){
  const condition=record.delayed?"SLA vencido":record.priorityToday?"Prioridade de hoje":"Dentro do prazo",deadline=Number.isFinite(record.dueStamp)?new Date(record.dueStamp).toLocaleString("pt-BR",{timeZone:SLA_CENTRAL_TIME_ZONE}):"—";
  const fields=[["Nota Fiscal",record.invoice||"—"],["Pedido de Venda",record.order],["Importado em",record.importedRaw],["Tempo pendente",slaCentralPendingDuration(Date.now()-record.importedStamp)],["Status atual",record.status],["Etapa",record.area==="billing"?"Faturamento":"Expedição"],["Serviço",record.service],["Transportadora",record.carrier],["Perfil aplicado",record.profileName],["Limite de importação",record.cutoff||"Não se aplica"],["Limite de expedição",record.deadlineTime||"48h após importação"],["Prazo base",record.dispatchDay==="next_day"?"Dia seguinte":record.dispatchDay==="same_day"?"Mesmo dia":"Regra automática"],["Prazo calculado",deadline],["Carga",record.load],["Onda",record.wave||record.waveId||"—"],["Volumes",fmt(record.volumes)],["Peças",fmt(record.products)],["Usuário responsável",record.responsible||"Não informado"],["Condição",condition],["Motivo",record.delayReason]];
  return'<article class="sla-detail-record '+(record.delayed?"delayed":"")+'"><div class="sla-detail-record-head"><span><strong>'+escapeHtml(record.invoice?"NF "+record.invoice:"Pedido "+record.order)+'</strong>'+(record.identifierFallback?'<small>Pedido de Venda usado como identificador</small>':'')+'</span><b class="'+(record.delayed?"bad":"good")+'">'+condition+'</b></div><div class="sla-detail-grid">'+fields.map(field=>'<div><small>'+escapeHtml(field[0])+'</small><strong>'+escapeHtml(field[1])+'</strong></div>').join("")+'</div></article>';
}

function renderSlaCentralDrawerResults(){
  if(!slaCentralUi.drawerOpen||!$("#sla-detail-results"))return;
  const records=filteredSlaCentralDrawerRecords();slaCentralUi.filteredDrawerRecords=records;const visible=records.slice(0,slaCentralUi.drawerLimit);
  $("#sla-drawer-subtitle").textContent=fmt(records.length)+" de "+fmt(slaCentralUi.drawerRecords.length)+" pedido(s)";
  $("#sla-detail-results").innerHTML=visible.length?visible.map(slaCentralDetailRecordHtml).join("")+(visible.length<records.length?'<button class="btn secondary sla-detail-more" id="sla-detail-more">Mostrar mais '+fmt(Math.min(200,records.length-visible.length))+'</button>':''):'<div class="sla-central-empty">Nenhum pedido corresponde aos filtros do detalhamento.</div>';
}

function exportSlaCentralDetailCsv(){
  const rows=[["NOTA FISCAL","PEDIDO DE VENDA","IDENTIFICADOR ALTERNATIVO","IMPORTADO EM","TEMPO PENDENTE","STATUS","ETAPA","SERVIÇO DA TRANSPORTADORA","TRANSPORTADORA","PERFIL SLA","LIMITE IMPORTAÇÃO","LIMITE EXPEDIÇÃO","PRAZO BASE","PRAZO CALCULADO","CARGA","ONDA","VOLUMES","PEÇAS","USUÁRIO RESPONSÁVEL","SLA VENCIDO","MOTIVO"]];
  slaCentralUi.filteredDrawerRecords.forEach(record=>rows.push([record.invoice,record.order,record.identifierFallback?"SIM":"NÃO",record.importedRaw,slaCentralPendingDuration(Date.now()-record.importedStamp),record.status,record.area==="billing"?"Faturamento":"Expedição",record.service,record.carrier,record.profileName,record.cutoff||"NÃO SE APLICA",record.deadlineTime||"48H",record.dispatchDay==="next_day"?"DIA SEGUINTE":record.dispatchDay==="same_day"?"MESMO DIA":"AUTOMÁTICO",new Date(record.dueStamp).toLocaleString("pt-BR",{timeZone:SLA_CENTRAL_TIME_ZONE}),record.load,record.wave||record.waveId,record.volumes,record.products,record.responsible,record.delayed?"SIM":"NÃO",record.delayReason]));
  const content=rows.map(row=>row.map(csvCell).join(";")).join("\n"),blob=new Blob(["\ufeff"+content],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="expedicao-pedidos-detalhamento-"+new Date().toISOString().slice(0,10)+".csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast("Detalhamento de Expedição Pedidos exportado em CSV.");
}

const conferenceUi={details:[],title:""};
function conferenceBucketByKey(key,segment){const data=segment==="b2c"?currentMetrics.b2cHourly:currentMetrics.b2bHourly;return data.find(item=>item.label+"||"+item.descriptor===key)}
function conferenceTotalByCarrier(carrier,segment){const data=segment==="b2c"?currentMetrics.b2cHourly:currentMetrics.b2bHourly,matching=data.filter(item=>item.descriptor===carrier),orders=new Map();matching.forEach(bucket=>bucket.details.forEach(item=>orders.set(item.order,item)));const details=Array.from(orders.values());return{label:"Todos os horários",descriptor:carrier,orders:details.length,volumes:details.reduce((sum,item)=>sum+item.volumes,0),details}}
function openConferenceDetails(bucket,segment){if(!bucket||!bucket.details.length)return;conferenceUi.details=bucket.details.slice().sort((a,b)=>String(a.invoice).localeCompare(String(b.invoice),"pt-BR",{numeric:true}));conferenceUi.title=(segment==="b2c"?"Conferência B2C":"Conferência B2B")+" · "+bucket.label+" · "+carrierDisplayName(bucket.descriptor);$("#sla-drawer-kicker").textContent="PEDIDOS PENDENTES DE CONFERÊNCIA";$("#sla-drawer-title").textContent=conferenceUi.title;$("#sla-drawer-subtitle").textContent=fmt(conferenceUi.details.length)+" pedidos · "+fmt(bucket.volumes)+" volumes";$("#sla-drawer-body").innerHTML='<div class="drawer-export-bar"><button class="btn secondary" id="conference-export-csv">Exportar CSV</button><button class="btn primary" id="conference-export-image">Exportar imagem</button></div><div style="overflow:auto"><div class="conference-detail-table"><div class="conference-detail-head"><span>Nota Fiscal</span><span>Pedido de Venda</span><span>Classificação</span><span>Cód. Serviço</span><span>Transportadora</span><span>Pesado em</span><span>Usuário Pesagem</span><span>Volumes</span></div>'+conferenceUi.details.map(item=>'<div class="conference-detail-row"><strong>'+escapeHtml(item.invoice||"—")+'</strong><span>'+escapeHtml(item.order||"—")+'</span><span>'+escapeHtml(item.orderClassification||"—")+'</span><span>'+escapeHtml(item.serviceCode||"—")+'</span><span>'+escapeHtml(item.carrier||"—")+'</span><span>'+escapeHtml(item.weighedAt||"—")+'</span><span>'+escapeHtml(item.weighingUser||"—")+'</span><strong>'+fmt(item.volumes)+'</strong></div>').join('')+'</div></div>';$("#sla-drawer").classList.add("show");$("#sla-drawer-backdrop").classList.add("show");$("#conference-export-csv").addEventListener("click",exportConferenceCsv);$("#conference-export-image").addEventListener("click",exportConferenceImage)}
function conferenceRows(){return [["NOTA FISCAL","PEDIDO DE VENDA","CLASSIFICAÇÃO DO PEDIDO","COD DE SERVIÇO","TRANSPORTADORA","PESADO EM","USUARIO DE PESAGEM","VOLUMES"],...conferenceUi.details.map(item=>[item.invoice,item.order,item.orderClassification,item.serviceCode,item.carrier,item.weighedAt,item.weighingUser,item.volumes])]}
function csvCell(value){const text=String(value==null?"":value);return /[;"\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text}
function exportConferenceCsv(){const content=conferenceRows().map(row=>row.map(csvCell).join(";")).join("\n"),blob=new Blob(["\ufeff"+content],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="pendentes-conferencia-"+new Date().toISOString().slice(0,10)+".csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast("Lista de conferência exportada em CSV.")}
function exportConferenceImage(){
  const rows=conferenceRows(),canvas=document.createElement("canvas"),rowHeight=44;canvas.width=1800;canvas.height=Math.max(500,210+rows.length*rowHeight);
  const context=canvas.getContext("2d");if(!context)return showToast("Não foi possível gerar a imagem.",true);
  const dark=document.body.dataset.theme==="dark",bg=dark?"#0b1220":"#f4f6f9",panel=dark?"#111b2e":"#fff",ink=dark?"#e8eef9":"#172033",muted=dark?"#91a0b5":"#738095",line=dark?"#29364a":"#e2e7ee";
  const columns=[50,200,360,590,750,1100,1320,1680],widths=[135,140,210,140,330,200,330,70];
  context.fillStyle=bg;context.fillRect(0,0,canvas.width,canvas.height);
  const text=(value,x,y,size,color,weight)=>{context.fillStyle=color;context.font=(weight||500)+" "+size+'px "Segoe UI",Arial';context.textBaseline="middle";context.fillText(String(value||"—"),x,y)};
  text("LUFT · PENDENTES DE CONFERÊNCIA",50,48,18,"#3b82f6",800);text(conferenceUi.title,50,90,26,ink,800);text(fmt(conferenceUi.details.length)+" pedidos",50,125,14,muted,600);
  rows.forEach((row,index)=>{const y=165+index*rowHeight;context.fillStyle=index===0?(dark?"#17243a":"#eaf0f8"):(index%2?panel:bg);context.fillRect(35,y-rowHeight/2+2,1730,rowHeight-4);row.forEach((value,column)=>{let result=String(value||"—");context.font=(index===0?800:600)+" "+(index===0?10:11)+'px "Segoe UI",Arial';while(result.length>3&&context.measureText(result).width>widths[column])result=result.slice(0,-1);if(result!==String(value||"—"))result=result.slice(0,-1)+"…";text(result,columns[column],y,index===0?10:11,index===0?muted:ink,index===0?800:600)});context.strokeStyle=line;context.beginPath();context.moveTo(35,y+rowHeight/2);context.lineTo(1765,y+rowHeight/2);context.stroke()});
  canvas.toBlob(blob=>{if(!blob)return showToast("Não foi possível gerar a imagem.",true);const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="pendentes-conferencia-"+new Date().toISOString().slice(0,10)+".png";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast("Lista de conferência exportada como imagem.")},"image/png")
}

/* ===================== CADASTRO DE PERFIS SLA ===================== */

// SCHEMA V5: services, cutoff, deadlineTime e dispatchDay são os campos operacionais da regra.
function profileRuleSummary(profile){
  const cutoff=profileCutoff(profile);
  const deadline=profileDeadlineTime(profile);
  const services=profileServiceValues(profile);
  const nextDay=profileDispatchDay(profile)==="next_day";
  const serviceLabel=services.length?fmt(services.length)+" serviço(s)":"Nenhum serviço selecionado";
  const withinCutoff=nextDay?"do dia seguinte":"do mesmo dia";
  const afterCutoff=nextDay?"em D+2":"do dia seguinte";
  return serviceLabel+" · importado até "+cutoff+": expedir até "+deadline+" "+withinCutoff+"; após "+cutoff+": expedir até "+deadline+" "+afterCutoff+". Dias corridos.";
}
function selectedValues(selector){return Array.from($(selector).selectedOptions).map(option=>option.value)}
function profileFromForm(){
  const now=new Date().toISOString();
  return{
    id:$("#sla-profile-id").value||("sla_"+Date.now()+"_"+Math.random().toString(36).slice(2,7)),
    schemaVersion:5,
    name:$("#sla-profile-name").value.trim(),
    description:$("#sla-profile-description").value.trim(),
    active:$("#sla-profile-active").value==="1",
    priority:Math.max(1,Number($("#sla-profile-priority").value)||100),
    services:selectedValues("#sla-profile-carriers"),
    cutoff:$("#sla-profile-cutoff").value||"20:00",
    deadlineTime:$("#sla-profile-deadline-time").value||"23:59",
    dispatchDay:$("#sla-profile-dispatch-day").value==="next_day"?"next_day":"same_day",
    createdAt:now,
    updatedAt:now
  };
}
function profileServices(){return Array.from(new Set([...(currentMetrics.slaRecords||[]),...(currentMetrics.slaCentralRecords||[])].map(item=>item.service).filter(value=>value&&value!=="Serviço não informado"))).sort((a,b)=>a.localeCompare(b,"pt-BR"))}
function renderPrettyServiceSelect(query=""){const select=$("#sla-profile-carriers"),picker=$("#sla-service-picker");if(!select||!picker)return;const selected=selectedValues("#sla-profile-carriers"),normalizedQuery=normalizeHeader(query),options=Array.from(select.options).filter(option=>!option.disabled&&(!normalizedQuery||normalizeHeader(option.textContent).includes(normalizedQuery)));const values=picker.querySelector(".pretty-selected-values"),list=picker.querySelector(".pretty-options");if(!values||!list)return;values.innerHTML=selected.length?(selected.slice(0,2).map(value=>'<span class="pretty-value-chip">'+escapeHtml(value)+'</span>').join("")+(selected.length>2?'<span class="pretty-count">+'+(selected.length-2)+'</span>':"")):'<span class="pretty-placeholder">Selecione um ou mais serviços</span>';list.innerHTML=options.length?options.map(option=>'<label class="pretty-option '+(option.selected?'selected':'')+'"><input type="checkbox" data-pretty-service="'+escapeHtml(option.value)+'" '+(option.selected?'checked':'')+'><span>'+escapeHtml(option.textContent)+'</span>'+(option.selected?'<small>Selecionado</small>':'')+'</label>').join(""):'<div class="pretty-empty">Nenhum serviço encontrado</div>'}
function enhanceServiceSelect(){const select=$("#sla-profile-carriers");if(!select||$("#sla-service-picker"))return;select.classList.add("pretty-multiselect-native");select.insertAdjacentHTML("afterend",'<div class="pretty-multiselect" id="sla-service-picker"><button type="button" class="pretty-multiselect-trigger" aria-expanded="false"><span class="pretty-selected-values"><span class="pretty-placeholder">Selecione um ou mais serviços</span></span><b class="pretty-chevron">⌄</b></button><div class="pretty-multiselect-menu"><div class="pretty-search-wrap"><input class="pretty-multiselect-search" placeholder="Pesquisar serviço..."></div><div class="pretty-options"></div></div></div>');const picker=$("#sla-service-picker"),trigger=picker.querySelector(".pretty-multiselect-trigger"),search=picker.querySelector(".pretty-multiselect-search");trigger.addEventListener("click",()=>{const willOpen=!picker.classList.contains("open");document.querySelectorAll(".pretty-multiselect.open").forEach(item=>item.classList.remove("open"));picker.classList.toggle("open",willOpen);trigger.setAttribute("aria-expanded",String(willOpen));if(willOpen)setTimeout(()=>search.focus(),0)});picker.querySelector(".pretty-multiselect-menu").addEventListener("click",event=>event.stopPropagation());search.addEventListener("input",()=>renderPrettyServiceSelect(search.value));picker.querySelector(".pretty-options").addEventListener("change",event=>{const input=event.target.closest("[data-pretty-service]");if(!input)return;const option=Array.from(select.options).find(item=>item.value===input.dataset.prettyService);if(option)option.selected=input.checked;select.dispatchEvent(new Event("change",{bubbles:true}));renderPrettyServiceSelect(search.value);updateProfileSummary()});document.addEventListener("click",event=>{if(!picker.contains(event.target)){picker.classList.remove("open");trigger.setAttribute("aria-expanded","false")}});renderPrettyServiceSelect()}
function populateProfileCarriers(){const select=$("#sla-profile-carriers");if(!select)return;const selected=selectedValues("#sla-profile-carriers"),services=Array.from(new Set([...profileServices(),...selected])).sort((a,b)=>a.localeCompare(b,"pt-BR"));select.innerHTML=services.length?services.map(value=>'<option value="'+escapeHtml(value)+'">'+escapeHtml(value)+"</option>").join(""):'<option disabled>Importe o CSV para listar os serviços</option>';Array.from(select.options).forEach(option=>option.selected=selected.includes(option.value));enhanceServiceSelect();renderPrettyServiceSelect()}
function updateProfileRuleFields(){updateProfileSummary()}
function updateProfileSummary(){if(!$("#sla-profile-summary"))return;$("#sla-profile-summary").textContent=profileRuleSummary(profileFromForm())}
function clearProfileForm(){$("#sla-profile-form").reset();$("#sla-profile-id").value="";$("#sla-profile-priority").value="100";$("#sla-profile-cutoff").value="20:00";$("#sla-profile-deadline-time").value="23:59";$("#sla-profile-dispatch-day").value="same_day";$("#sla-profile-form-title").textContent="Novo perfil";Array.from($("#sla-profile-carriers").options).forEach(option=>option.selected=false);populateProfileCarriers();updateProfileSummary()}
function editSlaProfile(profile){clearProfileForm();const services=profileServiceValues(profile);$("#sla-profile-id").value=profile.id;$("#sla-profile-name").value=profile.name||"";$("#sla-profile-description").value=profile.description||"";$("#sla-profile-active").value=profile.active?"1":"0";$("#sla-profile-priority").value=profile.priority||100;$("#sla-profile-cutoff").value=profileCutoff(profile);$("#sla-profile-deadline-time").value=profileDeadlineTime(profile);$("#sla-profile-dispatch-day").value=profileDispatchDay(profile);const select=$("#sla-profile-carriers"),available=Array.from(new Set([...Array.from(select.options).map(option=>option.value),...services])).filter(Boolean).sort((a,b)=>a.localeCompare(b,"pt-BR"));select.innerHTML=available.map(value=>'<option value="'+escapeHtml(value)+'">'+escapeHtml(value)+"</option>").join("");Array.from(select.options).forEach(option=>option.selected=normalizedListIncludes(services,option.value));renderPrettyServiceSelect();$("#sla-profile-form-title").textContent="Editar · "+profile.name;updateProfileSummary();$("#page-sla-profiles").scrollIntoView({behavior:"smooth"})}
function renderSlaProfileList(){const sorted=[...slaProfiles].sort((a,b)=>(Number(a.priority)||9999)-(Number(b.priority)||9999)||String(a.name).localeCompare(String(b.name),"pt-BR"));$("#sla-profile-count").textContent=fmt(sorted.length)+" perfil(is)";$("#sla-profile-list").innerHTML=sorted.length?'<div class="profile-row header"><span>Perfil</span><span>Serviços</span><span>Importação</span><span>Expedição</span><span>Prazo base</span><span>Situação</span><span>Ações</span></div>'+sorted.map(profile=>'<div class="profile-row"><span><strong>'+escapeHtml(profile.name)+'</strong><small>Prioridade '+fmt(profile.priority)+'</small></span><span><strong>'+fmt(profileServiceValues(profile).length)+'</strong><small>'+escapeHtml(profileServiceValues(profile).slice(0,2).join(" · ")||"Não configurado")+'</small></span><strong>'+escapeHtml(profileCutoff(profile))+'</strong><strong>'+escapeHtml(profileDeadlineTime(profile))+'</strong><span><small>'+(profileDispatchDay(profile)==="next_day"?"Dia seguinte · após corte D+2":"Mesmo dia · após corte D+1")+'</small></span><span><i class="profile-status '+(profile.active?'':'off')+'">'+(profile.active?'Ativo':'Inativo')+'</i></span><span class="profile-actions"><button data-profile-action="edit" data-profile-id="'+profile.id+'">Editar</button><button data-profile-action="duplicate" data-profile-id="'+profile.id+'">Duplicar</button><button data-profile-action="delete" data-profile-id="'+profile.id+'">Excluir</button></span></div>').join(""):'<div class="profile-empty"><strong>Nenhum perfil cadastrado</strong><br>Todos os serviços usarão automaticamente o prazo de 48 horas corridas.</div>'}
function refreshSlaConsumers(){renderSlaProfileList();renderSlaCentral(true);renderPickupDashboard()}

/* ===================== GRADES E ALERTAS DE COLETA ===================== */

function pickupCarriers(metrics){return Array.from(new Set([...(metrics.gembaOrders||[]),...(metrics.slaRecords||[])].map(item=>item.carrier).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR"))}
function populatePickupCarrier(metrics){const select=$("#pickup-carrier"),current=select.value,carriers=pickupCarriers(metrics);select.innerHTML='<option value="">Selecione a transportadora</option>'+carriers.map(carrier=>'<option value="'+escapeHtml(carrier)+'">'+escapeHtml(carrier)+'</option>').join('');if(carriers.includes(current))select.value=current}
function loadPickupForm(carrier){const schedule=carrierSchedule(carrier)||{};document.querySelectorAll("[data-pickup-day]").forEach(input=>input.value=(schedule[input.dataset.pickupDay]||[]).join(", "))}
function renderPickupSavedList(){const names=Object.keys(pickupSchedules).sort((a,b)=>a.localeCompare(b,"pt-BR"));$("#pickup-saved-list").innerHTML=names.length?names.map(name=>{const schedule=pickupSchedules[name],summary=pickupDayNames.map((day,index)=>(schedule[String(index)]||[]).length?day.slice(0,3)+" "+schedule[String(index)].join("/"):"").filter(Boolean).join(" · ");return '<div class="pickup-saved-item"><span><strong>'+escapeHtml(name)+'</strong><small>'+escapeHtml(summary||"Sem horários")+'</small></span><button class="danger-mini" data-delete-pickup="'+escapeHtml(name)+'">Excluir</button></div>'}).join(''):'<div class="empty-state">Nenhuma grade cadastrada.</div>'}
function allUpcomingPickups(afterDate){const result=[];Object.keys(pickupSchedules).forEach(carrier=>{const date=nextPickupForCarrier(carrier,afterDate);if(date)result.push({carrier,date,stamp:date.getTime()})});return result.sort((a,b)=>a.stamp-b.stamp)}
function isSpecialSeries14Alert(record){const carrier=normalizeHeader(record.carrier),special=carrier.includes("fl brasil")||carrier.includes("viviane")||carrier.includes("patrus");return special&&record.series==="14"&&record.importedStamp&&Date.now()-record.importedStamp>3*86400000}
function pendingPickupFlowGroups(){const groups=new Map();enrichedSlaRecords().forEach(record=>{if(record.load!=="Sem carga"||normalizeHeader(record.status).includes("coleta iniciada")||(!record.slaApplicable&&!isSpecialSeries14Alert(record)))return;const key=normalizeHeader(record.carrier);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record)});return groups}
function pendingPickupFlow(carrier,groups){return (groups||pendingPickupFlowGroups()).get(normalizeHeader(carrier))||[]}
function renderPickupDashboard(){
  const now=new Date(),flowGroups=pendingPickupFlowGroups(),upcoming=allUpcomingPickups(now),next=upcoming[0],pending=next?pendingPickupFlow(next.carrier,flowGroups):[];
  const nextHtml=next?'<article class="card pickup-next" data-next-pickup="1" role="button" tabindex="0"><div class="pickup-next-icon">🚚</div><div><small>Próxima transportadora · clique para detalhar</small><strong>'+escapeHtml(next.carrier)+'</strong><small>'+next.date.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit"})+' às '+next.date.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+'</small>'+(pending.length?'<div class="pickup-alert">⚠ '+fmt(pending.length)+' pedidos em alerta ainda sem carga e sem Coleta Iniciada</div>':'<div class="pickup-alert" style="background:#22c55e24;color:#bbf7d0">✓ Nenhum pedido em alerta fora de carga/coleta</div>')+'</div><div class="pickup-countdown"><small>Tempo restante</small><strong>'+escapeHtml(humanDuration(next.stamp-Date.now()).replace("vence em ",""))+'</strong></div></article>':'<article class="card pickup-next"><div class="pickup-next-icon">🚚</div><div><small>Próxima transportadora</small><strong>Nenhuma coleta cadastrada</strong><small>Cadastre os horários em Configurações.</small></div></article>';
  const days=Array.from({length:7},(_,offset)=>{const date=new Date(now);date.setDate(date.getDate()+offset);date.setHours(0,0,0,0);const slots=[];Object.entries(pickupSchedules).forEach(([carrier,schedule])=>(schedule[String(date.getDay())]||[]).forEach(time=>{const [hour,minute]=time.split(":").map(Number),stamp=new Date(date);stamp.setHours(hour,minute,0,0);slots.push({carrier,time,stamp:stamp.getTime()})}));slots.sort((a,b)=>a.stamp-b.stamp);return{date,slots}});
  const week='<div class="pickup-week">'+days.map((day,index)=>'<article class="card pickup-day '+(index===0?'today':'')+'"><h3>'+pickupDayNames[day.date.getDay()]+'</h3><small>'+day.date.toLocaleDateString("pt-BR")+(index===0?' · hoje':'')+'</small>'+(day.slots.length?day.slots.map(slot=>'<div class="pickup-slot '+(next&&slot.stamp===next.stamp&&normalizeHeader(slot.carrier)===normalizeHeader(next.carrier)?'next':'')+'"><strong>'+escapeHtml(slot.time)+' · '+escapeHtml(carrierShort(slot.carrier))+'</strong><small>'+fmt(pendingPickupFlow(slot.carrier,flowGroups).length)+' em fluxo sem carga</small></div>').join(''):'<div class="pickup-help">Sem coleta</div>')+'</article>').join('')+'</div>';
  const rows=Object.keys(pickupSchedules).sort((a,b)=>a.localeCompare(b,"pt-BR")).map(carrier=>'<div class="pickup-table-row"><strong>'+escapeHtml(carrier)+'</strong>'+Array.from({length:7},(_,index)=>'<span>'+escapeHtml((pickupSchedules[carrier][String(index)]||[]).join(" / ")||"—")+'</span>').join('')+'<span>'+fmt(pendingPickupFlow(carrier,flowGroups).length)+' pend.</span></div>').join('');
  const table='<article class="card"><div class="card-head"><div><h2>Grade semanal completa</h2><p>Série 17 em fluxo e Série 14 acima de 3 dias para FL Brasil, Viviane e Patrus</p></div></div><div class="pickup-table"><div class="pickup-table-row header"><span>Transportadora</span>'+pickupDayNames.map(day=>'<span>'+day.slice(0,3)+'</span>').join('')+'<span>Alerta</span></div>'+(rows||'<div class="empty-state">Nenhuma grade cadastrada.</div>')+'</div></article>';
  $("#pickup-dashboard").innerHTML=nextHtml+week+table;
}

/* ===================== ORQUESTRAÇÃO DA INTERFACE ===================== */

// Chamado após cada importação e sincronização; mantém todas as páginas com a mesma base.
function render(metrics) {
  $("#kpi-triados").textContent = fmt(metrics.triaged);
  $("#kpi-expedidos").textContent = fmt(metrics.processedToday);
  $("#kpi-sem-pdf").textContent = fmt(metrics.withoutPdf);
  $("#kpi-volumes").textContent = fmt(metrics.volumesToday);
  $("#nav-triados").textContent = fmt(metrics.triaged);
  $("#summary-triados").innerHTML = summaryHtml(metrics.triagedSummary);
  $("#summary-triados-page").innerHTML = summaryHtml(metrics.triagedSummary);
  $("#triaged-carrier-list").innerHTML = triagedCarrierListHtml(metrics.triagedByCarrier);
  $("#triaged-carrier-chart").innerHTML = triagedCarrierChartHtml(metrics.triagedByCarrier);
  $("#summary-sem-pdf").innerHTML = summaryHtml(metrics.withoutPdfSummary);
  $("#summary-ontem").innerHTML = summaryHtml(metrics.dispatchedYesterday);
  $("#summary-d1-subtitle").textContent = metrics.d1Date
    ? "Última data processada: " + metrics.d1Date
    : "Última data processada diferente da atual";
  $("#summary-hoje").innerHTML = summaryHtml(metrics.dispatchedToday);
  $("#overview-summary-preview").textContent = generateOverviewSummary(metrics);
  $("#b2c-table").innerHTML = pendingMatrixHtml(metrics.b2cHourly, false);
  $("#b2b-table").innerHTML = pendingMatrixHtml(metrics.b2bHourly, true);
  $("#b2c-conference-summary").innerHTML = conferenceSummaryHtml(metrics.b2cHourly, false);
  $("#b2b-conference-summary").innerHTML = conferenceSummaryHtml(metrics.b2bHourly, true);
  $("#pin-table-page").innerHTML = pinHtml(metrics.pinDetails);
  $("#productivity-content").innerHTML = productivityHtml(metrics.productivity);
  $("#file-info").textContent = metrics.fileName
    ? metrics.fileName + " · " + fmt(metrics.recordCount) + " registros · importado às " + metrics.importedAt
    : "Importe a exportação operacional para calcular os indicadores";
  $("#footer-update").textContent = metrics.importedAt ? "Dados atualizados às " + metrics.importedAt : "Aguardando importação";
  $("#dispatch-carrier-card").textContent = metrics.lastDispatch ? metrics.lastDispatch.carrier : "Aguardando importação";
  $("#dispatch-time-card").textContent = metrics.lastDispatch ? metrics.lastDispatch.processedAt : "—";
  renderSlaCentral(true);
  renderGemba(metrics);
  populatePickupCarrier(metrics);renderPickupSavedList();renderPickupDashboard();populateProfileCarriers();renderSlaProfileList();updateProfileRuleFields();
}

function showToast(message, error) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = "toast show" + (error ? " error" : "");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.className = "toast", error ? 10000 : 3500);
}

function generateOverviewSummary(metrics=currentMetrics,referenceDate=new Date()) {
  const blocks = [
    ["Triados", metrics.triagedSummary],
    ["sem pdf", metrics.withoutPdfSummary],
    ["expedidos d1", metrics.dispatchedYesterday],
    ["expedidos hoje", metrics.dispatchedToday]
  ];
  return [greetingForTime(referenceDate)+"!", ...blocks.flatMap(([title,summary]) => [
    "",
    title,
    "pedidos: "+fmt(summary.orders),
    "total peças: "+fmt(summary.products),
    "volumes: "+fmt(summary.volumes)
  ])].join("\n");
}

async function copyOverviewSummary() {
  if (!currentMetrics.fileName) return showToast("Importe um CSV antes de copiar o resumo.", true);
  try {
    await writeClipboardText(generateOverviewSummary());
    showToast("Resumo da Visão geral copiado com sucesso.");
  } catch (error) {
    showToast("Não foi possível copiar o resumo neste navegador.", true);
  }
}

function exportSummary() {
  if (!currentMetrics.fileName) return showToast("Importe um CSV antes de exportar.", true);
  const m = currentMetrics;
  const lines = [
    ["Indicador", "Pedidos", "Produtos", "Volumes"],
    ["Triados", m.triagedSummary.orders, m.triagedSummary.products, m.triagedSummary.volumes],
    ["Sem PDF", m.withoutPdfSummary.orders, m.withoutPdfSummary.products, m.withoutPdfSummary.volumes],
    ["Expedidos D1" + (m.d1Date ? " (" + m.d1Date + ")" : ""), m.dispatchedYesterday.orders, m.dispatchedYesterday.products, m.dispatchedYesterday.volumes],
    ["Expedidos hoje", m.dispatchedToday.orders, m.dispatchedToday.products, m.dispatchedToday.volumes],
    ["Solicitação PIN", m.pinRequests, "", ""]
  ].map(row => row.join(";")).join("\n");
  const blob = new Blob(["\ufeff" + lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "resumo_operacional.csv"; link.click();
  URL.revokeObjectURL(url);
}

function exportDashboardImage() {
  if (!currentMetrics.fileName) return showToast("Importe um CSV antes de exportar a imagem.", true);
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 1120;
  const context = canvas.getContext("2d");
  if (!context) { setExportBusy(false); return showToast("O navegador não oferece suporte à exportação.", true); }

  const dark = document.body.dataset.theme === "dark";
  const colors = {
    background: dark ? "#0b1220" : "#f4f6f9",
    panel: dark ? "#111b2e" : "#ffffff",
    text: dark ? "#e8eef9" : "#172033",
    muted: dark ? "#8fa0b8" : "#7b8798",
    line: dark ? "#25334a" : "#e2e7ee",
    blue: "#3b82f6", green: "#22c55e", orange: "#f59e0b", cyan: "#06b6d4"
  };

  const roundedRect = (x, y, width, height, radius, fill, stroke) => {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 2;
      context.stroke();
    }
  };
  const text = (value, x, y, size, color, weight, align) => {
    context.fillStyle = color || colors.text;
    context.font = (weight || 500) + " " + size + 'px "Segoe UI", Arial, sans-serif';
    context.textAlign = align || "left";
    context.textBaseline = "alphabetic";
    context.fillText(String(value), x, y);
  };
  const summaryCard = (title, subtitle, data, x, y, accent) => {
    roundedRect(x, y, 825, 220, 18, colors.panel, colors.line);
    context.fillStyle = accent;
    context.fillRect(x, y, 7, 220);
    text(title.toUpperCase(), x + 35, y + 42, 18, colors.text, 700);
    text(subtitle, x + 35, y + 70, 13, colors.muted, 400);
    const fields = [
      ["PEDIDOS DE VENDA", data.orders],
      ["QTDE. TOTAL DE PRODUTO", data.products],
      ["QTDE. DE VOLUMES", data.volumes]
    ];
    fields.forEach((field, index) => {
      const fieldX = x + 35 + index * 260;
      text(field[0], fieldX, y + 125, 12, colors.muted, 700);
      text(fmt(field[1]), fieldX, y + 176, 34, colors.text, 800);
    });
  };

  context.fillStyle = colors.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  text("LUFT · STATUS OPERACIONAL", 70, 68, 18, colors.blue, 800);
  text("Visão geral", 70, 122, 40, colors.text, 800);
  text("Arquivo: " + currentMetrics.fileName + " · " + fmt(currentMetrics.recordCount) + " registros", 70, 158, 16, colors.muted, 400);
  text(new Date().toLocaleString("pt-BR"), 1730, 82, 15, colors.muted, 600, "right");

  const kpis = [
    ["TRIADOS", currentMetrics.triaged, colors.blue],
    ["EXPEDIDOS HOJE", currentMetrics.processedToday, colors.green],
    ["SEM PDF", currentMetrics.withoutPdf, colors.orange],
    ["VOLUMES", currentMetrics.volumesToday, colors.cyan]
  ];
  kpis.forEach((item, index) => {
    const x = 70 + index * 425;
    roundedRect(x, 205, 390, 145, 17, colors.panel, colors.line);
    text(item[0], x + 25, 247, 14, colors.muted, 700);
    text(fmt(item[1]), x + 25, 315, 45, colors.text, 800);
    context.fillStyle = item[2];
    context.fillRect(x, 343, 390, 7);
  });

  const gradient = context.createLinearGradient(70, 0, 1730, 0);
  gradient.addColorStop(0, "#17233a");
  gradient.addColorStop(1, "#28477b");
  roundedRect(70, 385, 1660, 145, 18, gradient);
  text("ÚLTIMA EXPEDIÇÃO PROCESSADA", 110, 430, 14, "#a9bad5", 800);
  text(currentMetrics.lastDispatch ? currentMetrics.lastDispatch.carrier : "Não localizada", 110, 485, 29, "#ffffff", 800);
  text("PROCESSADO EM", 1680, 430, 13, "#a9bad5", 800, "right");
  text(currentMetrics.lastDispatch ? currentMetrics.lastDispatch.processedAt : "—", 1680, 480, 22, "#ffffff", 700, "right");

  summaryCard("Triados", "Inclui Série 11 e resolução de quebra", currentMetrics.triagedSummary, 70, 570, colors.blue);
  summaryCard("Sem PDF", "Série vazia e 11, exceto FedEx", currentMetrics.withoutPdfSummary, 905, 570, colors.orange);
  summaryCard("Expedidos D1", currentMetrics.d1Date ? "Última data processada: " + currentMetrics.d1Date : "Última data diferente da atual", currentMetrics.dispatchedYesterday, 70, 810, "#64748b");
  summaryCard("Expedidos hoje", "Processados na data atual", currentMetrics.dispatchedToday, 905, 810, colors.green);

  text("Dados processados localmente · Turno A · CD Extrema", 70, 1082, 14, colors.muted, 500);
  canvas.toBlob(blob => {
    if (!blob) { setExportBusy(false); return showToast("Não foi possível gerar a imagem.", true); }
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "visao-geral-luft-" + new Date().toISOString().slice(0, 10) + ".png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setExportBusy(false);
    showToast("Imagem da visão geral exportada.");
  }, "image/png");
}

function exportDetailPageImage(pageId) {
  const isPin = pageId === "page-pin";
  const isSla = pageId === "page-faturamento";
  const pinGroups = isPin ? groupPinDetails(currentMetrics.pinDetails) : [];
  const slaImageModel = isSla ? buildSlaCentralModel(currentMetrics) : null;
  const slaExportAreaHeight = areaData => {
    if (!areaData?.records.length) return 170;
    const bodyHeight=areaData.dates.reduce((height,date)=>height+60+([slaImageModel.todayKey,slaImageModel.d1Key].includes(date.key)?date.hours.size*54:0),0);
    return 76+58+bodyHeight+64;
  };
  let pinContentHeight = 0;
  for (let index = 0; index < pinGroups.length; index += 2) {
    const leftHeight = 104 + pinGroups[index].orders.length * 46;
    const rightHeight = pinGroups[index + 1] ? 104 + pinGroups[index + 1].orders.length * 46 : 0;
    pinContentHeight += Math.max(leftHeight, rightHeight) + 24;
  }
  const canvas = document.createElement("canvas");
  const slaCarrierCount=isSla?Math.max(1,...["billing","shipping"].map(area=>new Set(slaImageModel.areas[area].records.map(record=>record.carrierNormalized)).size)):0;
  canvas.width = isSla ? Math.max(1800,610+slaCarrierCount*180) : 1800;
  canvas.height = isPin ? Math.max(1100, 250 + pinContentHeight) : isSla ? 260+slaExportAreaHeight(slaImageModel.areas.billing)+slaExportAreaHeight(slaImageModel.areas.shipping) : 1120;
  const context = canvas.getContext("2d");
  if (!context) { setExportBusy(false); return showToast("O navegador não oferece suporte à exportação.", true); }
  const dark = document.body.dataset.theme === "dark";
  const colors = {
    background: dark ? "#0b1220" : "#f4f6f9", panel: dark ? "#111b2e" : "#ffffff",
    text: dark ? "#e8eef9" : "#172033", muted: dark ? "#8fa0b8" : "#7b8798",
    line: dark ? "#25334a" : "#dfe5ed", header: "#172235",
    blue: "#3b82f6", cyan: "#06b6d4", green: dark ? "#275c38" : "#d8f1df",
    yellow: dark ? "#a37210" : "#fde8a6", red: dark ? "#b83c34" : "#ffb0a5"
  };
  const rect = (x, y, width, height, fill, stroke, radius) => {
    context.beginPath(); context.roundRect(x, y, width, height, radius || 0);
    context.fillStyle = fill; context.fill();
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = 1; context.stroke(); }
  };
  const drawText = (value, x, y, size, color, weight, align) => {
    context.fillStyle = color || colors.text;
    context.font = (weight || 500) + " " + size + 'px "Segoe UI", Arial, sans-serif';
    context.textAlign = align || "left"; context.textBaseline = "middle";
    context.fillText(String(value), x, y);
  };
  const fitText = (value, maximumWidth) => {
    let result = String(value || "");
    if (context.measureText(result).width <= maximumWidth) return result;
    while (result.length > 3 && context.measureText(result + "…").width > maximumWidth) result = result.slice(0, -1);
    return result + "…";
  };
  const pageTitles = {
    "page-triados": "Triados por transportadora", "page-produtividade": "Produtividade", "page-gemba": "GEMBA", "page-pin": "Solicitação PIN",
    "page-conferencia-b2c": "Conferência Doca · B2C",
    "page-conferencia-b2b": "Conferência Doca · B2B",
    "page-faturamento": "Expedição Pedidos", "page-transportadoras": "Transportadoras · Grade de coleta",
    "page-relatorios": "Relatórios", "page-sla-profiles": "Perfis de prioridade SLA", "page-configuracoes": "Configurações"
  };
  context.fillStyle = colors.background; context.fillRect(0, 0, canvas.width, canvas.height);
  drawText("LUFT · STATUS OPERACIONAL", 70, 55, 18, colors.blue, 800);
  drawText(pageTitles[pageId] || "Status operacional", 70, 108, 38, colors.text, 800);
  drawText(currentMetrics.fileName + " · " + fmt(currentMetrics.recordCount) + " registros", 70, 150, 15, colors.muted, 500);
  drawText(new Date().toLocaleString("pt-BR"), canvas.width-70, 70, 15, colors.muted, 600, "right");

  if (pageId === "page-conferencia-b2c" || pageId === "page-conferencia-b2b") {
    const showVolumes = pageId === "page-conferencia-b2b";
    const data = pageId === "page-conferencia-b2c" ? currentMetrics.b2cHourly : currentMetrics.b2bHourly;
    const descriptors = Array.from(new Set(data.map(item => item.descriptor))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const labels = Array.from(new Set(data.map(item => item.label)));
    const values = new Map(data.map(item => [item.label + "||" + item.descriptor, item]));
    const x = 70, y = 195, width = 1660, height = 825;
    const columns = Math.max(2, descriptors.length + 2), rows = Math.max(2, labels.length + 2);
    const cellWidth = width / columns, cellHeight = height / rows;
    const cell = (column, row, value, fill, color, weight, alert) => {
      const cx = x + column * cellWidth, cy = y + row * cellHeight;
      context.fillStyle = fill; context.fillRect(cx, cy, cellWidth, cellHeight);
      context.strokeStyle = colors.line; context.strokeRect(cx, cy, cellWidth, cellHeight);
      context.font = (weight || 600) + " " + Math.max(9, Math.min(15, cellWidth / 9)) + 'px "Segoe UI", Arial';
      const fontSize = Math.max(9, Math.min(15, cellWidth / 9));
      drawText(fitText(value, cellWidth - 10), cx + cellWidth / 2 + (alert ? 7 : 0), cy + cellHeight / 2, fontSize, color, weight || 600, "center");
      if (alert) {
        context.strokeStyle = "#f5b400"; context.lineWidth = 3; context.strokeRect(cx + 2, cy + 2, cellWidth - 4, cellHeight - 4);
        context.beginPath(); context.arc(cx + cellWidth / 2 - 13, cy + cellHeight / 2, Math.max(7, fontSize * .62), 0, Math.PI * 2);
        context.fillStyle = "#f5b400"; context.fill();
        drawText("!", cx + cellWidth / 2 - 13, cy + cellHeight / 2 + .5, fontSize, "#332400", 900, "center");
      }
    };
    cell(0, 0, "HORA", colors.header, "#fff", 800);
    descriptors.forEach((descriptor, index) => cell(index + 1, 0, carrierShort(descriptor), colors.header, "#fff", 800));
    cell(columns - 1, 0, "TOTAL", colors.header, "#fff", 800);
    labels.forEach((label, rowIndex) => {
      cell(0, rowIndex + 1, label, colors.panel, colors.text, 800);
      let rowTotal = 0, rowVolumes = 0;
      descriptors.forEach((descriptor, columnIndex) => {
        const item = values.get(label + "||" + descriptor);
        const value = item ? item.orders : 0, volumeValue = item ? item.volumes : 0;
        rowTotal += value; rowVolumes += volumeValue;
        cell(columnIndex + 1, rowIndex + 1, fmt(value) + (showVolumes ? " (" + fmt(volumeValue) + ")" : ""), value === 0 ? colors.panel : value <= 10 ? colors.green : value <= 30 ? colors.yellow : colors.red, value === 0 ? colors.muted : colors.text, 800, item && item.alert);
      });
      cell(columns - 1, rowIndex + 1, fmt(rowTotal) + (showVolumes ? " (" + fmt(rowVolumes) + ")" : ""), colors.panel, colors.text, 900);
    });
    cell(0, rows - 1, "TOTAL", colors.panel, colors.text, 900);
    let grandTotal = 0, grandVolumes = 0;
    descriptors.forEach((descriptor, index) => {
      const totals = labels.reduce((sum, label) => {
        const item = values.get(label + "||" + descriptor);
        sum.orders += item ? item.orders : 0; sum.volumes += item ? item.volumes : 0;
        return sum;
      }, { orders: 0, volumes: 0 });
      grandTotal += totals.orders; grandVolumes += totals.volumes;
      cell(index + 1, rows - 1, fmt(totals.orders) + (showVolumes ? " (" + fmt(totals.volumes) + ")" : ""), colors.panel, colors.text, 900);
    });
    cell(columns - 1, rows - 1, fmt(grandTotal) + (showVolumes ? " (" + fmt(grandVolumes) + ")" : ""), colors.panel, colors.text, 900);
  } else if (pageId === "page-produtividade") {
    const days = currentMetrics.productivity.days, today = days[0];
    const shiftBox = (title, data, x, y, width) => {
      rect(x, y, width, 105, colors.panel, colors.line, 12);
      drawText(title, x + 16, y + 21, 13, colors.text, 800);
      [["PRODUTOS", fmt(data.products)], ["PRODUTOS/H", decimalFmt(data.productsPerHour)], ["PEDIDOS/H", decimalFmt(data.ordersPerHour)]].forEach((item, index) => {
        const metricX = x + 16 + index * (width - 32) / 3;
        drawText(item[0], metricX, y + 51, 9, colors.muted, 800);
        drawText(item[1], metricX, y + 79, 18, colors.text, 900);
      });
    };
    if (today) {
      rect(70,190,1660,350,colors.panel,colors.line,16);
      const productivityGradient=context.createLinearGradient(70,190,1730,262);productivityGradient.addColorStop(0,"#14213a");productivityGradient.addColorStop(1,"#284f87");
      rect(70,190,1660,72,productivityGradient,null,16);
      drawText("PRODUTIVIDADE DO DIA", 94, 214, 10, "#a9bad5", 900);
      drawText("Produtos pesados por turno", 94, 244, 22, "#fff", 900);
      drawText(today.date,1705,226,14,"#fff",900,"right");
      context.strokeStyle=colors.line;context.beginPath();context.moveTo(900,278);context.lineTo(900,520);context.stroke();
      drawText("B2C", 94, 294, 16, colors.text, 900);drawText("SÉRIE 17",150,294,9,colors.muted,800);
      drawText(fmt(today.b2c.shift1.products+today.b2c.shift2.products),875,290,20,colors.blue,900,"right");drawText("TOTAL DO DIA",875,309,8,colors.muted,800,"right");
      shiftBox("1º turno · 06h–14h59", today.b2c.shift1, 94, 330, 382);
      shiftBox("2º turno · 15h–23h59", today.b2c.shift2, 494, 330, 382);
      drawText("B2B", 924, 294, 16, colors.text, 900);drawText("SÉRIES VAZIA, 11 E 14",980,294,9,colors.muted,800);
      drawText(fmt(today.b2b.shift1.products+today.b2b.shift2.products),1705,290,20,"#8b5cf6",900,"right");drawText("TOTAL DO DIA",1705,309,8,colors.muted,800,"right");
      shiftBox("1º turno · 06h–14h59", today.b2b.shift1, 924, 330, 382);
      shiftBox("2º turno · 15h–23h59", today.b2b.shift2, 1324, 330, 382);
      drawText("ÚLTIMOS QUATRO DIAS", 70, 575, 14, colors.text, 800);
      days.slice(1).forEach((day, index) => {
        const x = 70 + index * 415;
        rect(x, 600, 395, 390, colors.panel, colors.line, 14);
        drawText(day.date, x + 18, 628, 14, colors.text, 900);
        const b2cTotal=day.b2c.shift1.products+day.b2c.shift2.products;
        const b2bTotal=day.b2b.shift1.products+day.b2b.shift2.products;
        rect(x+16,650,174,72,colors.background,colors.line,10);
        rect(x+205,650,174,72,colors.background,colors.line,10);
        drawText("TOTAL B2C",x+29,671,9,colors.muted,800);
        drawText(fmt(b2cTotal),x+29,702,23,colors.blue,900);
        drawText("TOTAL B2B",x+218,671,9,colors.muted,800);
        drawText(fmt(b2bTotal),x+218,702,23,"#8b5cf6",900);
        drawText("PRODUÇÃO POR TURNO",x+18,752,9,colors.muted,800);
        [["B2C T1", day.b2c.shift1], ["B2C T2", day.b2c.shift2], ["B2B T1", day.b2b.shift1], ["B2B T2", day.b2b.shift2]].forEach((item, row) => {
          const rowY=782+row*47;
          if(row){context.strokeStyle=colors.line;context.beginPath();context.moveTo(x+18,rowY-23);context.lineTo(x+377,rowY-23);context.stroke()}
          drawText(item[0], x + 18, rowY, 10, item[0].startsWith("B2C")?colors.blue:"#8b5cf6", 900);
          drawText(fmt(item[1].products)+" produtos",x+92,rowY,11,colors.text,800);
          drawText(decimalFmt(item[1].productsPerHour)+" prod./h",x+255,rowY-8,9,colors.text,700);
          drawText(decimalFmt(item[1].ordersPerHour)+" ped./h",x+255,rowY+9,8,colors.muted,600);
        });
      });
    }
  } else if (pageId === "page-triados") {
    rect(70, 190, 1660, 110, colors.panel, colors.line, 14);
    [["Pedidos", currentMetrics.triagedSummary.orders], ["Produtos", currentMetrics.triagedSummary.products], ["Volumes", currentMetrics.triagedSummary.volumes]].forEach((item, index) => {
      const x = 120 + index * 520; drawText(item[0].toUpperCase(), x, 225, 13, colors.muted, 800); drawText(fmt(item[1]), x, 270, 32, colors.text, 900);
    });
    const data = currentMetrics.triagedByCarrier, max = Math.max(1, ...data.flatMap(item => [item.orders, item.volumes]));
    drawText("RANKING POR TRANSPORTADORA", 70, 345, 16, colors.text, 800);
    data.forEach((item, index) => {
      const y = 385 + index * 55; if (y > 1000) return;
      drawText((index + 1) + ".", 75, y, 14, colors.blue, 900);
      drawText(fitText(item.carrier, 460), 110, y, 14, colors.text, 700);
      drawText(fmt(item.orders) + " pedidos", 590, y, 13, colors.muted, 600, "right");
      drawText(fmt(item.volumes) + " volumes", 780, y, 13, colors.blue, 800, "right");
      const baseX = 900 + index * Math.min(75, 750 / Math.max(1, data.length));
      const chartBase = 940, chartHeight = 520;
      const orderHeight = item.orders / max * chartHeight, volumeHeight = item.volumes / max * chartHeight;
      context.fillStyle = colors.blue; context.fillRect(baseX, chartBase - orderHeight, 22, orderHeight);
      context.fillStyle = colors.cyan; context.fillRect(baseX + 27, chartBase - volumeHeight, 22, volumeHeight);
      drawText(carrierShort(item.carrier), baseX + 25, 970, 9, colors.muted, 800, "center");
    });
  } else if (pageId === "page-transportadoras") {
    const flowGroups=pendingPickupFlowGroups(),upcoming=allUpcomingPickups(new Date()),next=upcoming[0],pending=next?pendingPickupFlow(next.carrier,flowGroups):[];
    const gradient=context.createLinearGradient(70,0,1730,0);gradient.addColorStop(0,"#15243d");gradient.addColorStop(1,"#28558f");rect(70,190,1660,150,gradient,null,16);
    drawText("PRÓXIMA TRANSPORTADORA",105,225,12,"#b8c7dc",800);drawText(next?fitText(next.carrier,900):"Nenhuma coleta cadastrada",105,270,28,"#fff",900);drawText(next?next.date.toLocaleString("pt-BR"):"Cadastre em Configurações",105,307,14,"#dbe7f7",600);drawText(next?humanDuration(next.stamp-Date.now()).replace("vence em ",""):"—",1680,255,28,"#fff",900,"right");drawText(next&&pending.length?fmt(pending.length)+" pedidos sem carga/coleta":"Nenhuma pendência crítica",1680,302,13,pending.length?"#fca5a5":"#86efac",800,"right");
    drawText("GRADE SEMANAL",70,390,16,colors.text,900);const names=Object.keys(pickupSchedules).sort((a,b)=>a.localeCompare(b,"pt-BR"));const startY=430,rowH=52;names.slice(0,11).forEach((carrier,index)=>{const y=startY+index*rowH;rect(70,y,1660,rowH-6,colors.panel,colors.line,8);drawText(fitText(carrier,370),90,y+23,11,colors.text,800);pickupDayNames.forEach((day,dayIndex)=>{drawText(fitText((pickupSchedules[carrier][String(dayIndex)]||[]).join(" / ")||"—",130),520+dayIndex*155,y+23,10,colors.muted,700,"center")});drawText(fmt(pendingPickupFlow(carrier,flowGroups).length)+" pend.",1705,y+23,10,colors.text,800,"right")});pickupDayNames.forEach((day,index)=>drawText(day.slice(0,3).toUpperCase(),520+index*155,410,9,colors.muted,800,"center"));
  } else if (pageId === "page-gemba") {
    const gemba=calculateGembaMetrics(currentMetrics),flow=gemba.flow;
    const flowTotal=flow.items.reduce((total,item)=>total+item.general,0),kpis=[["CLASSIF. ATIVAS",flow.items.length,colors.blue],["FLUXO GERAL",flowTotal,"#8b5cf6"],["PRODUZIDO B2C",gemba.production.b2c,"#06b6d4"],["PRODUZIDO B2B",gemba.production.b2b,"#22c55e"]];
    kpis.forEach((item,index)=>{const x=70+index*415;rect(x,195,395,125,colors.panel,colors.line,13);drawText(item[0],x+20,225,11,colors.muted,800);drawText(fmt(item[1]),x+20,275,31,colors.text,900);context.fillStyle=item[2];context.fillRect(x,313,395,7)});
    [["B2C",gemba.forecast.b2c],["B2B",gemba.forecast.b2b]].forEach((item,index)=>{const x=70+index*835,data=item[1];rect(x,360,805,190,colors.panel,colors.line,13);drawText("FORECAST "+item[0],x+22,390,14,colors.text,900);[["META ORIGINAL",data.meta],["PRODUZIDO",data.produced],["COMPENSAÇÃO",data.compensation],["AJUSTADA",data.adjusted]].forEach((field,column)=>{const fx=x+22+column*190;drawText(field[0],fx,430,9,colors.muted,800);drawText(fmt(field[1]),fx,468,24,colors.text,900)});drawText(data.remaining?"Faltam produzir "+fmt(data.remaining):"✓ Meta atingida",x+22,520,13,data.remaining?"#ef4444":"#22c55e",800)});
    drawText("FLUXO OPERACIONAL",70,600,15,colors.text,900);if(flow.items.length)flow.items.forEach((item,index)=>{const column=index%2,row=Math.floor(index/2),x=70+column*835,y=625+row*57;rect(x,y,805,48,colors.panel,colors.line,9);drawText(item.label,x+18,y+28,11,colors.text,900);drawText("G "+fmt(item.general)+"  ·  I "+fmt(item.imported)+"  ·  F "+fmt(item.inFlow)+"  ·  A "+fmt(item.waiting),x+780,y+28,10,colors.blue,800,"right")});else drawText("Nenhuma classificação com pedidos nos status monitorados.",70,650,12,colors.muted,700);
    drawText("ABS: "+fmt(gembaAbs.length),70,950,15,colors.text,900);drawText("G: geral · I: importado · F: em fluxo · A: aguardando separação",1730,950,11,colors.muted,700,"right");
  } else if (pageId === "page-faturamento") {
    const model=slaImageModel,tableX=70,tableWidth=canvas.width-140,firstWidth=300,totalWidth=170,sectionHeaderHeight=76,headerHeight=58,dateHeight=60,hourHeight=54,footerHeight=64;
    const palette={overdue:dark?"#401b23":"#fff0f1",alert:dark?"#3c3214":"#fff8e1",today:dark?"#142b4a":"#eff6ff",d1:dark?"#182235":"#f8fafc",total:dark?"#19345b":"#eaf1ff",hour:colors.panel};
    const drawMatrixCell=(x,y,width,height,fill)=>{context.fillStyle=fill;context.fillRect(x,y,width,height);context.strokeStyle=colors.line;context.lineWidth=1;context.strokeRect(x,y,width,height)};
    const rowFill=(records,fallback)=>records.some(record=>record.delayed)?palette.overdue:records.some(record=>record.priorityToday&&!record.delayed)?palette.alert:fallback;
    const drawCount=(records,x,y,width,height,fill,total=false)=>{
      drawMatrixCell(x,y,width,height,total?palette.total:fill);
      if(!records.length)return;
      const delayed=records.filter(record=>record.delayed).length,dueToday=records.filter(record=>record.priorityToday&&!record.delayed).length,hasSignal=delayed||dueToday;
      drawText(fmt(records.length),x+width/2,y+height/2-(hasSignal?7:0),15,colors.text,900,"center");
      if(delayed)drawText(fmt(delayed)+" atrasado"+(delayed===1?"":"s"),x+width/2,y+height/2+12,7,"#ef4444",900,"center");
      else if(dueToday)drawText(fmt(dueToday)+" para hoje",x+width/2,y+height/2+12,7,"#d97706",900,"center");
    };
    const drawSlaTable=(area,y)=>{
      const areaData=model.areas[area],areaLabel=area==="billing"?"PENDENTES DE FATURAMENTO":"PENDENTES DE EXPEDIÇÃO",description=area==="billing"?"Importado · Formação de romaneio · Separação · Conferência iniciada":"Coleta iniciada · Faturado · Conferência concluída · Enviado para faturamento",height=slaExportAreaHeight(areaData);
      rect(tableX,y,tableWidth,height,colors.panel,colors.line,16);
      drawText(areaLabel,tableX+24,y+26,13,colors.text,900);
      drawText(fitText(description,tableWidth-48),tableX+24,y+51,9,colors.muted,600);
      if(!areaData.records.length){drawText("Nenhum pedido encontrado nesta etapa.",tableX+24,y+112,13,colors.muted,600);return y+height}
      const carriers=model.carriers.filter(carrier=>areaData.records.some(record=>record.carrierNormalized===carrier.normalized)),carrierWidth=(tableWidth-firstWidth-totalWidth)/Math.max(1,carriers.length),headerY=y+sectionHeaderHeight;
      drawMatrixCell(tableX,headerY,firstWidth,headerHeight,colors.header);drawText("DIA/HORÁRIO",tableX+16,headerY+headerHeight/2,9,"#fff",900);
      carriers.forEach((carrier,index)=>{const x=tableX+firstWidth+index*carrierWidth;drawMatrixCell(x,headerY,carrierWidth,headerHeight,colors.header);context.font='900 9px "Segoe UI", Arial, sans-serif';drawText(fitText(String(carrier.label).toUpperCase(),carrierWidth-18),x+carrierWidth/2,headerY+headerHeight/2,9,"#fff",900,"center")});
      const totalX=tableX+tableWidth-totalWidth;drawMatrixCell(totalX,headerY,totalWidth,headerHeight,colors.header);drawText("TOTAL",totalX+totalWidth/2,headerY+headerHeight/2,9,"#fff",900,"center");
      let rowY=headerY+headerHeight;
      areaData.dates.forEach(date=>{
        const isToday=date.key===model.todayKey,isD1=date.key===model.d1Key,expanded=isToday||isD1,suffix=isToday?" — Hoje":isD1?" — D-1":"",fill=rowFill(date.records,isToday?palette.today:isD1?palette.d1:colors.panel);
        drawMatrixCell(tableX,rowY,firstWidth,dateHeight,fill);rect(tableX+13,rowY+18,24,24,colors.panel,colors.line,7);drawText(expanded?"−":"+",tableX+25,rowY+30,13,colors.blue,900,"center");drawText(date.label+suffix,tableX+50,rowY+dateHeight/2,11,colors.text,900);
        carriers.forEach((carrier,index)=>{const records=slaCentralRecordsForCarrier(date.records,carrier.normalized);drawCount(records,tableX+firstWidth+index*carrierWidth,rowY,carrierWidth,dateHeight,fill)});drawCount(date.records,totalX,rowY,totalWidth,dateHeight,fill,true);rowY+=dateHeight;
        if(expanded)Array.from(date.hours.entries()).sort((a,b)=>a[0]-b[0]).forEach(([hour,hourRecords])=>{
          const hourFill=rowFill(hourRecords,palette.hour);drawMatrixCell(tableX,rowY,firstWidth,hourHeight,hourFill);drawText("↳ "+String(hour).padStart(2,"0")+"h",tableX+50,rowY+hourHeight/2,10,colors.muted,800);
          carriers.forEach((carrier,index)=>{const records=slaCentralRecordsForCarrier(hourRecords,carrier.normalized);drawCount(records,tableX+firstWidth+index*carrierWidth,rowY,carrierWidth,hourHeight,hourFill)});drawCount(hourRecords,totalX,rowY,totalWidth,hourHeight,hourFill,true);rowY+=hourHeight;
        });
      });
      drawMatrixCell(tableX,rowY,firstWidth,footerHeight,palette.total);drawText("TOTAL POR TRANSPORTADORA",tableX+16,rowY+footerHeight/2,10,colors.text,900);
      carriers.forEach((carrier,index)=>{const records=slaCentralRecordsForCarrier(areaData.records,carrier.normalized);drawCount(records,tableX+firstWidth+index*carrierWidth,rowY,carrierWidth,footerHeight,palette.total)});drawCount(areaData.records,totalX,rowY,totalWidth,footerHeight,palette.total,true);
      return y+height;
    };
    const billingBottom=drawSlaTable("billing",190);drawSlaTable("shipping",billingBottom+26);
  } else if (pageId === "page-pin") {
    const cardWidth = 808, gap = 44, startX = 70, rowHeight = 46;
    let currentY = 195;
    for (let index = 0; index < pinGroups.length; index += 2) {
      const pair = pinGroups.slice(index, index + 2);
      const pairHeight = Math.max(...pair.map(group => 104 + group.orders.length * rowHeight));
      pair.forEach((group, column) => {
        const x = startX + column * (cardWidth + gap);
        const cardHeight = 104 + group.orders.length * rowHeight;
        rect(x, currentY, cardWidth, cardHeight, colors.panel, colors.line, 14);
        rect(x, currentY, cardWidth, 78, colors.header, null, 14);
        drawText("CARGA", x + 20, currentY + 23, 11, "#aebbd0", 800);
        drawText(fitText(group.load, cardWidth - 150), x + 20, currentY + 51, 19, "#fff", 800);
        rect(x + cardWidth - 65, currentY + 24, 42, 30, colors.blue, null, 15);
        drawText(fmt(group.orders.length), x + cardWidth - 44, currentY + 39, 12, "#fff", 900, "center");
        drawText("PEDIDO DE VENDA", x + 20, currentY + 91, 9, colors.muted, 800);
        drawText("SÉRIE", x + 288, currentY + 91, 9, colors.muted, 800);
        drawText("STATUS NF", x + 375, currentY + 91, 9, colors.muted, 800);
        drawText("UF", x + cardWidth - 22, currentY + 91, 9, colors.muted, 800, "right");
        group.orders.forEach((item, rowIndex) => {
          const rowY = currentY + 104 + rowIndex * rowHeight;
          if (rowIndex % 2) { context.fillStyle = colors.background; context.fillRect(x + 1, rowY, cardWidth - 2, rowHeight); }
          if (rowIndex) { context.strokeStyle = colors.line; context.beginPath(); context.moveTo(x + 15, rowY); context.lineTo(x + cardWidth - 15, rowY); context.stroke(); }
          drawText(fitText(item.order, 245), x + 20, rowY + rowHeight / 2, 13, colors.text, 700);
          drawText(fitText(item.series, 65), x + 288, rowY + rowHeight / 2, 12, colors.text, 700);
          drawText(fitText(item.status, 330), x + 375, rowY + rowHeight / 2, 11, colors.text, 700);
          drawText(item.uf, x + cardWidth - 22, rowY + rowHeight / 2, 13, colors.muted, 800, "right");
        });
      });
      currentY += pairHeight + 24;
    }
  } else {
    rect(70, 210, 1660, 600, colors.panel, colors.line, 18);
    drawText("Esta tela ainda não possui dados detalhados para exportação.", 900, 500, 24, colors.muted, 600, "center");
  }
  drawText("Dados processados localmente · Turno A · CD Extrema", 70, canvas.height - 35, 14, colors.muted, 500);
  canvas.toBlob(blob => {
    if (!blob) { setExportBusy(false); return showToast("Não foi possível gerar a imagem.", true); }
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    const fileName=pageId==="page-faturamento"?"expedicao-pedidos":pageId.replace("page-", "");
    link.href = url; link.download = fileName + "-luft-" + new Date().toISOString().slice(0, 10) + ".png";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportBusy(false);
    showToast("Imagem da tela exportada.");
  }, "image/png");
}

function setExportBusy(busy) {
  const button=$("#export-image");
  if(!button)return;
  button.classList.toggle("exporting",busy);
  button.disabled=busy;
  button.setAttribute("aria-busy",String(busy));
  const label=button.querySelector("span:nth-child(2)");
  if(label)label.textContent=busy?"Gerando…":"Exportar";
}

function closeExportMenu(){const control=$("#export-control"),button=$("#export-image");if(!control||!button)return;control.classList.remove("open");button.setAttribute("aria-expanded","false")}

/* ===================== EXPORTAÇÕES ===================== */

function exportCurrentPageImage() {
  if (!currentMetrics.fileName) return showToast("Importe um CSV antes de exportar a imagem.", true);
  closeExportMenu();setExportBusy(true);
  const activePage = document.querySelector(".page.active");
  if (!activePage || activePage.id === "page-dashboard") return exportDashboardImage();
  exportDetailPageImage(activePage.id);
}

/* ===================== EVENTOS DA INTERFACE ===================== */

function validateCsvFile(file){if(!file)return"Nenhum arquivo foi selecionado.";if(!/\.csv$/i.test(file.name))return"Selecione um arquivo com extensão .csv.";if(!file.size)return"O arquivo CSV está vazio.";if(file.size>200*1024*1024)return"O arquivo excede o limite local de 200 MB.";return""}
$("#csv-input").addEventListener("change",async event=>{const file=event.target.files[0];if(!file)return;$("#processing").classList.add("show");$("#processing-title").textContent="Processando CSV…";$("#processing-detail").textContent="A análise está sendo executada localmente; nenhum dado será enviado.";$("#processing-steps").innerHTML="";try{const validationError=validateCsvFile(file);if(validationError)throw new Error(validationError);const buffer=await file.arrayBuffer();const metrics=await calculateMetricsAsync(buffer,file.name);currentMetrics=metrics;render(currentMetrics);resetGembaAbs();showToast(fmt(metrics.recordCount)+" registros analisados com sucesso.")}catch(error){console.error(error);showToast(error.message||"Não foi possível processar o CSV.",true)}finally{$("#processing").classList.remove("show");event.target.value=""}});

$("#copy-summary").addEventListener("click", copyOverviewSummary);
$("#export-summary").addEventListener("click", exportSummary);
$("#export-image").addEventListener("click",event=>{event.stopPropagation();const control=$("#export-control"),open=control.classList.toggle("open");$("#export-image").setAttribute("aria-expanded",String(open))});
$("#export-current-page").addEventListener("click",exportCurrentPageImage);
$("#export-dashboard").addEventListener("click",()=>{if(!currentMetrics.fileName)return showToast("Importe um CSV antes de exportar a imagem.",true);closeExportMenu();setExportBusy(true);exportDashboardImage()});
$("#export-menu").addEventListener("click",event=>event.stopPropagation());
document.addEventListener("click",closeExportMenu);
$("#sla-central-import").addEventListener("click",()=>$("#csv-input").click());
$("#page-faturamento").addEventListener("click",event=>{
  const toggle=event.target.closest("[data-sla-toggle-area]");if(toggle){const area=toggle.dataset.slaToggleArea,date=toggle.dataset.slaToggleDate,expanded=slaCentralUi.expanded[area];if(expanded.has(date))expanded.delete(date);else expanded.add(date);renderSlaCentral();return}
  const button=event.target.closest("[data-sla-context]");if(!button||!button.dataset.slaContext)return;const context=slaCentralUi.contexts.get(button.dataset.slaContext);if(context)openSlaCentralDrawer(context.records,context.title);
});
$("#sla-drawer-body").addEventListener("input",event=>{if(slaCentralUi.drawerOpen&&event.target.matches("#sla-detail-search,#sla-detail-date"))renderSlaCentralDrawerResults()});
$("#sla-drawer-body").addEventListener("change",event=>{if(slaCentralUi.drawerOpen&&event.target.matches("#sla-detail-hour,#sla-detail-status,#sla-detail-service,#sla-detail-delay"))renderSlaCentralDrawerResults()});
$("#sla-drawer-body").addEventListener("click",event=>{
  if(slaCentralUi.drawerOpen){if(event.target.closest("#sla-detail-export"))return exportSlaCentralDetailCsv();if(event.target.closest("#sla-detail-more")){slaCentralUi.drawerLimit+=200;return renderSlaCentralDrawerResults()}return}
  const more=event.target.closest("#sla-drawer-more");if(more){slaUi.drawerPage++;return renderSlaDrawerPage()}const button=event.target.closest("[data-sla-record-index]");if(button)showSlaRecord(Number(button.dataset.slaRecordIndex));
});
$("#sla-drawer-close").addEventListener("click",closeSlaDrawer); $("#sla-drawer-backdrop").addEventListener("click",closeSlaDrawer);
document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeSlaDrawer();closeExportMenu();closeGembaAbs()}});
setInterval(()=>{if(!currentMetrics.fileName||document.hidden)return;const page=document.querySelector(".page.active")?.id;if(page==="page-faturamento")renderSlaCentral();else if(page==="page-transportadoras")renderPickupDashboard()},60000);
populateProfileCarriers();renderSlaProfileList();clearProfileForm();
$("#gemba-import").addEventListener("click",()=>$("#csv-input").click());
$("#gemba-copy").addEventListener("click",copyGemba);
$("#gemba-goals-form").addEventListener("submit",event=>{event.preventDefault();if(!cloudState.isManager)return showToast("Somente Gestor ou Administrador pode alterar as metas.",true);gembaConfig={metaB2c:nonNegativeNumber($("#gemba-meta-b2c").value),metaB2b:nonNegativeNumber($("#gemba-meta-b2b").value)};saveGembaConfig();renderGemba(currentMetrics);showToast("Metas do GEMBA salvas e forecast recalculado.")});
$("#gemba-add-abs").addEventListener("click",()=>openGembaAbs());
$("#gemba-abs-close").addEventListener("click",closeGembaAbs);$("#gemba-abs-cancel").addEventListener("click",closeGembaAbs);
$("#gemba-abs-modal").addEventListener("click",event=>{if(event.target===$("#gemba-abs-modal"))closeGembaAbs()});
$("#gemba-abs-form").addEventListener("submit",event=>{event.preventDefault();const id=$("#gemba-abs-id").value,name=$("#gemba-abs-name").value.trim(),type=$("#gemba-abs-type").value;if(!name||!GEMBA_ABS_TYPES.includes(type)){$("#gemba-abs-error").textContent="Informe o nome e selecione um tipo de ABS válido.";return}const item={id:id||("gemba_"+Date.now()+"_"+Math.random().toString(36).slice(2,8)),nome:name,tipo:type},index=gembaAbs.findIndex(entry=>entry.id===id);if(index>=0)gembaAbs[index]=item;else gembaAbs.push(item);saveGembaAbs();closeGembaAbs();showToast(index>=0?"ABS atualizado.":"ABS adicionado.")});
$("#gemba-abs-list").addEventListener("click",event=>{const button=event.target.closest("[data-gemba-abs-action]");if(!button)return;const item=gembaAbs.find(entry=>entry.id===button.dataset.gembaAbsId);if(!item)return;if(button.dataset.gembaAbsAction==="edit")return openGembaAbs(item);if(button.dataset.gembaAbsAction==="delete"&&confirm('Excluir o ABS de "'+item.nome+'"?')){gembaAbs=gembaAbs.filter(entry=>entry.id!==item.id);saveGembaAbs();showToast("ABS excluído.")}});
$("#pickup-carrier").addEventListener("change",event=>loadPickupForm(event.target.value));
$("#pickup-clear-form").addEventListener("click",()=>{$("#pickup-carrier").value="";loadPickupForm("")});
$("#pickup-save").addEventListener("click",()=>{const carrier=$("#pickup-carrier").value;if(!carrier)return showToast("Selecione uma transportadora do CSV.",true);const schedule={};document.querySelectorAll("[data-pickup-day]").forEach(input=>schedule[input.dataset.pickupDay]=validPickupTimes(input.value));if(!Object.values(schedule).some(times=>times.length))return showToast("Informe pelo menos um dia e horário de coleta.",true);pickupSchedules[carrier]=schedule;savePickupSchedules();renderPickupSavedList();renderPickupDashboard();renderSlaCentral(false);showToast("Grade de coleta salva para "+carrier+".")});
$("#pickup-saved-list").addEventListener("click",event=>{const button=event.target.closest("[data-delete-pickup]");if(!button)return;delete pickupSchedules[button.dataset.deletePickup];savePickupSchedules();renderPickupSavedList();renderPickupDashboard();renderSlaCentral(false);showToast("Grade de coleta removida.")});
$("#sla-profile-form").addEventListener("input",updateProfileSummary);$("#sla-profile-form").addEventListener("change",updateProfileSummary);$("#sla-profile-new").addEventListener("click",clearProfileForm);$("#sla-profile-cancel").addEventListener("click",clearProfileForm);
// No mesmo dia, a expedição precisa ocorrer depois do corte; em D+1 qualquer horário é válido.
$("#sla-profile-form").addEventListener("submit",event=>{
  event.preventDefault();
  const profile=profileFromForm();
  const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const minutes=value=>{const[hour,minute]=value.split(":").map(Number);return hour*60+minute};

  if(!profile.name)return showToast("Informe o nome do perfil.",true);
  if(!profile.services.length)return showToast("Selecione ao menos um Serviço da Transportadora.",true);
  if(!validTime(profile.cutoff))return showToast("Informe um limite de importação válido.",true);
  if(!validTime(profile.deadlineTime))return showToast("Informe um limite de expedição válido.",true);
  if(profile.dispatchDay==="same_day"&&minutes(profile.deadlineTime)<=minutes(profile.cutoff)){
    return showToast("Para expedição no mesmo dia, o limite de expedição deve ser posterior ao limite de importação.",true);
  }

  const existing=slaProfiles.find(item=>item.id===profile.id);
  if(existing)profile.createdAt=existing.createdAt||profile.createdAt;
  const index=slaProfiles.findIndex(item=>item.id===profile.id);
  if(index>=0)slaProfiles[index]=profile;
  else slaProfiles.push(profile);

  saveSlaProfiles();
  refreshSlaConsumers();
  clearProfileForm();
  showToast("Perfil salvo. Limites aplicados em Expedição Pedidos.");
});
$("#sla-profile-list").addEventListener("click",event=>{const button=event.target.closest("[data-profile-action]");if(!button)return;const profile=slaProfiles.find(item=>item.id===button.dataset.profileId);if(!profile)return;if(button.dataset.profileAction==="edit")return editSlaProfile(profile);if(button.dataset.profileAction==="duplicate"){const copy=JSON.parse(JSON.stringify(profile));copy.id="sla_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);copy.name=profile.name+" · cópia";copy.createdAt=new Date().toISOString();slaProfiles.push(copy);saveSlaProfiles();refreshSlaConsumers();return showToast("Perfil duplicado.")}if(button.dataset.profileAction==="delete"){if(!confirm('Excluir o perfil "'+profile.name+'"? Pedidos associados ficarão sem SLA configurado.'))return;slaProfiles=slaProfiles.filter(item=>item.id!==profile.id);saveSlaProfiles();refreshSlaConsumers();clearProfileForm();showToast("Perfil excluído.")}});
document.querySelectorAll("[data-export-page]").forEach(button=>button.addEventListener("click",exportCurrentPageImage));
$("#pickup-go-settings").addEventListener("click",()=>{const button=document.querySelector('.nav-item[data-page="configuracoes"]');if(button)button.click()});
$("#pickup-dashboard").addEventListener("click",event=>{const card=event.target.closest("[data-next-pickup]");if(!card)return;const next=allUpcomingPickups(new Date())[0];if(!next)return;const records=pendingPickupFlow(next.carrier);if(!records.length)return showToast("A próxima transportadora não possui pedidos em alerta fora de carga/coleta.");openSlaDrawer(records,"Próxima coleta · "+carrierShort(next.carrier))});
$("#pickup-dashboard").addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&event.target.closest("[data-next-pickup]")){event.preventDefault();event.target.closest("[data-next-pickup]").click()}});
[["#b2c-table","b2c"],["#b2b-table","b2b"]].forEach(([selector,segment])=>$(selector).addEventListener("click",event=>{const cell=event.target.closest("[data-conference-key]"),total=event.target.closest("[data-conference-total]");if(cell)openConferenceDetails(conferenceBucketByKey(cell.dataset.conferenceKey,segment),segment);else if(total)openConferenceDetails(conferenceTotalByCarrier(total.dataset.conferenceTotal,segment),segment)}));
let matrixResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(matrixResizeTimer);
  matrixResizeTimer = setTimeout(() => {
    $("#b2c-table").innerHTML = pendingMatrixHtml(currentMetrics.b2cHourly, false);
    $("#b2b-table").innerHTML = pendingMatrixHtml(currentMetrics.b2bHourly, true);
  }, 120);
});
/* ===================== NAVEGAÇÃO E INICIALIZAÇÃO ===================== */

// Páginas administrativas continuam protegidas mesmo quando acessadas diretamente pelo hash.
function requiredRoleForPage(page){if(["configuracoes","sla-profiles"].includes(page))return"manager";return"operation"}
function navigateToPage(page,options={}){
  const required=requiredRoleForPage(page);
  if(!hasAccess(required)){showToast("Entre como Gestor ou Administrador para acessar esta área.",true);showAuthModal();return false}
  const button=document.querySelector('.nav-item[data-page="'+CSS.escape(page)+'"]'),target=$("#page-"+page);
  if(!target)return false;
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  document.querySelectorAll(".page").forEach(item => item.classList.remove("active"));
  if(button)button.classList.add("active");
  target.classList.add("active");
  const title = button?button.textContent.replace(/\s+/g," ").trim():page;
  $("#page-title").textContent = title;
  $("#breadcrumb").textContent = title.toUpperCase();
  if($("#export-current-label"))$("#export-current-label").textContent=title;
  $("#sidebar").classList.remove("open");
  $("#scrim").classList.remove("show");
  const hash="#/"+page;if(options.replaceHash)history.replaceState(null,"",hash);else if(location.hash!==hash)history.pushState(null,"",hash);
  return true
}
ensureUnifiedNavigation();
$("#sidebar").addEventListener("click",event=>{const button=event.target.closest(".nav-item[data-page]");if(button)navigateToPage(button.dataset.page)});
function restoreRoute(){const page=location.hash.replace(/^#\/?/,"")||"dashboard";if(!navigateToPage(page,{replaceHash:true}))navigateToPage("dashboard",{replaceHash:true})}
window.addEventListener("hashchange",restoreRoute);
$("#menu").addEventListener("click", () => {
  $("#sidebar").classList.add("open"); $("#scrim").classList.add("show");
});
$("#scrim").addEventListener("click", () => {
  $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show");
});

const savedTheme = localStorage.getItem("luft-theme") || "light";
document.body.dataset.theme = savedTheme;
$("#theme-toggle").textContent = savedTheme === "dark" ? "☀" : "☾";
$("#theme-toggle").addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  localStorage.setItem("luft-theme", nextTheme);
  $("#theme-toggle").textContent = nextTheme === "dark" ? "☀" : "☾";
});

const now = new Date();
$("#current-date").textContent = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "").toUpperCase();
render(currentMetrics);
createAccessGateway();
$("#access-button").addEventListener("click",()=>hasAccess("leader")?showAuthModal():showAccessGateway());$("#auth-close").addEventListener("click",closeAuthModal);$("#operation-mode").addEventListener("click",enterOperationMode);$("#auth-backdrop").addEventListener("click",event=>{if(event.target===$("#auth-backdrop"))closeAuthModal()});
$("#manager-login-form").addEventListener("submit",async event=>{event.preventDefault();if(!cloudState.client){$("#auth-error").textContent="O Supabase ainda não foi configurado neste arquivo.";return}const email=$("#manager-email").value.trim(),password=$("#manager-password").value;$("#auth-error").textContent="Autenticando…";const {data,error}=await cloudState.client.auth.signInWithPassword({email,password});if(error){$("#auth-error").textContent="E-mail ou senha inválidos.";return}const role=await verifyAccessProfile(data.user);if(accessLevel(role)<accessLevel("leader")){await cloudState.client.auth.signOut();$("#auth-error").textContent="Este usuário não possui perfil de acesso ativo.";return}cloudState.user=data.user;cloudState.role=role;cloudState.isManager=hasAccess("manager");if(cloudState.isManager)await pullCloudSettings(false);enterManagerMode();showToast("Acesso "+role+" liberado.")});
$("#manager-logout").addEventListener("click",async()=>{if(cloudState.client)await cloudState.client.auth.signOut();cloudState.user=null;cloudState.role="operation";cloudState.isManager=false;sessionStorage.removeItem("luft-access-mode");applyAccessMode();hideAuthModal();showAccessGateway();showToast("Sessão autenticada encerrada.")});
document.addEventListener("click",event=>{if(event.target?.id==="database-sync")syncAllSettings()});
initializeSupabase().then(restoreRoute).catch(error=>{console.error(error);showToast("Falha ao inicializar o controle de acesso.",true)});
