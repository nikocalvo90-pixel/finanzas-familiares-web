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
