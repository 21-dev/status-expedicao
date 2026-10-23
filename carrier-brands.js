/* Official assets are local: see SOURCES.json. */
window.CarrierBrands=(()=>{
 const brands=[
  {key:'jadlog',file:'jadlog.png',match:/^(?:jadlog\b|jad\b)/},
  {key:'fedex',file:'fedex.png',match:/^fed\s*ex\b/},
  {key:'dhl',file:'dhl.svg',match:/^dhl\b/},
  {key:'correios',file:'correios.svg',match:/^(?:correios\b|ect\b|empresa brasileira de correios)/},
  {key:'spx',file:'spx.svg',match:/^(?:spx\b|shopee\b|shoppe\b|shps\b)/},
  {key:'patrus',file:'patrus.svg',match:/^patrus\b/},
  {key:'loggi',file:'loggi.svg',match:/^(?:loggi\b|l4b\b)/}
 ];
 const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const find=value=>brands.find(brand=>brand.match.test(normal(value)));
 const src=value=>{const brand=find(value);return brand?''+brand.file:''};
 let readyPromise;
 function ready(){return readyPromise||=(Promise.all(brands.map(brand=>new Promise(resolve=>{const img=new Image();img.onload=()=>{brand.image=img;resolve()};img.onerror=()=>resolve();img.src=''+brand.file}))))}
 function draw(ctx,value,x,y,size,align){const brand=find(value);if(!brand?.image||align==='right'||align==='center')return x;const h=Math.min(28,size*1.5),w=64;ctx.save();ctx.fillStyle='#ffffff';ctx.fillRect(x,y-h+3,w,h+6);const scale=Math.min((w-6)/brand.image.naturalWidth,(h-2)/brand.image.naturalHeight);ctx.drawImage(brand.image,x+(w-brand.image.naturalWidth*scale)/2,y-h+5+(h-2-brand.image.naturalHeight*scale)/2,brand.image.naturalWidth*scale,brand.image.naturalHeight*scale);ctx.restore();return x+w+8}
 function decorate(root){
  const candidates=[...(root.matches?.('td,th,strong,.matrix-title img')?[root]:[]),...root.querySelectorAll('td,th,strong,.matrix-title img')];
  for(const el of candidates){
   if(el.tagName==='IMG'){const name=el.closest('.matrix-header')?.title||el.parentElement.textContent,url=src(name);if(url){el.src=url;el.classList.add('official-carrier-logo')}continue}
   if(el.querySelector('img')||el.children.length||!src(el.textContent))continue;
   const img=document.createElement('img');img.src=src(el.textContent);img.alt='';img.className='official-carrier-logo';img.loading='lazy';el.prepend(img);
  }
 }
 document.addEventListener('DOMContentLoaded',()=>{decorate(document.body);new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node.nodeType===1&&!node.matches('img'))decorate(node)}).observe(document.body,{childList:true,subtree:true})});
 return {src,find,ready,draw};
})();
