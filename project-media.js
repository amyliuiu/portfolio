// Visibility-aware grid and dynamic gallery videos, with explicit teardown.
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),dialog=document.getElementById('project-viewer'),managed=new Map();
 const apple=/Apple/.test(navigator.vendor)||/iP(hone|ad|od)/.test(navigator.userAgent);
 function attach(video){
  const inViewer=!!video.closest('.project-viewer');let inView=false,attempt=0;
  if(video.classList.contains('discount-animation')&&apple){const fallback=video.querySelector('source[type="video/mp4"]');if(fallback)video.src=fallback.src;}
  const allowed=()=>video.isConnected&&inView&&!document.hidden&&!reduced.matches&&(inViewer?dialog.open&&dialog.dataset.phase==='open':!dialog?.open);
  function sync(){const request=++attempt;if(!allowed()){video.pause();return;}video.play().then(()=>{if(request!==attempt&&!allowed())video.pause();}).catch(()=>{});}
  const cover=video._viewerCover;
  if(cover){
   const reveal=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(video.isConnected&&video.readyState>=2){cover.remove();delete video._viewerCover;}}));
   video.addEventListener('playing',()=>{
    if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(reveal);
    else video.addEventListener('timeupdate',reveal,{once:true});
   },{once:true});
  }
  video.muted=true;video.controls=false;
  const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting&&entry.intersectionRatio>=.15;sync();},{threshold:[0,.15]});observer.observe(video);
  managed.set(video,{sync,destroy(){attempt++;observer.disconnect();video.pause();}});
 }
 function refresh(){
  for(const [video,state] of managed)if(!video.isConnected){state.destroy();managed.delete(video);}
  for(const video of document.querySelectorAll('.project-image video,.project-viewer video'))if(!managed.has(video))attach(video);
  for(const state of managed.values())state.sync();
 }
 document.addEventListener('project-viewer:change',refresh);
 document.addEventListener('visibilitychange',refresh);reduced.addEventListener('change',refresh);refresh();
})();
