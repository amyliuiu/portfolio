/* Compose the accepted one-shot entrance with the untouched C1 hover engine.
   Only one controller owns the SVG at a time. Resizing settles the entrance;
   reduced motion skips it; a pause during arrival carries into the hover phase. */
(() => {
  'use strict';
  const hoverFactory=window.PlaidThreads;
  const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobileNav=matchMedia('(max-width:600px)');
  let revealTimer=0,revealAnimations=[],revealRun=0;
  const needsReveal=!reduced.matches&&!location.hash&&scrollY===0;
  root.classList.toggle('landing-pending',needsReveal);
  root.classList.toggle('landing-links-pending',needsReveal);
  root.dataset.landingReveal=needsReveal?'pending':'settled';
  function settleLanding(){
    revealRun++; // Invalidate callbacks from canceled or completed sequences.
    clearTimeout(revealTimer);revealTimer=0;
    revealAnimations.forEach(a=>a.cancel());revealAnimations=[];
    root.classList.remove('landing-pending','landing-links-pending');root.dataset.landingReveal='settled';
  }
  function fadeLandingGroup(selector,state,pendingClass,run,onFinished){
    const animations=[...document.querySelectorAll(selector)].map(n=>n.animate([{opacity:0},{opacity:1}],{duration:500,easing:'ease-in-out'}));
    revealAnimations.push(...animations);
    root.classList.remove(pendingClass);root.dataset.landingReveal=state;
    Promise.all(animations.map(a=>a.finished.catch(()=>{}))).then(()=>{if(run===revealRun)onFinished();});
  }
  function revealLanding(){
    if(!root.classList.contains('landing-pending'))return;
    const run=++revealRun;
    clearTimeout(revealTimer);root.dataset.landingReveal='waiting';
    revealTimer=setTimeout(()=>{
      if(run!==revealRun)return;
      if(reduced.matches||document.hidden||scrollY>0){settleLanding();return;}
      // Name is part of the hero copy; social/navigation links are a second beat.
      // Docked headers are excluded, and scrolling cancels both stages at once.
      fadeLandingGroup('.intro>p,body:not(.is-docked)>.brand','revealing','landing-pending',run,()=>{
        root.dataset.landingReveal='waiting-links';
        revealTimer=setTimeout(()=>{
          if(run!==revealRun)return;
          if(reduced.matches||document.hidden||scrollY>0){settleLanding();return;}
          const links=mobileNav.matches?'.intro-meta':'.intro-meta,body:not(.is-docked)>.primary-nav';
          fadeLandingGroup(links,'revealing-links','landing-links-pending',run,settleLanding);
        },220);
      });
    },220);
  }
  // Never strand content if rendering is interrupted or a visitor skips ahead.
  if(needsReveal)revealTimer=setTimeout(settleLanding,5000);
  addEventListener('scroll',()=>{if(scrollY>0)settleLanding();},{passive:true});
  document.addEventListener('focusin',settleLanding,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)settleLanding();});
  reduced.addEventListener('change',()=>{if(reduced.matches)settleLanding();});
  mobileNav.addEventListener('change',settleLanding);
  // The retained engines share a control object, but the production page has no
  // motion toolbar. This button is deliberately never inserted into the DOM.
  window.PortfolioMotionControl=document.createElement('button');
  window.PortfolioMotionControl.setAttribute('aria-pressed','true');
  window.PlaidThreads=Object.freeze({create(args){
    let phase='new',geometry=null,entrance=null,hover=null;
    function setPhase(next){phase=next;args.field.dataset.homePhase=next;}
    function handOver({paused=false}={}){
      if(phase==='hover')return;
      entrance?.destroy();entrance=null;
      setPhase('hover');
      hover=hoverFactory.create(args);hover.refresh(geometry);
      window.dispatchEvent(new Event('plaid:entrance-complete'));
      revealLanding();
      // A click-triggered handoff is still inside HTMLElement.click(); nested
      // clicks on that same element are suppressed. Apply pause before next paint.
      if(paused)queueMicrotask(()=>args.control.click());
    }
    return {
      reset(){
        if(phase==='entrance'){
          entrance.destroy();entrance=null;setPhase('waiting-hover');
        }else hover?.reset();
      },
      refresh(nextGeometry){
        geometry=nextGeometry;
        if(phase==='new'){
          setPhase('entrance');
          entrance=window.HomePixelEntrance.create({...args,onFinish:handOver});
          entrance.refresh(geometry);
        }else if(phase==='waiting-hover')handOver();
        else if(phase==='hover')hover.refresh(geometry);
      },
    };
  }});
})();
