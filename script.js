"use strict";

const $ = (selector) => document.querySelector(selector);
const SUPABASE_CONFIG={url:"https://ywicdcngxlagtkjbfjep.supabase.co",anonKey:"sb_publishable_R_TpeEkM0E9j3LVhW9OMhw_ZAP0mBaC"};
const cloudState={client:null,user:null,isManager:false,syncing:false,lastSync:null,gatewayRequired:true};
function createAccessGateway(){if($("#access-gateway"))return;const logo=document.querySelector(".brand .logo")?.src||"";document.body.insertAdjacentHTML("beforeend",'<div class="access-gateway show" id="access-gateway"><div class="gateway-shell"><section class="gateway-copy"><img class="gateway-logo" src="'+logo+'" alt="Luft"><small>LUFT · STATUS OPERACIONAL</small><h1>Como você deseja acessar?</h1><p>Escolha o ambiente adequado para sua rotina. O modo Operação mantém o painel simples e seguro; o modo Gestor libera os controles administrativos.</p></section><section class="gateway-modes"><button class="gateway-mode" id="gateway-operation"><span class="gateway-icon">▦</span><span><strong>Entrar no Modo Operação</strong><small>Visualizar indicadores, importar CSV, pesquisar pedidos e exportar relatórios. Não exige login.</small></span><span class="gateway-arrow">→</span></button><button class="gateway-mode manager" id="gateway-manager"><span class="gateway-icon">⚙</span><span><strong>Entrar como Gestor</strong><small>Visualização completa, configurações, perfis de SLA, metas e sincronização com o banco.</small></span><span class="gateway-arrow">→</span></button><div class="gateway-foot">As permissões de edição são validadas pelo Supabase.</div></section></div></div>');const right=$(".header-right");if(right&&!$("#operation-ribbon"))right.insertAdjacentHTML("afterbegin",'<span class="mode-ribbon operation" id="operation-ribbon">● Operação · leitura</span><span class="mode-ribbon manager" id="manager-ribbon">● Gestor · edição</span>');$("#gateway-operation").addEventListener("click",enterOperationMode);$("#gateway-manager").addEventListener("click",()=>{$("#access-gateway").classList.remove("show");showAuthModal()})}
function enterOperationMode(){cloudState.gatewayRequired=false;sessionStorage.setItem("luft-access-mode","operation");cloudState.isManager=false;applyAccessMode();$("#access-gateway")?.classList.remove("show");hideAuthModal();showToast("Modo Operação ativo · acesso somente visual.")}
function enterManagerMode(){cloudState.gatewayRequired=false;sessionStorage.setItem("luft-access-mode","manager");applyAccessMode();$("#access-gateway")?.classList.remove("show");hideAuthModal()}
function showAccessGateway(){cloudState.gatewayRequired=true;$("#auth-backdrop")?.classList.remove("show");$("#access-gateway")?.classList.add("show")}
function supabaseConfigured(){return /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_CONFIG.url)&&SUPABASE_CONFIG.anonKey&&!SUPABASE_CONFIG.anonKey.startsWith("COLE_AQUI")&&window.supabase}
function ensureDatabaseStatusUi(){if($("#database-status-title"))return;const page=$("#page-configuracoes"),intro=page&&page.querySelector(".intro");if(!page||!intro)return;intro.insertAdjacentHTML("afterend",'<article class="card database-status"><div class="database-status-icon">☁</div><div><small>SUPABASE</small><strong id="database-status-title">Banco não configurado</strong><p id="database-status-detail">Informe a URL e a chave pública no bloco SUPABASE_CONFIG do arquivo.</p></div><button class="btn secondary" id="database-sync">Sincronizar agora</button></article>')}
function updateDatabaseStatus(title,detail){ensureDatabaseStatusUi();if($("#database-status-title"))$("#database-status-title").textContent=title;if($("#database-status-detail"))$("#database-status-detail").textContent=detail}
function showAuthModal(){const manager=cloudState.isManager;$("#auth-backdrop").classList.add("show");$("#manager-login-form").hidden=manager;$("#auth-session").hidden=!manager;if(manager)$("#auth-session-email").textContent=cloudState.user.email||"Gestor"}
function hideAuthModal(){$("#auth-backdrop").classList.remove("show");$("#auth-error").textContent=""}
function closeAuthModal(){if(cloudState.gatewayRequired)showAccessGateway();else hideAuthModal()}
function applyAccessMode(){const manager=cloudState.isManager;$("#manager-navigation").hidden=!manager;$("#access-avatar").textContent=manager?"GE":"OP";$("#access-name").textContent=manager?(cloudState.user.user_metadata?.name||cloudState.user.email||"Gestor"):"Modo Operação";$("#access-role").textContent=manager?"Gestor · configurações liberadas":"Acesso visual";document.body.dataset.access=manager?"manager":"operation";["#io-open-settings","#pickup-go-settings"].forEach(selector=>{const element=$(selector);if(element)element.hidden=!manager});if(!manager&&["page-io","page-configuracoes","page-sla-profiles"].includes(document.querySelector(".page.active")?.id)){document.querySelector('.nav-item[data-page="dashboard"]')?.click()}}
async function verifyManager(user){if(!user||!cloudState.client)return false;const {data,error}=await cloudState.client.from("manager_profiles").select("role,active").eq("user_id",user.id).maybeSingle();return !error&&data&&data.active&&data.role==="manager"}
async function applyCloudSettings(rows){const map=Object.fromEntries((rows||[]).map(row=>[row.setting_key,row.payload]));if(Array.isArray(map.sla_profiles)){slaProfiles=map.sla_profiles;localStorage.setItem("luft-sla-profiles-v1",JSON.stringify(slaProfiles))}if(map.pickup_schedules&&typeof map.pickup_schedules==="object"){pickupSchedules=map.pickup_schedules;localStorage.setItem("luft-pickup-schedules",JSON.stringify(pickupSchedules))}if(map.io_config&&typeof map.io_config==="object"){ioConfig={...ioDefaults,...map.io_config};localStorage.setItem("luft-io-config",JSON.stringify(ioConfig))}invalidateOperationalCaches();render(currentMetrics)}
async function pullCloudSettings(showMessage){if(!cloudState.client)return false;cloudState.syncing=true;updateDatabaseStatus("Sincronizando…","Buscando as configurações operacionais do banco.");const {data,error}=await cloudState.client.from("system_settings").select("setting_key,payload,updated_at");cloudState.syncing=false;if(error){updateDatabaseStatus("Falha na sincronização",error.message);if(showMessage)showToast("Não foi possível sincronizar com o banco.",true);return false}await applyCloudSettings(data);cloudState.lastSync=new Date();updateDatabaseStatus("Banco conectado","Última sincronização às "+cloudState.lastSync.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));if(showMessage)showToast("Configurações sincronizadas com o Supabase.");return true}
async function pushCloudSetting(key,payload){if(!cloudState.client||!cloudState.isManager)return false;const {error}=await cloudState.client.from("system_settings").upsert({setting_key:key,payload,updated_by:cloudState.user.id},{onConflict:"setting_key"});if(error){showToast("Alteração salva localmente, mas não sincronizada: "+error.message,true);return false}cloudState.lastSync=new Date();updateDatabaseStatus("Banco conectado","Alteração sincronizada às "+cloudState.lastSync.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));return true}
async function syncAllSettings(){if(!cloudState.client)return showToast("Configure o Supabase antes de sincronizar.",true);if(!cloudState.isManager)return pullCloudSettings(true);updateDatabaseStatus("Sincronizando…","Enviando as configurações locais e conferindo o banco.");const rows=[{setting_key:"sla_profiles",payload:slaProfiles,updated_by:cloudState.user.id},{setting_key:"pickup_schedules",payload:pickupSchedules,updated_by:cloudState.user.id},{setting_key:"io_config",payload:ioConfig,updated_by:cloudState.user.id}];const {error}=await cloudState.client.from("system_settings").upsert(rows,{onConflict:"setting_key"});if(error){updateDatabaseStatus("Falha na sincronização",error.message);return showToast("Não foi possível sincronizar as configurações.",true)}await pullCloudSettings(false);showToast("Todas as configurações foram sincronizadas.")}
async function initializeSupabase(){ensureDatabaseStatusUi();const savedMode=sessionStorage.getItem("luft-access-mode");if(!supabaseConfigured()){updateDatabaseStatus("Banco aguardando configuração","Cole a URL do projeto e a chave pública anon no bloco SUPABASE_CONFIG.");applyAccessMode();if(savedMode==="operation")enterOperationMode();else showAccessGateway();return}cloudState.client=window.supabase.createClient(SUPABASE_CONFIG.url,SUPABASE_CONFIG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data:{session}}=await cloudState.client.auth.getSession();cloudState.user=session?.user||null;cloudState.isManager=await verifyManager(cloudState.user);applyAccessMode();await pullCloudSettings(false);if(cloudState.isManager)enterManagerMode();else if(savedMode==="operation")enterOperationMode();else showAccessGateway();cloudState.client.auth.onAuthStateChange(async(event,sessionValue)=>{cloudState.user=sessionValue?.user||null;cloudState.isManager=await verifyManager(cloudState.user);applyAccessMode()})}
const fmt = (value) => Number(value || 0).toLocaleString("pt-BR");
const zeroSummary = () => ({ orders: 0, products: 0, volumes: 0 });
let currentMetrics = createEmptyMetrics();
let slaRuntimeCache={metrics:null,profiles:null,pickups:null,minute:-1,records:[]};
function invalidateOperationalCaches(){slaRuntimeCache={metrics:null,profiles:null,pickups:null,minute:-1,records:[]}}

function createEmptyMetrics() {
  return {
    triaged: 0, processedToday: 0, withoutPdf: 0, pinRequests: 0, volumesToday: 0,
    recordCount: 0, receivedRows: 0, rejectedRows: 0, fileName: "", importedAt: "", triagedSummary: zeroSummary(),
    withoutPdfSummary: zeroSummary(), dispatchedToday: zeroSummary(), dispatchedYesterday: zeroSummary(),
    b2cHourly: [], b2bHourly: [], pinDetails: [], lastDispatch: null, d1Date: "",
    triagedByCarrier: [], productivity: { days: [] }, slaRecords: [], ioOrders: []
  };
}

function normalizeHeader(value) {
  return String(value || "").replace(/^\ufeff/, "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

let pickupSchedules = loadPickupSchedules();
let slaProfiles = loadSlaProfiles();
const pickupDayNames = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
function loadPickupSchedules(){try{return JSON.parse(localStorage.getItem("luft-pickup-schedules")||"{}")||{}}catch(error){return {}}}
function savePickupSchedules(){invalidateOperationalCaches();localStorage.setItem("luft-pickup-schedules",JSON.stringify(pickupSchedules));pushCloudSetting("pickup_schedules",pickupSchedules)}
function loadSlaProfiles(){try{const data=JSON.parse(localStorage.getItem("luft-sla-profiles-v1")||"[]");return Array.isArray(data)?data:[]}catch(error){return []}}
function saveSlaProfiles(){invalidateOperationalCaches();localStorage.setItem("luft-sla-profiles-v1",JSON.stringify(slaProfiles));pushCloudSetting("sla_profiles",slaProfiles)}
function validPickupTimes(value){return Array.from(new Set(String(value||"").split(/[,;\s]+/).map(item=>item.trim()).filter(item=>/^([01]\d|2[0-3]):[0-5]\d$/.test(item)))).sort()}
function carrierSchedule(carrier){const exact=pickupSchedules[carrier];if(exact)return exact;const key=Object.keys(pickupSchedules).find(name=>normalizeHeader(name)===normalizeHeader(carrier));return key?pickupSchedules[key]:null}
function nextPickupForCarrier(carrier,afterDate){const schedule=carrierSchedule(carrier);if(!schedule)return null;const after=new Date(afterDate);for(let offset=0;offset<15;offset++){const day=new Date(after);day.setDate(day.getDate()+offset);day.setHours(0,0,0,0);const times=schedule[String(day.getDay())]||[];for(const time of times){const [hour,minute]=time.split(":").map(Number),candidate=new Date(day);candidate.setHours(hour,minute,0,0);if(candidate>after)return candidate}}return null}
function normalizedListIncludes(list,value){const target=normalizeHeader(value);return (list||[]).some(item=>normalizeHeader(item)===target)}
function profileMatchesRecord(profile,record){if(!profile||!profile.active)return false;const match=profile.match||{},legacyUsesService=profile.schemaVersion>=2||Array.isArray(match.services)||match.allServices!==undefined,mode=match.mode||(legacyUsesService?"service":"carrier"),carrierOk=Boolean(match.allCarriers)||normalizedListIncludes(match.carriers,record.carrier),serviceOk=Boolean(match.allServices)||normalizedListIncludes(match.services,record.service);const associationOk=mode==="carrier"?carrierOk:mode==="both"?carrierOk&&serviceOk:mode==="either"?carrierOk||serviceOk:serviceOk;const seriesOk=(match.series||[]).includes("Todas")||(match.series||[]).includes(record.series);const statusOk=normalizedListIncludes(match.statuses,record.status);return associationOk&&seriesOk&&statusOk}
function matchingSlaProfile(record){return slaProfiles.filter(profile=>profileMatchesRecord(profile,record)).sort((a,b)=>(Number(a.priority)||9999)-(Number(b.priority)||9999)||String(a.name).localeCompare(String(b.name),"pt-BR"))[0]||null}
function profileOrigin(profile,record){const source=(profile.rule||{}).source;const map={imported:record.importedStamp,billed:record.billedStamp,conference:record.conferenceStamp,other:record.registeredStamp};const stamp=map[source];return stamp?new Date(stamp):null}
function dateKey(date){return String(date.getDate()).padStart(2,"0")+"/"+String(date.getMonth()+1).padStart(2,"0")+"/"+date.getFullYear()}
function isProfileBusinessDay(date,profile){const calendar=profile.calendar||{},days=calendar.businessDays||[];return days.includes(date.getDay())&&!(calendar.holidayDates||[]).includes(dateKey(date))}
function nextProfileBusinessDay(date,amount,profile){const result=new Date(date);let remaining=amount==null?1:amount,guard=0;while(remaining>0&&guard++<370){result.setDate(result.getDate()+1);if(isProfileBusinessDay(result,profile))remaining--}return result}
function setProfileTime(date,time,fallback){const result=new Date(date),parts=String(time||fallback||"23:59").split(":").map(Number);result.setHours(parts[0]||0,parts[1]||0,0,0);return result}
function afterProfileCutoff(date,cutoff){const parts=String(cutoff||"23:59").split(":").map(Number);return date.getHours()*60+date.getMinutes()>(parts[0]||0)*60+(parts[1]||0)}
function calculateProfileDue(profile,record){const rule=profile.rule||{},origin=profileOrigin(profile,record);if(!origin)return null;let due;if(rule.type==="hours")due=new Date(origin.getTime()+Math.max(0,Number(rule.hours)||0)*3600000);else if(rule.type==="same_day"){const same=isProfileBusinessDay(origin,profile)&&!afterProfileCutoff(origin,rule.cutoff);due=setProfileTime(same?origin:nextProfileBusinessDay(origin,1,profile),rule.deadlineTime,"23:59")}else if(rule.type==="next_business_day"){due=setProfileTime(nextProfileBusinessDay(origin,afterProfileCutoff(origin,rule.cutoff)?2:1,profile),rule.deadlineTime,"23:59")}else if(rule.type==="fixed_date"){const parts=String(rule.fixedDate||"").split("-").map(Number);if(parts.length!==3||!parts[0])return null;due=setProfileTime(new Date(parts[0],parts[1]-1,parts[2]),rule.fixedTime,"23:59")}else if(rule.type==="custom"){due=new Date(origin);due.setDate(due.getDate()+Math.max(0,Number(rule.offsetDays)||0));due=new Date(due.getTime()+Math.max(0,Number(rule.offsetHours)||0)*3600000);if(rule.deadlineTime)due=setProfileTime(due,rule.deadlineTime);if(!isProfileBusinessDay(due,profile))due=setProfileTime(nextProfileBusinessDay(due,1,profile),rule.deadlineTime,"23:59")}else return null;return Number.isNaN(due.getTime())?null:due}
function effectiveSlaDeadline(record,profile){const base=calculateProfileDue(profile,record);if(!base)return null;const origin=profileOrigin(profile,record),pickup=nextPickupForCarrier(record.carrier,origin||new Date());return pickup&&pickup<base?{due:pickup.getTime(),pickup:pickup.getTime(),source:"Coleta programada · antes do perfil "+profile.name}:{due:base.getTime(),pickup:pickup?pickup.getTime():null,source:"Perfil "+profile.name}}
function profileAlertMinutes(profile){const values=((profile.alerts||{}).thresholdMinutes||[]).map(Number).filter(value=>value>0);return values.length?Math.max(...values):0}

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
    if (!isCancelled) {
      const ioImportedRaw = (indexes.imported >= 0 ? values[indexes.imported] : "") || (indexes.registered >= 0 ? values[indexes.registered] : "");
      const ioImportedAt = parseBrazilianDateTime(ioImportedRaw);
      const ioSeries = series === "17" ? "b2c" : (["", "11", "14"].includes(series) ? "b2b" : null);
      if (ioSeries) metrics.ioOrders.push({
        order, segment:ioSeries, series:series || "Vazia", wave:indexes.wave >= 0 ? (values[indexes.wave] || "").trim() : "",
        waveId:indexes.waveId >= 0 ? (values[indexes.waveId] || "").trim() : "", status:(values[indexes.status] || "").trim(),
        products, skus:indexes.skuQty >= 0 ? Number(String(values[indexes.skuQty] || "0").replace(",",".")) || 0 : 0,
        separatedAt:indexes.separatedAt >= 0 ? (values[indexes.separatedAt] || "").trim() : "", billedAt:indexes.billedAt >= 0 ? (values[indexes.billedAt] || "").trim() : "", weighedAt,
        conferenceStarted:indexes.conferenceStarted >= 0 ? (values[indexes.conferenceStarted] || "").trim() === "1" : false,
        processed:isProcessed, importedStamp:ioImportedAt ? ioImportedAt.getTime() : 0, carrier, load
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

function decodeCsvBuffer(buffer){if(typeof buffer==="string")return buffer;const bytes=new Uint8Array(buffer),utf8=new TextDecoder("utf-8").decode(bytes);if(utf8.includes("\uFFFD"))try{return new TextDecoder("windows-1252").decode(bytes)}catch(error){}return utf8}

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

const slaUi = { status: "", war: false, drawerRecords: [], drawerTitle: "", drawerPage:0, drawerPageSize:100 };
const ioDefaults = { metaB2c:0,metaB2b:0,rateSepB2c:60,rateFatB2c:100,rateSepB2b:90,rateFatB2b:180,teamSepB2c:0,teamFatB2c:0,teamSepB2b:0,teamFatB2b:0 };
let ioConfig = loadIoConfig();

function loadIoConfig(){try{return {...ioDefaults,...JSON.parse(localStorage.getItem("luft-io-config")||"{}")}}catch(error){return {...ioDefaults}}}
function saveIoConfig(){localStorage.setItem("luft-io-config",JSON.stringify(ioConfig));pushCloudSetting("io_config",ioConfig)}
function currentShiftTime(){const now=new Date(),end=new Date(now);let label;if(now.getHours()<15){end.setHours(15,0,0,0);label="1º turno"}else{end.setDate(end.getDate()+1);end.setHours(0,0,0,0);label="2º turno"}return{label,hours:Math.max(0,(end-now)/3600000),end}}
function sameLocalDay(value,date){const parsed=parseBrazilianDateTime(value);return parsed&&parsed.getDate()===date.getDate()&&parsed.getMonth()===date.getMonth()&&parsed.getFullYear()===date.getFullYear()}
function clockDuration(hours){const total=Math.max(0,Math.round(hours*60));return Math.floor(total/60)+"h"+String(total%60).padStart(2,"0")}

function ioWaveRanking(orders,segment){
  const map=new Map();
  orders.filter(item=>item.segment===segment&&!item.processed&&(item.wave||item.waveId)).forEach(item=>{const key=item.wave||item.waveId;if(!map.has(key))map.set(key,{wave:key,segment,orders:0,pieces:0,skus:0,conference:false,oldest:item.importedStamp||Infinity,orderIds:new Set()});const wave=map.get(key);if(!wave.orderIds.has(item.order)){wave.orderIds.add(item.order);wave.orders++;wave.pieces+=item.products;wave.skus+=item.skus}wave.conference=wave.conference||item.conferenceStarted||normalizeHeader(item.status).includes("conferencia iniciada");wave.oldest=Math.min(wave.oldest,item.importedStamp||Infinity)});
  const waves=Array.from(map.values()).map(item=>({...item,ratio:item.pieces/Math.max(1,segment==="b2b"?item.skus:item.orders)}));
  const maxOrders=Math.max(1,...waves.map(item=>item.orders)),maxPieces=Math.max(1,...waves.map(item=>item.pieces)),maxSkus=Math.max(1,...waves.map(item=>item.skus)),maxRatio=Math.max(1,...waves.map(item=>item.ratio));
  waves.forEach(item=>{item.score=segment==="b2c"?(item.orders/maxOrders*.55+(1-Math.min(1,item.ratio/Math.max(1,maxRatio)))*.25+item.pieces/maxPieces*.2):(1-item.skus/maxSkus)*.35+item.pieces/maxPieces*.3+item.ratio/maxRatio*.35;if(item.conference)item.score+=.12;item.opportunityScore=Math.min(100,Math.round(item.score*100))});
  return waves.sort((a,b)=>b.score-a.score||b.pieces-a.pieces);
}

function calculateIo(metrics){
  const now=new Date(),shift=currentShiftTime(),orders=metrics.ioOrders;
  const todayText=String(now.getDate()).padStart(2,"0")+"/"+String(now.getMonth()+1).padStart(2,"0")+"/"+now.getFullYear();
  let sepB2c=0,fatB2c=0,sepB2b=0,fatB2b=0;
  orders.forEach(item=>{const separated=String(item.separatedAt||"").startsWith(todayText),weighed=String(item.weighedAt||"").startsWith(todayText);if(item.segment==="b2c"){if(separated)sepB2c+=item.products;if(weighed)fatB2c+=item.products}else if(item.segment==="b2b"){if(separated)sepB2b+=item.products;if(weighed)fatB2b+=item.products}});
  const remainingB2c=Math.max(0,ioConfig.metaB2c-fatB2c),remainingB2b=Math.max(0,ioConfig.metaB2b-fatB2b);
  const capacities={sepB2c:ioConfig.teamSepB2c*ioConfig.rateSepB2c*shift.hours,fatB2c:ioConfig.teamFatB2c*ioConfig.rateFatB2c*shift.hours,sepB2b:ioConfig.teamSepB2b*ioConfig.rateSepB2b*shift.hours,fatB2b:ioConfig.teamFatB2b*ioConfig.rateFatB2b*shift.hours};
  capacities.b2c=Math.min(capacities.sepB2c,capacities.fatB2c);capacities.b2b=Math.min(capacities.sepB2b,capacities.fatB2b);capacities.total=capacities.b2c+capacities.b2b;
  const projectedDeficitB2c=Math.max(0,remainingB2c-capacities.b2c),projectedDeficitB2b=Math.max(0,remainingB2b-capacities.b2b);
  const transferToB2b=projectedDeficitB2c>0&&projectedDeficitB2b===0?projectedDeficitB2c:0,transferToB2c=projectedDeficitB2b>0&&projectedDeficitB2c===0?projectedDeficitB2b:0;
  const adjustedRemainingB2c=remainingB2c+transferToB2c,adjustedRemainingB2b=remainingB2b+transferToB2b;
  const slaNow=enrichedSlaRecords(),urgentIds=new Set(slaNow.filter(item=>["overdue","critical"].includes(item.slaStatus)).map(item=>item.order));
  const applySlaPriority=list=>list.map(wave=>{wave.slaRisk=Array.from(wave.orderIds).some(order=>urgentIds.has(order));if(wave.slaRisk)wave.score+=2;return wave}).sort((a,b)=>b.score-a.score||a.oldest-b.oldest);
  const b2cWaves=applySlaPriority(ioWaveRanking(orders,"b2c")),b2bWaves=applySlaPriority(ioWaveRanking(orders,"b2b")),waves=[...b2cWaves,...b2bWaves].sort((a,b)=>b.score-a.score||a.oldest-b.oldest);
  const available={b2c:b2cWaves.reduce((s,w)=>s+w.pieces,0),b2b:b2bWaves.reduce((s,w)=>s+w.pieces,0)};
  const urgentSla=slaNow.filter(item=>["overdue","critical"].includes(item.slaStatus));
  const required=adjustedRemainingB2c+adjustedRemainingB2b,capacityCoverage=required?Math.min(1,capacities.total/required):1,waveCoverage=required?Math.min(1,(available.b2c+available.b2b)/required):1,teamReady=(ioConfig.teamSepB2c+ioConfig.teamFatB2c+ioConfig.teamSepB2b+ioConfig.teamFatB2b)>0;
  const confidence=ioConfig.metaB2c+ioConfig.metaB2b===0?0:Math.round(Math.max(2,Math.min(99,(capacityCoverage*.58+waveCoverage*.32+(teamReady?.1:0)-Math.min(.18,urgentSla.length*.004))*100)));
  return{shift,sepB2c,fatB2c,sepB2b,fatB2b,remainingB2c,remainingB2b,adjustedRemainingB2c,adjustedRemainingB2b,projectedDeficitB2c,projectedDeficitB2b,transferToB2c,transferToB2b,capacities,b2cWaves,b2bWaves,waves,available,urgentSla,confidence};
}

function ioGoalCard(label,produced,goal,adjusted,transfer){const percent=goal?Math.min(100,produced/goal*100):0;return '<article class="card goal-card"><div class="goal-head"><strong>'+label+'</strong><span>'+decimalFmt(percent)+'% concluído</span></div><div class="goal-progress"><i style="width:'+percent+'%"></i></div><div class="goal-values"><div><small>Produzido</small><strong>'+fmt(produced)+'</strong></div><div><small>Meta</small><strong>'+fmt(goal)+'</strong></div><div><small>Falta</small><strong>'+fmt(Math.max(0,goal-produced))+'</strong></div><div><small>Necessário/h</small><strong>'+decimalFmt(adjusted/Math.max(.01,currentShiftTime().hours))+'</strong></div></div>'+(transfer?'<div class="goal-compensation">↗ Compensação prevista: +'+fmt(transfer)+' peças transferidas para este segmento</div>':'')+'</article>'}
function capacityRow(label,necessary,capacity){const balance=capacity-necessary;return '<div class="capacity-row"><div><strong>'+label+'</strong><small>Até o fim do '+currentShiftTime().label.toLowerCase()+'</small></div><span>Necessário <b>'+fmt(Math.ceil(necessary))+'</b></span><span>Capacidade <b>'+fmt(Math.floor(capacity))+'</b></span><span class="capacity-result '+(balance>=0?'ok':'bad')+'">'+(balance>=0?'✓ Sobra ':'⚠ Déficit ')+fmt(Math.abs(Math.round(balance)))+'</span></div>'}
function waveItem(wave,index,plan,rate){const detail=wave.segment==="b2b"?fmt(wave.pieces)+' peças · '+fmt(wave.skus)+' SKU · '+decimalFmt(wave.ratio)+' peças/SKU':fmt(wave.orders)+' pedidos · '+fmt(wave.pieces)+' peças · '+decimalFmt(wave.ratio)+' prod./pedido';const time=rate?wave.pieces/rate:0;return '<div class="wave-item"><span class="wave-rank">'+(plan?(index+1)+'º':index===0?'🥇':index===1?'🥈':index===2?'🥉':(index+1)+'º')+'</span><span><strong>Onda '+escapeHtml(wave.wave)+' · '+wave.segment.toUpperCase()+(wave.slaRisk?' · 🔴 SLA crítico':wave.conference?' · Conferência iniciada':'')+'</strong><small>'+detail+(plan?' · estimado '+clockDuration(time):'')+'</small></span><span class="wave-score"><strong>'+wave.opportunityScore+'</strong><small>índice</small></span></div>'}

function renderIo(metrics){
  const io=calculateIo(metrics);$("#nav-io-confidence").textContent=io.confidence+"%";
  if(!metrics.fileName){$("#io-content").innerHTML='<article class="card io-empty">Importe o CSV para a I.O. analisar metas, capacidade e ondas.</article>';return}
  const configured=ioConfig.metaB2c+ioConfig.metaB2b>0,canReach=io.capacities.b2c>=io.adjustedRemainingB2c&&io.capacities.b2b>=io.adjustedRemainingB2b;
  const top=io.waves[0],oldest=io.waves.slice().sort((a,b)=>a.oldest-b.oldest)[0],fifoBreak=top&&oldest&&top.wave!==oldest.wave;
  const oldestUrgent=oldest&&enrichedSlaRecords().some(record=>record.wave===oldest.wave&&["overdue","critical"].includes(record.slaStatus));
  const messages=[];
  if(!configured)messages.push({type:"urgent",title:"Configure as metas diárias",text:"As produtividades padrão já estão preenchidas. Informe metas e equipe para ativar a projeção completa."});
  else messages.push({type:canReach?"opportunity":"urgent",title:canReach?"A meta é alcançável com a capacidade atual":"A capacidade atual não cobre a meta",text:"Restam "+clockDuration(io.shift.hours)+" de operação. Capacidade estimada: "+fmt(Math.floor(io.capacities.total))+" peças; necessidade ajustada: "+fmt(Math.ceil(io.adjustedRemainingB2c+io.adjustedRemainingB2b))+" peças."});
  const b2cPressure=io.adjustedRemainingB2c-io.capacities.b2c,b2bPressure=io.adjustedRemainingB2b-io.capacities.b2b;
  if(configured)messages.push({type:Math.max(b2cPressure,b2bPressure)>0?"urgent":"opportunity",title:(b2cPressure>b2bPressure?"B2C":"B2B")+" precisa de atenção primeiro",text:"Separação e faturamento foram comparados individualmente. O menor deles define a capacidade real do segmento."});
  if(io.projectedDeficitB2c>0&&io.projectedDeficitB2b>0)messages.push({type:"urgent",title:"Compensação cruzada indisponível no cenário atual",text:"B2C e B2B apresentam déficit projetado. Transferir a diferença entre eles apenas duplicaria a necessidade; é necessário elevar capacidade ou remanejar equipe."});
  if(top)messages.push({type:top.slaRisk?"urgent":"opportunity",title:"Inicie a Onda "+top.wave,text:(top.slaRisk?"Prioridade elevada por risco de SLA. ":"É a melhor oportunidade de produtividade. ")+"Segmento "+top.segment.toUpperCase()+", com "+fmt(top.pieces)+" peças."});
  if(io.urgentSla.length)messages.push({type:"urgent",title:fmt(io.urgentSla.length)+" pedidos com risco crítico de SLA",text:"Valide esses pedidos na Central de SLA antes de alterar a sequência de ondas."});
  if(fifoBreak)messages.push({type:oldestUrgent?"urgent":"opportunity",title:oldestUrgent?"Não é recomendável quebrar o FIFO agora":"FIFO pode ser quebrado com risco controlado",text:oldestUrgent?"A onda mais antiga contém pedido crítico ou vencido. Priorize o SLA antes do ganho de produtividade.":"A melhor oportunidade difere da onda mais antiga, mas não foi encontrado risco crítico de SLA nessa onda."});
  const plan=[],needed={b2c:io.adjustedRemainingB2c,b2b:io.adjustedRemainingB2b},rates={b2c:Math.min(ioConfig.teamSepB2c*ioConfig.rateSepB2c,ioConfig.teamFatB2c*ioConfig.rateFatB2c),b2b:Math.min(ioConfig.teamSepB2b*ioConfig.rateSepB2b,ioConfig.teamFatB2b*ioConfig.rateFatB2b)};io.waves.forEach(wave=>{if(needed[wave.segment]>0&&plan.length<8){plan.push(wave);needed[wave.segment]-=wave.pieces}});
  const planHours=plan.reduce((sum,wave)=>sum+(rates[wave.segment]?wave.pieces/rates[wave.segment]:0),0),finish=new Date(Date.now()+planHours*3600000);
  $("#io-content").innerHTML='<div class="io-hero"><article class="card io-command"><small>Leitura executiva · '+io.shift.label+'</small><h2>'+(configured?(canReach?'Operação com capacidade para atingir a meta':'Intervenção necessária para recuperar a meta'):'Aguardando metas e equipe')+'</h2><p>'+(top?'Melhor ação agora: iniciar a Onda '+escapeHtml(top.wave)+' ('+top.segment.toUpperCase()+'). ':'')+(io.urgentSla.length?'Existem '+fmt(io.urgentSla.length)+' pedidos em risco crítico de SLA. ':'Sem risco crítico de SLA identificado. ')+'Tempo restante: '+clockDuration(io.shift.hours)+'.</p></article><article class="card io-confidence"><div class="confidence-ring" style="--value:'+io.confidence+'"><strong>'+io.confidence+'%</strong></div><div><h3>Índice de confiança</h3><p>Combina equipe, tempo, capacidade, ondas disponíveis, meta restante e risco de SLA.</p></div></article></div><div class="io-goals">'+ioGoalCard('Meta B2C',io.fatB2c,ioConfig.metaB2c,io.adjustedRemainingB2c,io.transferToB2c)+ioGoalCard('Meta B2B',io.fatB2b,ioConfig.metaB2b,io.adjustedRemainingB2b,io.transferToB2b)+'</div><div class="io-grid"><article class="card"><div class="card-head"><div><h2>Capacidade operacional</h2><p>Equipe × produtividade/hora × horas restantes</p></div></div><div class="io-card-body">'+capacityRow('Separação B2C',io.adjustedRemainingB2c,io.capacities.sepB2c)+capacityRow('Faturamento B2C',io.adjustedRemainingB2c,io.capacities.fatB2c)+capacityRow('Separação B2B',io.adjustedRemainingB2b,io.capacities.sepB2b)+capacityRow('Faturamento B2B',io.adjustedRemainingB2b,io.capacities.fatB2b)+capacityRow('Capacidade total',io.adjustedRemainingB2c+io.adjustedRemainingB2b,io.capacities.total)+'</div></article><article class="card"><div class="card-head"><div><h2>Assistente operacional</h2><p>Recomendações com base no cenário atual</p></div></div><div class="io-card-body">'+messages.map(message=>'<div class="assistant-message '+message.type+'"><strong>'+escapeHtml(message.title)+'</strong><p>'+escapeHtml(message.text)+'</p></div>').join('')+'</div></article></div><div class="io-ranking-plan"><article class="card"><div class="card-head"><div><h2>Ranking inteligente de ondas</h2><p>B2C: pedidos e produtos/pedido · B2B: SKU, peças e peças/SKU</p></div></div><div class="wave-list">'+(io.waves.length?io.waves.slice(0,8).map((wave,index)=>waveItem(wave,index,false,0)).join(''):'<div class="io-empty">Nenhuma onda pendente disponível.</div>')+'</div></article><article class="card"><div class="card-head"><div><h2>Plano de execução</h2><p>Sequência sugerida até cobrir a necessidade restante</p></div></div><div class="wave-list">'+(plan.length?plan.map((wave,index)=>waveItem(wave,index,true,rates[wave.segment])).join('<div class="plan-arrow">↓</div>'):'<div class="io-empty">Configure metas/equipe ou importe ondas pendentes.</div>')+'</div>'+(plan.length?'<div class="goal-compensation" style="margin:14px 17px">Resultado estimado: '+(planHours?finish.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'informe a equipe para calcular o horário')+'</div>':'')+'</article></div>';
}
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
    const profile=matchingSlaProfile(record),deadline=profile?effectiveSlaDeadline(record,profile):null,applicable=Boolean(profile&&deadline),alertMinutes=profile?profileAlertMinutes(profile):0;
    return { ...record, profileId:profile?profile.id:null, profileName:profile?profile.name:"SLA não configurado", profileSummary:profile?profileRuleSummary(profile):"Nenhum perfil ativo corresponde à transportadora, série e status deste pedido.", alertMinutes, dueStamp:deadline?deadline.due:null, pickupStamp:deadline?deadline.pickup:null, deadlineSource:deadline?deadline.source:"Sem perfil aplicável ou campo de origem vazio", slaApplicable:applicable, slaStatus:applicable?slaState(deadline.due,now,alertMinutes):"notApplicable", remaining:applicable?deadline.due-now:null };
  });
  slaRuntimeCache={metrics:currentMetrics,profiles:slaProfiles,pickups:pickupSchedules,minute,records};
  return records;
}

function selectOptions(selector, records, field, emptyLabel) {
  const element = $(selector), current = element.value;
  const values = Array.from(new Set(records.map(record => record[field]).filter(Boolean))).sort((a,b) => String(a).localeCompare(String(b), "pt-BR", { numeric:true }));
  element.innerHTML = '<option value="">' + emptyLabel + '</option>' + values.map(value => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>').join("");
  if (values.includes(current)) element.value = current;
}

function populateSlaFilters(records) {
  selectOptions("#sla-carrier", records, "carrier", "Todas"); selectOptions("#sla-wave", records, "wave", "Todas");
  selectOptions("#sla-load", records, "load", "Todas"); selectOptions("#sla-order-status", records, "status", "Todos");
  selectOptions("#sla-service", records, "service", "Todos"); selectOptions("#sla-series", records, "series", "Todas");
}

function filteredSlaRecords(records) {
  const query = normalizeHeader($("#sla-search").value), selectedStatus = slaUi.status || $("#sla-filter").value;
  const exact = [["#sla-carrier","carrier"],["#sla-wave","wave"],["#sla-load","load"],["#sla-order-status","status"],["#sla-service","service"],["#sla-series","series"],["#sla-shift","shift"],["#sla-date","importDate"]];
  return records.filter(record => {
    if (!query && !record.slaApplicable) return false;
    if (slaUi.war && !["overdue","critical"].includes(record.slaStatus)) return false;
    if (selectedStatus && selectedStatus !== "all" && record.slaStatus !== selectedStatus) return false;
    if (query && !normalizeHeader([record.invoice,record.order,record.wave,record.waveId,record.load,record.carrier].join(" ")).includes(query)) return false;
    return exact.every(([selector,field]) => !$(selector).value || record[field] === $(selector).value);
  });
}

function groupSlaRecords(records, field) {
  const groups = new Map();
  records.forEach(record => { const key = record[field] || "Não informado"; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); });
  const risk = { overdue:0, critical:1, today:2, safe:3, notApplicable:4 };
  return Array.from(groups, ([name,items]) => ({ name, items, minRisk: Math.min(...items.map(item => risk[item.slaStatus])), minDue: Math.min(...items.map(item => item.dueStamp)) }))
    .sort((a,b) => a.minRisk - b.minRisk || a.minDue - b.minDue || b.items.length - a.items.length);
}

function slaCounts(records) {
  const counts = { safe:0,today:0,critical:0,overdue:0,notApplicable:0 };
  records.forEach(record => counts[record.slaStatus]++); return counts;
}

function slaGroupHtml(group, index) {
  const counts = slaCounts(group.items), total = group.items.length;
  const part = value => (value / total * 100).toFixed(2) + "%";
  return '<button class="sla-group" data-sla-group-index="' + index + '"><div class="sla-group-head"><strong>' + escapeHtml(group.name) + '</strong><span>' + fmt(total) + ' pedidos · ' + fmt(group.items.reduce((sum,item)=>sum+item.volumes,0)) + ' volumes</span></div><div class="sla-group-stats"><span class="sla-chip red">🔴 ' + fmt(counts.overdue) + ' vencidos</span><span class="sla-chip orange">🟠 ' + fmt(counts.critical) + ' críticos</span><span class="sla-chip yellow">🟡 ' + fmt(counts.today) + ' hoje</span><span class="sla-chip green">🟢 ' + fmt(counts.safe) + ' dentro</span>'+(counts.notApplicable?'<span class="sla-chip gray">Sem SLA '+fmt(counts.notApplicable)+'</span>':'')+'</div><div class="sla-riskbar"><i style="width:' + part(counts.overdue) + ';background:#ef4444"></i><i style="width:' + part(counts.critical) + ';background:#f97316"></i><i style="width:' + part(counts.today) + ';background:#eab308"></i><i style="width:' + part(counts.safe) + ';background:#22c55e"></i><i style="width:' + part(counts.notApplicable) + ';background:#94a3b8"></i></div></button>';
}

function priorityGroups(records) {
  const urgent = records.filter(record => ["overdue","critical","today"].includes(record.slaStatus));
  const groups = new Map();
  urgent.forEach(record => { const key = record.carrier + "||" + record.load; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); });
  return Array.from(groups, ([key,items]) => ({ key, carrier:items[0].carrier, load:items[0].load, sector:items[0].sector, items, due:Math.min(...items.map(item=>item.dueStamp)) }))
    .sort((a,b) => a.due - b.due || b.items.length - a.items.length).slice(0,7);
}

function renderSlaCentral(refreshFilters) {
  const all = enrichedSlaRecords(), applicable = all.filter(record=>record.slaApplicable), counts = slaCounts(applicable);
  $("#sla-total").textContent=fmt(applicable.length); $("#sla-safe").textContent=fmt(counts.safe); $("#sla-today").textContent=fmt(counts.today); $("#sla-critical").textContent=fmt(counts.critical); $("#sla-overdue").textContent=fmt(counts.overdue);
  if (refreshFilters) populateSlaFilters(all);
  document.querySelectorAll(".sla-kpi").forEach(card => card.classList.toggle("active", (card.dataset.slaStatus || "") === (slaUi.status || "all")));
  const filtered = filteredSlaRecords(all), field=$("#sla-group").value, labels={carrier:"transportadora",wave:"onda",load:"carga",status:"status atual",importHour:"horário de importação"};
  const groups=groupSlaRecords(filtered,field); slaUi.visibleGroups=groups;
  $("#sla-group-title").textContent="Risco por " + labels[field]; $("#sla-result-count").textContent=fmt(filtered.length)+" pedidos exibidos em "+fmt(groups.length)+" grupos";
  $("#sla-groups").innerHTML=groups.length?groups.map(slaGroupHtml).join(""):'<div class="sla-empty">Nenhum pedido corresponde aos filtros selecionados.</div>';
  const priorities=priorityGroups(slaUi.war?filtered:applicable); slaUi.priorityGroups=priorities;
  $("#sla-priorities").innerHTML=priorities.length?priorities.map((group,index)=>'<button class="priority-item" data-sla-priority-index="'+index+'"><span class="priority-rank">'+(index+1)+'º</span><span><strong>'+escapeHtml(carrierShort(group.carrier))+' · '+escapeHtml(group.load)+'</strong><small>'+fmt(group.items.length)+' pedidos · '+escapeHtml(group.sector)+'</small></span><span class="priority-time">'+escapeHtml(humanDuration(group.due-Date.now()))+'</span></button>').join(""):'<div class="sla-empty">Nenhuma prioridade imediata.</div>';
  const next=applicable.filter(record=>record.remaining>=0).sort((a,b)=>a.dueStamp-b.dueStamp)[0]; $("#sla-countdown").textContent=next?humanDuration(next.remaining):"Sem prazo futuro";
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

function closeSlaDrawer(){$("#sla-drawer").classList.remove("show");$("#sla-drawer-backdrop").classList.remove("show")}

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

const profileTypeLabels={hours:"SLA por horas",same_day:"Mesmo dia",next_business_day:"Próximo dia útil",fixed_date:"Data fixa",custom:"Regra personalizada"},profileSourceLabels={imported:"Data/Hora Importação",billed:"Data/Hora Faturamento",conference:"Data/Hora Conferência",other:"Data de cadastro"};
function profileRuleSummary(profile){const rule=profile.rule||{},calendar=profile.calendar||{},parts=[];parts.push(profileTypeLabels[rule.type]||"Regra não definida");if(rule.type==="hours")parts.push((Number(rule.hours)||0)+" horas a partir de "+(profileSourceLabels[rule.source]||"origem"));if(rule.type==="same_day")parts.push("Origem até "+rule.cutoff+" · expedir até "+rule.deadlineTime+" do mesmo dia útil");if(rule.type==="next_business_day")parts.push("Origem até "+rule.cutoff+" · expedir no próximo dia útil às "+rule.deadlineTime);if(rule.type==="fixed_date")parts.push("Expedir em "+(rule.fixedDate||"data não definida")+" às "+rule.fixedTime);if(rule.type==="custom")parts.push((Number(rule.offsetDays)||0)+" dia(s) e "+(Number(rule.offsetHours)||0)+" hora(s) adicionais");const alerts=((profile.alerts||{}).thresholdMinutes||[]);if(alerts.length)parts.push("Alertas: "+alerts.join(", ")+" min antes");if((calendar.holidayDates||[]).length)parts.push((calendar.holidayDates||[]).length+" feriado(s) cadastrado(s)");if((profile.exceptions||[]).length)parts.push("Exceções: "+profile.exceptions.join("; "));return parts.join(". ")+"."}
function checkedValues(container){return Array.from(document.querySelectorAll(container+' input[type="checkbox"]:checked')).map(input=>input.value)}
function selectedValues(selector){return Array.from($(selector).selectedOptions).map(option=>option.value)}
function profileFromForm(){return{id:$("#sla-profile-id").value||("sla_"+Date.now()+"_"+Math.random().toString(36).slice(2,7)),schemaVersion:3,name:$("#sla-profile-name").value.trim(),description:$("#sla-profile-description").value.trim(),active:$("#sla-profile-active").value==="1",priority:Math.max(1,Number($("#sla-profile-priority").value)||100),notes:$("#sla-profile-notes").value.trim(),match:{mode:$("#sla-profile-match-mode").value,allCarriers:$("#sla-profile-all-transporters").checked,carriers:selectedValues("#sla-profile-transporters"),allServices:$("#sla-profile-all-carriers").checked,services:selectedValues("#sla-profile-carriers"),series:checkedValues("#sla-profile-series"),statuses:checkedValues("#sla-profile-statuses"),clients:[],ufs:[],priorities:[]},rule:{type:$("#sla-profile-type").value,source:$("#sla-profile-source").value,hours:Number($("#sla-profile-hours").value)||0,cutoff:$("#sla-profile-cutoff").value,deadlineTime:$("#sla-profile-deadline-time").value,fixedDate:$("#sla-profile-fixed-date").value,fixedTime:$("#sla-profile-fixed-time").value,offsetDays:Number($("#sla-profile-offset-days").value)||0,offsetHours:Number($("#sla-profile-offset-hours").value)||0},calendar:{businessDays:checkedValues("#sla-profile-business-days").map(Number),holidayDates:String($("#sla-profile-holidays").value||"").split(/[,;]+/).map(value=>value.trim()).filter(value=>/^\d{2}\/\d{2}\/\d{4}$/.test(value))},alerts:{thresholdMinutes:Array.from(new Set(String($("#sla-profile-alerts").value||"").split(/[,;\s]+/).map(Number).filter(value=>value>0))).sort((a,b)=>b-a)},exceptions:String($("#sla-profile-exceptions").value||"").split(/\n+/).map(value=>value.trim()).filter(Boolean),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}
function renderProfileChecks(){const series=["17","11","14","Vazia","Todas"],standard=["Conferência Iniciada","Conferência Concluída","Enviado para Faturamento","Faturado","Coleta Iniciada","Processado"],fromCsv=currentMetrics.slaRecords.map(item=>item.status),statuses=Array.from(new Set([...standard,...fromCsv].filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR"));$("#sla-profile-series").innerHTML=series.map(value=>'<label class="profile-check"><input type="checkbox" value="'+escapeHtml(value)+'"> '+escapeHtml(value)+"</label>").join("");$("#sla-profile-statuses").innerHTML=statuses.map(value=>'<label class="profile-check"><input type="checkbox" value="'+escapeHtml(value)+'"> '+escapeHtml(value)+"</label>").join("");$("#sla-profile-business-days").innerHTML=pickupDayNames.map((value,index)=>'<label class="profile-check"><input type="checkbox" value="'+index+'" '+(index>=1&&index<=5?'checked':'')+'> '+value.slice(0,3)+"</label>").join("")}
function profileServices(){return Array.from(new Set((currentMetrics.slaRecords||[]).map(item=>item.service).filter(value=>value&&value!=="Serviço não informado"))).sort((a,b)=>a.localeCompare(b,"pt-BR"))}
function renderPrettyServiceSelect(query=""){const select=$("#sla-profile-carriers"),picker=$("#sla-service-picker");if(!select||!picker)return;const selected=selectedValues("#sla-profile-carriers"),normalizedQuery=normalizeHeader(query),options=Array.from(select.options).filter(option=>!option.disabled&&(!normalizedQuery||normalizeHeader(option.textContent).includes(normalizedQuery)));const values=picker.querySelector(".pretty-selected-values"),list=picker.querySelector(".pretty-options");if(!values||!list)return;values.innerHTML=selected.length?(selected.slice(0,2).map(value=>'<span class="pretty-value-chip">'+escapeHtml(value)+'</span>').join("")+(selected.length>2?'<span class="pretty-count">+'+(selected.length-2)+'</span>':"")):'<span class="pretty-placeholder">Selecione um ou mais serviços</span>';list.innerHTML=options.length?options.map(option=>'<label class="pretty-option '+(option.selected?'selected':'')+'"><input type="checkbox" data-pretty-service="'+escapeHtml(option.value)+'" '+(option.selected?'checked':'')+'><span>'+escapeHtml(option.textContent)+'</span>'+(option.selected?'<small>Selecionado</small>':'')+'</label>').join(""):'<div class="pretty-empty">Nenhum serviço encontrado</div>'}
function enhanceServiceSelect(){const select=$("#sla-profile-carriers");if(!select||$("#sla-service-picker"))return;select.classList.add("pretty-multiselect-native");select.insertAdjacentHTML("afterend",'<div class="pretty-multiselect" id="sla-service-picker"><button type="button" class="pretty-multiselect-trigger" aria-expanded="false"><span class="pretty-selected-values"><span class="pretty-placeholder">Selecione um ou mais serviços</span></span><b class="pretty-chevron">⌄</b></button><div class="pretty-multiselect-menu"><div class="pretty-search-wrap"><input class="pretty-multiselect-search" placeholder="Pesquisar serviço..."></div><div class="pretty-options"></div></div></div>');const picker=$("#sla-service-picker"),trigger=picker.querySelector(".pretty-multiselect-trigger"),search=picker.querySelector(".pretty-multiselect-search");trigger.addEventListener("click",()=>{const willOpen=!picker.classList.contains("open");document.querySelectorAll(".pretty-multiselect.open").forEach(item=>item.classList.remove("open"));picker.classList.toggle("open",willOpen);trigger.setAttribute("aria-expanded",String(willOpen));if(willOpen)setTimeout(()=>search.focus(),0)});picker.querySelector(".pretty-multiselect-menu").addEventListener("click",event=>event.stopPropagation());search.addEventListener("input",()=>renderPrettyServiceSelect(search.value));picker.querySelector(".pretty-options").addEventListener("change",event=>{const input=event.target.closest("[data-pretty-service]");if(!input)return;const option=Array.from(select.options).find(item=>item.value===input.dataset.prettyService);if(option)option.selected=input.checked;select.dispatchEvent(new Event("change",{bubbles:true}));renderPrettyServiceSelect(search.value);updateProfileSummary()});document.addEventListener("click",event=>{if(!picker.contains(event.target)){picker.classList.remove("open");trigger.setAttribute("aria-expanded","false")}});renderPrettyServiceSelect()}
function profileTransporters(){return Array.from(new Set((currentMetrics.slaRecords||[]).map(item=>item.carrier).filter(value=>value&&value!=="Transportadora não informada"))).sort((a,b)=>a.localeCompare(b,"pt-BR"))}
function updateProfileMatchVisibility(){const mode=$("#sla-profile-match-mode")?.value||"service",showCarrier=mode!=="service",showService=mode!=="carrier";document.querySelectorAll("[data-profile-carrier-match]").forEach(item=>item.hidden=!showCarrier);document.querySelectorAll("[data-profile-service-match]").forEach(item=>item.hidden=!showService)}
function ensureProfileMatchFields(){if($("#sla-profile-match-mode"))return;const serviceToggle=$("#sla-profile-all-carriers")?.parentElement,serviceField=$("#sla-profile-carriers")?.closest(".sla-field");if(!serviceToggle||!serviceField)return;serviceToggle.dataset.profileServiceMatch="";serviceField.dataset.profileServiceMatch="";const block=document.createElement("div");block.className="profile-match-config";block.innerHTML='<div class="sla-field span-2"><label>Validar SLA por</label><select id="sla-profile-match-mode"><option value="service">Somente Serviço da Transportadora</option><option value="carrier">Somente Transportadora</option><option value="both">Transportadora e Serviço</option><option value="either">Transportadora ou Serviço</option></select><small>Define como a Central de SLA associa cada pedido a este perfil.</small></div><label class="profile-toggle span-2" data-profile-carrier-match><input type="checkbox" id="sla-profile-all-transporters"> Todas as transportadoras</label><div class="sla-field span-2" data-profile-carrier-match><label>Transportadora · seleção múltipla</label><select id="sla-profile-transporters" multiple size="5"><option disabled>Importe o CSV para listar</option></select></div>';serviceToggle.closest(".profile-section").insertBefore(block,serviceToggle);$("#sla-profile-match-mode").addEventListener("change",updateProfileMatchVisibility)}
function populateProfileCarriers(){ensureProfileMatchFields();const select=$("#sla-profile-carriers"),selected=selectedValues("#sla-profile-carriers"),services=profileServices();select.innerHTML=services.length?services.map(value=>'<option value="'+escapeHtml(value)+'">'+escapeHtml(value)+"</option>").join(""):'<option disabled>Importe o CSV para listar os serviços</option>';Array.from(select.options).forEach(option=>option.selected=selected.includes(option.value));enhanceServiceSelect();renderPrettyServiceSelect();const transporterSelect=$("#sla-profile-transporters"),selectedTransporters=selectedValues("#sla-profile-transporters"),transporters=profileTransporters();transporterSelect.innerHTML=transporters.length?transporters.map(value=>'<option value="'+escapeHtml(value)+'">'+escapeHtml(value)+"</option>").join(""):'<option disabled>Importe o CSV para listar as transportadoras</option>';Array.from(transporterSelect.options).forEach(option=>option.selected=selectedTransporters.includes(option.value));const allLabel=$("#sla-profile-all-carriers")?.parentElement,fieldLabel=select?.closest(".sla-field")?.querySelector("label"),description=$("#sla-profile-form-title")?.closest(".card-head")?.querySelector("p"),version=$("#sla-profile-form-title")?.closest(".card-head")?.querySelector(".profile-version");if(allLabel)allLabel.lastChild.textContent=" Todos os serviços da transportadora";if(fieldLabel)fieldLabel.textContent="Serviço da Transportadora · seleção múltipla";if(description)description.textContent="Associe a regra por transportadora, serviço ou pela combinação dos dois";if(version)version.textContent="SCHEMA V3";updateProfileMatchVisibility()}
function updateProfileRuleFields(){const type=$("#sla-profile-type").value;document.querySelectorAll(".profile-rule-field").forEach(field=>field.hidden=!field.dataset.ruleTypes.split(" ").includes(type));updateProfileSummary()}
function updateProfileSummary(){if(!$("#sla-profile-summary"))return;$("#sla-profile-summary").textContent=profileRuleSummary(profileFromForm())}
function clearProfileForm(){$("#sla-profile-form").reset();$("#sla-profile-id").value="";$("#sla-profile-priority").value="100";$("#sla-profile-alerts").value="120, 60, 30";$("#sla-profile-form-title").textContent="Novo perfil";renderProfileChecks();populateProfileCarriers();$("#sla-profile-match-mode").value="service";updateProfileMatchVisibility();updateProfileRuleFields()}
function setChecked(container,values){document.querySelectorAll(container+' input[type="checkbox"]').forEach(input=>input.checked=(values||[]).map(String).includes(input.value))}
function editSlaProfile(profile){clearProfileForm();const match=profile.match||{},legacyUsesService=profile.schemaVersion>=2||Array.isArray(match.services)||match.allServices!==undefined,mode=match.mode||(legacyUsesService?"service":"carrier"),services=match.services||[],carriers=match.carriers||[];$("#sla-profile-id").value=profile.id;$("#sla-profile-name").value=profile.name||"";$("#sla-profile-description").value=profile.description||"";$("#sla-profile-active").value=profile.active?"1":"0";$("#sla-profile-priority").value=profile.priority||100;$("#sla-profile-notes").value=profile.notes||"";$("#sla-profile-match-mode").value=mode;$("#sla-profile-all-transporters").checked=Boolean(match.allCarriers);Array.from($("#sla-profile-transporters").options).forEach(option=>option.selected=carriers.includes(option.value));$("#sla-profile-all-carriers").checked=Boolean(match.allServices);Array.from($("#sla-profile-carriers").options).forEach(option=>option.selected=services.includes(option.value));renderPrettyServiceSelect();setChecked("#sla-profile-series",match.series);setChecked("#sla-profile-statuses",match.statuses);const rule=profile.rule||{};$("#sla-profile-type").value=rule.type||"hours";$("#sla-profile-source").value=rule.source||"imported";[["#sla-profile-hours",rule.hours],["#sla-profile-cutoff",rule.cutoff],["#sla-profile-deadline-time",rule.deadlineTime],["#sla-profile-fixed-date",rule.fixedDate],["#sla-profile-fixed-time",rule.fixedTime],["#sla-profile-offset-days",rule.offsetDays],["#sla-profile-offset-hours",rule.offsetHours]].forEach(([selector,value])=>{if(value!=null)$(selector).value=value});setChecked("#sla-profile-business-days",(profile.calendar||{}).businessDays);$("#sla-profile-holidays").value=((profile.calendar||{}).holidayDates||[]).join(", ");$("#sla-profile-alerts").value=((profile.alerts||{}).thresholdMinutes||[]).join(", ");$("#sla-profile-exceptions").value=(profile.exceptions||[]).join("\n");$("#sla-profile-form-title").textContent="Editar · "+profile.name;updateProfileMatchVisibility();updateProfileRuleFields();$("#page-sla-profiles").scrollIntoView({behavior:"smooth"})}
function profileMatchLabel(profile){const match=profile.match||{},legacyUsesService=profile.schemaVersion>=2||Array.isArray(match.services)||match.allServices!==undefined,mode=match.mode||(legacyUsesService?"service":"carrier"),labels={service:"Serviço",carrier:"Transportadora",both:"Transportadora e Serviço",either:"Transportadora ou Serviço"},carrierCount=match.allCarriers?"todas":fmt((match.carriers||[]).length),serviceCount=match.allServices?"todos":fmt((match.services||[]).length);if(mode==="carrier")return labels[mode]+" · "+carrierCount;if(mode==="service")return labels[mode]+" · "+serviceCount;return labels[mode]+" · "+carrierCount+" transp. / "+serviceCount+" serv."}
function renderSlaProfileList(){const sorted=[...slaProfiles].sort((a,b)=>(Number(a.priority)||9999)-(Number(b.priority)||9999)||a.name.localeCompare(b.name,"pt-BR"));$("#sla-profile-count").textContent=fmt(sorted.length)+" perfil(is)";$("#sla-profile-list").innerHTML=sorted.length?'<div class="profile-row header"><span>Perfil</span><span>Validação</span><span>Tipo</span><span>SLA</span><span>Situação</span><span>Ações</span></div>'+sorted.map(profile=>'<div class="profile-row"><span><strong>'+escapeHtml(profile.name)+'</strong><small>Prioridade '+fmt(profile.priority)+'</small></span><strong>'+escapeHtml(profileMatchLabel(profile))+'</strong><span>'+escapeHtml(profileTypeLabels[(profile.rule||{}).type]||"—")+'</span><span><small>'+escapeHtml(profileRuleSummary(profile))+'</small></span><span><i class="profile-status '+(profile.active?'':'off')+'">'+(profile.active?'Ativo':'Inativo')+'</i></span><span class="profile-actions"><button data-profile-action="edit" data-profile-id="'+profile.id+'">Editar</button><button data-profile-action="duplicate" data-profile-id="'+profile.id+'">Duplicar</button><button data-profile-action="delete" data-profile-id="'+profile.id+'">Excluir</button></span></div>').join(""):'<div class="profile-empty"><strong>Nenhum perfil cadastrado</strong><br>Pedidos continuarão pesquisáveis, mas aparecerão como SLA não configurado.</div>'}
function refreshSlaConsumers(){renderSlaProfileList();renderSlaCentral(true);renderIo(currentMetrics);renderPickupDashboard()}
function pickupCarriers(metrics){return Array.from(new Set([...(metrics.ioOrders||[]),...(metrics.slaRecords||[])].map(item=>item.carrier).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR"))}
function populatePickupCarrier(metrics){const select=$("#pickup-carrier"),current=select.value,carriers=pickupCarriers(metrics);select.innerHTML='<option value="">Selecione a transportadora</option>'+carriers.map(carrier=>'<option value="'+escapeHtml(carrier)+'">'+escapeHtml(carrier)+'</option>').join('');if(carriers.includes(current))select.value=current}
function loadPickupForm(carrier){const schedule=carrierSchedule(carrier)||{};document.querySelectorAll("[data-pickup-day]").forEach(input=>input.value=(schedule[input.dataset.pickupDay]||[]).join(", "))}
function renderPickupSavedList(){const names=Object.keys(pickupSchedules).sort((a,b)=>a.localeCompare(b,"pt-BR"));$("#pickup-saved-list").innerHTML=names.length?names.map(name=>{const schedule=pickupSchedules[name],summary=pickupDayNames.map((day,index)=>(schedule[String(index)]||[]).length?day.slice(0,3)+" "+schedule[String(index)].join("/"):"").filter(Boolean).join(" · ");return '<div class="pickup-saved-item"><span><strong>'+escapeHtml(name)+'</strong><small>'+escapeHtml(summary||"Sem horários")+'</small></span><button class="danger-mini" data-delete-pickup="'+escapeHtml(name)+'">Excluir</button></div>'}).join(''):'<div class="io-empty">Nenhuma grade cadastrada.</div>'}
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
  const table='<article class="card"><div class="card-head"><div><h2>Grade semanal completa</h2><p>Série 17 em fluxo e Série 14 acima de 3 dias para FL Brasil, Viviane e Patrus</p></div></div><div class="pickup-table"><div class="pickup-table-row header"><span>Transportadora</span>'+pickupDayNames.map(day=>'<span>'+day.slice(0,3)+'</span>').join('')+'<span>Alerta</span></div>'+(rows||'<div class="io-empty">Nenhuma grade cadastrada.</div>')+'</div></article>';
  $("#pickup-dashboard").innerHTML=nextHtml+week+table;
}

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
  renderIo(metrics);
  populatePickupCarrier(metrics);renderPickupSavedList();renderPickupDashboard();renderProfileChecks();populateProfileCarriers();renderSlaProfileList();updateProfileRuleFields();
}

function showToast(message, error) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = "toast show" + (error ? " error" : "");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.className = "toast", error ? 10000 : 3500);
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
  const pinGroups = isPin ? groupPinDetails(currentMetrics.pinDetails) : [];
  let pinContentHeight = 0;
  for (let index = 0; index < pinGroups.length; index += 2) {
    const leftHeight = 104 + pinGroups[index].orders.length * 46;
    const rightHeight = pinGroups[index + 1] ? 104 + pinGroups[index + 1].orders.length * 46 : 0;
    pinContentHeight += Math.max(leftHeight, rightHeight) + 24;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = isPin ? Math.max(1100, 250 + pinContentHeight) : 1120;
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
    "page-triados": "Triados por transportadora", "page-produtividade": "Produtividade", "page-io": "I.O · Inteligência Operacional", "page-pin": "Solicitação PIN",
    "page-conferencia-b2c": "Conferência Doca · B2C",
    "page-conferencia-b2b": "Conferência Doca · B2B",
    "page-faturamento": "Central inteligente de SLA", "page-transportadoras": "Transportadoras · Grade de coleta",
    "page-relatorios": "Relatórios", "page-sla-profiles": "Cadastro de Perfis de SLA", "page-configuracoes": "Configurações"
  };
  context.fillStyle = colors.background; context.fillRect(0, 0, canvas.width, canvas.height);
  drawText("LUFT · STATUS OPERACIONAL", 70, 55, 18, colors.blue, 800);
  drawText(pageTitles[pageId] || "Status operacional", 70, 108, 38, colors.text, 800);
  drawText(currentMetrics.fileName + " · " + fmt(currentMetrics.recordCount) + " registros", 70, 150, 15, colors.muted, 500);
  drawText(new Date().toLocaleString("pt-BR"), 1730, 70, 15, colors.muted, 600, "right");

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
  } else if (pageId === "page-io") {
    const io=calculateIo(currentMetrics),configured=ioConfig.metaB2c+ioConfig.metaB2b>0;
    const kpis=[["CONFIANÇA",io.confidence+"%",colors.blue],["TEMPO RESTANTE",clockDuration(io.shift.hours),"#8b5cf6"],["CAPACIDADE TOTAL",fmt(Math.floor(io.capacities.total)),"#22c55e"],["NECESSIDADE",fmt(Math.ceil(io.adjustedRemainingB2c+io.adjustedRemainingB2b)),"#f97316"]];
    kpis.forEach((item,index)=>{const x=70+index*415;rect(x,195,395,125,colors.panel,colors.line,13);drawText(item[0],x+20,225,11,colors.muted,800);drawText(item[1],x+20,275,31,colors.text,900);context.fillStyle=item[2];context.fillRect(x,313,395,7)});
    [["B2C",io.fatB2c,ioConfig.metaB2c,io.adjustedRemainingB2c,io.capacities.b2c],["B2B",io.fatB2b,ioConfig.metaB2b,io.adjustedRemainingB2b,io.capacities.b2b]].forEach((item,index)=>{const x=70+index*835;rect(x,360,805,165,colors.panel,colors.line,13);drawText("META "+item[0],x+22,390,14,colors.text,900);[["PRODUZIDO",item[1]],["META",item[2]],["FALTA AJUSTADA",item[3]],["CAPACIDADE",Math.floor(item[4])]].forEach((field,column)=>{const fx=x+22+column*190;drawText(field[0],fx,430,9,colors.muted,800);drawText(fmt(field[1]),fx,468,24,colors.text,900)});drawText(item[4]>=item[3]?"✓ Capacidade suficiente":"⚠ Déficit de "+fmt(Math.ceil(item[3]-item[4])),x+22,505,12,item[4]>=item[3]?"#22c55e":"#ef4444",800)});
    drawText("RANKING INTELIGENTE",70,575,15,colors.text,900);io.waves.slice(0,6).forEach((wave,index)=>{const y=610+index*66;rect(70,y,790,52,colors.panel,colors.line,9);drawText((index+1)+"º",90,y+26,13,colors.blue,900);drawText("Onda "+wave.wave+" · "+wave.segment.toUpperCase()+(wave.slaRisk?" · SLA CRÍTICO":""),135,y+18,12,colors.text,800);drawText(fmt(wave.pieces)+" peças · índice "+wave.opportunityScore,135,y+36,10,colors.muted,600)});
    drawText("LEITURA EXECUTIVA",910,575,15,colors.text,900);rect(910,610,820,280,colors.panel,colors.line,13);const top=io.waves[0];drawText(configured?(io.capacities.total>=io.adjustedRemainingB2c+io.adjustedRemainingB2b?"Meta alcançável":"Intervenção necessária") : "Configure metas e equipe",940,650,20,colors.text,900);drawText("Tempo restante: "+clockDuration(io.shift.hours),940,690,13,colors.muted,700);drawText("Pedidos críticos de SLA: "+fmt(io.urgentSla.length),940,725,13,io.urgentSla.length?"#ef4444":"#22c55e",700);drawText(top?"Melhor ação: iniciar Onda "+top.wave+" ("+top.segment.toUpperCase()+")":"Nenhuma onda pendente disponível",940,765,15,colors.blue,800);drawText("Capacidade calculada pela menor vazão entre separação e faturamento.",940,815,12,colors.muted,600);
  } else if (pageId === "page-faturamento") {
    const records = enrichedSlaRecords().filter(record=>record.slaApplicable), counts = slaCounts(records), priorities = priorityGroups(records);
    const cards = [["TOTAL PENDENTE",records.length,colors.blue],["DENTRO DO SLA",counts.safe,"#22c55e"],["VENCEM HOJE",counts.today,"#eab308"],["CRÍTICO · <2H",counts.critical,"#f97316"],["FORA DO SLA",counts.overdue,"#ef4444"]];
    cards.forEach((item,index)=>{const x=70+index*332;rect(x,195,310,125,colors.panel,colors.line,13);drawText(item[0],x+20,225,11,colors.muted,800);drawText(fmt(item[1]),x+20,275,34,colors.text,900);context.fillStyle=item[2];context.fillRect(x,313,310,7)});
    drawText("PRIORIDADES DA OPERAÇÃO",70,370,16,colors.text,800);
    priorities.slice(0,6).forEach((group,index)=>{const y=405+index*82;rect(70,y,760,66,colors.panel,colors.line,10);drawText((index+1)+"º",92,y+33,15,colors.blue,900);drawText(fitText(carrierShort(group.carrier)+" · "+group.load,430),140,y+24,14,colors.text,800);drawText(fmt(group.items.length)+" pedidos · "+group.sector,140,y+45,11,colors.muted,600);drawText(humanDuration(group.due-Date.now()),805,y+33,12,"#ef4444",800,"right")});
    drawText("RISCO POR TRANSPORTADORA",900,370,16,colors.text,800);
    groupSlaRecords(records,"carrier").slice(0,8).forEach((group,index)=>{const y=405+index*70,c=slaCounts(group.items);rect(900,y,830,55,colors.panel,colors.line,9);drawText(fitText(group.name,370),920,y+20,12,colors.text,800);drawText(fmt(group.items.length)+" pedidos",920,y+39,10,colors.muted,600);drawText("🔴 "+fmt(c.overdue)+"   🟠 "+fmt(c.critical)+"   🟡 "+fmt(c.today)+"   🟢 "+fmt(c.safe),1705,y+28,12,colors.text,700,"right")});
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
    link.href = url; link.download = pageId.replace("page-", "") + "-luft-" + new Date().toISOString().slice(0, 10) + ".png";
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

function exportCurrentPageImage() {
  if (!currentMetrics.fileName) return showToast("Importe um CSV antes de exportar a imagem.", true);
  closeExportMenu();setExportBusy(true);
  const activePage = document.querySelector(".page.active");
  if (!activePage || activePage.id === "page-dashboard") return exportDashboardImage();
  exportDetailPageImage(activePage.id);
}

function validateCsvFile(file){if(!file)return"Nenhum arquivo foi selecionado.";if(!/\.csv$/i.test(file.name))return"Selecione um arquivo com extensão .csv.";if(!file.size)return"O arquivo CSV está vazio.";if(file.size>200*1024*1024)return"O arquivo excede o limite local de 200 MB.";return""}
$("#csv-input").addEventListener("change",async event=>{const file=event.target.files[0];if(!file)return;$("#processing").classList.add("show");$("#processing-title").textContent="Processando CSV…";$("#processing-detail").textContent="A análise está sendo executada localmente; nenhum dado será enviado.";$("#processing-steps").innerHTML="";try{const validationError=validateCsvFile(file);if(validationError)throw new Error(validationError);const buffer=await file.arrayBuffer();const metrics=await calculateMetricsAsync(buffer,file.name);currentMetrics=metrics;render(currentMetrics);showToast(fmt(metrics.recordCount)+" registros analisados com sucesso.")}catch(error){console.error(error);showToast(error.message||"Não foi possível processar o CSV.",true)}finally{$("#processing").classList.remove("show");event.target.value=""}});

$("#export-summary").addEventListener("click", exportSummary);
$("#export-image").addEventListener("click",event=>{event.stopPropagation();const control=$("#export-control"),open=control.classList.toggle("open");$("#export-image").setAttribute("aria-expanded",String(open))});
$("#export-current-page").addEventListener("click",exportCurrentPageImage);
$("#export-dashboard").addEventListener("click",()=>{if(!currentMetrics.fileName)return showToast("Importe um CSV antes de exportar a imagem.",true);closeExportMenu();setExportBusy(true);exportDashboardImage()});
$("#export-menu").addEventListener("click",event=>event.stopPropagation());
document.addEventListener("click",closeExportMenu);
document.querySelectorAll(".sla-kpi").forEach(card => card.addEventListener("click", () => {
  slaUi.status = card.dataset.slaStatus === "all" ? "" : card.dataset.slaStatus;
  $("#sla-filter").value = slaUi.status; renderSlaCentral(false);
}));
let slaSearchTimer = 0;
["#sla-search","#sla-group","#sla-carrier","#sla-wave","#sla-load","#sla-order-status","#sla-service","#sla-series","#sla-filter","#sla-date","#sla-shift"].forEach(selector => {
  $(selector).addEventListener(selector === "#sla-search" ? "input" : "change", () => {
    if (selector === "#sla-filter") slaUi.status = $(selector).value;
    if (selector !== "#sla-search") return renderSlaCentral(false);
    clearTimeout(slaSearchTimer);
    slaSearchTimer = setTimeout(() => renderSlaCentral(false), 180);
  });
});
$("#sla-clear").addEventListener("click", () => {
  $("#sla-search").value=""; ["#sla-carrier","#sla-wave","#sla-load","#sla-order-status","#sla-service","#sla-series","#sla-filter","#sla-date","#sla-shift"].forEach(selector=>$(selector).value="");
  slaUi.status=""; renderSlaCentral(false);
});
$("#war-mode").addEventListener("click", () => {
  slaUi.war=!slaUi.war; $("#page-faturamento").classList.toggle("war-mode",slaUi.war); $("#war-mode").classList.toggle("active",slaUi.war);
  $("#war-mode").textContent=slaUi.war?"✕ Encerrar Modo Guerra":"⚡ Modo Guerra"; renderSlaCentral(false);
});
$("#sla-groups").addEventListener("click",event=>{const button=event.target.closest("[data-sla-group-index]");if(button){const group=slaUi.visibleGroups[Number(button.dataset.slaGroupIndex)];openSlaDrawer(group.items,group.name)}});
$("#sla-priorities").addEventListener("click",event=>{const button=event.target.closest("[data-sla-priority-index]");if(button){const group=slaUi.priorityGroups[Number(button.dataset.slaPriorityIndex)];openSlaDrawer(group.items,group.load+" · "+carrierShort(group.carrier))}});
$("#sla-drawer-body").addEventListener("click",event=>{const more=event.target.closest("#sla-drawer-more");if(more){slaUi.drawerPage++;return renderSlaDrawerPage()}const button=event.target.closest("[data-sla-record-index]");if(button)showSlaRecord(Number(button.dataset.slaRecordIndex))});
$("#sla-drawer-close").addEventListener("click",closeSlaDrawer); $("#sla-drawer-backdrop").addEventListener("click",()=>{closeSlaDrawer();if(typeof closeIoSettings==="function")closeIoSettings()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeSlaDrawer();closeExportMenu();if(typeof closeIoSettings==="function")closeIoSettings()}});
setInterval(()=>{if(!currentMetrics.fileName||document.hidden)return;const page=document.querySelector(".page.active")?.id;if(page==="page-faturamento"&&currentMetrics.slaRecords.length)renderSlaCentral(false);else if(page==="page-io")renderIo(currentMetrics);else if(page==="page-transportadoras")renderPickupDashboard()},60000);
renderProfileChecks();populateProfileCarriers();renderSlaProfileList();clearProfileForm();
const ioInputs={metaB2c:"#io-meta-b2c",metaB2b:"#io-meta-b2b",rateSepB2c:"#io-rate-sep-b2c",rateFatB2c:"#io-rate-fat-b2c",rateSepB2b:"#io-rate-sep-b2b",rateFatB2b:"#io-rate-fat-b2b",teamSepB2c:"#io-team-sep-b2c",teamFatB2c:"#io-team-fat-b2c",teamSepB2b:"#io-team-sep-b2b",teamFatB2b:"#io-team-fat-b2b"};
function closeIoSettings(){$("#io-settings").classList.remove("show");$("#sla-drawer-backdrop").classList.remove("show")}
$("#io-open-settings").addEventListener("click",()=>{Object.entries(ioInputs).forEach(([key,selector])=>$(selector).value=ioConfig[key]);$("#io-settings").classList.add("show");$("#sla-drawer-backdrop").classList.add("show")});
$("#io-settings-close").addEventListener("click",closeIoSettings);$("#io-settings-cancel").addEventListener("click",closeIoSettings);
$("#io-settings-save").addEventListener("click",()=>{Object.entries(ioInputs).forEach(([key,selector])=>ioConfig[key]=Math.max(0,Number($(selector).value)||0));saveIoConfig();renderIo(currentMetrics);closeIoSettings();showToast("Configuração da I.O. salva e projeções recalculadas.")});
$("#pickup-carrier").addEventListener("change",event=>loadPickupForm(event.target.value));
$("#pickup-clear-form").addEventListener("click",()=>{$("#pickup-carrier").value="";loadPickupForm("")});
$("#pickup-save").addEventListener("click",()=>{const carrier=$("#pickup-carrier").value;if(!carrier)return showToast("Selecione uma transportadora do CSV.",true);const schedule={};document.querySelectorAll("[data-pickup-day]").forEach(input=>schedule[input.dataset.pickupDay]=validPickupTimes(input.value));if(!Object.values(schedule).some(times=>times.length))return showToast("Informe pelo menos um dia e horário de coleta.",true);pickupSchedules[carrier]=schedule;savePickupSchedules();renderPickupSavedList();renderPickupDashboard();renderSlaCentral(false);renderIo(currentMetrics);showToast("Grade de coleta salva para "+carrier+".")});
$("#pickup-saved-list").addEventListener("click",event=>{const button=event.target.closest("[data-delete-pickup]");if(!button)return;delete pickupSchedules[button.dataset.deletePickup];savePickupSchedules();renderPickupSavedList();renderPickupDashboard();renderSlaCentral(false);renderIo(currentMetrics);showToast("Grade de coleta removida.")});
$("#sla-profile-type").addEventListener("change",updateProfileRuleFields);$("#sla-profile-form").addEventListener("input",updateProfileSummary);$("#sla-profile-new").addEventListener("click",clearProfileForm);$("#sla-profile-cancel").addEventListener("click",clearProfileForm);
$("#sla-profile-form").addEventListener("submit",event=>{event.preventDefault();const profile=profileFromForm(),match=profile.match,carrierConfigured=match.allCarriers||match.carriers.length>0,serviceConfigured=match.allServices||match.services.length>0;if(!profile.name)return showToast("Informe o nome do perfil.",true);if(match.mode==="carrier"&&!carrierConfigured)return showToast("Selecione ao menos uma transportadora ou marque todas.",true);if(match.mode==="service"&&!serviceConfigured)return showToast("Selecione ao menos um Serviço da Transportadora ou marque todos.",true);if(match.mode==="both"&&(!carrierConfigured||!serviceConfigured))return showToast("Para validar por Transportadora e Serviço, configure os dois campos.",true);if(match.mode==="either"&&!carrierConfigured&&!serviceConfigured)return showToast("Configure ao menos uma transportadora ou um serviço.",true);if(!profile.match.series.length||!profile.match.statuses.length)return showToast("Selecione ao menos uma série e um status.",true);if(!profile.calendar.businessDays.length&&["same_day","next_business_day","custom"].includes(profile.rule.type))return showToast("Selecione ao menos um dia útil.",true);const existing=slaProfiles.find(item=>item.id===profile.id);if(existing)profile.createdAt=existing.createdAt||profile.createdAt;const index=slaProfiles.findIndex(item=>item.id===profile.id);if(index>=0)slaProfiles[index]=profile;else slaProfiles.push(profile);saveSlaProfiles();refreshSlaConsumers();clearProfileForm();showToast("Perfil de SLA salvo e aplicado em todo o sistema.")});
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
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  const page = button.dataset.page;
  if(["io","configuracoes","sla-profiles"].includes(page)&&!cloudState.isManager){showToast("Entre como gestor para acessar esta área.",true);showAuthModal();return}
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  document.querySelectorAll(".page").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  $("#page-" + page).classList.add("active");
  const title = button.childNodes[1].textContent.trim();
  $("#page-title").textContent = title;
  $("#breadcrumb").textContent = title.toUpperCase();
  if($("#export-current-label"))$("#export-current-label").textContent=title;
  $("#sidebar").classList.remove("open");
  $("#scrim").classList.remove("show");
}));
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
$("#access-button").addEventListener("click",()=>cloudState.isManager?showAuthModal():showAccessGateway());$("#auth-close").addEventListener("click",closeAuthModal);$("#operation-mode").addEventListener("click",enterOperationMode);$("#auth-backdrop").addEventListener("click",event=>{if(event.target===$("#auth-backdrop"))closeAuthModal()});
$("#manager-login-form").addEventListener("submit",async event=>{event.preventDefault();if(!cloudState.client){$("#auth-error").textContent="O Supabase ainda não foi configurado neste arquivo.";return}const email=$("#manager-email").value.trim(),password=$("#manager-password").value;$("#auth-error").textContent="Autenticando…";const {data,error}=await cloudState.client.auth.signInWithPassword({email,password});if(error){$("#auth-error").textContent="E-mail ou senha inválidos.";return}const allowed=await verifyManager(data.user);if(!allowed){await cloudState.client.auth.signOut();$("#auth-error").textContent="Este usuário não possui perfil de gestor ativo.";return}cloudState.user=data.user;cloudState.isManager=true;await pullCloudSettings(false);enterManagerMode();showToast("Acesso de gestor liberado · edição habilitada.")});
$("#manager-logout").addEventListener("click",async()=>{if(cloudState.client)await cloudState.client.auth.signOut();cloudState.user=null;cloudState.isManager=false;sessionStorage.removeItem("luft-access-mode");applyAccessMode();hideAuthModal();showAccessGateway();showToast("Sessão de gestor encerrada.")});
document.addEventListener("click",event=>{if(event.target?.id==="database-sync")syncAllSettings()});
initializeSupabase();
