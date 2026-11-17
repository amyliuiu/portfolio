// Shared project viewer. Grid order is navigation order; endpoints never wrap.
(()=>{
 'use strict';
 const dialog=document.getElementById('project-viewer');if(!dialog||typeof dialog.showModal!=='function')return;
 const panel=dialog.querySelector('.project-panel'),gallery=dialog.querySelector('.viewer-gallery'),title=dialog.querySelector('#viewer-title');
 const closeButton=dialog.querySelector('.viewer-close'),previous=dialog.querySelector('[aria-label="Previous project"]'),next=dialog.querySelector('[aria-label="Next project"]');
 const iconButtons=[closeButton,previous,next];
 const clearIconPress=()=>iconButtons.forEach(b=>delete b.dataset.pressed);
 // Keep keyboard holds separate from navigation cleanup; quick taps get a visible 120ms press beat.
 const keyPresses=new Map();
 function releaseKeyPress(key,immediate=false){
  const press=keyPresses.get(key);if(!press)return;clearTimeout(press.timer);
  const release=()=>{if(keyPresses.get(key)!==press)return;delete press.button.dataset.keyPressed;keyPresses.delete(key);};
  if(immediate)release();else press.timer=setTimeout(release,Math.max(0,120-(performance.now()-press.started)));
 }
 function clearKeyPresses(){for(const key of keyPresses.keys())releaseKeyPress(key,true);}
 function pressKeyIcon(key,button){
  if(button.disabled||!dialog.open)return;
  releaseKeyPress(key,true);keyPresses.set(key,{button,started:performance.now(),timer:0});button.dataset.keyPressed='true';
 }
 document.addEventListener('keyup',e=>releaseKeyPress(e.key),true);
 for(const button of iconButtons){
  button.addEventListener('pointerdown',e=>{if(!button.disabled&&e.button===0){clearIconPress();clearKeyPresses();button.dataset.pressed='true';}});
  button.addEventListener('pointerleave',()=>delete button.dataset.pressed);
 }
 for(const event of ['pointerup','pointercancel'])document.addEventListener(event,clearIconPress,true);
 addEventListener('blur',()=>{clearIconPress();clearKeyPresses();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearIconPress();clearKeyPresses();}});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:700px)');
 const date=dialog.querySelector('#viewer-date'),captionText=dialog.querySelector('.viewer-caption'),copyNodes=[title,date,captionText];
 const projectCopy={
  'shop-posts':{date:'March 2026',caption:'As Shop evolves into shopping-entertainment, we needed a way to provide fresh, dynamic content beyond product recommendations. Shop Posts serve as the foundation for getting user-generated content onto Shop.'},
  'shop-discounts':{date:'August 2026',caption:'As merchants began to adopt Shop Posts, they wanted a way to promote not only products, but also discounts and sales. Now, merchants can tag discounts created in the Shopify admin to their posts. Shoppers are able to checkout with discounts automatically applied.'},
 };
 const discounts=[...gallery.children].map(n=>n.cloneNode(true)),expand=document.querySelector('.project-expand');
 const projects=[...document.querySelectorAll('.work .project-image')].map((card,index)=>{
  const figure=card.closest('figure'),caption=figure.querySelector('figcaption'),name=caption.textContent.trim();
  figure.classList.add('project-preview','viewer-ready');
  const headline=document.createElement('span');headline.className='project-headline';
  [...caption.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>headline.append(n));caption.prepend(headline);
  if(!caption.querySelector('.project-expand'))caption.append(expand.cloneNode(true));
  let trigger=figure.querySelector('.project-open');
  if(!trigger){trigger=document.createElement('button');trigger.type='button';trigger.className='project-open';figure.append(trigger);}
  trigger.hidden=false;trigger.dataset.projectIndex=index;trigger.setAttribute('aria-label','Open '+name);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);trigger.setAttribute('aria-expanded','false');
  trigger.addEventListener('click',()=>open(index));
  trigger.addEventListener('blur',()=>delete trigger.dataset.restoredPointerFocus);
  return {card,trigger,name,id:card.dataset.asset,date:'',caption:'',...projectCopy[card.dataset.asset]};
 });
 const announcement=document.createElement('div');announcement.className='sr-only';announcement.setAttribute('role','status');dialog.append(announcement);
 let index=1,requested=1,entry=1,phase='closed',run=0,animations=[],flight=null,returnFocus=null,locked=null,outsideDown=false,gesture=null;
 let hero=gallery.firstElementChild,carousel=null;
 const details=dialog.querySelector('.viewer-details'),carouselAPI=window.ProjectCarousel;
 dialog.dataset.input='keyboard';
 document.addEventListener('pointerdown',()=>{dialog.dataset.input='pointer';},{capture:true,passive:true});
 document.addEventListener('keydown',e=>{
  if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key)){
   dialog.dataset.input='keyboard';projects.forEach(p=>delete p.trigger.dataset.restoredPointerFocus);
  }
 },true);
 const notify=()=>document.dispatchEvent(new Event('project-viewer:change'));
 function setPhase(value){phase=value;dialog.dataset.phase=value;notify();}
 function stopMotion(){clearIconPress();animations.forEach(a=>a.cancel());animations=[];flight?.remove();flight=null;carousel?.destroy();carousel=null;copyNodes.forEach(n=>n.style.opacity='');if(hero)hero.style.visibility='';}
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
 function renderCopy(selected){const project=projects[selected];title.textContent=project.name;date.textContent=project.date;captionText.textContent=project.caption;}
 function render(selected,keepMedia=false){
  index=selected;const project=projects[index];
  if(!keepMedia)gallery.replaceChildren(...makeMedia(selected));hero=gallery.firstElementChild;
  renderCopy(selected);dialog.dataset.project=project.id;gallery.setAttribute('aria-label',project.name+' media');
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
  clearKeyPresses();stopMotion();gesture=null;setPhase('closed');
  if(returnFocus&&dialog.dataset.input==='pointer')returnFocus.dataset.restoredPointerFocus='true';
  dialog.close();unlock();returnFocus?.setAttribute('aria-expanded','false');
  if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});notify();
 }
 async function close(){
  if(phase==='closed'||phase==='closing')return;
  clearKeyPresses();const token=++run;renderCopy(index);stopMotion();setPhase('closing');
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
  carousel=carouselAPI.create({dialog,panel,gallery,details,target:projects[target]?target:null,name:projects[target]?.name,date:projects[target]?.date,caption:projects[target]?.caption,media:projects[target]?makeMedia(target):[],direction});
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
  const text=commit?fadeTitle(token,()=>{renderCopy(current.target);panel.scrollTop=0;}):Promise.resolve();
  await Promise.all([current.finish(commit),text]);if(token!==run)return;
  if(commit){current.commit();render(current.target,true);}
  settleOpen();if(requested!==index)switchProject();
 }
 async function fadeTitle(token,change){
   const fadeOut=copyNodes.map(n=>n.animate([{opacity:1},{opacity:0}],{duration:160,easing:'ease-out',fill:'forwards'}));animations.push(...fadeOut);
   await Promise.all(fadeOut.map(a=>a.finished.catch(()=>{})));if(token!==run)return;
   // Replace the entire text entry together at zero opacity; controls stay visible.
   copyNodes.forEach(n=>n.style.opacity='0');fadeOut.forEach(a=>a.cancel());
   change();
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(token!==run)return;
   const fadeIn=copyNodes.map(n=>n.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-in',fill:'forwards'}));animations.push(...fadeIn);
   await Promise.all(fadeIn.map(a=>a.finished.catch(()=>{})));if(token!==run)return;
   copyNodes.forEach(n=>n.style.opacity='1');fadeIn.forEach(a=>a.cancel());
 }
 async function switchProject(){
  if(mobile.matches&&!reduced.matches&&carouselAPI){beginCarousel(Math.sign(requested-index));finishCarousel(true,true);return;}
  const token=++run,direction=Math.sign(requested-index);stopMotion();setPhase('switching');
  if(reduced.matches){render(requested);settleOpen();return;}
  const out=gallery.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${-12*direction}px)`}],{duration:120,easing:'ease-in-out',fill:'both'});animations.push(out);
  out.finished.catch(()=>{});let mediaIn=Promise.resolve();
  await fadeTitle(token,()=>{
   render(requested);out.cancel();
   mediaIn=animate(gallery,[{opacity:0,transform:`translateX(${12*direction}px)`},{opacity:1,transform:'translateX(0)'}],180);
  });
  await mediaIn;if(token!==run)return;
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
 dialog.addEventListener('pointercancel',()=>{outsideDown=false;if(gesture?.kind!=='touch')cancelDrag();});
 panel.addEventListener('lostpointercapture',()=>{if(phase==='dragging'&&gesture?.kind!=='touch'){gesture=null;finishCarousel(false);}});
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.target.closest('input,textarea,select,[contenteditable="true"]')||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
   e.preventDefault();if(!e.repeat){const right=e.key==='ArrowRight',before=requested;navigate(right?1:-1);if(requested!==before)pressKeyIcon(e.key,right?next:previous);}return;
  }
  if(e.key!=='Tab')return;
  const focusable=[closeButton,...(mobile.matches?[]:[previous,next].filter(b=>!b.disabled)),gallery];
  const at=focusable.indexOf(document.activeElement);e.preventDefault();focusable[(at+(e.shiftKey?-1:1)+focusable.length)%focusable.length].focus({preventScroll:true});
 });
 // Resolve touch direction before the native scroll view takes ownership.
 // Touch events continue even if Safari cancels its parallel pointer stream.
 panel.addEventListener('touchstart',e=>{
  if(!mobile.matches)return;
  if(e.touches.length!==1){cancelDrag();return;}
  const t=e.touches[0];
  if(phase!=='open'||t.clientX<24||t.clientX>innerWidth-24||e.target.closest('button,a,input,textarea,select'))return;
  gesture={id:t.identifier,x:t.clientX,y:t.clientY,time:performance.now(),direction:0,kind:'touch'};
 },{passive:true});
 dialog.addEventListener('touchmove',e=>{
  if(gesture?.kind!=='touch')return;
  if(e.touches.length!==1){cancelDrag();return;}
  const t=[...e.touches].find(t=>t.identifier===gesture.id);if(!t)return;
  const dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
  if(!gesture.direction){
   if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
   if(Math.abs(dy)>=Math.abs(dx)){cancelDrag();return;}
   if(Math.abs(dx)<Math.abs(dy)*1.15)return;
  }
  if(!e.cancelable){cancelDrag();return;}
  e.preventDefault(); // Horizontal only. Vertical scrolling is never prevented.
  const direction=dx<0?1:-1;
  if(reduced.matches||!carouselAPI){gesture.direction=direction;return;}
  if(!carousel||gesture.direction!==direction){gesture.direction=direction;beginCarousel(direction);}
  carousel.move(dx);
 },{passive:false,capture:true});
 document.addEventListener('touchend',e=>{
  if(gesture?.kind!=='touch')return;
  const t=[...e.changedTouches].find(t=>t.identifier===gesture.id);if(!t)return;
  const start=gesture;gesture=null;const dx=t.clientX-start.x;
  if(carousel){const velocity=Math.abs(dx)/Math.max(1,performance.now()-start.time);finishCarousel(Math.abs(dx)>=carousel.width*.22||(Math.abs(dx)>28&&velocity>.5));}
  else if(start.direction&&Math.abs(dx)>=60)navigate(dx<0?1:-1);
 },{passive:true,capture:true});
 document.addEventListener('touchcancel',()=>{if(gesture?.kind==='touch')cancelDrag();},{passive:true,capture:true});
 panel.addEventListener('pointerdown',e=>{
  if(!mobile.matches||e.pointerType!=='touch')return;
  if(!e.isPrimary){cancelDrag();return;}
  if(phase!=='open'||e.clientX<24||e.clientX>innerWidth-24||e.target.closest('button,a,input,textarea,select'))return;
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),direction:0,kind:'pointer'};
 },{passive:true});
 panel.addEventListener('pointermove',e=>{
  if(!gesture||gesture.kind==='touch'||e.pointerId!==gesture.id)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(!gesture.direction&&Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){cancelDrag();return;}
  if(!gesture.direction&&(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.2))return;
  if(reduced.matches||!carouselAPI)return;
  const direction=dx<0?1:-1;
  if(!carousel||gesture.direction!==direction){gesture.direction=direction;try{panel.setPointerCapture(e.pointerId);}catch{}beginCarousel(direction);}
  carousel.move(dx);
 },{passive:true});
 panel.addEventListener('pointerup',e=>{
  if(gesture?.kind==='touch')return;
  const start=gesture;gesture=null;if(!start||start.id!==e.pointerId)return;
  const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(carousel){const velocity=Math.abs(dx)/Math.max(1,performance.now()-start.time);finishCarousel(Math.abs(dx)>=carousel.width*.22||(Math.abs(dx)>28&&velocity>.5));}
  else if(Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.4)navigate(dx<0?1:-1);
 },{passive:true});
 function settleMotion(){
  clearKeyPresses();
  if(phase==='dragging'){run++;requested=index;gesture=null;settleOpen();}
  else if(phase==='opening'){run++;settleOpen();}
  else if(phase==='switching'){run++;stopMotion();render(requested);settleOpen();}
  else if(phase==='closing'){run++;finishClose();}
 }
 let viewportWidth=innerWidth;
 addEventListener('resize',()=>{
  // Safari toolbar/visual-viewport height changes are not orientation changes.
  if(mobile.matches&&innerWidth===viewportWidth)return;
  viewportWidth=innerWidth;gesture=null;settleMotion();if(!mobile.matches)panel.scrollTop=0;else gallery.scrollTop=0;
 });
 reduced.addEventListener('change',()=>{if(reduced.matches)settleMotion();});
 document.addEventListener('visibilitychange',()=>{if(mobile.matches&&document.hidden){gesture=null;settleMotion();}});
 addEventListener('pagehide',()=>{if(phase!=='closed'){run++;finishClose();}});
})();
