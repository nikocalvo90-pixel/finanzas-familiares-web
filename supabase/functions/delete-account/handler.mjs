const origins=new Set(['https://casuo.es','https://www.casuo.es','https://nikocalvo90-pixel.github.io']);
// No SDK or dependencies: Auth validates both the caller's JWT and password.
// The privileged key only exists in the Edge runtime, never in the web app.
export function createHandler({url,anonKey,serviceKey,fetcher=fetch}){
 return async req=>{
  const origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(status,message,extra={})=>new Response(JSON.stringify({message,...extra}),{status,headers});
  if(origin&&!origins.has(origin))return reply(403,'Origen no permitido.');
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,'Método no permitido.');
  if(!url||!anonKey||!serviceKey)return reply(503,'La baja no está disponible en este momento.');
  const authorization=req.headers.get('authorization')||'';
  if(!/^Bearer \S+$/i.test(authorization))return reply(401,'Inicia sesión para eliminar tu cuenta.');
  let body;
  try{if(Number(req.headers.get('content-length')||0)>4096)return reply(413,'Solicitud demasiado grande.');const raw=await req.text();if(raw.length>4096)return reply(413,'Solicitud demasiado grande.');body=JSON.parse(raw)}catch{return reply(400,'Solicitud no válida.')}
  if(body?.confirmation!=='ELIMINAR'||typeof body.password!=='string'||!body.password||body.password.length>1024)return reply(400,'Introduce tu contraseña y escribe ELIMINAR.');
  const call=async(path,options={})=>{
   const res=await fetcher(url+path,{...options,signal:AbortSignal.timeout(15000)});
   let data;try{data=await res.json()}catch{data=null}return {ok:res.ok,status:res.status,data};
  };
  let freshToken;
  try{
   const caller=await call('/auth/v1/user',{headers:{apikey:anonKey,Authorization:authorization}});
   if(!caller.ok||!caller.data?.id||!caller.data.email||caller.data.deleted_at)return reply(401,'Tu sesión ya no está disponible. Vuelve a entrar.');
   const user=caller.data;
   const ownership=await call('/rest/v1/household_members?user_id=eq.'+encodeURIComponent(user.id)+'&role=eq.OWNER&select=household_id&limit=1',{headers:{apikey:anonKey,Authorization:authorization}});
   if(!ownership.ok||!Array.isArray(ownership.data))return reply(503,'No se pudieron comprobar tus hogares. Inténtalo más tarde.');
   if(ownership.data.length)return reply(409,'Transfiere primero la propiedad de todos tus hogares. Puedes hacerlo en Mi hogar.');
   const verified=await call('/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:body.password})});
   body.password='';
   if(!verified.ok)return reply(verified.status===429?429:400,verified.status===429?'Demasiados intentos. Espera unos minutos.':'No se pudo verificar la contraseña actual.');
   freshToken=verified.data?.access_token;
   if(!freshToken||verified.data?.user?.id!==user.id)return reply(403,'No se pudo verificar tu identidad.');
   // Atomic Auth transaction: our triggers check ownership and remove membership,
   // profile and notifications; Auth clears credentials and every session.
   const deleted=await call('/auth/v1/admin/users/'+encodeURIComponent(user.id),{method:'DELETE',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({should_soft_delete:true})});
   if(!deleted.ok)return reply(409,'No se pudo completar la baja. Si eres propietario, transfiere el hogar primero; si no, vuelve a intentarlo más tarde.');
   return reply(200,'Tu cuenta de Casuo se ha eliminado.',{deleted:true,user_id:user.id});
  }catch{return reply(503,'No se pudo confirmar la baja. Vuelve a entrar para comprobar el estado de tu cuenta.')}
  finally{
   if(body)body.password='';
   // A failed deletion must not leave an extra reauthentication session behind.
   if(freshToken)try{await fetcher(url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:anonKey,Authorization:'Bearer '+freshToken},signal:AbortSignal.timeout(5000)})}catch{}
  }
 };
}
