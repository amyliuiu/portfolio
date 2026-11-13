// Shared project viewer. Grid order is navigation order; endpoints never wrap.
(()=>{
 'use strict';
 const dialog=document.getElementById('project-viewer');if(!dialog||typeof dialog.showModal!=='function')return;
 const panel=dialog.querySelector('.project-panel'),gallery=dialog.querySelector('.viewer-gallery'),title=dialog.querySelector('#viewer-title');
 const closeButton=dialog.querySelector('.viewer-close'),previous=dialog.querySelector('[aria-label="Previous project"]'),next=dialog.querySelector('[aria-label="Next project"]');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:700px)');
 const discounts=[...gallery.children].map(n=>n.cloneNode(true)),expand=document.querySelector('.project-expand');
 const projects=[...document.querySelectorAll('.work .project-image')].map((card,index)=>{
  const figure=card.closest('figure'),caption=figure.querySelector('figcaption'),name=caption.textContent.trim();
  figure.classList.add('project-preview','viewer-ready');
  if(!caption.querySelector('.project-expand'))caption.append(expand.cloneNode(true));
  let trigger=figure.querySelector('.project-open');
  if(!trigger){trigger=document.createElement('button');trigger.type='button';trigger.className='project-open';figure.append(trigger);}
  trigger.hidden=false;trigger.dataset.projectIndex=index;trigger.setAttribute('aria-label','Open '+name);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);trigger.setAttribute('aria-expanded','false');
  trigger.addEventListener('click',()=>open(index));
  return {card,trigger,name,id:card.dataset.asset};
 });
 const announcement=document.createElement('div');announcement.className='sr-only';announcement.setAttribute('role','status');dialog.append(announcement);
 let index=1,requested=1,entry=1,phase='closed',run=0,animations=[],flight=null,returnFocus=null,locked=null,outsideDown=false,gesture=null;
 let hero=gallery.firstElementChild,carousel=null;
 const details=dialog.querySelector('.viewer-details'),carouselAPI=window.ProjectCarousel;
 dialog.dataset.input='keyboard';
 document.addEventListener('pointerdown',()=>{dialog.dataset.input='pointer';},{capture:true,passive:true});
 document.addEventListener('keydown',e=>{if(!e.metaKey&&!e.ctrlKey&&!e.altKey)dialog.dataset.input='keyboard';},true);
 const notify=()=>document.dispatchEvent(new Event('project-viewer:change'));
 function setPhase(value){phase=value;dialog.dataset.phase=value;notify();}
 function stopMotion(){animations.forEach(a=>a.cancel());animations=[];flight?.remove();flight=null;carousel?.destroy();carousel=null;if(hero)hero.style.visibility='';}
 function animate(node,frames,duration=360){const a=node.animate(frames,{duration,easing:'ease-in-out',fill:'both'});animations.push(a);return a.finished.catch(()=>{});}
 function announce(){announcement.textContent=projects[index].name+', project '+(index+1)+' of '+projects.length;}
 function makeMedia(selected){
  const project=projects[selected];let media;
  if(project.id==='shop-discounts')media=discounts.map(n=>n.cloneNode(true));
  else{
   const stage=project.card.cloneNode(true),phone=!!stage.querySelector('.phone-screen');
   stage.classList.remove('project-image','mobile-showcase','portrait');stage.classList.add('viewer-media','viewer-hero');
   if(phone)stage.classList.add('viewer-recording');
   stage.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
   stage.querySelectorAll('img').forEach(n=>{n.loading='eager';if(n.srcset){if(mobile.matches){n.src=n.srcset.split(',').at(-1).trim().split(/\s+/)[0];n.removeAttribute('srcset');n.removeAttribute('sizes');}else n.sizes='983px';}});
   media=[stage];
  }
  return media;
 }
 function render(selected){
  index=selected;const project=projects[index];
  gallery.replaceChildren(...makeMedia(selected));hero=gallery.firstElementChild;
  title.textContent=project.name;dialog.dataset.project=project.id;gallery.setAttribute('aria-label',project.name+' media');
  gallery.scrollTop=panel.scrollTop=0;dialog.querySelector('.viewer-copy').scrollTop=0;
  previous.disabled=index===0;next.disabled=index===projects.length-1;
  if(document.activeElement===previous&&previous.disabled)next.focus({preventScroll:true});
  if(document.activeElement===next&&next.disabled)previous.focus({preventScroll:true});
  notify();
 }
 function lock(){
  const root=document.documentElement,body=document.body;
  locked={root:root.style.overflow,body:body.style.overflow,padding:body.style.paddingRight,x:scrollX,y:scrollY};
  const scrollbar=innerWidth-root.clientWidth;root.style.setProperty('--viewer-scrollbar',scrollbar+'px');
  body.style.paddingRight=(parseFloat(getComputedStyle(body).paddingRight)+scrollbar)+'px';root.style.overflow=body.style.overflow='hidden';root.classList.add('viewer-open');
 }
 function unlock(){
  if(!locked)return;const root=document.documentElement,body=document.body,saved=locked;locked=null;
  root.style.overflow=saved.root;body.style.overflow=saved.body;body.style.paddingRight=saved.padding;root.classList.remove('viewer-open');root.style.removeProperty('--viewer-scrollbar');
  scrollTo({left:saved.x,top:saved.y,behavior:'instant'});
 }
 function snapshot(video){
  const frame=document.createElement('div');frame.className='viewer-flight';frame.setAttribute('aria-hidden','true');
  if(video.readyState>=2){const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);frame.append(canvas);}
  else{const img=new Image();img.src=video.poster;img.alt='';frame.append(img);}
  dialog.append(frame);flight=frame;return frame;
 }
 const box=r=>({left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
 function warmNeighbors(){if(mobile.matches&&carouselAPI)for(const i of [index-1,index+1])if(projects[i])carouselAPI.warmMedia(makeMedia(i));}
 function settleOpen(){stopMotion();setPhase('open');announce();warmNeighbors();}
 async function open(selected){
  if(phase!=='closed')return;
  const token=++run;entry=requested=selected;returnFocus=projects[selected].trigger;
  const from=projects[selected].card.getBoundingClientRect();render(selected);warmNeighbors();
  lock();dialog.showModal();returnFocus.setAttribute('aria-expanded','true');setPhase('opening');closeButton.focus({preventScroll:true});
  const sourceVideo=projects[index].card.querySelector('video'),heroVideo=hero.querySelector('video');
  if(sourceVideo&&heroVideo){
   const sync=()=>{if(token===run&&dialog.open&&heroVideo.isConnected&&Number.isFinite(heroVideo.duration))heroVideo.currentTime=Math.min(sourceVideo.currentTime,Math.max(0,heroVideo.duration-.01));};
   if(heroVideo.readyState)sync();else{heroVideo.addEventListener('loadedmetadata',sync,{once:true});heroVideo.preload='metadata';heroVideo.load();}
  }
  if(reduced.matches){settleOpen();return;}
  const tasks=[animate(panel,[{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'scale(1)'}])];
  if(projects[index].id==='shop-discounts'){
   const ghost=snapshot(sourceVideo);hero.style.visibility='hidden';
   tasks.push(animate(ghost,[box(from),box(hero.getBoundingClientRect())]),animate(ghost.firstElementChild,[{objectPosition:getComputedStyle(sourceVideo).objectPosition},{objectPosition:getComputedStyle(heroVideo).objectPosition}]));
  }
  await Promise.all(tasks);if(token===run&&phase==='opening')settleOpen();
 }
 function finishClose(){
  stopMotion();gesture=null;setPhase('closed');dialog.close();unlock();returnFocus?.setAttribute('aria-expanded','false');
  if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});notify();
 }
 async function close(){
  if(phase==='closed'||phase==='closing')return;
  const token=++run;title.textContent=projects[index].name;stopMotion();setPhase('closing');
  if(reduced.matches){finishClose();return;}
  const tasks=[animate(panel,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.98)'}])];
  if(index===entry&&projects[index].id==='shop-discounts'){
   const from=hero.getBoundingClientRect(),to=projects[index].card.getBoundingClientRect(),view=gallery.getBoundingClientRect();
   if(from.top>=Math.max(0,view.top)-1&&from.bottom<=Math.min(innerHeight,view.bottom)+1&&to.bottom>0&&to.top<innerHeight){
    const video=hero.querySelector('video'),ghost=snapshot(video);hero.style.visibility='hidden';
    tasks.push(animate(ghost,[box(from),box(to)]),animate(ghost.firstElementChild,[{objectPosition:getComputedStyle(video).objectPosition},{objectPosition:'50% 0%'}]));
   }
  }
  await Promise.all(tasks);if(token===run)finishClose();
 }
 function beginCarousel(direction){
  carousel?.destroy();
  const target=index+direction;
  carousel=carouselAPI.create({dialog,panel,gallery,details,target:projects[target]?target:null,name:projects[target]?.name,media:projects[target]?makeMedia(target):[],direction});
  setPhase('dragging');return carousel;
 }
 async function finishCarousel(commit,preserveRequested=false){
  const current=carousel;if(!current)return;
  commit=commit&&current.target!==null;
  const token=++run;if(!commit)requested=index;else if(!preserveRequested)requested=current.target;setPhase('switching');
  if(commit){
   // Hold a fully visible outgoing page until the incoming stills are decoded.
   await Promise.race([current.ready,new Promise(r=>setTimeout(r,1500))]);
   if(token!==run)return;
  }
  const text=commit?(async()=>{
   await animate(title,[{opacity:1},{opacity:0}],100);if(token!==run)return;
   title.textContent=projects[current.target].name;panel.scrollTop=0;
   await animate(title,[{opacity:0},{opacity:1}],180);
  })():Promise.resolve();
  await Promise.all([current.finish(commit),text]);if(token!==run)return;
  if(commit){
   render(current.target);
   await Promise.all([...gallery.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   if(token!==run)return;
  }
  settleOpen();if(requested!==index)switchProject();
 }
 async function switchProject(){
  if(mobile.matches&&!reduced.matches&&carouselAPI){beginCarousel(Math.sign(requested-index));finishCarousel(true,true);return;}
  const token=++run,direction=Math.sign(requested-index);stopMotion();setPhase('switching');
  const nodes=[gallery,title];
  if(!reduced.matches)await Promise.all(nodes.map(n=>animate(n,[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${-12*direction}px)`}],120)));
  if(token!==run)return;
  render(requested);stopMotion();
  if(!reduced.matches)await Promise.all(nodes.map(n=>animate(n,[{opacity:0,transform:`translateX(${12*direction}px)`},{opacity:1,transform:'translateX(0)'}],180)));
  if(token!==run)return;
  settleOpen();if(requested!==index)switchProject();
 }
 function navigate(delta){
  if(phase!=='open'&&phase!=='switching')return;
  requested=Math.max(0,Math.min(projects.length-1,requested+delta));
  if(phase==='open'&&requested!==index)switchProject();
 }
 previous.addEventListener('click',()=>navigate(-1));next.addEventListener('click',()=>navigate(1));closeButton.addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('pointerdown',e=>{outsideDown=e.target===dialog;});
 dialog.addEventListener('pointerup',e=>{if(outsideDown&&e.target===dialog)close();outsideDown=false;});
 function cancelDrag(){gesture=null;if(phase==='dragging'){run++;requested=index;settleOpen();}}
 dialog.addEventListener('pointercancel',()=>{outsideDown=false;cancelDrag();});
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.target.closest('input,textarea,select,[contenteditable="true"]')||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();if(!e.repeat)navigate(e.key==='ArrowRight'?1:-1);return;}
  if(e.key!=='Tab')return;
  const focusable=[closeButton,...(mobile.matches?[]:[previous,next].filter(b=>!b.disabled)),gallery];
  const at=focusable.indexOf(document.activeElement);e.preventDefault();focusable[(at+(e.shiftKey?-1:1)+focusable.length)%focusable.length].focus({preventScroll:true});
 });
 panel.addEventListener('pointerdown',e=>{
  if(!mobile.matches||e.pointerType!=='touch')return;
  if(!e.isPrimary){cancelDrag();return;}
  if(phase!=='open'||e.clientX<24||e.clientX>innerWidth-24||e.target.closest('button,a,input,textarea,select'))return;
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),direction:0};
 },{passive:true});
 panel.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(!gesture.direction&&Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){cancelDrag();return;}
  if(Math.abs(dx)<10||(!gesture.direction&&Math.abs(dx)<Math.abs(dy)*1.2))return;
  if(reduced.matches||!carouselAPI)return;
  const direction=dx<0?1:-1;
  if(!carousel||gesture.direction!==direction){gesture.direction=direction;beginCarousel(direction);try{panel.setPointerCapture(e.pointerId);}catch{}}
  carousel.move(dx);
 },{passive:true});
 panel.addEventListener('pointerup',e=>{
  const start=gesture;gesture=null;if(!start||start.id!==e.pointerId)return;
  const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(carousel){const velocity=Math.abs(dx)/Math.max(1,performance.now()-start.time);finishCarousel(Math.abs(dx)>=carousel.width*.22||(Math.abs(dx)>28&&velocity>.5));}
  else if(Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.4)navigate(dx<0?1:-1);
 },{passive:true});
 function settleMotion(){
  if(phase==='dragging'){run++;requested=index;gesture=null;settleOpen();}
  else if(phase==='opening'){run++;settleOpen();}
  else if(phase==='switching'){run++;stopMotion();render(requested);settleOpen();}
  else if(phase==='closing'){run++;finishClose();}
 }
 addEventListener('resize',()=>{gesture=null;settleMotion();if(!mobile.matches)panel.scrollTop=0;else gallery.scrollTop=0;});
 reduced.addEventListener('change',()=>{if(reduced.matches)settleMotion();});
 addEventListener('pagehide',()=>{if(phase!=='closed'){run++;finishClose();}});
})();
