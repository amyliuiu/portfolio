// One-project preview. Navigation is intentionally disabled until more projects
// have viewer content; future keyboard/swipe navigation must stop at the ends.
(()=>{
 'use strict';
 const dialog=document.getElementById('project-viewer'),trigger=document.querySelector('.project-open');
 if(!dialog||!trigger||typeof dialog.showModal!=='function')return;
 const panel=dialog.querySelector('.project-panel'),gallery=dialog.querySelector('.viewer-gallery'),hero=dialog.querySelector('.viewer-hero');
 const card=document.querySelector('[data-asset="shop-discounts"]'),sourceVideo=card.querySelector('video'),heroVideo=hero.querySelector('video');
 const closeButton=dialog.querySelector('.viewer-close'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let phase='closed',run=0,animations=[],flight=null,returnFocus=null,locked=null,outsideDown=false;
 // Safari may mark programmatic dialog autofocus as focus-visible after a tap.
 // Track the actual input instead of removing accessible keyboard focus styles.
 dialog.dataset.input='keyboard';
 document.addEventListener('pointerdown',()=>{dialog.dataset.input='pointer';},{capture:true,passive:true});
 document.addEventListener('keydown',e=>{if(!e.metaKey&&!e.ctrlKey&&!e.altKey)dialog.dataset.input='keyboard';},true);
 const notify=()=>document.dispatchEvent(new Event('project-viewer:change'));
 function setPhase(value){phase=value;dialog.dataset.phase=value;notify();}
 function stopMotion(){animations.forEach(a=>a.cancel());animations=[];flight?.remove();flight=null;hero.style.visibility='';}
 function animate(node,frames){const a=node.animate(frames,{duration:360,easing:'ease-in-out',fill:'both'});animations.push(a);return a.finished.catch(()=>{});}
 function lock(){
  const root=document.documentElement,body=document.body;
  locked={root:root.style.overflow,body:body.style.overflow,padding:body.style.paddingRight,x:scrollX,y:scrollY};
  const scrollbar=innerWidth-root.clientWidth;
  root.style.setProperty('--viewer-scrollbar',scrollbar+'px');
  body.style.paddingRight=(parseFloat(getComputedStyle(body).paddingRight)+scrollbar)+'px';
  root.style.overflow=body.style.overflow='hidden';root.classList.add('viewer-open');
 }
 function unlock(){
  if(!locked)return;
  const root=document.documentElement,body=document.body,saved=locked;locked=null;
  root.style.overflow=saved.root;body.style.overflow=saved.body;body.style.paddingRight=saved.padding;
  root.classList.remove('viewer-open');root.style.removeProperty('--viewer-scrollbar');
  scrollTo({left:saved.x,top:saved.y,behavior:'instant'});
 }
 function snapshot(video){
  const frame=document.createElement('div');frame.className='viewer-flight';frame.setAttribute('aria-hidden','true');
  if(video.readyState>=2){
   const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
   canvas.getContext('2d').drawImage(video,0,0);frame.append(canvas);
  }else{const img=new Image();img.src=video.poster;img.alt='';frame.append(img);}
  dialog.append(frame);flight=frame;return frame;
 }
 const box=r=>({left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
 function settleOpen(){stopMotion();setPhase('open');}
 async function open(){
  if(phase!=='closed')return;
  const token=++run,from=card.getBoundingClientRect();returnFocus=trigger;
  lock();dialog.showModal();gallery.scrollTop=0;panel.scrollTop=0;trigger.setAttribute('aria-expanded','true');setPhase('opening');
  const syncTime=()=>{if(token===run&&dialog.open&&Number.isFinite(heroVideo.duration))heroVideo.currentTime=Math.min(sourceVideo.currentTime,Math.max(0,heroVideo.duration-.01));};
  if(heroVideo.readyState)syncTime();else{heroVideo.addEventListener('loadedmetadata',syncTime,{once:true});heroVideo.preload='metadata';heroVideo.load();}
  closeButton.focus({preventScroll:true});
  if(reduced.matches){settleOpen();return;}
  const ghost=snapshot(sourceVideo),to=hero.getBoundingClientRect();hero.style.visibility='hidden';
  await Promise.all([animate(ghost,[box(from),box(to)]),animate(ghost.firstElementChild,[{objectPosition:getComputedStyle(sourceVideo).objectPosition},{objectPosition:getComputedStyle(heroVideo).objectPosition}]),animate(panel,[{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'scale(1)'}])]);
  if(token===run&&phase==='opening')settleOpen();
 }
 function finishClose(){
  stopMotion();setPhase('closed');dialog.close();unlock();trigger.setAttribute('aria-expanded','false');
  (returnFocus?.isConnected?returnFocus:trigger).focus({preventScroll:true});notify();
 }
 async function close(){
  if(phase==='closed'||phase==='closing')return;
  const token=++run;stopMotion();setPhase('closing');
  if(reduced.matches){finishClose();return;}
  const from=hero.getBoundingClientRect(),to=card.getBoundingClientRect(),view=gallery.getBoundingClientRect();
  const canReturn=from.top>=Math.max(0,view.top)-1&&from.bottom<=Math.min(innerHeight,view.bottom)+1&&to.bottom>0&&to.top<innerHeight;
  const tasks=[animate(panel,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.98)'}])];
  if(canReturn){const ghost=snapshot(heroVideo);hero.style.visibility='hidden';tasks.push(animate(ghost,[box(from),box(to)]),animate(ghost.firstElementChild,[{objectPosition:getComputedStyle(heroVideo).objectPosition},{objectPosition:getComputedStyle(sourceVideo).objectPosition}]));}
  await Promise.all(tasks);if(token===run)finishClose();
 }
 trigger.hidden=false;trigger.parentElement.classList.add('viewer-ready');trigger.addEventListener('click',open);closeButton.addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('pointerdown',e=>{outsideDown=e.target===dialog;});
 dialog.addEventListener('pointerup',e=>{if(outsideDown&&e.target===dialog)close();outsideDown=false;});
 dialog.addEventListener('pointercancel',()=>{outsideDown=false;});
 // Native modal focus trapping is reinforced for consistent browser behavior.
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const last=gallery;
  if(e.shiftKey&&document.activeElement===closeButton){e.preventDefault();last.focus({preventScroll:true});}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();closeButton.focus({preventScroll:true});}
 });
 // No horizontal gesture interception for a single project: vertical scrolling
 // and system gestures remain native. Mobile arrows are hidden, not fake links.
 function settleMotion(){if(phase==='opening'){run++;settleOpen();}else if(phase==='closing'){run++;finishClose();}}
 addEventListener('resize',()=>{settleMotion();if(innerWidth>700)panel.scrollTop=0;else gallery.scrollTop=0;});
 reduced.addEventListener('change',()=>{if(reduced.matches)settleMotion();});
 addEventListener('pagehide',()=>{if(phase!=='closed'){run++;finishClose();}});
})();
