// Visibility-aware previews and viewer media. Pause background videos while a
// modal is open; only visible, settled viewer media is allowed to play.
(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const dialog=document.getElementById('project-viewer');
 for(const video of document.querySelectorAll('.project-image video,.project-viewer video')){
 const inViewer=!!video.closest('.project-viewer');
 if(video.classList.contains('discount-animation')&&(/Apple/.test(navigator.vendor)||/iP(hone|ad|od)/.test(navigator.userAgent))){
  const fallback=video.querySelector('source[type="video/mp4"]');if(fallback)video.src=fallback.src;
 }
 let inView=false,attempt=0;
 const allowed=()=>inView&&!document.hidden&&!reduced.matches&&(inViewer?dialog.open&&dialog.dataset.phase==='open':!dialog?.open);
 function sync(){
  const request=++attempt;
  if(!allowed()){video.pause();return;}
  video.play().then(()=>{if(request!==attempt&&!allowed())video.pause();}).catch(()=>{});
 }
 video.muted=true;video.controls=false;
 const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting&&entry.intersectionRatio>=.15;sync();},{threshold:[0,.15]});
 observer.observe(video);
 document.addEventListener('visibilitychange',sync);
 document.addEventListener('project-viewer:change',sync);
 reduced.addEventListener('change',sync);
 }
})();
