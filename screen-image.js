/* Canvas reports using the same visual language as the overview export. */
window.exportStyledScreen = async function(page, name, download) {
  await window.CarrierBrands.ready();
  const root=document.getElementById(page),dark=document.body.dataset.theme==='dark';
  const c={background:dark?'#0b1220':'#f4f6f9',panel:dark?'#111b2e':'#ffffff',text:dark?'#e8eef9':'#172033',muted:dark?'#8fa0b8':'#7b8798',line:dark?'#25334a':'#e2e7ee',blue:'#3b82f6',green:'#22c55e',orange:'#f59e0b',cyan:'#06b6d4'};
  const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2400;
  const ctx=canvas.getContext('2d'),pages=[];let y=205;
  const text=(value,x,y,size=16,color=c.text,weight=500)=>{ctx.fillStyle=deliveryColor(value,color);ctx.font=weight+' '+size+'px "Segoe UI",Arial';ctx.textBaseline='alphabetic';ctx.fillText(String(value),window.CarrierBrands.draw(ctx,value,x,y,size,ctx.textAlign),y)};
  function rect(x,y,w,h,fill=c.panel,stroke=c.line){ctx.beginPath();ctx.roundRect(x,y,w,h,17);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
  function wrap(value,width,size=16){ctx.font='500 '+size+'px "Segoe UI",Arial';const lines=[];let line='';for(const word of String(value).trim().split(/\s+/)){if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=''}for(const char of word){if(ctx.measureText(line+char).width>width){lines.push(line);line=''}line+=char}line+=' '}if(line.trim())lines.push(line.trim());return lines.length?lines:['']}
  const clean=el=>el?.textContent.replace(/\s+/g,' ').trim()||'';
  const title=page==='page-produtividade'?'Produtividade':'Expedi\u00e7\u00e3o';
  const filters=[...root.querySelectorAll('input:not([type=file]),select')].map(el=>{if(el.type==='checkbox')return el.checked?clean(el.parentElement):'';const label=el.closest('label')?.firstChild?.textContent?.trim()||el.getAttribute('aria-label')||'';return (label?label+': ':'')+(el.selectedOptions?.[0]?.textContent||el.value||'Todos')}).filter(Boolean).join('  |  ');
  function header(){ctx.fillStyle=c.background;ctx.fillRect(0,0,1800,2400);text('LUFT \u00b7 STATUS OPERACIONAL',70,68,18,c.blue,800);text(title,70,122,40,c.text,800);text('Arquivo: '+(typeof currentMetrics!=='undefined'?currentMetrics.fileName:''),70,158,16,c.muted);ctx.textAlign='right';text(new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),1730,82,15,c.muted,600);ctx.textAlign='left';y=205}
  function finish(){text('Dados processados localmente \u00b7 CD Extrema  |  '+(pages.length+1),70,y+40,14,c.muted);const output=document.createElement('canvas');output.width=1800;output.height=y+75;output.getContext('2d').drawImage(canvas,0,0);pages.push(output)}
  function space(height){if(y+height>2300){finish();header();return true}return false}
  function banner(value){const lines=wrap(value,1580,16),height=42+lines.length*24;space(height);const gradient=ctx.createLinearGradient(70,0,1730,0);gradient.addColorStop(0,'#17233a');gradient.addColorStop(1,'#28477b');rect(70,y,1660,height,gradient,null);lines.forEach((line,i)=>text(line,100,y+33+i*24,16,'#ffffff',600));y+=height+24}
  header();banner(filters||'Vis\u00e3o operacional filtrada');
  const kpis=[...root.querySelectorAll('.prod-kpis article')];
  if(kpis.length){space(170);kpis.forEach((card,i)=>{const x=70+i*425,accent=[c.blue,c.green,c.orange,c.cyan][i];rect(x,y,390,145);wrap(clean(card.querySelector('small')),340,14).forEach((line,j)=>text(line.toUpperCase(),x+25,y+35+j*18,14,c.muted,700));text(clean(card.querySelector('strong')),x+25,y+108,43,c.text,800);ctx.fillStyle=accent;ctx.fillRect(x,y+138,390,7)});y+=170}
  function heading(title,subtitle){const lines=wrap(subtitle,1580,15),height=65+(subtitle?lines.length*22:0);space(height+90);rect(70,y,1660,height);const accent=deliveryColor(title,null);if(accent){ctx.fillStyle=accent;ctx.fillRect(70,y,5,height)}text(title,100,y+34,22,c.text,800);if(subtitle)lines.forEach((line,i)=>text(line,100,y+62+i*22,15,c.muted));y+=height+12}
  if(page==='page-produtividade'){
    const block=[...root.querySelectorAll('.prod-block')].find(card=>clean(card.querySelector('h2'))==='Comparativo dos turnos');
    const groups=new Map();
    for(const row of block?.querySelectorAll('tbody tr')||[]){const cells=[...row.cells].map(clean);if(!groups.has(cells[0]))groups.set(cells[0],[]);groups.get(cells[0]).push(cells)}
    const selected=root.querySelector('#productivity-shift')?.value;
    const turns=[...groups].filter((entry,index)=>!selected||index===({night:0,first:1,second:2}[selected]));
    if(turns.length){
      heading('Produ\u00e7\u00e3o por turno \u00b7 B2C e B2B','Total de pe\u00e7as por modelo de entrega \u00b7 etapa e filtros selecionados');
      space(250);const width=(1660-20*(turns.length-1))/turns.length;
      turns.forEach(([label,rows],index)=>{
        const x=70+index*(width+20);rect(x,y,width,220);ctx.fillStyle=c.blue;ctx.fillRect(x,y,5,220);
        const parts=label.split(' \u00b7 ');text(parts[0],x+26,y+36,23,c.text,800);text(parts[1]||'',x+26,y+62,15,c.muted);
        rows.forEach((cells,i)=>{const color=cells[1]==='B2C'?c.blue:DeliveryColors.b2b;text(cells[1]+' \u00b7 '+cells[2]+' pe\u00e7as',x+26,y+110+i*66,27,color,800);text(cells[3]+' pedidos  \u00b7  '+cells[4]+' volumes',x+26,y+134+i*66,15,c.muted)})
      });y+=250;
    }
  }
  for(const card of root.querySelectorAll('.prod-segments article,.prod-block,.shipping-grid article,.shipping-loaded')){
    const cardTitle=clean(card.querySelector('h2')),subtitle=clean(card.querySelector('.card-head p'));heading(cardTitle,subtitle);
    const values=[...card.querySelectorAll('.prod-segment-values>div,.shipping-summary>div')];
    if(values.length){space(130);const width=(1660-20*(values.length-1))/values.length;values.forEach((value,i)=>{const x=70+i*(width+20);rect(x,y,width,108);text(clean(value.querySelector('small')).toUpperCase(),x+24,y+33,14,c.muted,700);text(clean(value.querySelector('strong')),x+24,y+80,32,c.text,800)});y+=130}
    const chart=card.querySelector('.prod-chart');
    if(chart){space(290);rect(70,y,1660,265);const hours=[...chart.querySelectorAll('.prod-hour')],values=hours.map(hour=>[...hour.querySelectorAll('.prod-bar')].map(bar=>parseFloat(bar.style.height)||0));for(let h=0;h<24;h++){const x=112+h*65;values[h]?.forEach((value,i)=>{ctx.fillStyle=i?DeliveryColors.b2b:c.blue;ctx.fillRect(x+i*21,y+215-value*1.8,18,value*1.8)});text(String(h).padStart(2,'0')+'h',x,y+244,13,c.muted)}text('B2C',1500,y+28,14,c.blue,700);text('B2B',1580,y+28,14,DeliveryColors.b2b,700);y+=290}
    // Productivity reports end after the hourly chart.
    if(page==='page-produtividade'&&chart)break;
    for(const table of (chart?[]:card.querySelectorAll('table'))){
      const headers=[...table.querySelectorAll('thead th')].map(clean),n=headers.length;if(!n)continue;
      const width=1660/n;
      function tableHeader(){const lines=headers.map(value=>wrap(value,width-24,14)),height=Math.max(...lines.map(v=>v.length))*20+24;rect(70,y,1660,height,dark?'#1c2b43':'#e8eef7',null);lines.forEach((values,i)=>values.forEach((value,j)=>text(value,82+i*width,y+24+j*20,14,c.text,700)));y+=height}
      tableHeader();
      for(const row of table.querySelectorAll('tbody tr')){
        const cells=[...row.cells].map(cell=>wrap(clean(cell),width-24,15)),height=Math.max(1,...cells.map(v=>v.length))*21+22;
        if(space(height+8)){heading(cardTitle+' \u00b7 continua\u00e7\u00e3o','');tableHeader()}
        const best=row.classList.contains('prod-best'),worst=row.classList.contains('prod-worst'),priority=row.classList.contains('shipping-d1-row');
        ctx.fillStyle=best?(dark?'#12352c':'#eaf8ee'):worst?(dark?'#3b222c':'#fff0f0'):priority?(dark?'#362d1b':'#fff7e6'):c.panel;ctx.fillRect(70,y,1660,height);
        if(best||worst||priority){ctx.fillStyle=best?c.green:worst?'#ef4444':c.orange;ctx.fillRect(70,y,5,height)}
        cells.forEach((lines,i)=>lines.forEach((line,j)=>text(line,82+i*width,y+24+j*21,15,deliveryColor(line,c.text),i===0?700:500)));
        ctx.strokeStyle=c.line;ctx.beginPath();ctx.moveTo(70,y+height);ctx.lineTo(1730,y+height);ctx.stroke();y+=height;
      }
      y+=24;
    }
    const empty=card.querySelector('.empty-state');if(empty){space(60);text(clean(empty),100,y+25,16,c.muted);y+=60}
    y+=12;
  }
  finish();
  for(let i=0;i<pages.length;i++){const blob=await new Promise(resolve=>pages[i].toBlob(resolve,'image/png'));if(!blob)throw Error('PNG unavailable');download(blob,name+(pages.length>1?'-'+(i+1):'')+'.png')}
};
