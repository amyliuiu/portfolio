/* Figma Pages for dev: one persistent name/nav, scroll-away introduction,
   and a mirrored, sparse-edge-first version of the accepted pixel arrival. */
(() => {
 'use strict';
 const root=document.documentElement,hero=document.querySelector('.landing'),brand=document.querySelector('.brand'),nav=document.querySelector('.primary-nav');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobileNav=matchMedia('(max-width:600px)'),control=window.PortfolioMotionControl;
 const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v)};
 const work=document.querySelector('#work'),workLinks=document.querySelectorAll('.primary-nav a[href="#work"],.footer-links a[href="#work"]');
 let nameTop=0,navTop=0,startSize=44,startLine=49.5,navSize=20,scrollFrame=0,workTop=0,headerHeight=80,workActive=false;
 const fontMeasure=document.createElement('canvas').getContext('2d');
 function measure(){
  workTop=work.getBoundingClientRect().top+scrollY;
  headerHeight=parseFloat(getComputedStyle(root).getPropertyValue('--header-height'));
  nameTop=document.querySelector('.name-space').getBoundingClientRect().top+scrollY;
  navTop=document.querySelector('.nav-anchor').getBoundingClientRect().top+scrollY;
  const css=getComputedStyle(document.querySelector('.intro>p'));startSize=parseFloat(css.fontSize);startLine=parseFloat(css.lineHeight);
  const navCSS=getComputedStyle(nav);navSize=parseFloat(navCSS.fontSize);
  // Use one cap-height reference on every page. Descenders such as Play's
  // “y” must not pull the marker below the main body of the letters.
  if(fontMeasure){
   fontMeasure.font=`${navCSS.fontSize} ${navCSS.fontFamily}`;
   const m=fontMeasure.measureText('H');
   const offset=(m.fontBoundingBoxAscent-m.fontBoundingBoxDescent-m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)/2;
   nav.style.setProperty('--marker-shift',`${Number.isFinite(offset)?offset:0}px`);
  }
  // Keep mobile glyph metrics stable. Scaling avoids re-laying out and
  // re-hinting the font at every fractional scroll step on mobile browsers.
  if(mobileNav.matches){brand.style.top='0px';brand.style.fontSize=startSize+'px';brand.style.lineHeight=startLine+'px';}
  else brand.style.transform='';
  update();
 }
 function update(){
  scrollFrame=0;const y=scrollY,p=ease(y/Math.max(1,nameTop-28));
  const top=Math.max(28,nameTop-y),size=startSize+(navSize-startSize)*p,line=startLine+(24-startLine)*p;
  if(mobileNav.matches){
   const scale=size/startSize,baselineOffset=(line-startLine*scale)/2;
   brand.style.transform=`translate3d(0,${top+baselineOffset}px,0) scale(${scale})`;
  }else{brand.style.top=top+'px';brand.style.fontSize=size+'px';brand.style.lineHeight=line+'px';}
  nav.style.top=mobileNav.matches?'28px':`${Math.max(28,navTop-y)}px`;
  root.style.setProperty('--hero-opacity',String(1-p));document.body.classList.toggle('is-docked',y>=nameTop-28);
  // Reveal the bar and marker together over the last 120px before Work reaches
  // the header. This reverses on return scroll, independent of load animations.
  const workProgress=ease((y-(workTop-headerHeight-120))/120);
  root.style.setProperty('--work-progress',String(reduced.matches?(workProgress>0?1:0):workProgress));
  const activeWork=workProgress>0;
  if(activeWork!==workActive){workActive=activeWork;workLinks.forEach(a=>{if(workActive)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
  document.querySelector('.intro').style.visibility=p===1?'hidden':'visible';
 }
 addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(update)},{passive:true});
 new ResizeObserver(measure).observe(hero);document.fonts.ready.then(measure);mobileNav.addEventListener('change',measure);measure();
 reduced.addEventListener('change',update);

 const container=document.querySelector('.footer-art');
 let geometry=null,stitches=[],palette=null,svg=null,canvas=null,ctx=null,frame=0,start=0,next=0,played=false,active=false,footerHover=null;
 function startFooterHover(){
  if(footerHover||!geometry||!svg||!played||active||reduced.matches||document.hidden||control.getAttribute('aria-pressed')==='false')return;
  footerHover=window.FooterPlaidThreads.create({
   field:svg,landing:container.closest('.page-footer'),control,
   sampleCell:window.PortfolioWeave.sampleCell,
   pointerPosition:event=>{const r=container.getBoundingClientRect();return {x:event.clientX-r.left,y:geometry.fadeEnd-(event.clientY-r.top)};},
  });
  // Render in original weave coordinates, then mirror both SVG and hover canvas.
  footerHover.refresh({...geometry,height:geometry.fadeEnd});
 }
 function finish(enableHover=true){
  cancelAnimationFrame(frame);frame=0;canvas?.remove();canvas=ctx=null;active=false;
  if(svg)svg.style.visibility='visible';container.dataset.state='settled';
  if(enableHover)startFooterHover();
 }
 function buildFooter(){
  const api=window.PortfolioWeave;if(!api?.getGeometry())return;
  const wasPlayed=played;footerHover?.destroy();footerHover=null;finish(false);geometry=api.getGeometry();const {width,fadeEnd,cell}=geometry;
  root.style.setProperty('--footer-art-height',`${fadeEnd}px`);
  const colors=getComputedStyle(root);
  palette={main:colors.getPropertyValue('--plaid-main').trim(),accent:colors.getPropertyValue('--plaid-accent').trim()};
  svg=document.querySelector('.plaid-field').cloneNode(true);svg.removeAttribute('class');
  svg.querySelectorAll('[data-motion]').forEach(n=>n.remove());svg.querySelector('[data-static-plaid]').removeAttribute('mask');
  svg.querySelectorAll('[id]').forEach(n=>{n.id='footer-'+n.id});
  svg.querySelectorAll('[fill]').forEach(n=>{const f=n.getAttribute('fill');if(f.startsWith('url(#'))n.setAttribute('fill',f.replace('url(#','url(#footer-'))});
  svg.setAttribute('height',fadeEnd);svg.setAttribute('viewBox',`0 0 ${width} ${fadeEnd}`);container.replaceChildren(svg);
  stitches=[];
  for(let row=0;row*cell<fadeEnd;row++)for(let col=0;col*cell<width;col++){
   const s=api.sampleCell(col,row);if(!s)continue;
   const at=window.HomePixelEntrance.math.arrivalAt(col,row,fadeEnd,cell)+650*(1-2*row*cell/fadeEnd);
   stitches.push({...s,y:fadeEnd-s.y-s.size,at});
  }
  stitches.sort((a,b)=>a.at-b.at);
  if(wasPlayed||reduced.matches||control.getAttribute('aria-pressed')==='false'){played=true;finish();}
  else{svg.style.visibility='hidden';container.dataset.state='waiting';checkFooter();}
 }
 function checkFooter(){
  if(!geometry||played||document.hidden)return;
  const r=container.getBoundingClientRect();if(r.top<innerHeight-32&&r.bottom>0)startFooter();
 }
 function startFooter(){
  played=true;
  if(reduced.matches||control.getAttribute('aria-pressed')==='false'){finish();return;}
  active=true;next=0;canvas=document.createElement('canvas');canvas.dataset.motion='footer-arrival';canvas.setAttribute('aria-hidden','true');
  const dpr=Math.min(devicePixelRatio||1,3);canvas.width=geometry.width*dpr;canvas.height=geometry.fadeEnd*dpr;canvas.style.width=geometry.width+'px';canvas.style.height=geometry.fadeEnd+'px';
  ctx=canvas.getContext('2d');if(!ctx){finish();return;}ctx.setTransform(dpr,0,0,dpr,0,0);container.append(canvas);start=performance.now();container.dataset.state='arriving';frame=requestAnimationFrame(tick);
 }
 function tick(now){
  if(!active)return;
  const elapsed=now-start;if(elapsed>=1200){finish();return;}
  const paths={main:new Path2D(),accent:new Path2D()};
  while(next<stitches.length&&stitches[next].at<=elapsed){const s=stitches[next++];paths[s.color].rect(s.x,s.y,s.size,s.size);}
  ctx.globalAlpha=1;ctx.fillStyle=palette.main;ctx.fill(paths.main);ctx.fillStyle=palette.accent;ctx.fill(paths.accent);
  canvas.dataset.shown=next;canvas.dataset.total=stitches.length;frame=requestAnimationFrame(tick);
 }
 new IntersectionObserver(checkFooter,{threshold:[0,.05,.2]}).observe(container);
 addEventListener('plaid:rendered',buildFooter);buildFooter();
 reduced.addEventListener('change',()=>{if(reduced.matches){played=true;finish();}else queueMicrotask(startFooterHover);});
 control.addEventListener('click',()=>queueMicrotask(()=>{if(control.getAttribute('aria-pressed')==='false'){played=true;finish();}else startFooterHover();}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)finish();else if(!document.hidden){checkFooter();startFooterHover();}});
})();
