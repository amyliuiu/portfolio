// Center every marker on Henry's cap height, not a word's descenders.
(()=>{
 const nav=document.querySelector('.primary-nav');
 const current=nav?.querySelector('[aria-current="page"]');
 const context=document.createElement('canvas').getContext('2d');
 if(!current||!context)return;
 function alignMarker(){
  const css=getComputedStyle(current);
  context.font=`${css.fontSize} ${css.fontFamily}`;
  const m=context.measureText('H');
  const offset=(m.fontBoundingBoxAscent-m.fontBoundingBoxDescent-m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)/2;
  nav.style.setProperty('--marker-shift',`${Number.isFinite(offset)?offset:0}px`);
 }
 document.fonts.ready.then(alignMarker);
 new ResizeObserver(alignMarker).observe(nav);
 alignMarker();
})();
