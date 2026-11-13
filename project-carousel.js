// Mobile-only, opaque side-by-side media pages. Text and controls stay separate.
(()=>{
 'use strict';
 const warmed=new Map();
 function warm(url){
  if(!url)return Promise.resolve();
  if(!warmed.has(url)){const image=new Image();image.src=url;warmed.set(url,image.decode().catch(()=>{}));}
  return warmed.get(url);
 }
 function warmMedia(nodes){return Promise.all(nodes.flatMap(n=>[...n.querySelectorAll('img,video')].map(m=>warm(m.tagName==='VIDEO'?m.poster:m.src))));}
 function stills(source,clone,freeze){
  const originals=[...source.querySelectorAll('img,video')],copies=[...clone.querySelectorAll('img,video')];
  originals.forEach((original,i)=>{
   const copy=copies[i];
   if(original.tagName==='IMG'){copy.removeAttribute('srcset');copy.removeAttribute('sizes');copy.src=original.currentSrc||original.src;copy.loading='eager';return;}
   const css=getComputedStyle(freeze?original:copy);let image;
   if(freeze&&original.readyState>=2){image=document.createElement('canvas');image.width=original.videoWidth;image.height=original.videoHeight;image.getContext('2d').drawImage(original,0,0);}
   else{image=new Image();image.src=original.poster;image.alt='';}
   for(const key of ['position','top','right','bottom','left','width','height','objectFit','objectPosition','borderRadius','display'])image.style[key]=css[key];
   copy.replaceWith(image);
  });
  clone.removeAttribute('tabindex');clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
 }
 function create({dialog,panel,gallery,details,target,name,media,direction}){
  const width=innerWidth,host=document.createElement('div');host.className='mobile-carousel';host.setAttribute('aria-hidden','true');host.inert=true;
  const outgoing=document.createElement('div');outgoing.className='carousel-page';host.append(outgoing);
  const old=gallery.cloneNode(true),rect=gallery.getBoundingClientRect();
  old.classList.add('carousel-gallery');old.style.cssText=`position:absolute;left:0;top:${rect.top}px;width:${rect.width}px;visibility:visible;`;
  outgoing.append(old);dialog.append(host);stills(gallery,old,true);
  let incoming=null,ready=Promise.resolve();
  if(target!==null){
   const probe=details.cloneNode(true);probe.inert=true;probe.setAttribute('aria-hidden','true');probe.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));probe.querySelector('h2').textContent=name;
   probe.style.cssText=`position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:${details.getBoundingClientRect().width}px;`;
   const panelCSS=getComputedStyle(panel);probe.style.setProperty('--viewer-title-line-height',panelCSS.getPropertyValue('--viewer-title-line-height'));
   dialog.append(probe);const top=parseFloat(panelCSS.paddingTop)+probe.getBoundingClientRect().height+parseFloat(panelCSS.rowGap);probe.remove();
   incoming=document.createElement('div');incoming.className='carousel-page';host.append(incoming);
   const preview=document.createElement('div');preview.className='viewer-gallery carousel-gallery';preview.style.cssText=`position:absolute;left:0;top:${top}px;width:${width}px;`;
   preview.append(...media);incoming.append(preview);
   // Capture references before replacing the videos with already-warmed posters.
   stills(preview,preview,false);
   ready=Promise.all([...preview.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));
  }
  gallery.style.visibility='hidden';dialog.dataset.carousel='active';
  let offset=0,motions=[];
  const transform=x=>`translate3d(${x}px,0,0)`;
  function move(dx){offset=target===null?Math.sign(dx)*Math.min(48,Math.abs(dx)*.2):dx;outgoing.style.transform=transform(offset);if(incoming)incoming.style.transform=transform(offset+direction*width);host.dataset.offset=offset;}
  move(0);
  return {target,width,ready,move,
   async finish(commit){
    const end=commit?-direction*width:0,duration=commit?Math.max(180,Math.min(320,Math.abs(end-offset)/width*320)):180;
    const animate=(node,from,to)=>{const animation=node.animate([{transform:transform(from)},{transform:transform(to)}],{duration,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'});motions.push(animation);return animation.finished.catch(()=>{});};
    await Promise.all([animate(outgoing,offset,end),...(incoming?[animate(incoming,offset+direction*width,end+direction*width)]:[])]);
   },
   destroy(){motions.forEach(a=>a.cancel());motions=[];host.remove();gallery.style.visibility='';delete dialog.dataset.carousel;}
  };
 }
 window.ProjectCarousel=Object.freeze({create,warmMedia});
})();
