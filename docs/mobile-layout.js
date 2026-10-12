(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.MobileLayout=api;api.install(root,root.document)}
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function measurements(viewport,layoutHeight,width,editing){
  if(width>760||!viewport||Math.abs((viewport.scale||1)-1)>.01)return null;
  const height=Number(viewport.height),top=Number(viewport.offsetTop)||0;
  if(!Number.isFinite(height)||height<=0)return null;
  return {height:Math.round(height),top:Math.max(0,Math.round(top)),keyboard:!!editing&&layoutHeight-height>120};
 }
 function install(win,doc){
  if(!doc||win.__casuoMobileLayout)return;win.__casuoMobileLayout=true;
  const html=doc.documentElement;
  function update(){
   const active=doc.activeElement;
   const editing=!!active&&((active.tagName==='INPUT'&&!['checkbox','radio','button','submit','file'].includes(active.type))||active.tagName==='TEXTAREA'||active.isContentEditable);
   const result=measurements(win.visualViewport,html.clientHeight,win.innerWidth,editing);
   html.classList.toggle('keyboard-open',!!result?.keyboard);
   if(result){html.style.setProperty('--visible-height',result.height+'px');html.style.setProperty('--visible-top',result.top+'px')}
   else{html.style.removeProperty('--visible-height');html.style.removeProperty('--visible-top')}
   if(result?.keyboard&&active?.closest&&win.requestAnimationFrame)win.requestAnimationFrame(()=>{
    if(doc.activeElement!==active)return;
    const modal=active.closest('.modal');if(!modal)return;
    const box=modal.getBoundingClientRect(),field=active.getBoundingClientRect();
    // Keep the focused field above the sticky save buttons without scrolling the page.
    if(field.bottom>box.bottom-88)modal.scrollTop+=field.bottom-(box.bottom-88);
    else if(field.top<box.top+16)modal.scrollTop-=box.top+16-field.top;
   });
  }
  win.visualViewport?.addEventListener('resize',update);
  win.visualViewport?.addEventListener('scroll',update);
  win.addEventListener('resize',update);win.addEventListener('pageshow',update);
  doc.addEventListener('focusin',update);doc.addEventListener('focusout',()=>win.setTimeout(update,0));
  update();
 }
 return {measurements,install};
});
