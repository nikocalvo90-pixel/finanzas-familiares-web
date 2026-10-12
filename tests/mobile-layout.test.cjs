const test=require('node:test');const assert=require('node:assert/strict');
const {measurements,install}=require('../docs/mobile-layout.js');
test('keyboard adaptation follows the visible area and viewport offset',()=>{
 assert.deepEqual(measurements({height:410.4,offsetTop:78.2,scale:1},844,390,true),{height:410,top:78,keyboard:true});
 assert.equal(measurements({height:800,scale:1},844,390,true).keyboard,false);
 assert.equal(measurements({height:410,scale:1},844,390,false).keyboard,false);
});
test('pinch zoom and desktop do not become a keyboard or fixed viewport override',()=>{
 assert.equal(measurements({height:410,scale:2},844,390,true),null);
 assert.equal(measurements({height:410,scale:1},844,1200,true),null);
 assert.equal(measurements(null,844,390,true),null);
 assert.equal(measurements({height:NaN},844,390,true),null);
});
test('focus and rotation clear keyboard state and overrides without duplicate listeners',()=>{
 const styles=new Map(),classes=new Map(),events={},viewportEvents={};let listeners=0;
 const doc={documentElement:{clientHeight:844,style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},classList:{toggle:(k,v)=>classes.set(k,v)}},activeElement:{tagName:'INPUT',type:'text'},addEventListener:(k,f)=>{listeners++;events[k]=f}};
 const win={innerWidth:390,visualViewport:{height:410,offsetTop:78,scale:1,addEventListener:(k,f)=>viewportEvents[k]=f},addEventListener:(k,f)=>events[k]=f,setTimeout:f=>f()};
 install(win,doc);assert.equal(classes.get('keyboard-open'),true);assert.equal(styles.get('--visible-height'),'410px');
 install(win,doc);assert.equal(listeners,2);
 doc.activeElement=null;events.focusout();assert.equal(classes.get('keyboard-open'),false);
 win.innerWidth=1200;events.resize();assert.equal(styles.size,0);
});
test('a field covered after keyboard resize is scrolled inside its form',()=>{
 let frame;const modal={scrollTop:0,getBoundingClientRect:()=>({top:30,bottom:440})};
 const active={tagName:'INPUT',type:'text',closest:()=>modal,getBoundingClientRect:()=>({top:390,bottom:436})};
 const doc={activeElement:active,documentElement:{clientHeight:844,style:{setProperty(){},removeProperty(){}},classList:{toggle(){}}},addEventListener(){}};
 const win={innerWidth:390,visualViewport:{height:410,offsetTop:30,scale:1,addEventListener(){}},addEventListener(){},requestAnimationFrame:f=>frame=f};
 install(win,doc);frame();assert.equal(modal.scrollTop,84);
 modal.scrollTop=0;doc.activeElement=null;frame();assert.equal(modal.scrollTop,0,'late frame does not move an unfocused form');
});
