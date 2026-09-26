self.addEventListener('install',()=>self.skipWaiting());

self.addEventListener('activate',(event)=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push',(event)=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?event.data.text():''}}
  const title=data.title||'Finanzas Familiares';
  const options={
    body:data.body||'Tienes un nuevo aviso.',
    tag:data.tag||data.eventId||'finanzas-familiares',
    renotify:false,
    data:{url:data.url||'#inicio',eventId:data.eventId||null}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',(event)=>{
  event.notification.close();
  const data=event.notification.data||{};
  const target=new URL(self.registration.scope);
  if(data.eventId)target.searchParams.set('notification',data.eventId);
  target.hash=data.url||'#inicio';

  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus' in client){
        if('postMessage' in client)client.postMessage({type:'notificationclick',eventId:data.eventId||null,url:data.url||'#inicio'});
        return client.focus();
      }
    }
    if(self.clients.openWindow)return self.clients.openWindow(target.href);
  })());
});