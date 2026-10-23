/* Local persistence and exports. No network requests. */
window.BrowserData = (() => {
  function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('luft-local-data',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
  async function write(metrics){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(metrics,'metrics');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
  async function read(){const db=await database();try{return await new Promise((resolve,reject)=>{const request=db.transaction('data').objectStore('data').get('metrics');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}finally{db.close()}}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
  function snapshot(page){
    const root=document.getElementById(page),clone=root.cloneNode(true);
    clone.querySelectorAll('input,select').forEach((el,i)=>{const original=root.querySelectorAll('input,select')[i];el.replaceWith(document.createTextNode(original.type==='checkbox'?(original.checked?'Sim':'N\u00e3o'):original.selectedOptions?.[0]?.textContent||original.value))});
    clone.querySelectorAll('[data-screen-export],.prod-chart-scroll').forEach(el=>el.remove());
    const rows=[];
    function walk(node){if(node.tagName==='TABLE'){node.querySelectorAll('tr').forEach(tr=>rows.push([...tr.cells].map(c=>c.textContent.trim())));rows.push([]);return}if(node.children?.length){for(const child of node.childNodes)walk(child)}else if(node.textContent?.trim())rows.push([node.textContent.trim()])}
    walk(clone);return rows;
  }
  async function exportScreen(page,format='png'){
    try{
      const rows=snapshot(page),name=page.replace('page-','')+'-'+new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
      if(format==='csv'){const cell=v=>'"'+String(/^[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';download(new Blob(['\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),name+'.csv');return}
      await window.exportStyledScreen(page,name,download);
    }catch(error){console.error(error);showToast('N\u00e3o foi poss\u00edvel exportar a tela.',true)}
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-screen-export]');if(button)exportScreen(button.closest('.page').id,button.dataset.screenExport)});
  return {read,write,exportScreen};
})();
