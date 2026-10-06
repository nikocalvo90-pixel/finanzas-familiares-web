(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FamilyAccess=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function email(value){const s=String(value||'').trim();if(s.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw Error('Introduce un email válido.');return s}
 function password(value,repeat){const s=String(value||'');if(s.length<8)throw Error('Usa una contraseña de al menos 8 caracteres.');if(new TextEncoder().encode(s).length>72)throw Error('La contraseña es demasiado larga (máximo 72 bytes).');if(s!==repeat)throw Error('Las dos contraseñas no coinciden.');return s}
 function emailError(e){if(e.status===429)return 'Se han solicitado demasiados correos. Espera unos minutos antes de reintentar.';if(/not authorized|email_address_not_authorized/i.test(e.message||''))return 'El servicio de correo todavía no permite enviar a esta dirección. Contacta con el administrador de la app.';return 'No se pudo solicitar el correo. Puedes reintentar más tarde.'}
 return {email,password,emailError};
});
