(function(global,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else global.CasuoLanding=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const markup = "<svg class=\"svg-library\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\">\n  <symbol id=\"i-house\" viewBox=\"0 0 32 32\"><path d=\"M5 14 16 5l11 9v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z\"/><path d=\"M21 15a7 7 0 1 0 0 9\"/></symbol>\n  <symbol id=\"i-arrow\" viewBox=\"0 0 24 24\"><path d=\"M5 12h14m-6-6 6 6-6 6\"/></symbol>\n  <symbol id=\"i-check\" viewBox=\"0 0 24 24\"><path d=\"m5 12 4 4L19 6\"/></symbol>\n  <symbol id=\"i-wallet\" viewBox=\"0 0 24 24\"><path d=\"M19 7V4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h15V7H5a1 1 0 0 1 0-2\"/><path d=\"M20 11h-6v5h6m-3-2.5h.01\"/></symbol>\n  <symbol id=\"i-chart\" viewBox=\"0 0 24 24\"><path d=\"M4 3v17h17M8 15v-4m5 4V6m5 9v-6\"/></symbol>\n  <symbol id=\"i-basket\" viewBox=\"0 0 24 24\"><path d=\"m3 9 2 11h14l2-11ZM8 9l4-6 4 6M9 13v3m6-3v3M2 9h20\"/></symbol>\n  <symbol id=\"i-repeat\" viewBox=\"0 0 24 24\"><path d=\"M4 10V6h14l-3-3M20 14v4H6l3 3M4 6l-3 3m19 9 3-3\"/></symbol>\n  <symbol id=\"i-people\" viewBox=\"0 0 24 24\"><circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5\"/></symbol>\n  <symbol id=\"i-plus\" viewBox=\"0 0 24 24\"><path d=\"M12 5v14M5 12h14\"/></symbol>\n  <symbol id=\"i-chevron\" viewBox=\"0 0 24 24\"><path d=\"m8 10 4 4 4-4\"/></symbol>\n  <symbol id=\"i-lock\" viewBox=\"0 0 24 24\"><rect x=\"5\" y=\"10\" width=\"14\" height=\"11\" rx=\"2\"/><path d=\"M8 10V6a4 4 0 0 1 8 0v4m-4 5v2\"/></symbol>\n  <symbol id=\"i-phone\" viewBox=\"0 0 24 24\"><rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"3\"/><path d=\"M10 5h4m-3 14h2\"/></symbol>\n  <symbol id=\"i-upload\" viewBox=\"0 0 24 24\"><path d=\"M12 16V3m-4 4 4-4 4 4M4 15v6h16v-6\"/></symbol>\n  <symbol id=\"i-spark\" viewBox=\"0 0 24 24\"><path d=\"m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z\"/></symbol>\n  <symbol id=\"i-menu\" viewBox=\"0 0 24 24\"><path d=\"M4 7h16M4 12h16M4 17h16\"/></symbol>\n</svg>\n<a class=\"skip-link\" href=\"#contenido\">Saltar al contenido</a>\n<header class=\"site-header\">\n  <div class=\"container header-inner\">\n    <a class=\"brand\" href=\"#inicio\" aria-label=\"Casuo, inicio\"><svg class=\"brand-mark\"><use href=\"#i-house\"/></svg><span>casuo<span class=\"brand-dot\">.</span></span></a>\n    <button class=\"menu-toggle icon-button\" aria-label=\"Abrir menú\" aria-controls=\"main-nav\" aria-expanded=\"false\"><svg class=\"icon\"><use href=\"#i-menu\"/></svg></button>\n    <nav id=\"main-nav\" aria-label=\"Navegación principal\">\n      <a href=\"#funciones\">Qué puedes hacer</a><a href=\"#como-funciona\">Cómo funciona</a><a href=\"#preguntas\">Dudas frecuentes</a>\n    </nav>\n    <a class=\"header-login\" href=\"https://casuo.es/\">Entrar <svg class=\"icon\"><use href=\"#i-arrow\"/></svg></a>\n  </div>\n</header>\n<main id=\"contenido\" tabindex=\"-1\">\n  <section class=\"hero\" id=\"inicio\" aria-labelledby=\"hero-title\">\n    <div class=\"container hero-grid\">\n      <div class=\"hero-copy\">\n        <p class=\"eyebrow\"><span class=\"status-dot\"></span> TU HOGAR, EN EQUIPO</p>\n        <h1 id=\"hero-title\">Menos cuentas.<br>Más vida en <em>familia.</em></h1>\n        <p class=\"hero-description\">Los gastos, los planes y la compra de casa. Todo en un mismo lugar, para que organizaros sea un poco más fácil.</p>\n        <div class=\"hero-actions\"><a class=\"button button-dark\" href=\"https://casuo.es/\">Empezar con Casuo <svg class=\"icon\"><use href=\"#i-arrow\"/></svg></a><a class=\"text-link\" href=\"#funciones\">Explorar la demo <span aria-hidden=\"true\">↘</span></a></div>\n        <p class=\"hero-note\"><svg class=\"icon\"><use href=\"#i-check\"/></svg> Descubre cómo funciona sin crear una cuenta.</p>\n        <div class=\"hero-people\"><span class=\"avatar avatar-one\" aria-hidden=\"true\">A</span><span class=\"avatar avatar-two\" aria-hidden=\"true\">D</span><span>Un espacio compartido.<br><strong>Cada uno, desde su móvil.</strong></span></div>\n      </div>\n      <div class=\"hero-visual\" aria-label=\"Ejemplo del resumen mensual de Casuo\">\n        <div class=\"dashboard-window\">\n          <aside class=\"mock-sidebar\" aria-hidden=\"true\"><svg class=\"mini-brand\"><use href=\"#i-house\"/></svg><span class=\"mock-nav active\"><svg class=\"icon\"><use href=\"#i-chart\"/></svg></span><span class=\"mock-nav\"><svg class=\"icon\"><use href=\"#i-wallet\"/></svg></span><span class=\"mock-nav\"><svg class=\"icon\"><use href=\"#i-basket\"/></svg></span><span class=\"mock-nav\"><svg class=\"icon\"><use href=\"#i-repeat\"/></svg></span><span class=\"sidebar-avatar\">A</span></aside>\n          <div class=\"mock-main\">\n            <div class=\"mock-top\"><span><span class=\"tiny-label\">VUESTRO ESPACIO</span><strong>Casa, dulce casa <span class=\"house-emoji\" aria-hidden=\"true\">⌂</span></strong></span><span class=\"mock-avatars\" aria-label=\"Dos miembros\"><i>A</i><i>D</i></span></div>\n            <div class=\"mock-heading\"><h2>Todo va tomando forma.</h2><span class=\"month-pill\">Octubre <svg class=\"icon\"><use href=\"#i-chevron\"/></svg></span></div>\n            <div class=\"balance-grid\"><div><span>Ingresos del mes</span><strong>4.200<span>,00 €</span></strong><small><span class=\"green-dot\"></span> Lo que entra</small></div><div><span>Gastos del mes</span><strong>2.480<span>,00 €</span></strong><small><span class=\"coral-dot\"></span> Lo que sale</small></div></div>\n            <div class=\"chart-card\"><div class=\"chart-top\"><h3>Vuestro mes, de un vistazo</h3><span>OCT</span></div><div class=\"mini-chart\" aria-label=\"Ejemplo ilustrativo de gasto semanal\"><span class=\"chart-label\">1.000 €</span><div class=\"chart-grid\"><div style=\"--bar:55%\"><i></i><small>Semana 1</small></div><div style=\"--bar:80%\"><i></i><small>Semana 2</small></div><div style=\"--bar:46%\"><i></i><small>Semana 3</small></div><div class=\"bar-future\" style=\"--bar:24%\"><i></i><small>Semana 4</small></div></div></div></div>\n            <div class=\"mock-transaction\"><span class=\"transaction-icon peach\"><svg class=\"icon\"><use href=\"#i-basket\"/></svg></span><span><strong>Compra de la semana</strong><small>Alimentación · Cuenta común</small></span><b>−68,40 €</b></div>\n            <p class=\"mock-disclaimer\">Vista ilustrativa · Datos de ejemplo</p>\n          </div>\n        </div>\n        <div class=\"floating-note\"><span class=\"float-check\"><svg class=\"icon\"><use href=\"#i-check\"/></svg></span><span><strong>La compra, lista.</strong><small>Una cosa menos en la cabeza.</small></span><svg class=\"note-spark\"><use href=\"#i-spark\"/></svg></div>\n        <span class=\"visual-caption\">Un poco de orden. Mucha tranquilidad.</span>\n      </div>\n    </div>\n    <div class=\"container hero-bottom\"><span>PENSADO PARA LA VIDA REAL</span><div><svg class=\"icon\"><use href=\"#i-wallet\"/></svg> Cuentas claras</div><div><svg class=\"icon\"><use href=\"#i-people\"/></svg> Organización compartida</div><div><svg class=\"icon\"><use href=\"#i-phone\"/></svg> Siempre a mano</div></div>\n  </section>\n\n  <section class=\"features section-space\" id=\"funciones\" aria-labelledby=\"features-title\">\n    <div class=\"container\">\n      <div class=\"section-intro\"><div><p class=\"eyebrow\">UN SITIO PARA TODO LO DE CASA</p><h2 id=\"features-title\">De «¿lo has apuntado?»<br>a <em>«lo tenemos».</em></h2></div><p>Menos mensajes sueltos y hojas de cálculo.<br>Más claridad para decidir juntos.</p></div>\n      <div class=\"feature-tabs\" role=\"tablist\" aria-label=\"Explorar funciones de Casuo\">\n        <button id=\"tab-gastos\" class=\"feature-tab\" role=\"tab\" aria-selected=\"true\" aria-controls=\"panel-gastos\" tabindex=\"0\" data-tab=\"gastos\"><svg class=\"icon\"><use href=\"#i-wallet\"/></svg> Gastos e ingresos</button>\n        <button id=\"tab-presupuestos\" class=\"feature-tab\" role=\"tab\" aria-selected=\"false\" aria-controls=\"panel-presupuestos\" tabindex=\"-1\" data-tab=\"presupuestos\"><svg class=\"icon\"><use href=\"#i-chart\"/></svg> Presupuestos</button>\n        <button id=\"tab-compra\" class=\"feature-tab\" role=\"tab\" aria-selected=\"false\" aria-controls=\"panel-compra\" tabindex=\"-1\" data-tab=\"compra\"><svg class=\"icon\"><use href=\"#i-basket\"/></svg> Lista de la compra</button>\n        <button id=\"tab-recurrentes\" class=\"feature-tab\" role=\"tab\" aria-selected=\"false\" aria-controls=\"panel-recurrentes\" tabindex=\"-1\" data-tab=\"recurrentes\"><svg class=\"icon\"><use href=\"#i-repeat\"/></svg> Recurrentes</button>\n      </div>\n      <div class=\"feature-panel\" id=\"panel-gastos\" role=\"tabpanel\" aria-labelledby=\"tab-gastos\" tabindex=\"0\">\n        <div class=\"feature-copy\"><span class=\"number-label\">01 / CUENTAS CLARAS</span><h3>Saber en qué se va.<br>Y de dónde viene.</h3><p>Registra cada movimiento con su categoría y su cuenta. Distingue el efectivo del banco y entiende cómo va vuestro mes.</p><ul class=\"check-list\"><li>Gastos e ingresos en una misma vista</li><li>Cuentas y categorías para poner orden</li><li>Importación de movimientos desde CSV</li></ul><span class=\"try-hint\"><svg class=\"icon\"><use href=\"#i-arrow\"/></svg> Prueba a añadir un gasto de ejemplo</span></div>\n        <div class=\"demo-card expense-demo\"><div class=\"demo-card-heading\"><div><span class=\"tiny-label\">RESUMEN DE OCTUBRE</span><h4>Los pequeños gastos también cuentan.</h4></div><span class=\"demo-badge\">DEMO</span></div><div class=\"expense-total\"><span>Gasto registrado</span><strong id=\"expense-total\">2.480,00 €</strong></div><div id=\"expense-rows\"><div class=\"demo-row\"><span class=\"transaction-icon peach\"><svg class=\"icon\"><use href=\"#i-basket\"/></svg></span><span><strong>Supermercado</strong><small>Alimentación · Cuenta común</small></span><b>68,40 €</b></div><div class=\"demo-row\"><span class=\"transaction-icon lavender\"><svg class=\"icon\"><use href=\"#i-house\"/></svg></span><span><strong>Internet de casa</strong><small>Hogar · Cuenta común</small></span><b>32,00 €</b></div></div><button class=\"button button-dark demo-action\" id=\"add-expense\"><svg class=\"icon\"><use href=\"#i-plus\"/></svg> Añadir café · 3,50 €</button><button class=\"reset-button\" id=\"reset-expense\" hidden>Restablecer ejemplo</button><p class=\"demo-caption\">Ejemplo interactivo. No modifica tus cuentas.</p></div>\n      </div>\n      <div class=\"feature-panel\" id=\"panel-presupuestos\" role=\"tabpanel\" aria-labelledby=\"tab-presupuestos\" tabindex=\"0\" hidden>\n        <div class=\"feature-copy\"><span class=\"number-label\">02 / UN PLAN PARA EL MES</span><h3>Poned un límite.<br>Ganad perspectiva.</h3><p>Decidid cuánto queréis dedicar a cada categoría y comparadlo con lo gastado. Un punto de partida para hablar de dinero con más claridad.</p><ul class=\"check-list\"><li>Presupuestos por categoría</li><li>Progreso del gasto fácil de entender</li><li>Una visión compartida para decidir</li></ul><span class=\"try-hint\"><svg class=\"icon\"><use href=\"#i-arrow\"/></svg> Ajusta el presupuesto del ejemplo</span></div>\n        <div class=\"demo-card\"><div class=\"demo-card-heading\"><div><span class=\"tiny-label\">VUESTRO PRESUPUESTO</span><h4>Disfrutar también entra en el plan.</h4></div><span class=\"demo-badge\">DEMO</span></div><div class=\"budget-category\"><span class=\"transaction-icon lavender\"><svg class=\"icon\"><use href=\"#i-spark\"/></svg></span><strong>Ocio y planes</strong><span>Este mes</span></div><div class=\"budget-amount\"><strong>180 €</strong><span>de <b id=\"budget-limit\">300 €</b></span></div><div class=\"budget-track\"><span id=\"budget-fill\" style=\"width:60%\"></span></div><p class=\"budget-status\" id=\"budget-status\">Os quedan 120 € para otros planes.</p><label class=\"range-label\" for=\"budget-range\">Presupuesto mensual <output id=\"budget-output\" for=\"budget-range\">300 €</output></label><input id=\"budget-range\" type=\"range\" min=\"100\" max=\"600\" value=\"300\" step=\"25\"><div class=\"range-extremes\"><span>100 €</span><span>600 €</span></div><p class=\"demo-caption\">Mueve el control y observa cómo cambia el margen.</p></div>\n      </div>\n      <div class=\"feature-panel\" id=\"panel-compra\" role=\"tabpanel\" aria-labelledby=\"tab-compra\" tabindex=\"0\" hidden>\n        <div class=\"feature-copy\"><span class=\"number-label\">03 / QUE NO SE OLVIDE LA LECHE</span><h3>Una lista.<br>Estéis donde estéis.</h3><p>Apuntad lo que falta cuando os acordéis y consultadlo al hacer la compra. La lista deja de vivir en la cabeza de uno solo.</p><ul class=\"check-list\"><li>Una lista compartida para el hogar</li><li>Productos habituales siempre a mano</li><li>Marca lo que ya está en el carro</li></ul><span class=\"try-hint\"><svg class=\"icon\"><use href=\"#i-arrow\"/></svg> Marca productos o añade uno nuevo</span></div>\n        <div class=\"demo-card\"><div class=\"demo-card-heading\"><div><span class=\"tiny-label\">COMPRA COMPARTIDA</span><h4>¿Quién pasa hoy por el súper?</h4></div><span class=\"demo-badge\">DEMO</span></div><div class=\"shopping-head\"><strong>La compra de casa</strong><span id=\"shopping-count\">0 de 4 listos</span></div><div class=\"shopping-list\" id=\"shopping-list\"></div><form class=\"shopping-form\" id=\"shopping-form\"><label class=\"sr-only\" for=\"shopping-input\">Producto para añadir al ejemplo</label><input id=\"shopping-input\" placeholder=\"¿Qué más falta?\" maxlength=\"60\" required autocomplete=\"off\"><button class=\"icon-button\" type=\"submit\" aria-label=\"Añadir producto\"><svg class=\"icon\"><use href=\"#i-plus\"/></svg></button></form><p class=\"demo-caption\">Lista de ejemplo. Los cambios duran esta visita.</p></div>\n      </div>\n      <div class=\"feature-panel\" id=\"panel-recurrentes\" role=\"tabpanel\" aria-labelledby=\"tab-recurrentes\" tabindex=\"0\" hidden>\n        <div class=\"feature-copy\"><span class=\"number-label\">04 / LO QUE VUELVE CADA MES</span><h3>Si se repite,<br>que tenga su sitio.</h3><p>Reúne los movimientos habituales de casa. Tener a la vista los gastos fijos ayuda a entender qué parte del mes ya está comprometida.</p><ul class=\"check-list\"><li>Ingresos y gastos recurrentes</li><li>Frecuencia, importe y cuenta asociados</li><li>Un punto de partida para planificar</li></ul><span class=\"try-hint\"><svg class=\"icon\"><use href=\"#i-arrow\"/></svg> Explora las próximas fechas del ejemplo</span></div>\n        <div class=\"demo-card\"><div class=\"demo-card-heading\"><div><span class=\"tiny-label\">MOVIMIENTOS HABITUALES</span><h4>Lo de siempre, bajo control.</h4></div><span class=\"demo-badge\">DEMO</span></div><div class=\"recurring-summary\"><span>Gastos fijos del ejemplo</span><strong>987,00 €<small> / mes</small></strong></div><div class=\"demo-row\"><span class=\"date-tile\"><small>OCT</small>01</span><span><strong>Alquiler</strong><small>Mensual · Cuenta común</small></span><b>900,00 €</b></div><div class=\"demo-row\"><span class=\"date-tile\"><small>OCT</small>05</span><span><strong>Internet</strong><small>Mensual · Cuenta común</small></span><b>32,00 €</b></div><div class=\"demo-row\"><span class=\"date-tile\"><small>OCT</small>10</span><span><strong>Gimnasio</strong><small>Mensual · Cuenta personal</small></span><b>55,00 €</b></div><button class=\"recurring-toggle\" id=\"recurring-toggle\" aria-pressed=\"false\">Ver fechas de noviembre <svg class=\"icon\"><use href=\"#i-arrow\"/></svg></button><p class=\"demo-caption\">Calendario ilustrativo de movimientos mensuales.</p></div>\n      </div>\n      <p class=\"demo-live sr-only\" id=\"demo-live\" role=\"status\" aria-live=\"polite\"></p>\n      <div class=\"more-features\"><span><svg class=\"icon\"><use href=\"#i-upload\"/></svg><b>Tus datos, con recorrido.</b> Importa y exporta movimientos.</span><span><svg class=\"icon\"><use href=\"#i-people\"/></svg><b>Un hogar compartido.</b> Cada miembro con su acceso.</span></div>\n    </div>\n  </section>\n\n  <section class=\"how-section section-space\" id=\"como-funciona\" aria-labelledby=\"how-title\"><div class=\"container\"><div class=\"how-heading\"><p class=\"eyebrow\">EMPEZAR ES PONER LA PRIMERA PIEZA</p><h2 id=\"how-title\">Vuestra casa ya funciona.<br><em>Ahora, un poco más fácil.</em></h2></div><div class=\"steps\"><article><span class=\"step-number\">01</span><h3>Crea vuestro espacio</h3><p>Regístrate y prepara el hogar que vais a compartir. Cada miembro entra con su propia cuenta.</p></article><article><span class=\"step-number\">02</span><h3>Dale vuestro contexto</h3><p>Añade las cuentas y los movimientos. Puedes empezar poco a poco o importar un archivo CSV.</p></article><article><span class=\"step-number\">03</span><h3>Hacedlo parte del día</h3><p>Apuntad la compra, registrad un gasto y revisad cómo va el mes. Desde el móvil o el ordenador.</p></article></div><div class=\"phone-banner\"><div class=\"phone-illustration\" aria-hidden=\"true\"><span></span><svg><use href=\"#i-house\"/></svg></div><div><h3>En la cocina. En el súper. En el sofá.</h3><p>Abre Casuo en el navegador o añádelo a la pantalla de inicio de tu móvil para tenerlo siempre a mano.</p></div><a class=\"text-link\" href=\"#faq-install\">Cómo añadirlo al móvil <svg class=\"icon\"><use href=\"#i-arrow\"/></svg></a></div></div></section>\n\n  <section class=\"faq-section section-space\" id=\"preguntas\" aria-labelledby=\"faq-title\"><div class=\"container faq-grid\"><div><p class=\"eyebrow\">ANTES DE ENTRAR</p><h2 id=\"faq-title\">Las cosas,<br><em>claras.</em></h2><p>Lo que quizá te estés preguntando.</p></div><div class=\"faq-items\"><details><summary>¿Para quién está pensado Casuo?<svg class=\"icon\"><use href=\"#i-plus\"/></svg></summary><p>Para parejas y familias que quieren organizar las cuentas y la compra de casa en un mismo espacio. Podéis usarlo desde el móvil y el ordenador.</p></details><details><summary>¿Tenemos que compartir una contraseña?<svg class=\"icon\"><use href=\"#i-plus\"/></svg></summary><p>No. Cada miembro utiliza su propia cuenta para acceder al hogar compartido. Así podéis consultar y organizar la información del mismo espacio.</p></details><details><summary>¿Tengo que conectar mi banco?<svg class=\"icon\"><use href=\"#i-plus\"/></svg></summary><p>No necesitas conectar tu banco. Puedes apuntar los movimientos manualmente o importar un archivo CSV compatible. Los ejemplos de esta página son ficticios y no acceden a tus datos.</p></details><details id=\"faq-install\"><summary>¿Cómo lo añado a la pantalla de inicio?<svg class=\"icon\"><use href=\"#i-plus\"/></svg></summary><p>Abre casuo.es en tu móvil. En iPhone, usa Safari, pulsa Compartir y elige «Añadir a pantalla de inicio». En Android, abre el menú del navegador y busca «Instalar aplicación» o «Añadir a pantalla de inicio». El nombre puede variar según el navegador.</p></details><details><summary>¿Esta demo guarda mis cambios?<svg class=\"icon\"><use href=\"#i-plus\"/></svg></summary><p>Solo durante esta visita. La demo sirve para explorar Casuo con datos ficticios, sin registro. Al recargar la página, los ejemplos vuelven a su estado inicial. Para organizar tu hogar, entra en Casuo y crea tu cuenta.</p></details></div></div></section>\n\n  <section class=\"final-section\"><div class=\"container\"><div class=\"final-cta\"><span class=\"eyebrow\">MÁS EQUIPO. MENOS CARGA MENTAL.</span><h2>Lo de casa,<br>mejor <em>juntos.</em></h2><p>Un pequeño cambio en cómo os organizáis.<br>Un poco más de espacio para lo que importa.</p><a class=\"button button-lime\" href=\"https://casuo.es/\">Empezar con Casuo <svg class=\"icon\"><use href=\"#i-arrow\"/></svg></a><small>Crea vuestro espacio o entra con tu cuenta.</small><svg class=\"cta-house\" aria-hidden=\"true\"><use href=\"#i-house\"/></svg></div></div></section>\n</main>\n<footer class=\"site-footer\"><div class=\"container footer-inner\"><a class=\"brand\" href=\"#inicio\" aria-label=\"Casuo, volver al inicio\"><svg class=\"brand-mark\"><use href=\"#i-house\"/></svg><span>casuo<span class=\"brand-dot\">.</span></span></a><span>Tu hogar, en equipo.</span><a href=\"https://casuo.es/\">Ir a Casuo <svg class=\"icon\"><use href=\"#i-arrow\"/></svg></a><span class=\"footer-copyright\">© <span id=\"copyright-year\">2026</span> Casuo</span></div></footer>";
  function mount({root,onEnter,onStart,preview=false}) {
    if(!root||typeof onEnter!=='function'||typeof onStart!=='function')throw new Error('La presentación necesita sus acciones de acceso.');
    root.innerHTML='<div class="welcome-page" id="casuo-landing-host"></div>';
    const host=root.querySelector('#casuo-landing-host');
    const view=host.attachShadow({mode:'open'});
    view.innerHTML='<link rel="stylesheet" href="./casuo-landing.css?v=20261021.38">'+markup;

  const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  const announce = (message) => { view.getElementById("demo-live").textContent = message; };
  const tabs = [...view.querySelectorAll("[data-tab]")];
  function selectTab(tab, focus = false) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      view.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
    });
  });

  const menuToggle = view.querySelector(".menu-toggle");
  const menu = view.getElementById("main-nav");
  function closeMenu() { menu.classList.remove("is-open"); menuToggle.setAttribute("aria-expanded", "false"); menuToggle.setAttribute("aria-label", "Abrir menú"); }
  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    menu.classList.toggle("is-open", open);
  });
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  view.addEventListener("keydown", (event) => { if (event.key === "Escape" && menu.classList.contains("is-open")) { closeMenu(); menuToggle.focus(); } });
  view.addEventListener("click", (event) => { if (!menu.contains(event.target) && !menuToggle.contains(event.target)) closeMenu(); });

  const expenseButton = view.getElementById("add-expense");
  const resetExpense = view.getElementById("reset-expense");
  expenseButton.addEventListener("click", () => {
    if (view.getElementById("example-coffee")) return;
    const row = document.createElement("div");
    row.className = "demo-row";
    row.id = "example-coffee";
    row.innerHTML = '<span class="transaction-icon peach" aria-hidden="true">☕</span><span><strong>Café</strong><small>Ocio · Efectivo</small></span><b>3,50 €</b>';
    view.getElementById("expense-rows").append(row);
    view.getElementById("expense-total").textContent = euro.format(2483.5);
    expenseButton.textContent = "✓ Gasto añadido al ejemplo";
    expenseButton.disabled = true;
    resetExpense.hidden = false;
    resetExpense.focus();
    announce("Café de 3,50 euros añadido. Gasto de ejemplo: 2.483,50 euros.");
  });
  resetExpense.addEventListener("click", () => {
    view.getElementById("example-coffee")?.remove();
    view.getElementById("expense-total").textContent = euro.format(2480);
    expenseButton.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg> Añadir café · 3,50 €';
    expenseButton.disabled = false;
    resetExpense.hidden = true;
    expenseButton.focus();
    announce("Ejemplo de gastos restablecido.");
  });

  const budgetRange = view.getElementById("budget-range");
  budgetRange.addEventListener("input", () => {
    const limit = Number(budgetRange.value);
    const available = limit - 180;
    const fill = view.getElementById("budget-fill");
    view.getElementById("budget-limit").textContent = `${limit} €`;
    view.getElementById("budget-output").value = `${limit} €`;
    fill.style.width = `${Math.min(100, 180 / limit * 100)}%`;
    fill.parentElement.classList.toggle("over-budget", available < 0);
    view.getElementById("budget-status").textContent = available >= 0 ? `Os quedan ${available} € para otros planes.` : `El gasto supera el presupuesto en ${Math.abs(available)} €.`;
    budgetRange.setAttribute("aria-valuetext", `${limit} euros. ${available >= 0 ? `${available} euros disponibles` : `Excedido en ${Math.abs(available)} euros`}.`);
  });

  const shoppingList = view.getElementById("shopping-list");
  let shoppingId = 0;
  function shoppingCount() {
    const items = [...shoppingList.querySelectorAll("input")];
    view.getElementById("shopping-count").textContent = `${items.filter((item) => item.checked).length} de ${items.length} listos`;
  }
  function addProduct(name) {
    const label = document.createElement("label");
    label.className = "shopping-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `product-${++shoppingId}`;
    const span = document.createElement("span");
    span.textContent = name;
    label.append(input, span);
    input.addEventListener("change", () => { shoppingCount(); announce(`${name}: ${input.checked ? "marcado como comprado" : "pendiente"}.`); });
    shoppingList.append(label);
    shoppingCount();
  }
  ["Leche", "Tomates", "Yogures", "Pan integral"].forEach(addProduct);
  view.getElementById("shopping-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = view.getElementById("shopping-input");
    const name = input.value.trim();
    if (!name) { input.value = ""; input.focus(); return; }
    const existing = [...shoppingList.querySelectorAll(".shopping-item span")].some((item) => item.textContent.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"));
    if (existing) { announce(`${name} ya está en la lista de ejemplo.`); input.setCustomValidity("Este producto ya está en la lista."); input.reportValidity(); return; }
    if (shoppingId >= 30) { input.setCustomValidity("La demo admite hasta 30 productos."); input.reportValidity(); return; }
    addProduct(name);
    input.value = "";
    shoppingList.scrollTop = shoppingList.scrollHeight;
    input.focus();
    announce(`${name} añadido a la lista de ejemplo.`);
  });
  view.getElementById("shopping-input").addEventListener("input", (event) => event.target.setCustomValidity(""));

  const recurringToggle = view.getElementById("recurring-toggle");
  recurringToggle.addEventListener("click", () => {
    const november = recurringToggle.getAttribute("aria-pressed") !== "true";
    recurringToggle.setAttribute("aria-pressed", String(november));
    view.querySelectorAll(".date-tile small").forEach((item) => { item.textContent = november ? "NOV" : "OCT"; });
    recurringToggle.innerHTML = `${november ? "Volver a octubre" : "Ver fechas de noviembre"} <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>`;
    announce(`Mostrando los movimientos recurrentes de ${november ? "noviembre" : "octubre"}.`);
  });

  function openLinkedFaq() {
    if (location.hash === "#faq-install") view.getElementById("faq-install").open = true;
  }
  view.querySelector('a[href="#faq-install"]').addEventListener("click", () => { view.getElementById("faq-install").open = true; });

  view.getElementById("copyright-year").textContent = String(new Date().getFullYear());

  view.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = view.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    target.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (link.classList.contains('skip-link')) target.focus({preventScroll:true});
  }));
  view.querySelectorAll('a[href="https://casuo.es/"]').forEach((link) => {
    const enter = link.classList.contains('header-login') || !!link.closest('footer');
    if (preview) link.textContent = 'Volver a mi hogar';
    link.addEventListener('click', (event) => { event.preventDefault(); closeMenu(); (enter ? onEnter : onStart)(); });
  });
  return { host, view };

  }
  return {mount,markup};
});
