/* Separador «Finanças»: carrega o Gestor de Dinheiro (com o Diário de Consumos no Carro)
   só quando abres o separador pela primeira vez. Os dados ficam neste aparelho (localStorage). */
(function () {
  var f = document.getElementById('financas-frame');
  var b = document.querySelector('#tabs [data-tab="financas"]');
  if (!f || !b) return;
  b.addEventListener('click', function () {
    if (!f.src && f.dataset.src) f.src = f.dataset.src;
  });
})();
