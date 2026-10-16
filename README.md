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

## Invitaciones visibles y cancelables (20261006.18)

Ajustes → Familia muestra Propietario/Miembro en español y señala la cuenta propia.
Explica qué se comparte y qué operaciones administra el propietario. Todas las
invitaciones vigentes se muestran con caducidad exacta, usos, copia del enlace y
cancelación confirmada. Crear otro enlace conserva los anteriores. El historial
muestra las últimas diez invitaciones cerradas sin sus códigos.

La cancelación actualiza únicamente `revoked_at`, filtrando por ID y hogar, y exige
una respuesta confirmada. Mantiene las políticas RLS existentes de propietario,
sin migraciones ni ampliación de permisos. Una respuesta tardía no modifica otra
sesión. Se bloquean pulsaciones repetidas mientras se crea o cancela una invitación.

Validación: 83 pruebas Node. `supabase/tests/family_invitations.sql` comprueba con
usuarios sintéticos y ROLLBACK: propietario propio, propietario externo, miembro,
invisibilidad de códigos, rechazo del código cancelado y conservación del miembro
ya incorporado. No se han cancelado invitaciones reales ni enviado mensajes.

## Recuperación de guardados (20261011.30)

Los formularios de movimientos, productos y tareas conservan sus campos en el
navegador, por usuario y hogar. Un guardado sin confirmar conserva su identificador
sin caducar y se recupera al abrir el formulario. El aviso de conexión muestra los
pendientes y permite revisarlos. No hay envíos automáticos al volver internet.
Esta función protege los cambios preparados con la app abierta; no convierte el
sitio ni la autenticación en un cliente completo que pueda arrancar sin internet.

Los movimientos reutilizan su `external_id`. Productos y tareas reutilizan un
UUID del cliente y comprueban si existe antes de insertar. Los cambios de lista
conservan el estado solicitado (comprado/completado), sin invertirlo en el reintento.
Las ediciones usan `updated_at` como condición de escritura y comprueban primero
si los campos ya están guardados. Si otra persona cambió el registro, la app pide
revisar la versión actual y nunca la sobrescribe en silencio. No se envía un cambio
si no se pudo conservar su borrador local. Una respuesta tardía tras cerrar sesión,
bloquear el dispositivo o cambiar de usuario no puede restaurar datos privados ni
modificar los borradores de la nueva sesión.

Pruebas: `node --test tests/*.test.cjs`, incluidas respuestas perdidas, cortes antes
del envío, recarga/reintento, almacenamiento lleno, edición concurrente y cancelación
de sesión. No se han modificado movimientos ni listas de usuarios reales.
# Revisión de aislamiento entre familias — 11 octubre 2026

Se revisaron RLS de todas las tablas públicas, vistas con `security_invoker`,
permisos de ejecución, funciones financieras y funciones de pertenencia.
Las pruebas con dos hogares y usuarios completamente sintéticos confirmaron
aislamiento de tablas/vistas y RPCs, rechazo de invitaciones caducadas,
revocadas o agotadas, y bloqueo de acciones del propietario para miembros.
Los datos temporales se revierten en cada bloque de
`supabase/tests/family_isolation_audit.sql`.

Se corrigió el envío push: consentimiento, evento y dispositivo deben coincidir
en hogar y usuario. Antes de cada envío se vuelven a comprobar el evento,
consentimiento, suscripción y pertenencia actual. Un trigger privado elimina
suscripciones, preferencias y eventos de ese hogar cuando se elimina una
pertenencia, tanto por salida como por revocación. No modifica otros hogares ni
historial financiero. El trabajo de avisos tampoco crea preferencias para un
usuario que ya no pertenece al hogar. Se verificó la limpieza mediante la salida
de un miembro sintético de dos hogares; la revocación directa por propietario
usa el mismo trigger, aunque ese DELETE no se ejecutó en esta revisión.

El servicio `family-notifications` conserva la autenticación propia con el token
privado de cron y solo acepta POST. La configuración inicial no puede generarse
por una petición anónima y los errores HTTP no exponen detalles internos.
La dependencia `web-push` conserva su versión fijada 3.6.7.

Validación: 143 pruebas Node, auditorías SQL por bloques y comprobación del
servicio desplegado sin credenciales (POST 401 y GET 405). El almacén de documentos
es privado y sus políticas exigen pertenencia actual; no se ejercitó la descarga
física ni se enviaron avisos reales. Los enlaces ya firmados duran 60 segundos;
los archivos descargados y avisos ya entregados no se pueden retirar remotamente.

Advisors no muestra nuevas advertencias. Permanecen 18 RPCs públicos con
`SECURITY DEFINER`, comprobados con autorización explícita; la extensión `pg_net`
en public; y la protección de contraseñas filtradas desactivada en Auth.
Referencias: [RPCs privilegiados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[pg_net](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

# Comodidad en móvil — 12 octubre 2026

La versión `20261012.32` incorpora `mobile.css` y `mobile-layout.js`. Se amplían
los controles táctiles, la navegación y las opciones de cuenta; los campos usan
al menos 16 px para evitar el zoom automático al editar en iPhone. El formulario
de movimientos pasa a una columna en móvil. La importación usa el desplazamiento
del propio formulario para reducir los paneles con scroll dentro de otro scroll.

El área de los formularios sigue la altura y desplazamiento de `visualViewport`.
Cuando un campo está activo y el teclado reduce el espacio, se ocultan los accesos
inferiores y se desplaza el campo dentro del formulario para dejar sitio a guardar.
El zoom manual sigue disponible y no activa la detección de teclado. Se conserva
el comportamiento previo en escritorio y el ajuste tiene alternativas sin API.

Validación: 147 pruebas Node y comprobación de sintaxis del JavaScript inline.
Las nuevas pruebas cubren teclado, cambio de orientación, zoom, foco y campos
cubiertos. No se modifican datos ni reglas de negocio. La comprobación visual en
Chromium/WebKit no pudo ejecutarse: los navegadores no estaban instalados y su
descarga falló. Queda comprobar con un iPhone físico el teclado, los controles
nativos de fecha y los márgenes al abrir desde pantalla de inicio.

# Añadir varios productos — 12 octubre 2026

Compra ofrece «Añadir varios» para escribir, pegar o dictar listas mediante el
micrófono del teclado del dispositivo. No se graba audio en Casuo ni se añade
ningún servicio de transcripción o IA de pago. `shopping-batch.js` separa comas,
saltos de línea y conjunciones, extrae cantidades sencillas y conserva comas
decimales. Acepta hasta 60 productos y 6000 caracteres; las frases complejas
requieren corrección en la revisión.

La revisión permite editar nombres y cantidades, seleccionar todos/desmarcar,
elegir coincidencias y guardar los productos como habituales. Las coincidencias
únicas reconocen acentos y algunos plurales comunes. Las coincidencias parciales
o múltiples exigen elección explícita. Los nombres repetidos se agrupan sin
sumar cantidades; si son distintas se pide revisarlas. Se mantienen nombres,
notas y secciones de los productos existentes. Una cantidad vacía conserva la
anterior; una cantidad escrita la sustituye. Al reutilizar un producto se vuelve
a poner en la lista pendiente, incluso si estaba comprado o retirado.

El borrador se conserva por usuario y hogar en el almacén local ya existente.
Antes de enviar se fija cada operación, con UUID para nuevas filas y versión
esperada para las existentes. Los productos se confirman uno a uno, con progreso
parcial visible y sin promesa de transacción atómica. Los reintentos omiten lo
confirmado y comprueban UUID/cambios antes de escribir; no se envían solos al
reconectar. Los fallos de almacenamiento impiden iniciar nuevos envíos. Un cambio
de sesión impide aplicar respuestas tardías. Se usan las APIs y políticas de
compra existentes; no hay cambios de esquema ni datos reales durante las pruebas.

Validación: 161 pruebas Node y sintaxis del JavaScript inline. Incluyen listas
naturales/pegadas, decimales, cantidades conflictivas, selección ambigua,
duplicados, metadatos conservados, pérdida de respuesta, progreso parcial,
reintentos, cambio de sesión y fallo de almacenamiento. La integración de la UI
se prueba con un DOM simulado; quedan la comprobación visual y el dictado en un
iPhone físico. Versión publicada: `20261012.33`.

# Presupuestos por categoría — 12 octubre 2026

`20261012.34` añade Finanzas → Presupuestos, con selector de mes, límites por
categoría de gasto y resumen en Inicio. Usa la tabla `budgets` y sus políticas
existentes: no se crean límites reales, ni se modifica el esquema o se añade un
servicio de pago. Todos los miembros del hogar pueden colaborar en los límites.

`budgets.js` calcula en céntimos gastos menos devoluciones según la fecha del
movimiento. Excluye inversiones, transferencias y movimientos futuros del mes
en curso. Las devoluciones se atribuyen al mes en que se registran, aunque puedan
corresponder a un gasto anterior. Una cifra neta negativa se muestra como tal.
Los gastos sin límite se presentan aparte; no entran en el disponible de las
categorías con límite, y ese disponible no es un saldo bancario. Un límite de
cero es explícito. Hay señales al 80 %, al alcanzar el límite y al superarlo;
son avisos dentro de la vista y de Inicio, no nuevas notificaciones push.

El mes en curso se compara con los mismos días del mes anterior, ajustando al
último día cuando el anterior es más corto. Los meses pasados se comparan
completos. Los límites se aplican solo al mes elegido; no hay renovación mensual
automática. Se pueden editar o quitar sin borrar gastos ni otros meses. La vista
se actualiza con cambios compartidos, también al consultar otro mes.

Se consultan todos los movimientos de los periodos necesarios con paginación,
no solo los 500 de la pantalla de movimientos. Inicio evita esa consulta adicional
si aún no hay categorías con límite. Los errores de carga no se presentan como
cero gastado y un fallo de la consulta de límites no detiene la sincronización
de los datos anteriores.

Los guardados conservan borrador, UUID y versión esperada, como compra y tareas.
No se sobreescriben cambios concurrentes ni se reenvían altas confirmadas.
Quitar un límite requiere confirmación y la versión vigente; una respuesta perdida
se comprueba con una nueva lectura y pertenencia actual. No se guarda una cola
local de borrado ni se ejecutan borrados al reconectar.

Validación: 177 pruebas Node, sintaxis del JavaScript inline y diff. Las pruebas
incluyen cálculo, devoluciones, decimales, umbrales, mes bisiesto, comparación
parcial, gastos sin límite, paginación, pérdida de respuesta, cambio de sesión,
fallo de almacenamiento, edición/borrado concurrente y sincronización del mes
seleccionado. `supabase/tests/budgets.sql` pasó con hogares sintéticos y rollback:
restricciones de categoría/mes/importe, duplicados, colaboración, aislamiento,
escritura condicional y pérdida de acceso. No cambió ningún presupuesto real.
Advisors conserva los avisos previos documentados, sin nuevos avisos. La UI se
comprueba con DOM simulado; sigue pendiente la revisión visual en iPhone físico.

### Build 20261016.35 — historical accounts and usual monthly spending

Analysis now reads the full household history with pagination, rather than estimating from the most recent 500 records. Users explicitly choose reviewed, completed calendar months from the last twelve; the current month cannot enter the average. The selection lasts for the current app session and is not a shared declaration of completeness. A selected empty month deliberately counts as zero; no month is automatically declared complete. Small samples and unknown payment origins are identified.

`usual-spending.js` computes actual net expense, exclusions and usual expense in cents, excluding investments, transfers and future transactions. The existing `exclude_from_normalized` flag is exposed in the transaction editor as an editable exclusion for extraordinary spending or another reason; existing exclusions keep their meaning. Linked refunds inherit the expense exclusion in this report. Exclusions remain in actual spending and exports. Configured active normalization allocations can replace the payment in the usual-cost calculation; the original account is used to attribute allocated cost. Ordinary annual bills are not automatically inferred or classified as extraordinary. The option can be disabled to examine payment-date spending. This report deliberately does not alter the existing accounting metrics or closure definitions.

The account review assigns a selected active household account to at most 100 previously unassigned transactions per batch. It never guesses from a similar concept. Transfers require individual review. The UI identifies closed months and requires the normal owner reopen/close workflow; batch writes do not bypass month locks. Each operation retains its original version, checks the household and uses an atomic `account_id IS NULL` / `updated_at` condition. Durable user/household-scoped checkpoints permit explicit retries after interruption; no automatic online writes occur. Confirmed assignments affect historical calculated account balances; users should review reconciliation afterwards. Edits also require their original version. Session changes cancel late work.

As an explicitly authorized one-time correction, seventeen September recurrent movements were linked to the unique account of the same recurring rule/type in October: fourteen expenses, one income and two investment contributions. The existing September closure was reopened and reclosed using the regular owner functions within one serializable transaction. Assertions required exactly seventeen changes, identical transaction content except account/timestamp, and an identical financial closure snapshot. September remains CLOSED with 55 other unassigned movements; no ambiguous assignments or extraordinary classifications were made. No personal record identifiers or private export are included in this repository.

Validation: 194 Node tests pass, including the existing suite and new calculation/controller cases for complete months, refunds, allocations, deduplication, unknown accounts, batch scope/limits, pagination, lost PATCH response, stale versions, atomic races, session changes, and editor exclusions. Inline JavaScript syntax and whitespace checks pass. Live RLS policies and composite household/account constraints were inspected; no new schema, grants, policies or privileged APIs were introduced. Security advisors retain the previously documented pg_net/public, authenticated SECURITY DEFINER and password-protection warnings. No signed-in browser or physical iPhone visual QA was performed for this build.
