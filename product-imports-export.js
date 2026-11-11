/* PNG reports grouped by complete sections; a matrix is never split across images. */
window.exportProductImports = async function(name,download){
 const root=document.getElementById('page-importacoes');
 if(!root.querySelector('.imports-kpis'))throw new Error('Importe um CSV antes de exportar.');
 await document.fonts.ready;await window.CarrierBrands.ready();
 const dark=document.body.dataset.theme==='dark',W=2400,H=3200,M=80,I=W-M*2;
 const palette=window.ReportImageTheme.colors();
 const colors={...palette,bg:palette.background,ink:palette.text,navy:palette.header};
 const pages=[];let canvas,ctx,y;
 const clean=el=>el?.textContent.replace(/\s+/g,' ').trim()||'';
 function text(value,x,baseline,size=20,color=colors.ink,bold=false){ctx.font=(bold?'700':'400')+' '+size+'px "Segoe UI",Arial';ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(String(value),x,baseline);}
 function box(x,top,w,h,color,border=false){ctx.fillStyle=color;ctx.fillRect(x,top,w,h);if(border){ctx.strokeStyle=colors.line;ctx.lineWidth=1;ctx.strokeRect(x,top,w,h);}}
 function wrap(value,width,size=20){ctx.font='400 '+size+'px "Segoe UI",Arial';const lines=[];let line='';for(const char of String(value)){if(ctx.measureText(line+char).width>width&&line){lines.push(line.trim());line='';}line+=char;}if(line)lines.push(line.trim());return lines.length?lines:[''];}
 function newPage(height=H){canvas=document.createElement('canvas');canvas.width=W;canvas.height=height;ctx=canvas.getContext('2d');box(0,0,W,height,colors.bg);window.ReportImageTheme.header(ctx,'Importação de produtos',clean(root.querySelector('#imports-updated')),M,60,160);y=250;}
 function space(){return false;}
 function paragraph(value,size=19){const lines=wrap(value,I-48,size),h=lines.length*(size+9)+30;space(h);box(M,y,I,h,colors.panel);lines.forEach((line,i)=>text(line,M+24,y+27+i*(size+9),size,colors.muted));y+=h+16;}
 function heading(value){space(70);box(M,y,I,54,colors.navy);text(value,M+22,y+36,24,'#fff',true);y+=54;}
 function filters(){
 const filterValue=id=>{const el=root.querySelector('#'+id);return el?.selectedOptions?.[0]?.textContent||el?.value||'Todas as datas';};
 paragraph('Marketplace: '+filterValue('imports-market')+' | Data de importação: '+filterValue('imports-date')+' | Serviço: '+filterValue('imports-service'));
 for(const [prefix,label] of [['imports','Importados'],['billed','Faturados']]){const labels=[...root.querySelectorAll('#'+prefix+'-status-options input:checked')].map(el=>clean(el.parentElement));paragraph('Status · '+label+': '+(labels.join(' · ')||'Nenhum status selecionado'));}
 }
 function drawTop(){
 space(180);const cards=[...root.querySelectorAll('.imports-kpis .imports-kpi')],gap=20,cw=(I-gap*(cards.length-1))/cards.length;
 cards.forEach((card,i)=>{const x=M+i*(cw+gap);box(x,y,cw,150,colors.panel,true);box(x,y,cw,6,card.style.getPropertyValue('--import-tone')||'#00819b');text(clean(card.querySelector('span')),x+20,y+38,19,colors.muted,true);text(clean(card.querySelector('strong')),x+20,y+90,38,colors.ink,true);text(clean(card.querySelector('small')),x+20,y+126,18,colors.muted);});y+=176;
 heading('Pedidos por marketplace');space(350);box(M,y,I,320,colors.panel);
 const slices=[...root.querySelectorAll('[data-market-chart]')].map(li=>({label:[...li.querySelector('span').childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ')+' · '+clean(li.querySelector('small')),color:li.querySelector('i').style.background,count:Number((li.querySelector('small')?.textContent||'0').split(' pedidos')[0].replace(/\./g,'').replace(',','.'))||0})),total=slices.reduce((n,s)=>n+s.count,0);
 const cx=M+220,cy=y+158,r=126;let angle=-Math.PI/2;
 if(!total){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=colors.line;ctx.fill();}
 slices.forEach(s=>{if(!s.count)return;const end=angle+s.count/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,end);ctx.closePath();ctx.fillStyle=s.color;ctx.fill();angle=end;});ctx.beginPath();ctx.arc(cx,cy,78,0,Math.PI*2);ctx.fillStyle=colors.panel;ctx.fill();const totalText=String(total);ctx.font='700 36px "Segoe UI",Arial';text(totalText,cx-ctx.measureText(totalText).width/2,cy+2,36,colors.ink,true);text('pedidos',cx-34,cy+34,18,colors.muted);
 slices.forEach((s,i)=>{box(M+450,y+45+i*60,16,16,s.color);text(s.label,M+485,y+61+i*60,22,colors.ink,true);});y+=338;
 paragraph('O gráfico conta pedidos únicos; os cartões e matrizes mostram produtos. As matrizes seguem as datas expandidas ou recolhidas na tela.');
 }
 function drawMatrix(panel){
  const title=clean(panel.querySelector('h3'));heading(title);
  const table=panel.querySelector('table');if(!table){paragraph(clean(panel.querySelector('.imports-empty')));return;}
  const headers=[...table.querySelectorAll('thead th')],n=headers.length,widths=headers.map((_,i)=>i===0?300:i===n-1?150:(I-450)/Math.max(1,n-2)),font=n>11?14:17,lineHeight=font+7;
  const headerLines=headers.map((h,i)=>wrap(h.querySelector('.imports-service-heading')?[...h.querySelector('.imports-service-heading>span').childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' '):clean(h),widths[i]-20,font));const headerHeight=Math.max(1,...headerLines.map(a=>a.length))*lineHeight+24;
  function tableHead(){space(headerHeight+80);let x=M;headerLines.forEach((lines,i)=>{box(x,y,widths[i],headerHeight,colors.navy,true);lines.forEach((line,j)=>text(line,x+10,y+22+j*lineHeight,font,'#fff',true));x+=widths[i];});y+=headerHeight;}
  tableHead();
  const rows=[...table.querySelectorAll('tbody tr,tfoot tr')].filter(row=>!row.hidden);
  for(const row of rows){const lines=[...row.cells].map((cell,i)=>wrap(clean(cell).replace(/^[▸▾]\s*/,''),widths[i]-20,font)),height=Math.max(1,...lines.map(a=>a.length))*lineHeight+16;
   const totalRow=!!row.closest('tfoot'),subtotal=row.classList.contains('imports-day-total');let x=M;
   [...row.cells].forEach((cell,i)=>{const tone=cell.classList.contains('bad')?'bad':cell.classList.contains('warn')?'warn':cell.classList.contains('good')?'good':'';const palettes=dark?{good:['#275c38','#e4f8e9'],warn:['#624913','#fff0b3'],bad:['#b83c34','#fff']}:{good:['#d8f1df','#14532d'],warn:['#fde8a6','#7c4a03'],bad:['#ffb0a5','#8f1d16']};const fill=totalRow||subtotal?(dark?'#20354c':'#e3edf7'):palettes[tone]?.[0]||colors.panel;box(x,y,widths[i],height,fill,true);lines[i].forEach((line,j)=>text(line,i===0?x+10:x+(widths[i]-ctx.measureText(line).width)/2,y+font+9+j*lineHeight,font,totalRow||subtotal?colors.ink:palettes[tone]?.[1]||colors.ink,totalRow||subtotal||i===0));x+=widths[i];});y+=height;
  }
  y+=18;
 }
 const legend='! = Pedido não expedido fora do prazo. Econômica e Normal: 48h. Marketplaces: até 13h, expedir até 19h do mesmo dia; após 13h, até 19h do dia seguinte. Cores das matrizes: verde até 10 produtos · amarelo de 11 a 30 · vermelho acima de 30. Filtros de status de Importados e Faturados são independentes.';
 function renderGroup(ids,withTop,height=1){
  newPage(height);filters();if(withTop)drawTop();
  ids.forEach(id=>{const panel=root.querySelector('#'+id);if(panel)drawMatrix(panel);});
  paragraph(legend);return Math.ceil(y+70);
 }
 function completeImage(ids,withTop){
  const height=renderGroup(ids,withTop);
  renderGroup(ids,withTop,height);
  text('Produtos: Qtde. Total de Produto · Brasília · Imagem '+String(pages.length+1).padStart(2,'0'),M,y+38,17,colors.muted);
  pages.push(canvas);
 }
 completeImage(['imports-pivot-general'],true);
 completeImage(['imports-pivot-market'],false);
 const billed=['imports-pivot-billed','imports-pivot-billed-market'];
 if(renderGroup(billed,false)<=H){completeImage(billed,false);}
 else{completeImage([billed[0]],false);completeImage([billed[1]],false);}
 for(let i=0;i<pages.length;i++){
  const blob=await new Promise(resolve=>pages[i].toBlob(resolve,'image/png'));
  if(!blob)throw new Error('Não foi possível gerar o PNG.');
  await download(blob,name+'-'+String(i+1).padStart(2,'0')+'.png');
 }
};
