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
