# Finanzas Familiares — web

Frontend público de la PWA. La base de datos y la autenticación viven en Supabase y están protegidas por RLS.

`main` se usa primero como staging hasta completar las pruebas reales. No contiene claves de administrador ni datos financieros.

## Reglas inteligentes (20260927.4)

En **Ajustes → Reglas inteligentes** se pueden crear, editar y pausar reglas del
hogar. Las coincidencias exactas tienen prioridad; después se usa la frase más
específica. Las coincidencias de palabras respetan límites de palabras e ignoran
mayúsculas y acentos. Si hay reglas igualmente específicas con categorías
distintas, el movimiento queda pendiente de revisión.

Al cambiar una categoría en un alta, una edición o la vista previa de importación,
«Recordar» guarda una regla exacta al confirmar el movimiento. La sugerencia por
sí sola no entrena. Desmarcar esa casilla evita aprender; las reglas pausadas no se
reactivan. No hay reclasificación ni aprendizaje retroactivo del histórico.

`docs/smart-rules.js` contiene el motor compartido. La migración de Supabase añade
reglas con RLS por hogar, auditoría, validación de categoría/tipo, un indicador de
aprendizaje por movimiento y un trigger con permisos del usuario. El movimiento
y su regla se guardan en la misma transacción; las importaciones duplicadas no
generan aprendizaje. Los cambios de reglas participan en la sincronización del
hogar. Los clientes anteriores conservan su comportamiento (aprendizaje desactivado
por defecto).

Validación: `node --test tests/*.test.cjs`. El archivo
`supabase/tests/smart_category_rules.sql` comprueba aprendizaje, pausa, validación,
importación y aislamiento con el rol autenticado. Sus datos sintéticos se revierten
con `ROLLBACK`; requiere un hogar con un miembro y una cuenta activa.

## Documentos privados (20260927.5)

En **Movimientos → Documentos** se adjuntan tickets, facturas y justificantes.
**Ver documentos** abre el archivo del hogar, incluidos los retirados al activar
«Mostrar retirados». Admite PDF, JPG, PNG, WebP, HEIC y HEIF hasta 10 MB; valida
cabecera y extensión. HEIC/HEIF puede requerir descarga para abrirse.

Los archivos se guardan en un bucket privado con acceso por hogar. Abrir y
descargar genera un enlace válido durante 60 segundos. El original es inmutable.
Una huella SHA-256 evita duplicados por movimiento; si la subida se interrumpe,
seleccionar el mismo archivo retoma el registro pendiente. Retirar es reversible.
Eliminar un movimiento conserva sus documentos retirados en el archivo general,
sin permitir restaurarlos a un movimiento inexistente. No incluye OCR.

`docs/transaction-documents.js` contiene validación y recuperación de subidas.
Validación: `node --test tests/*.test.cjs` (30 pruebas).
`supabase/tests/transaction_documents.sql` comprueba permisos, aislamiento,
metadatos, duplicados y conservación con `ROLLBACK`. La prueba SQL usa metadatos
sintéticos de Storage; no ejercita el transporte físico de archivos. El flujo
completo de subida desde una sesión autenticada queda pendiente de comprobación.

## Comparativa mensual (20260927.6)

Análisis permite elegir dos meses y comparar ingresos, gastos, devoluciones y
ahorro operativo en euros y porcentaje. Pulsa un importe para ver todos sus
movimientos. El desglose por categoría muestra gasto neto de devoluciones e
incluye categorías presentes solo en uno de los meses y movimientos sin categoría.
Se consultan ambos meses con paginación, sin el límite de 500 de Movimientos.
Los importes se suman en céntimos; inversión y transferencias no son gasto.
Un mes en curso se señala como incompleto y una base cero no genera porcentajes
infinitos. No modifica movimientos ni la base de datos.

Pruebas: `node --test tests/*.test.cjs` (35 pruebas). El cálculo tiene pruebas
de devoluciones, precisión, meses iguales, bases negativas/cero y más de 500
registros. La vista autenticada requiere comprobación desde una sesión real.

## Este mes (20260927.7)

Inicio muestra progreso del mes, ahorro operativo registrado y su proporción de
los ingresos, tres categorías con mayor gasto y próximos vencimientos de reglas
de gasto/inversión hasta fin de mes. Muestra el siguiente vencimiento de cada
regla, no una proyección de todas las repeticiones ni un saldo disponible.
Las fechas pasadas se marcan para revisar y los pagos manuales no se presentan
como impagados confirmados. Gestionar abre Ajustes → Recurrentes.
Al cambiar de mes la sincronización refresca los indicadores aunque no haya
cambios de movimientos. No cambia datos ni crea movimientos adicionales.
Validación: 39 pruebas Node y revisión sintáctica. UI autenticada pendiente de
comprobación desde una sesión real.

## Copias portables (20260927.8)

Ajustes → Copias de seguridad prepara un ZIP de hasta 100 MB y ofrece un botón
separado Guardar para descargar o compartir desde iPhone. Incluye datos completos
paginados de 24 tablas financieras/organización, hogar, miembros, etiquetas de
movimientos y originales READY de documentos, incluidos retirados. No incluye
autenticación, sesiones, invitaciones, notificaciones, auditoría ni originales
de subidas pendientes; estos últimos se declaran en el manifiesto.

Dos lecturas iguales detectan cambios durante la generación; no sustituyen una
instantánea transaccional de servidor. SHA-256 y CRC validan los archivos y ZIP.
La comprobación de un ZIP es local, no envía el archivo ni modifica datos. Es
una verificación de integridad, no una firma de autenticidad. ZIP sin cifrar.
No hay programación automática ni restauración desde la app en esta versión.
Los límites o fallos impiden entregar una copia parcial.

Validación: 46 pruebas Node; pruebas de originales retirados, subidas pendientes,
cambios concurrentes, límite, corrupción y tablas ausentes. Falta comprobar la
exportación completa con sesión autenticada y la descarga en un iPhone real.

## Registro móvil e importación (20260927.9)

Nuevo movimiento ofrece Rellenar campos sin interpretar texto. El borrador guarda
texto y formulario en localStorage, separado por usuario/hogar, con caducidad de
30 días. Se recupera al abrir Registrar; cerrar conserva, Descartar elimina y el
éxito de guardado limpia el borrador. No sincroniza borradores entre dispositivos.
Si el navegador rechaza almacenamiento se indica explícitamente.

Cada alta conserva un external_id durante los reintentos. Consulta antes de
insertar y tras un fallo ambiguo; la restricción única existente del servidor
evita duplicados. Un envío incierto congela el contenido para comprobar/reintentar
el mismo movimiento; errores definitivos de validación/permisos permiten editar.
La sincronización de fondo espera mientras haya un formulario modal abierto.
Controles móviles ajustados a 44 px y campos de 16 px para facilitar el uso.

La vista previa Excel/CSV permite renombrar conceptos conservando el identificador
del extracto y la comprobación de posibles duplicados del concepto original.
Seleccionar todas las válidas incluye filas revisables, previa advertencia si hay
dudas, pero excluye filas inválidas, ya importadas o de meses cerrados. También
permite desmarcar todas. Los movimientos guardados siguen editándose desde Editar.

Validación: 52 pruebas Node, sintaxis y diff. Probados borradores por usuario/hogar,
caducidad, errores de almacenamiento, respuestas de guardado perdidas, nombres
editados con identidad estable y selección masiva con exclusiones. Falta probar
la interacción completa con sesión autenticada en un iPhone real.

## Compra compartida (20260927.10)

Sección Compra para añadir productos, cantidad libre, nota, sección y marca de
habitual. Agrupa pendientes, conserva comprados y permite volver a añadir o
retirar y recuperar productos. No registra gastos al marcar comprado.
Nombres únicos por hogar sin distinguir mayúsculas evitan duplicados accidentales.
Cambios sincronizados mediante sondeo cada 8 segundos con app visible y sin
modal abierto; Actualizar datos fuerza la lectura. No hay modo de edición offline.

Tabla shopping_items con RLS, permisos de miembro, auditoría y sin DELETE para
usuarios. Las copias ZIP nuevas la incluyen como tabla opcional: las antiguas
siguen siendo verificables. Migración aplicada 20260927194004_shopping_list.
54 pruebas Node pasan; prueba SQL de dos miembros, aislamiento, duplicados,
restauración y permisos pasa con ROLLBACK. Sin nuevas advertencias de seguridad.
Pendiente interacción completa desde dos sesiones autenticadas en dispositivos.

## Restauración conservadora (20260927.11)

Ajustes → Copias de seguridad → Restaurar una copia (solo propietario). Verifica
el ZIP y analiza los datos en el servidor con una transacción revertida, incluida
su auditoría. La confirmación requiere el token de la vista previa: si cambian
los datos se debe analizar de nuevo. Solo inserta registros ausentes; diferencias
con el mismo ID se muestran y se conserva el registro actual. Conflictos de
restricciones únicas o referencias inválidas bloquean el lote sin aplicar cambios.
Máximo 20 MB de JSON y 20000 registros; ZIP mantiene límite de 100 MB.

Recuperación de datos atómica con permisos del usuario y comprobación de
referencias del mismo hogar. No restaura miembros/permisos, no reabre meses
cerrados ni vuelve a entrenar reglas de categoría. Las reglas recurrentes nuevas
quedan pausadas. Las periodizaciones recuperadas regeneran sus repartos; los
repartos faltantes de calendarios existentes no se reconstruyen en esta versión.
Dependencias de tareas/movimientos se ordenan antes de insertar; ciclos bloquean.

Los originales se suben después de los datos. Fallos de subida dejan registros
PENDING que se recuperan reanalizando el mismo ZIP. No se sobrescriben originales
existentes. Los documentos huérfanos conservan su referencia y estado retirado.
Se permite devolver READY a PENDING únicamente si el objeto original está ausente.
El ZIP se verifica localmente; el análisis envía su JSON al Supabase del hogar, y
la confirmación envía los originales pendientes.

Validación: 56 pruebas Node. SQL con ROLLBACK verifica vista previa, aplicación,
token obsoleto, no sobrescritura, permisos, datos ajenos, recuperación de documentos
huérfanos, movimientos sin reaprendizaje y periodizaciones con recurrentes pausados.
La simulación de una instantánea real da cero inserciones/conflictos. Sin nuevas
advertencias de seguridad. Pendiente flujo autenticado completo y transporte físico
de archivos; los tests de Storage usan metadatos sintéticos, no originales reales.

## Seguridad e integridad (20260928.14)

El bloqueo se comprueba al navegar, renderizar, consultar datos y recibir avisos.
Bloquear o cerrar sesión retira datos de la memoria y pantalla, detiene el sondeo,
cancela peticiones y descarta respuestas tardías, incluidas renovaciones de sesión.
Cerrar sesión en otra pestaña también limpia la pantalla. El cierre local es
inmediato; la revocación remota y la baja de avisos de ese dispositivo son intentos
de red con tiempo limitado, sin desactivar los avisos del resto de dispositivos.
Entrar con contraseña conserva la configuración biométrica. Los borradores
locales por usuario/hogar conservan su política anterior de recuperación/caducidad.
La biometría protege la interfaz local; no sustituye la autorización del servidor.

La base de datos valida 27 relaciones con claves compuestas por hogar, además de
etiquetas de movimientos y conciliaciones. Hogar e identificador son inmutables.
Se conservan las acciones de borrado y la restauración de copias entiende las nuevas
claves. El control de meses comprueba fechas originales y nuevas, periodizaciones
y sus repartos. Cierre, reapertura y escrituras financieras usan el mismo bloqueo
transaccional por hogar. Solo el propietario puede cerrar/reabrir y el servidor
impide cerrar antes del último día del mes, según la zona horaria del hogar.

Validación: 70 pruebas Node, incluidas 14 de sesión con respuestas tardías y
desbloqueo válido. Las cinco suites SQL de integridad, restauración, documentos,
reglas y compra pasan con ROLLBACK y rol autenticado. La migración también ejecuta
su prueba de integridad antes de confirmar, revirtiendo solo sus hogares sintéticos.
Pendiente comprobación física de Face ID y del flujo completo desde un iPhone.

Sin nuevas advertencias del asesor de seguridad. Siguen pendientes la
[protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
y la [ubicación de pg_net](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
Las 18 RPC existentes con autoridad elevada mantienen sus comprobaciones de
miembro/propietario; los nuevos triggers usan los permisos del usuario.

## Primer acceso de familias (20261006.16)

Crear cuenta admite una invitación opcional. Tras confirmar el correo, una cuenta
sin hogar puede crear el suyo o entrar con un código. La configuración pide nombre
del hogar y del miembro; después permite crear una primera cuenta corriente en EUR,
con saldo y fecha, o dejar las cuentas para más adelante. Los hogares iniciales
usan Europe/Madrid. La bienvenida ofrece preparar y copiar una invitación o entrar
sin invitar; las invitaciones siguen disponibles en Ajustes → Familia.

La RPC `initialize_household` conserva SECURITY INVOKER y llama a las operaciones
existentes de creación autorizada de hogar y cuenta. Toda la configuración se guarda
en una transacción. Un bloqueo por usuario serializa reintentos; si ya pertenece a
un hogar, devuelve su membresía sin crear otro ni cambiar sus datos. El saldo genera
una referencia patrimonial, nunca un movimiento de ingreso. Los usuarios existentes
siguen entrando directamente. No añade soporte de cambio entre varios hogares.

Validación: 73 pruebas Node; `supabase/tests/family_onboarding.sql` usa tres usuarios
sintéticos con rol autenticado y ROLLBACK. Comprueba creación con/sin cuenta, saldo,
validaciones, reintentos, aislamiento de lectura/escritura e invitación. El flujo de
correo de confirmación con direcciones externas y la entrega SMTP requieren una
comprobación aparte antes de abrir el registro a muchas familias.

La interacción se comprobó además con el DOM real de las pantallas y API simulada:
alta sin código, cuenta opcional, invitación y recuperación después de un fallo de
carga. La revisión visual en navegador queda pendiente: el entorno impidió iniciar
Chrome por una restricción de sockets. Estas comprobaciones no sustituyen una
prueba completa del correo y los dispositivos reales.

## Acceso y bienvenida de ejemplo (20261006.17)

Entrar ofrece recuperación de contraseña y reenvío de confirmación. Las solicitudes
usan mensajes neutrales y no revelan si una dirección tiene cuenta. Un enlace con
`type=recovery` guarda una sesión restringida: el router y las peticiones privadas
no permiten consultar finanzas antes del cambio de contraseña, incluso tras renovar
el token. Guardar termina la sesión local y pide entrar con la contraseña nueva.
Desde Ajustes → Seguridad se puede cambiar la contraseña, verificando primero la
actual mediante una sesión nueva del mismo usuario. Los campos no se persisten.

Ajustes → Aplicación → Ver bienvenida recorre las pantallas con datos de ejemplo.
El recorrido no llama a las RPC de creación, no genera invitaciones ni modifica
el hogar. El sondeo de fondo espera hasta que se vuelva a Ajustes.

Validación: 80 pruebas Node, incluidas sesiones de recuperación, bloqueo de datos,
renovación, contraseña actual incorrecta y respuesta de reautenticación tardía.
Interacción DOM con API simulada verifica vista de ejemplo sin escrituras, solicitud
de recuperación, reenvío conservando invitación y confirmación de nueva contraseña.
No se han enviado correos de prueba ni modificado contraseñas de usuarios reales.

La consulta pública de Auth realizada el 6/10 confirma `mailer_autoconfirm=true`
y registro habilitado. Actualmente un alta válida puede iniciar sesión directamente,
sin verificar el email. El conector disponible no permite consultar/configurar SMTP
ni cambiar esa opción. Antes de abrir el acceso general se requiere verificar el
servicio de correo para direcciones externas, sus redirecciones y activar confirmación
de email cuando la entrega esté preparada. La documentación oficial describe las
[restricciones del SMTP predeterminado](https://supabase.com/docs/guides/auth/auth-smtp).
La revisión visual en dispositivos reales sigue pendiente.
