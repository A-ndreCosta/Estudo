/* Adaptador: faz com que as páginas do Gestor de Dinheiro e do Diário de Consumos
   (feitas como artefactos do Claude) guardem os dados no localStorage deste aparelho.
   Imita só a parte da API que elas usam: use('db'|'user'|'downloads'). */
(function () {
  'use strict';
  var PREFIX = 'estudo-fin:';
  var listeners = {}; // collPath -> [fn]

  function read(coll) {
    try { return JSON.parse(localStorage.getItem(PREFIX + coll) || '{}'); } catch (e) { return {}; }
  }
  function write(coll, obj) {
    localStorage.setItem(PREFIX + coll, JSON.stringify(obj));
    notify(coll);
  }
  function snapshot(coll) {
    var o = read(coll), ids = Object.keys(o);
    return {
      size: ids.length,
      empty: !ids.length,
      metadata: { fromCache: false, hasPendingWrites: false },
      docs: ids.map(function (id) { return docSnap(id, o[id], true); }),
      forEach: function (f) { this.docs.forEach(f); }
    };
  }
  function docSnap(id, data, exists) {
    return { id: id, exists: exists, data: function () { return exists ? JSON.parse(JSON.stringify(data)) : undefined; } };
  }
  function notify(coll) {
    (listeners[coll] || []).slice().forEach(function (f) { try { f(snapshot(coll)); } catch (e) { console.warn(e); } });
  }
  function uid() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function docRef(coll, id) {
    return {
      id: id,
      collection: function (n) { return collRef(coll + '/' + id + '/' + n); },
      get: function () { var o = read(coll); return Promise.resolve(docSnap(id, o[id], id in o)); },
      set: function (data, opts) {
        var o = read(coll);
        o[id] = (opts && opts.merge) ? Object.assign({}, o[id], data) : Object.assign({}, data);
        write(coll, o); return Promise.resolve();
      },
      update: function (data) {
        var o = read(coll);
        if (!(id in o)) return Promise.reject({ code: 'not-found' });
        o[id] = Object.assign({}, o[id], data);
        write(coll, o); return Promise.resolve();
      },
      delete: function () { var o = read(coll); delete o[id]; write(coll, o); return Promise.resolve(); }
    };
  }
  function collRef(coll) {
    return {
      doc: function (id) { return docRef(coll, id || uid()); },
      add: function (data) {
        var id = uid(), o = read(coll);
        o[id] = Object.assign({}, data); write(coll, o);
        return Promise.resolve(docRef(coll, id));
      },
      get: function () { return Promise.resolve(snapshot(coll)); },
      onSnapshot: function (ok) {
        (listeners[coll] = listeners[coll] || []).push(ok);
        setTimeout(function () { ok(snapshot(coll)); }, 0);
        return function () { listeners[coll] = (listeners[coll] || []).filter(function (f) { return f !== ok; }); };
      }
    };
  }

  var db = {
    collection: collRef,
    doc: function (path) { // caminho de um "documento": o que vier depois só serve para .collection()
      return { collection: function (n) { return collRef(path + '/' + n); } };
    }
  };
  var user = { id: function () { return Promise.resolve('local'); }, canEdit: function () { return Promise.resolve(true); } };
  var downloads = {
    save: function (o) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([o.data], { type: 'text/csv;charset=utf-8' }));
      a.download = o.filename || 'ficheiro.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      return Promise.resolve();
    }
  };
  window.claude = { use: function (n) { return Promise.resolve({ db: db, user: user, downloads: downloads }[n] || null); } };

  /* Se outra janela/aba alterar os dados, atualiza aqui também. */
  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf(PREFIX) === 0) notify(e.key.slice(PREFIX.length));
  });

  /* Tema: segue o do site (html[data-theme]) quando está dentro dele. */
  try {
    var p = window.parent.document.documentElement;
    if (window.parent !== window) {
      var apply = function () { if (p.dataset.theme) document.documentElement.dataset.theme = p.dataset.theme; };
      apply();
      new MutationObserver(apply).observe(p, { attributes: true, attributeFilter: ['data-theme'] });
    }
  } catch (e) {}

  /* Altura: a iframe cresce com o conteúdo (sem barra de scroll interna). */
  document.addEventListener('DOMContentLoaded', function () {
    var f = window.frameElement;
    if (!f) return;
    var fit = function () {
      var cs = getComputedStyle(document.body), r = document.body.getBoundingClientRect();
      var h = Math.ceil(r.height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom));
      if (h > 50 && Math.abs(h - f.clientHeight) > 1) f.style.height = h + 'px';
    };
    new ResizeObserver(fit).observe(document.body);
    fit();
  });
})();
