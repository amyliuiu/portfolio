// Mobile carousel: move the real media nodes, never replace them with snapshots.
(()=>{
 'use strict';
 const warmed=new Map();
 function warm(url){if(!url)return Promise.resolve();if(!warmed.has(url)){const image=new Image();image.src=url;warmed.set(url,image.decode().catch(()=>{}));}return warmed.get(url);}
 const warmMedia=nodes=>Promise.all(nodes.flatMap(n=>[...n.querySelectorAll('img,video')].map(m=>warm(m.tagName==='VIDEO'?m.poster:m.src))));
 function create({dialog,panel,gallery,details,target,name,date='',caption='',media,direction}){
  const width=innerWidth,rect=gallery.getBoundingClientRect(),savedHeight=gallery.style.height;
  const host=document.createElement('div');host.className='mobile-carousel';host.setAttribute('aria-hidden','true');host.inert=true;
  const outgoing=document.createElement('div');outgoing.className='carousel-page';host.append(outgoing);
  const old=gallery.cloneNode(false);old.removeAttribute('id');old.removeAttribute('tabindex');old.classList.add('carousel-gallery');
  old.style.cssText=`position:absolute;left:0;top:${rect.top}px;width:${rect.width}px;`;
  gallery.style.height=rect.height+'px';outgoing.append(old);dialog.append(host);
  old.append(...gallery.childNodes);
  let incoming=null,preview=null,ready=Promise.resolve(),committed=false;
  if(target!==null){
   const probe=details.cloneNode(true);probe.inert=true;probe.setAttribute('aria-hidden','true');probe.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));probe.querySelector('h2').textContent=name;probe.querySelector('.viewer-date').textContent=date;probe.querySelector('.viewer-caption').textContent=caption;
   probe.style.cssText=`position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:${details.getBoundingClientRect().width}px;`;
   const css=getComputedStyle(panel);probe.style.setProperty('--viewer-title-line-height',css.getPropertyValue('--viewer-title-line-height'));
   dialog.append(probe);const top=parseFloat(css.paddingTop)+probe.getBoundingClientRect().height+parseFloat(css.rowGap);probe.remove();
   incoming=document.createElement('div');incoming.className='carousel-page';host.append(incoming);
   preview=document.createElement('div');preview.className='viewer-gallery carousel-gallery';preview.style.cssText=`position:absolute;left:0;top:${top}px;width:${width}px;`;
   preview.append(...media);incoming.append(preview);
   // A decoded poster remains above each new video until a real frame is presented.
   for(const video of preview.querySelectorAll('video')){
    const cover=new Image();cover.src=video.poster;cover.alt='';cover.className='viewer-video-cover';
    const style=getComputedStyle(video);
    cover.style.cssText=`position:absolute;left:${video.offsetLeft}px;top:${video.offsetTop}px;width:${video.getBoundingClientRect().width}px;height:${video.getBoundingClientRect().height}px;object-fit:${style.objectFit};object-position:${style.objectPosition};border-radius:${style.borderRadius};pointer-events:none;z-index:1;`;
    video.after(cover);video._viewerCover=cover;
   }
   ready=Promise.all([...preview.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));
  }
  dialog.dataset.carousel='active';let offset=0,motions=[];
  const transform=x=>`translate3d(${x}px,0,0)`;
  function move(dx){offset=target===null?Math.sign(dx)*Math.min(48,Math.abs(dx)*.2):dx;outgoing.style.transform=transform(offset);if(incoming)incoming.style.transform=transform(offset+direction*width);host.dataset.offset=offset;}
  move(0);
  return {target,width,ready,move,
   async finish(commit){
    const end=commit?-direction*width:0,duration=commit?Math.max(180,Math.min(320,Math.abs(end-offset)/width*320)):180;
    const animate=(node,from,to)=>{const a=node.animate([{transform:transform(from)},{transform:transform(to)}],{duration,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'});motions.push(a);return a.finished.catch(()=>{});};
    await Promise.all([animate(outgoing,offset,end),...(incoming?[animate(incoming,offset+direction*width,end+direction*width)]:[])]);
   },
   commit(){if(preview){gallery.replaceChildren(...preview.childNodes);committed=true;}gallery.style.height=savedHeight;},
   destroy(){motions.forEach(a=>a.cancel());motions=[];if(!committed)gallery.replaceChildren(...old.childNodes);gallery.style.height=savedHeight;host.remove();delete dialog.dataset.carousel;}
  };
 }
 window.ProjectCarousel=Object.freeze({create,warmMedia});
})();
