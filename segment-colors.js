/* One palette for delivery models, in the UI and canvas reports. */
window.DeliveryColors=Object.freeze({b2c:'#3b82f6',b2b:'#14b8a6'});
window.deliveryColor=function(value,fallback){const text=String(value||'').toUpperCase();const b2c=/\bB2C\b/.test(text),b2b=/\bB2B\b/.test(text);return b2c!==b2b?DeliveryColors[b2c?'b2c':'b2b']:fallback};
document.addEventListener('DOMContentLoaded',()=>{
  function decorate(root){
    const nodes=[...(root.matches?.('h2,h3,th,td,small,strong,span,label')?[root]:[]),...root.querySelectorAll('h2,h3,th,td,small,strong,span,label')];
    for(const el of nodes){const value=el.textContent.trim();if(el.children.length||!/^B2[BC]\b/i.test(value)||(/\bB2B\b/.test(value)&&/\bB2C\b/.test(value)))continue;const segment=/^B2C/i.test(value)?'b2c':'b2b';el.dataset.delivery=segment;const card=el.matches('h2,h3')?el.closest('.prod-segments article,.shipping-grid article,.gemba-flow-item,.gemba-forecast-item'):null;if(card)card.dataset.delivery=segment}
  }
  decorate(document.body);
  new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node.nodeType===1)decorate(node)}).observe(document.body,{childList:true,subtree:true});
});
