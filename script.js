/* ==========================================================
   Estudo · Dashboard — script.js
   Núcleo (estado, tema, semestres, definições, exportar/importar)
   + Notas e Médias + Dashboard + Calendário + Checklist + Ficheiros.
   ========================================================== */
'use strict';

/* ---------- Utilitários ---------- */
const STORAGE_KEY = 'estudo-dashboard-v1';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = n => (n == null ? '—' : n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const num = n => String(n).replace('.', ',');
const isHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
const DEFAULT_COLOR = '#6366f1';

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- Dados iniciais (só na primeira vez) ---------- */
function seedState() {
  const s1 = (id, name, color, components = []) => ({ id, semester: 's1', name, color, components });
  return {
    version: 1,
    currentSemester: 's1',
    theme: null, // null = segue o sistema; 'light' | 'dark' = escolha manual
    semesters: {
      s1: { name: '1º Semestre', start: '2026-09-01', end: '2027-01-30' },
      s2: { name: '2º Semestre', start: '2027-02-01', end: '2027-06-26' }
    },
    disciplines: [
      s1('d-calculo', 'Cálculo', '#6366f1', [
        { id: 'c-calc-teste', name: 'Teste intermédio', weight: 45, min: 8 },
        { id: 'c-calc-moodle', name: 'Testes do Moodle', weight: 5 },
        { id: 'c-calc-freq', name: 'Frequência', weight: 50, min: 8 } // mínimo: 4 em 10 = 8 em 20
      ]),
      s1('d-fad', 'Fundamentos de Análise de Dados', '#10b981'),
      s1('d-ia', 'Introdução à Inteligência Artificial', '#f59e0b'),
      s1('d-fp', 'Fundamentos de Programação', '#f43f5e', [
        { id: 'c-fp-a1', name: 'A1 · Tarefas de Aprendizagem', weight: 15, min: 8 },
        { id: 'c-fp-a2', name: 'A2 · ePortfolio', weight: 15 },
        { id: 'c-fp-a3', name: 'A3 · Projeto em grupo + discussão', weight: 70, min: 9.5 }
      ])
    ],
    grades: [
      { id: 'g-calc-ta1', disciplineId: 'd-calculo', componentId: 'c-calc-moodle', name: 'TA1', value: 20 },
      { id: 'g-calc-ta2', disciplineId: 'd-calculo', componentId: 'c-calc-moodle', name: 'TA2', value: 20 },
      { id: 'g-fad-ea1', disciplineId: 'd-fad', componentId: null, name: 'Exercício em aula 1', value: 20 },
      { id: 'g-fad-ea2', disciplineId: 'd-fad', componentId: null, name: 'Exercício em aula 2', value: 15 },
      { id: 'g-fad-ea4', disciplineId: 'd-fad', componentId: null, name: 'Exercício em aula 4', value: 16 }
    ],
    events: [
      { id: 'e-calc-ta5', title: 'TA5', date: '2026-10-27', time: '16:59', disciplineId: 'd-calculo', type: 'teste' },
      { id: 'e-fp-d1', title: 'Desafio 1 - GIT', date: '2026-12-23', time: '23:59', disciplineId: 'd-fp', type: 'ficha' },
      { id: 'e-fp-d2', title: 'Desafio 2 - Better Ask Py', date: '2026-12-23', time: '23:59', disciplineId: 'd-fp', type: 'ficha' },
      { id: 'e-fp-d3', title: 'Desafio 3 - Python - a short', date: '2026-12-23', time: '23:59', disciplineId: 'd-fp', type: 'ficha' }
    ],
    tasks: [],
    links: [],
    ui: { collapsedFiles: [] }
  };
}

/* Tarefas: "date" = início (ou dia da tarefa), "end" = fim opcional.
   Aceita também "start" como sinónimo de "date". Sem data → tarefa sem dia. */
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeTask(t) {
  if (!t || typeof t !== 'object') return t;
  if (!ISO_RE.test(t.date || '') && ISO_RE.test(t.start || '')) t.date = t.start;
  delete t.start;
  if (!ISO_RE.test(t.date || '')) t.date = '';
  if (!ISO_RE.test(t.end || '') || !t.date || t.end < t.date) delete t.end;
  return t;
}

/* ---------- Estado + localStorage ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        const st = Object.assign({
          version: 1, currentSemester: 's1', theme: null,
          semesters: seedState().semesters,
          disciplines: [], grades: [], events: [], tasks: [], links: []
        }, s);
        ['disciplines', 'grades', 'events', 'tasks', 'links'].forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
        st.disciplines.forEach(d => { if (!Array.isArray(d.components)) d.components = []; });
        st.tasks.forEach(normalizeTask);
        if (!st.ui || typeof st.ui !== 'object') st.ui = {};
        if (!Array.isArray(st.ui.collapsedFiles)) st.ui.collapsedFiles = [];
        if (!st.semesters[st.currentSemester]) st.currentSemester = Object.keys(st.semesters)[0];
        return st;
      }
    }
  } catch (e) { console.warn('Não foi possível ler os dados guardados.', e); }
  return seedState();
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Não foi possível guardar (armazenamento cheio ou bloqueado).'); }
}

const semDisciplines = () => state.disciplines.filter(d => d.semester === state.currentSemester);
const findDisc = id => state.disciplines.find(d => d.id === id);

/* ---------- Formulários: nunca recarregar a página ---------- */
document.addEventListener('submit', e => {
  if (e.target.getAttribute('method') !== 'dialog') e.preventDefault();
});

/* ---------- Tema (segue o sistema; botão para trocar) ---------- */
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const currentTheme = () => state.theme || (darkQuery && darkQuery.matches ? 'dark' : 'light');
const applyTheme = () => { document.documentElement.dataset.theme = currentTheme(); };

$('#theme-toggle').addEventListener('click', () => {
  state.theme = currentTheme() === 'dark' ? 'light' : 'dark';
  save();
  applyTheme();
});
if (darkQuery && darkQuery.addEventListener) {
  darkQuery.addEventListener('change', () => { if (!state.theme) applyTheme(); });
}

/* ---------- Separadores ---------- */
function showTab(name) {
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  $$('#tabs .tab').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0 });
}
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab');
  if (b) showTab(b.dataset.tab);
});

/* ---------- Seletor de semestre ---------- */
function renderSemesterSelect() {
  const sel = $('#semester-select');
  sel.innerHTML = Object.entries(state.semesters)
    .map(([k, s]) => `<option value="${esc(k)}">${esc(s.name)}</option>`).join('');
  sel.value = state.currentSemester;
}
$('#semester-select').addEventListener('change', e => {
  state.currentSemester = e.target.value;
  save();
  renderAll();
});

/* ==========================================================
   NOTAS E MÉDIAS
   - Sem componentes definidos → média simples dos itens.
   - Com componentes (peso %) → média de cada componente e,
     depois, média ponderada das componentes que já têm nota.
   - Média global = média simples das médias das disciplinas.
   ========================================================== */
function componentAverage(d, c) {
  const vals = state.grades.filter(g => g.disciplineId === d.id && g.componentId === c.id).map(g => g.value);
  return vals.length ? mean(vals) : null;
}

function disciplineAverage(d) {
  const gs = state.grades.filter(g => g.disciplineId === d.id);
  if (!gs.length) return { value: null, mode: 'none' };
  const comps = (d.components || []).filter(c => c.weight > 0);
  if (comps.length) {
    let sum = 0, covered = 0;
    comps.forEach(c => {
      const a = componentAverage(d, c);
      if (a != null) { sum += a * c.weight; covered += c.weight; }
    });
    if (covered > 0) {
      return { value: sum / covered, mode: 'ponderada', covered, total: comps.reduce((a, c) => a + c.weight, 0) };
    }
  }
  return { value: mean(gs.map(g => g.value)), mode: 'simples' };
}

function averageOf(discs) {
  const vals = discs.map(d => disciplineAverage(d).value).filter(v => v != null);
  return vals.length ? mean(vals) : null;
}

function parseGrade(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 20 ? Math.round(n * 100) / 100 : null;
}

function renderGrades() {
  const discs = semDisciplines();
  $('#semester-average').textContent = fmt(averageOf(discs));
  $('#global-average').textContent = fmt(averageOf(state.disciplines));

  const box = $('#grades-list');
  if (!discs.length) {
    box.innerHTML = '<div class="card empty">Ainda não há disciplinas neste semestre. Adiciona-as em ⚙ Definições.</div>';
    return;
  }

  box.innerHTML = discs.map(d => {
    const avg = disciplineAverage(d);
    const comps = d.components || [];
    const gs = state.grades.filter(g => g.disciplineId === d.id);
    const compOptions = (selected) => '<option value="">— sem componente —</option>' +
      comps.map(c => `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

    let hint = 'sem notas';
    if (avg.mode === 'simples') hint = 'média simples';
    if (avg.mode === 'ponderada') {
      hint = 'média ponderada' + (avg.covered < avg.total ? ` · ${num(Math.round(avg.covered * 10) / 10)}% do peso com nota` : '');
    }

    const compSummary = comps.length ? `
      <ul class="comp-list">
        ${comps.map(c => `
          <li>
            <span>${esc(c.name)} <span class="meta">· ${num(c.weight)}%${c.min != null ? ` · mín. ${num(c.min)}` : ''}</span></span>
            <strong>${fmt(componentAverage(d, c))}</strong>
          </li>`).join('')}
      </ul>` : '';

    const rows = gs.length ? gs.map(g => `
      <tr>
        <td>${esc(g.name)}</td>
        ${comps.length ? `<td><select class="grade-comp" data-id="${esc(g.id)}" aria-label="Componente">${compOptions(g.componentId)}</select></td>` : ''}
        <td><input class="grade-input" type="number" inputmode="decimal" min="0" max="20" step="0.01" value="${g.value}" data-id="${esc(g.id)}" aria-label="Nota de ${esc(g.name)}"></td>
        <td><button type="button" class="icon-btn danger" data-action="del-grade" data-id="${esc(g.id)}" aria-label="Apagar ${esc(g.name)}">✕</button></td>
      </tr>`).join('')
      : `<tr class="no-items"><td colspan="${comps.length ? 4 : 3}">Ainda sem notas.</td></tr>`;

    return `
      <article class="card grade-card" style="--c:${isHex(d.color) ? d.color : DEFAULT_COLOR}">
        <header class="grade-head">
          <h2><span class="dot"></span>${esc(d.name)}</h2>
          <div class="grade-avg"><strong>${fmt(avg.value)}</strong><small>${hint}</small></div>
        </header>
        ${compSummary}
        <div class="table-wrap">
          <table class="grades-table">
            <thead><tr><th>Item</th>${comps.length ? '<th>Componente</th>' : ''}<th>Nota (0–20)</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <form class="grade-form" data-disc="${esc(d.id)}">
          <input name="name" placeholder="Item (ex.: Teste 1)" required maxlength="80" aria-label="Nome do item">
          ${comps.length ? `<select name="component" aria-label="Componente">${compOptions(comps[0].id)}</select>` : ''}
          <input name="value" type="number" inputmode="decimal" min="0" max="20" step="0.01" placeholder="0–20" required aria-label="Nota">
          <button class="btn btn-primary">Adicionar</button>
        </form>
      </article>`;
  }).join('');
}

const gradesBox = $('#grades-list');

gradesBox.addEventListener('submit', e => {
  const f = e.target.closest('.grade-form');
  if (!f) return;
  e.preventDefault();
  const fd = new FormData(f);
  const value = parseGrade(fd.get('value'));
  if (value == null) { toast('A nota tem de estar entre 0 e 20.'); return; }
  const d = findDisc(f.dataset.disc);
  if (!d) return;
  const hasComps = (d.components || []).length > 0;
  state.grades.push({
    id: uid(),
    disciplineId: d.id,
    componentId: hasComps ? (fd.get('component') || null) : null,
    name: String(fd.get('name')).trim(),
    value
  });
  save();
  renderGrades();
});

gradesBox.addEventListener('change', e => {
  const t = e.target;
  if (t.classList.contains('grade-input')) {
    const g = state.grades.find(x => x.id === t.dataset.id);
    const value = parseGrade(t.value);
    if (!g) return;
    if (value == null) { toast('A nota tem de estar entre 0 e 20.'); renderGrades(); return; }
    g.value = value;
    save();
    renderGrades();
  } else if (t.classList.contains('grade-comp')) {
    const g = state.grades.find(x => x.id === t.dataset.id);
    if (!g) return;
    g.componentId = t.value || null;
    save();
    renderGrades();
  }
});

gradesBox.addEventListener('click', e => {
  const b = e.target.closest('[data-action="del-grade"]');
  if (!b) return;
  if (!confirm('Apagar esta nota?')) return;
  state.grades = state.grades.filter(g => g.id !== b.dataset.id);
  save();
  renderGrades();
});

/* ==========================================================
   DEFINIÇÕES (datas do semestre, disciplinas, componentes)
   ========================================================== */
const settingsDialog = $('#settings-dialog');

function renderSettings() {
  const open = new Set($$('#settings-disciplines details[open]').map(d => d.dataset.disc));
  const sem = state.semesters[state.currentSemester];
  $('#settings-sem-name').textContent = sem.name;
  $('#sem-start').value = sem.start || '';
  $('#sem-end').value = sem.end || '';

  $('#settings-disciplines').innerHTML = semDisciplines().map(d => `
    <details class="disc-edit" data-disc="${esc(d.id)}"${open.has(d.id) ? ' open' : ''}>
      <summary><span class="dot" style="--c:${isHex(d.color) ? d.color : DEFAULT_COLOR}"></span><span class="name">${esc(d.name)}</span></summary>
      <div class="disc-edit-body">
        <div class="row">
          <input data-field="name" value="${esc(d.name)}" maxlength="80" aria-label="Nome da disciplina">
          <input data-field="color" type="color" value="${isHex(d.color) ? d.color : DEFAULT_COLOR}" aria-label="Cor">
        </div>
        <h4>Componentes de avaliação <span class="muted">(opcional · sem componentes a média é simples · nome, peso %, nota mínima)</span></h4>
        <div class="stack">
          ${(d.components || []).map(c => `
            <div class="comp-edit" data-comp="${esc(c.id)}">
              <input data-cfield="name" value="${esc(c.name)}" maxlength="60" aria-label="Nome da componente">
              <input data-cfield="weight" type="number" min="0" max="100" step="0.5" value="${c.weight}" aria-label="Peso (%)">
              <input data-cfield="min" type="number" min="0" max="20" step="0.5" value="${c.min ?? ''}" placeholder="mín." aria-label="Nota mínima">
              <button type="button" class="icon-btn danger" data-action="del-comp" aria-label="Remover componente">✕</button>
            </div>`).join('')}
        </div>
        <form class="comp-add row">
          <input name="name" placeholder="Nova componente" required maxlength="60" aria-label="Nova componente">
          <input name="weight" type="number" min="0" max="100" step="0.5" placeholder="Peso %" required aria-label="Peso (%)">
          <input name="min" type="number" min="0" max="20" step="0.5" placeholder="Mín." aria-label="Nota mínima">
          <button class="btn">Adicionar</button>
        </form>
        <button type="button" class="btn btn-danger" data-action="del-disc">Remover disciplina</button>
      </div>
    </details>`).join('') || '<p class="muted">Sem disciplinas neste semestre.</p>';
}

$('#settings-btn').addEventListener('click', () => {
  renderSettings();
  if (typeof settingsDialog.showModal === 'function') settingsDialog.showModal();
  else settingsDialog.setAttribute('open', '');
});
settingsDialog.addEventListener('click', e => { if (e.target === settingsDialog) settingsDialog.close(); });

/* datas do semestre */
['#sem-start', '#sem-end'].forEach(sel => {
  $(sel).addEventListener('change', () => {
    const start = $('#sem-start').value, end = $('#sem-end').value;
    const sem = state.semesters[state.currentSemester];
    if (!start || !end || start >= end) {
      toast('A data de fim tem de ser depois da data de início.');
      $('#sem-start').value = sem.start || '';
      $('#sem-end').value = sem.end || '';
      return;
    }
    sem.start = start; sem.end = end;
    save();
    renderAll();
  });
});

/* editar nome/cor da disciplina e componentes */
$('#settings-disciplines').addEventListener('change', e => {
  const det = e.target.closest('.disc-edit');
  if (!det) return;
  const d = findDisc(det.dataset.disc);
  if (!d) return;
  const compEl = e.target.closest('.comp-edit');

  if (compEl) {
    const c = d.components.find(x => x.id === compEl.dataset.comp);
    if (!c) return;
    const f = e.target.dataset.cfield;
    if (f === 'name') {
      const v = e.target.value.trim();
      if (!v) { e.target.value = c.name; return; }
      c.name = v;
    } else if (f === 'weight') {
      const n = parseFloat(e.target.value);
      if (!(n >= 0 && n <= 100)) { e.target.value = c.weight; toast('O peso tem de estar entre 0 e 100.'); return; }
      c.weight = n;
    } else if (f === 'min') {
      const raw = e.target.value.trim();
      if (raw === '') delete c.min;
      else {
        const n = parseFloat(raw);
        if (!(n >= 0 && n <= 20)) { e.target.value = c.min ?? ''; toast('A nota mínima tem de estar entre 0 e 20.'); return; }
        c.min = n;
      }
    }
  } else {
    const f = e.target.dataset.field;
    if (f === 'name') {
      const v = e.target.value.trim();
      if (!v) { e.target.value = d.name; return; }
      d.name = v;
      $('summary .name', det).textContent = v;
    } else if (f === 'color') {
      d.color = e.target.value;
      $('summary .dot', det).style.setProperty('--c', d.color);
    }
  }
  save();
  renderAll();
});

$('#settings-disciplines').addEventListener('submit', e => {
  const f = e.target.closest('.comp-add');
  if (!f) return;
  e.preventDefault();
  const d = findDisc(f.closest('.disc-edit').dataset.disc);
  const fd = new FormData(f);
  const weight = parseFloat(fd.get('weight'));
  if (!d || !(weight >= 0 && weight <= 100)) { toast('O peso tem de estar entre 0 e 100.'); return; }
  const comp = { id: uid(), name: String(fd.get('name')).trim(), weight };
  const min = String(fd.get('min')).trim();
  if (min !== '') {
    const n = parseFloat(min);
    if (!(n >= 0 && n <= 20)) { toast('A nota mínima tem de estar entre 0 e 20.'); return; }
    comp.min = n;
  }
  d.components.push(comp);
  save();
  renderSettings();
  renderAll();
});

$('#settings-disciplines').addEventListener('click', e => {
  const det = e.target.closest('.disc-edit');
  if (!det) return;
  const d = findDisc(det.dataset.disc);
  if (!d) return;

  if (e.target.closest('[data-action="del-comp"]')) {
    const id = e.target.closest('.comp-edit').dataset.comp;
    if (!confirm('Remover esta componente? As notas ficam, mas sem componente.')) return;
    d.components = d.components.filter(c => c.id !== id);
    state.grades.forEach(g => { if (g.componentId === id) g.componentId = null; });
    save(); renderSettings(); renderAll();
  } else if (e.target.closest('[data-action="del-disc"]')) {
    if (!confirm(`Remover «${d.name}» e todas as suas notas, eventos e links? (As tarefas ficam, sem disciplina.)`)) return;
    state.disciplines = state.disciplines.filter(x => x.id !== d.id);
    state.grades = state.grades.filter(g => g.disciplineId !== d.id);
    state.events = state.events.filter(ev => ev.disciplineId !== d.id);
    state.links.forEach(l => { if (l.disciplineId === d.id && l.fileId) fileStore.del(l.fileId).catch(() => {}); });
    state.links = state.links.filter(l => l.disciplineId !== d.id);
    state.tasks.forEach(t => { if (t.disciplineId === d.id) t.disciplineId = ''; });
    save(); renderSettings(); renderAll();
  }
});

$('#discipline-form').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get('name')).trim();
  if (!name) return;
  state.disciplines.push({
    id: uid(), semester: state.currentSemester, name,
    color: isHex(fd.get('color')) ? fd.get('color') : DEFAULT_COLOR, components: []
  });
  e.target.reset();
  save();
  renderSettings();
  renderAll();
});

/* ==========================================================
   EXPORTAR / IMPORTAR (importar JUNTA ao que já existe)
   ========================================================== */
$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estudo-backup-${toISO(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup exportado.');
});

$('#import-btn').addEventListener('click', () => $('#import-input').click());

$('#import-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const added = mergeState(data);
    save();
    renderAll();
    toast(added ? `Importado: ${added} novo(s) item(ns) juntado(s).` : 'Importado: não havia nada de novo para juntar.');
  } catch (err) {
    console.warn(err);
    toast('Ficheiro inválido. Usa um backup exportado por esta app.');
  }
});

const cleanComp = c => ({
  id: c.id, name: c.name, weight: c.weight,
  ...(Number.isFinite(c.min) ? { min: c.min } : {})
});
const validComp = c => c && typeof c.id === 'string' && typeof c.name === 'string' && Number.isFinite(c.weight);

function mergeState(inc) {
  if (!inc || typeof inc !== 'object' || !Array.isArray(inc.disciplines)) throw new Error('Formato inválido');
  let added = 0;

  // semestres que ainda não existem
  if (inc.semesters && typeof inc.semesters === 'object') {
    for (const [k, s] of Object.entries(inc.semesters)) {
      if (!state.semesters[k] && s && typeof s.name === 'string') {
        state.semesters[k] = { name: s.name, start: s.start || '', end: s.end || '' };
      }
    }
  }

  // disciplinas (novas) e componentes em falta nas existentes
  inc.disciplines.forEach(d => {
    if (!d || typeof d.id !== 'string' || typeof d.name !== 'string' || !state.semesters[d.semester]) return;
    const comps = (Array.isArray(d.components) ? d.components : []).filter(validComp);
    const cur = findDisc(d.id);
    if (!cur) {
      state.disciplines.push({
        id: d.id, semester: d.semester, name: d.name,
        color: isHex(d.color) ? d.color : DEFAULT_COLOR,
        components: comps.map(cleanComp)
      });
      added++;
    } else {
      const ids = new Set(cur.components.map(c => c.id));
      comps.forEach(c => { if (!ids.has(c.id)) { cur.components.push(cleanComp(c)); ids.add(c.id); added++; } });
    }
  });

  // restantes listas: acrescenta só o que tem id novo
  const discIds = new Set(state.disciplines.map(d => d.id));
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const rules = {
    grades: g => typeof g.name === 'string' && Number.isFinite(g.value) && g.value >= 0 && g.value <= 20 && discIds.has(g.disciplineId),
    events: ev => typeof ev.title === 'string' && isDate(ev.date) && discIds.has(ev.disciplineId) &&
      ['teste', 'ficha'].includes(ev.type) && (!ev.time || /^\d{2}:\d{2}$/.test(ev.time)),
    tasks: t => typeof t.title === 'string' && (normalizeTask(t), true),
    links: l => typeof l.name === 'string' && isSafeUrl(l.url) &&
      discIds.has(l.disciplineId) && ['aulas', 'series', 'resumos'].includes(l.category)
  };
  for (const [k, ok] of Object.entries(rules)) {
    if (!Array.isArray(inc[k])) continue;
    const ids = new Set(state[k].map(x => x.id));
    inc[k].forEach(x => {
      if (x && typeof x === 'object' && typeof x.id === 'string' && !ids.has(x.id) && ok(x)) {
        state[k].push(x); ids.add(x.id); added++;
      }
    });
  }

  // notas ligadas a componentes que não existem ficam sem componente
  state.grades.forEach(g => {
    const d = findDisc(g.disciplineId);
    if (g.componentId && !(d && d.components.some(c => c.id === g.componentId))) g.componentId = null;
  });
  return added;
}

/* ==========================================================
   AUXILIARES DE DATAS E DISCIPLINAS
   ========================================================== */
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => toISO(new Date());
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const fmtDate = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const longDate = iso => parseISO(iso).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
// sem hora definida, o evento conta até ao fim desse dia
const eventDateTime = ev => {
  const [y, m, d] = ev.date.split('-').map(Number);
  const [hh, mm] = (ev.time || '23:59').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};
const discColor = id => { const d = findDisc(id); return d && isHex(d.color) ? d.color : 'var(--muted)'; };
const discName = id => { const d = findDisc(id); return d ? d.name : ''; };
const typeLabel = t => (t === 'ficha' ? 'Ficha' : 'Teste');

function openDialog(dlg) {
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

function fillDisciplineSelect(sel, { empty = false } = {}) {
  const cur = sel.value;
  sel.innerHTML = (empty ? '<option value="">— sem disciplina —</option>' : '') +
    semDisciplines().map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

/* ==========================================================
   DASHBOARD (contagem decrescente + progresso do semestre)
   ========================================================== */
function renderDashboard() {
  const now = new Date();

  // próximo "Teste" do semestre selecionado
  const discIds = new Set(semDisciplines().map(d => d.id));
  const next = state.events
    .filter(ev => ev.type === 'teste' && discIds.has(ev.disciplineId))
    .map(ev => ({ ev, at: eventDateTime(ev) }))
    .filter(x => x.at >= now)
    .sort((a, b) => a.at - b.at)[0];

  if (next) {
    const diff = next.at - now;
    $('#countdown-title').textContent = `${next.ev.title} · ${discName(next.ev.disciplineId)}`;
    $('#countdown-sub').textContent = longDate(next.ev.date) + (next.ev.time ? ` às ${next.ev.time}` : '');
    $('#cd-days').textContent = Math.floor(diff / 864e5);
    $('#cd-hours').textContent = Math.floor((diff % 864e5) / 36e5);
    $('#cd-mins').textContent = Math.floor((diff % 36e5) / 6e4);
  } else {
    $('#countdown-title').textContent = 'Sem testes marcados';
    $('#countdown-sub').textContent = 'Adiciona um evento do tipo Teste no calendário.';
    ['#cd-days', '#cd-hours', '#cd-mins'].forEach(s => { $(s).textContent = '–'; });
  }

  // progresso do semestre (o dia de fim conta como dia inteiro)
  const sem = state.semesters[state.currentSemester];
  let pct = 0, label = '–', text = 'Define as datas do semestre em ⚙ Definições.';
  if (sem && sem.start && sem.end) {
    const start = parseISO(sem.start), end = parseISO(addDays(sem.end, 1));
    pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    const left = Math.max(0, Math.ceil((end - now) / 864e5));
    if (now < start) text = `O ${sem.name} começa a ${fmtDate(sem.start)}.`;
    else if (now >= end) text = `O ${sem.name} terminou a ${fmtDate(sem.end)}.`;
    else text = `Faltam ${left} ${left === 1 ? 'dia' : 'dias'} · de ${fmtDate(sem.start)} a ${fmtDate(sem.end)}.`;
    label = `${Math.round(pct)}%`;
  }
  $('#progress-pct').textContent = label;
  $('#progress-bar').style.width = `${pct}%`;
  $('#progress').setAttribute('aria-valuenow', String(Math.round(pct)));
  $('#progress-text').textContent = text;
}

/* ==========================================================
   CALENDÁRIO
   - Eventos (testes/fichas) num dia.
   - Tarefas com início E fim aparecem como faixa em todos
     os dias desse intervalo (as sem fim não entram aqui).
   ========================================================== */
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelected = todayISO();

const semDiscIds = () => new Set(semDisciplines().map(d => d.id));
const semEvents = () => {
  const ids = semDiscIds();
  return state.events.filter(ev => ids.has(ev.disciplineId));
};
// tarefas com intervalo (início e fim) do semestre atual (ou sem disciplina)
const rangedTasks = () => {
  const ids = semDiscIds();
  return state.tasks.filter(t => t.date && t.end && (!t.disciplineId || ids.has(t.disciplineId)));
};
const sortEvents = (a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title);
const sortRanged = (a, b) => a.date.localeCompare(b.date) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title);
const taskColor = t => (t.disciplineId && findDisc(t.disciplineId) ? discColor(t.disciplineId) : 'var(--muted)');
const rangeLabel = t => `${fmtDate(t.date)} → ${fmtDate(t.end)}`;

function goToDate(iso) {
  const d = parseISO(iso);
  calSelected = iso; calYear = d.getFullYear(); calMonth = d.getMonth();
}

function renderCalendar() {
  $('#cal-title').textContent = new Date(calYear, calMonth, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  const byDate = {};
  semEvents().forEach(ev => { (byDate[ev.date] = byDate[ev.date] || []).push(ev); });
  const ranged = rangedTasks().sort(sortRanged);
  const tasksOn = iso => ranged.filter(t => t.date <= iso && iso <= t.end);

  const first = new Date(calYear, calMonth, 1);
  const start = new Date(calYear, calMonth, 1 - ((first.getDay() + 6) % 7)); // semana começa à segunda
  const today = todayISO();
  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(d);
    const evs = (byDate[iso] || []).sort(sortEvents);
    const ts = tasksOn(iso);
    const weekStart = i % 7 === 0;
    const chips = [
      ...evs.map(ev => `<span class="cal-chip ${ev.type}" style="--c:${discColor(ev.disciplineId)}">${esc(ev.time ? ev.time + ' ' : '')}${esc(ev.title)}</span>`),
      ...ts.map(t => {
        const cls = ['cal-chip', 'range'];
        if (t.date === iso) cls.push('r-start');
        if (t.end === iso) cls.push('r-end');
        if (t.done) cls.push('done');
        // o título só aparece no início, no começo de cada semana e no dia 1
        const showTitle = t.date === iso || weekStart || d.getDate() === 1;
        return `<span class="${cls.join(' ')}" style="--c:${taskColor(t)}" title="${esc(t.title)} · ${rangeLabel(t)}">${showTitle ? esc(t.title) : '&nbsp;'}</span>`;
      })
    ];
    const total = evs.length + ts.length;
    html += `
      <button type="button" class="cal-cell${d.getMonth() !== calMonth ? ' other' : ''}${iso === today ? ' today' : ''}${iso === calSelected ? ' selected' : ''}"
              data-date="${iso}" aria-label="${esc(longDate(iso))}${evs.length ? `, ${evs.length} evento(s)` : ''}${ts.length ? `, ${ts.length} tarefa(s)` : ''}">
        <span class="cal-num">${d.getDate()}</span>
        <span class="cal-dots">${evs.slice(0, 4).map(ev => `<span class="cal-dot ${ev.type}" style="--c:${discColor(ev.disciplineId)}"></span>`).join('')}</span>
        ${ts.length ? `<span class="cal-bars">${ts.slice(0, 3).map(t => `<span class="cal-bar${t.date === iso ? ' r-start' : ''}${t.end === iso ? ' r-end' : ''}${t.done ? ' done' : ''}" style="--c:${taskColor(t)}"></span>`).join('')}</span>` : ''}
        ${chips.slice(0, 3).join('')}
        ${total > 3 ? `<span class="cal-chip-more">+${total - 3}</span>` : ''}
      </button>`;
  }
  $('#cal-grid').innerHTML = html;

  $('#cal-legend').innerHTML = semDisciplines()
    .map(d => `<span><i class="dot" style="--c:${isHex(d.color) ? d.color : DEFAULT_COLOR}"></i>${esc(d.name)}</span>`).join('') +
    '<span><i class="legend-bar"></i>Tarefa com início e fim</span>';

  // eventos e tarefas do dia selecionado
  $('#cal-selected-title').textContent = `Dia · ${longDate(calSelected)}`;
  const dayEvs = (byDate[calSelected] || []).sort(sortEvents);
  const dayTasks = tasksOn(calSelected);
  const evHtml = dayEvs.map(ev => `
    <li class="event-item" style="--c:${discColor(ev.disciplineId)}">
      <div class="grow">
        <div class="title">${esc(ev.title)}</div>
        <div class="muted">${ev.time ? esc(ev.time) + ' · ' : ''}${esc(discName(ev.disciplineId))}</div>
      </div>
      <span class="type-badge">${typeLabel(ev.type)}</span>
      <button type="button" class="icon-btn" data-action="edit-event" data-id="${esc(ev.id)}" aria-label="Editar ${esc(ev.title)}">✎</button>
      <button type="button" class="icon-btn danger" data-action="del-event" data-id="${esc(ev.id)}" aria-label="Apagar ${esc(ev.title)}">✕</button>
    </li>`).join('');
  const taskHtml = dayTasks.map(t => {
    const total = daysBetween(t.date, t.end) + 1;
    const n = daysBetween(t.date, calSelected) + 1;
    const late = isLate(t);
    return `
    <li class="event-item task-range${t.done ? ' done' : ''}" style="--c:${taskColor(t)}">
      <input type="checkbox" data-action="toggle-task" data-id="${esc(t.id)}"${t.done ? ' checked' : ''} aria-label="Concluir: ${esc(t.title)}">
      <div class="grow">
        <div class="title">${esc(t.title)}</div>
        <div class="muted">${rangeLabel(t)} · dia ${n} de ${total}${t.disciplineId && findDisc(t.disciplineId) ? ' · ' + esc(discName(t.disciplineId)) : ''}${late ? ' · <span class="badge-late">Atrasada</span>' : ''}</div>
        <div class="mini-progress"><span style="width:${Math.round((n / total) * 100)}%"></span></div>
      </div>
      <span class="type-badge">Tarefa</span>
      <button type="button" class="icon-btn" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.title)}">✎</button>
    </li>`;
  }).join('');
  $('#cal-day-events').innerHTML = evHtml + taskHtml || '<li class="muted">Nada marcado neste dia.</li>';
}

$('#cal-prev').addEventListener('click', () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
$('#cal-next').addEventListener('click', () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});
$('#cal-today').addEventListener('click', () => { goToDate(todayISO()); renderCalendar(); });
$('#cal-grid').addEventListener('click', e => {
  const c = e.target.closest('.cal-cell');
  if (!c) return;
  goToDate(c.dataset.date);
  renderCalendar();
});
// setas do teclado mudam de mês quando o calendário está visível
document.addEventListener('keydown', e => {
  if (!$('#tab-calendar').classList.contains('active') || $('dialog[open]')) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'ArrowLeft') $('#cal-prev').click();
  else if (e.key === 'ArrowRight') $('#cal-next').click();
});

/* --- diálogo de evento (criar / editar / apagar) --- */
const eventDialog = $('#event-dialog');
const eventForm = $('#event-form');

function openEventDialog(ev) {
  if (!semDisciplines().length) { toast('Cria primeiro uma disciplina em ⚙ Definições.'); return; }
  fillDisciplineSelect(eventForm.elements['discipline']);
  eventForm.reset();
  $('#event-dialog-title').textContent = ev ? 'Editar evento' : 'Novo evento';
  $('#event-delete').hidden = !ev;
  eventForm.elements['eventId'].value = ev ? ev.id : '';
  eventForm.elements['title'].value = ev ? ev.title : '';
  eventForm.elements['date'].value = ev ? ev.date : calSelected;
  eventForm.elements['time'].value = ev ? (ev.time || '') : '';
  eventForm.elements['type'].value = ev ? ev.type : 'teste';
  if (ev && findDisc(ev.disciplineId)) eventForm.elements['discipline'].value = ev.disciplineId;
  openDialog(eventDialog);
}

$('#cal-add').addEventListener('click', () => openEventDialog(null));
$('#event-cancel').addEventListener('click', () => eventDialog.close());
eventDialog.addEventListener('click', e => { if (e.target === eventDialog) eventDialog.close(); });

eventForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(eventForm);
  const title = String(fd.get('title')).trim();
  const date = String(fd.get('date'));
  const discId = String(fd.get('discipline'));
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !findDisc(discId)) { toast('Preenche o título, a data e a disciplina.'); return; }
  const rec = { title, date, time: String(fd.get('time') || ''), disciplineId: discId, type: fd.get('type') === 'ficha' ? 'ficha' : 'teste' };
  const id = String(fd.get('eventId') || '');
  const existing = id ? state.events.find(x => x.id === id) : null;
  if (existing) Object.assign(existing, rec);
  else state.events.push({ id: uid(), ...rec });
  save();
  eventDialog.close();
  goToDate(date);
  renderAll();
});

$('#event-delete').addEventListener('click', () => {
  const id = eventForm.elements['eventId'].value;
  if (!id || !confirm('Apagar este evento?')) return;
  state.events = state.events.filter(ev => ev.id !== id);
  save();
  eventDialog.close();
  renderAll();
});

$('#cal-day-events').addEventListener('click', e => {
  const edit = e.target.closest('[data-action="edit-event"]');
  const del = e.target.closest('[data-action="del-event"]');
  if (edit) {
    const ev = state.events.find(x => x.id === edit.dataset.id);
    if (ev) openEventDialog(ev);
  } else if (del) {
    if (!confirm('Apagar este evento?')) return;
    state.events = state.events.filter(ev => ev.id !== del.dataset.id);
    save();
    renderAll();
  }
});

/* ==========================================================
   CHECKLIST DIÁRIO (Ontem / Hoje / Amanhã)
   - Tarefas com início e fim aparecem em todos os dias do
     intervalo; só ficam atrasadas depois do dia de fim.
   - As tarefas por fazer de dias anteriores passam
     automaticamente para "Hoje", com aviso a vermelho.
   - Tarefas sem data ficam numa secção própria em "Hoje".
   ========================================================== */
let dayOffset = 0;
const viewDay = () => addDays(todayISO(), dayOffset);
const taskEnd = t => t.end || t.date;
const isLate = t => !t.done && !!t.date && taskEnd(t) < todayISO();
const coversDay = (t, day) => !!t.date && t.date <= day && day <= taskEnd(t);

function tasksForView() {
  const day = viewDay(), today = todayISO();
  let list = state.tasks.filter(t => coversDay(t, day));
  if (dayOffset === 0) {
    // atrasadas por fazer + as que foram concluídas hoje (para não desaparecerem ao marcar)
    list = list.concat(state.tasks.filter(t => t.date && taskEnd(t) < today && (!t.done || t.doneDate === today)));
  }
  const rank = t => (isLate(t) ? 0 : t.done ? 2 : 1);
  return list.sort((a, b) => rank(a) - rank(b) || taskEnd(a).localeCompare(taskEnd(b)) || a.title.localeCompare(b.title));
}

function taskItem(t) {
  const today = todayISO();
  const late = isLate(t);
  const bits = [];
  if (t.disciplineId && findDisc(t.disciplineId)) bits.push(esc(discName(t.disciplineId)));
  if (t.end) {
    const left = daysBetween(today, t.end);
    bits.push(rangeLabel(t) + (!t.done && !late && t.date <= today
      ? (left === 0 ? ' · <strong>termina hoje</strong>' : ` · faltam ${left} ${left === 1 ? 'dia' : 'dias'}`) : ''));
  }
  if (late) {
    const n = daysBetween(taskEnd(t), today);
    bits.push(`<span class="badge-late">Atrasada há ${n} ${n === 1 ? 'dia' : 'dias'}</span>`);
  }
  return `
    <li class="task${t.done ? ' done' : ''}${late ? ' late' : ''}" style="--c:${t.disciplineId ? discColor(t.disciplineId) : 'var(--border)'}">
      <input type="checkbox" data-id="${esc(t.id)}"${t.done ? ' checked' : ''} aria-label="Concluir: ${esc(t.title)}">
      <div class="grow">
        <span class="title">${esc(t.title)}</span>
        ${bits.length ? `<small>${bits.join(' · ')}</small>` : ''}
      </div>
      <button type="button" class="icon-btn" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.title)}">✎</button>
      <button type="button" class="icon-btn danger" data-action="del-task" data-id="${esc(t.id)}" aria-label="Apagar ${esc(t.title)}">✕</button>
    </li>`;
}

function renderChecklist() {
  const labels = { '-1': 'Ontem', '0': 'Hoje', '1': 'Amanhã' };
  $$('#day-nav .btn').forEach(b => b.classList.toggle('active', Number(b.dataset.offset) === dayOffset));
  $('#checklist-date').textContent = `${labels[dayOffset]} · ${longDate(viewDay())}`;
  fillDisciplineSelect($('#task-form [name="discipline"]'), { empty: true });

  const list = tasksForView();
  $('#task-list').innerHTML = list.length ? list.map(taskItem).join('') : '<li class="muted">Sem tarefas para este dia.</li>';

  const undated = dayOffset === 0 ? state.tasks.filter(t => !t.date && (!t.done || t.doneDate === todayISO())) : [];
  $('#undated-wrap').hidden = !undated.length;
  const pending = undated.filter(t => !t.done).length;
  $('#undated-count').textContent = `· ${pending} por fazer`;
  $('#undated-list').innerHTML = undated.map(taskItem).join('');
}

$('#day-nav').addEventListener('click', e => {
  const b = e.target.closest('[data-offset]');
  if (!b) return;
  dayOffset = Number(b.dataset.offset);
  renderChecklist();
});

$('#task-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const fd = new FormData(f);
  const title = String(fd.get('title')).trim();
  if (!title) return;
  const discId = String(fd.get('discipline') || '');
  const when = String(fd.get('when'));
  let date = viewDay(), end = '';
  if (when === 'none') date = '';
  else if (when === 'range') {
    date = String(fd.get('start') || '');
    end = String(fd.get('end') || '');
    if (!date || !end) { toast('Escolhe a data de início e a de fim.'); return; }
    if (end < date) { toast('A data de fim tem de ser igual ou depois do início.'); return; }
  }
  const t = normalizeTask({ id: uid(), title, date, end, disciplineId: findDisc(discId) ? discId : '', done: false });
  state.tasks.push(t);
  save();
  f.querySelector('[name="title"]').value = '';
  f.querySelector('[name="start"]').value = '';
  f.querySelector('[name="end"]').value = '';
  f.querySelector('[name="title"]').focus();
  if (!t.date) toast('Tarefa adicionada a «Sem prazo».');
  if (t.end) toast(`Tarefa adicionada: ${rangeLabel(t)} (aparece no calendário).`);
  renderChecklist();
  renderCalendar();
});

$('#task-form [name="when"]').addEventListener('change', e => {
  const range = e.target.value === 'range';
  $('#task-range').hidden = !range;
  if (range && !$('#task-form [name="start"]').value) $('#task-form [name="start"]').value = viewDay();
});

function toggleTask(id, done) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = done;
  if (t.done) t.doneDate = todayISO(); else delete t.doneDate;
  save();
  renderChecklist();
  renderCalendar();
}

$('#checklist-card').addEventListener('change', e => {
  if (e.target.type === 'checkbox' && e.target.dataset.id) toggleTask(e.target.dataset.id, e.target.checked);
});
$('#cal-day-events').addEventListener('change', e => {
  if (e.target.dataset.action === 'toggle-task') toggleTask(e.target.dataset.id, e.target.checked);
});

$('#checklist-card').addEventListener('click', e => {
  const edit = e.target.closest('[data-action="edit-task"]');
  if (edit) { openTaskDialog(state.tasks.find(t => t.id === edit.dataset.id)); return; }
  const b = e.target.closest('[data-action="del-task"]');
  if (!b) return;
  if (!confirm('Apagar esta tarefa?')) return;
  state.tasks = state.tasks.filter(t => t.id !== b.dataset.id);
  save();
  renderChecklist();
  renderCalendar();
});

/* --- diálogo de tarefa (editar título, disciplina, início e fim) --- */
const taskDialog = $('#task-dialog');
const taskForm = $('#task-edit-form');

function openTaskDialog(t) {
  if (!t) return;
  fillDisciplineSelect(taskForm.elements['discipline'], { empty: true });
  taskForm.elements['taskId'].value = t.id;
  taskForm.elements['title'].value = t.title;
  taskForm.elements['start'].value = t.date || '';
  taskForm.elements['end'].value = t.end || '';
  taskForm.elements['discipline'].value = t.disciplineId && findDisc(t.disciplineId) ? t.disciplineId : '';
  openDialog(taskDialog);
}

$('#cal-day-events').addEventListener('click', e => {
  const b = e.target.closest('[data-action="edit-task"]');
  if (b) openTaskDialog(state.tasks.find(t => t.id === b.dataset.id));
});
$('#task-cancel').addEventListener('click', () => taskDialog.close());
taskDialog.addEventListener('click', e => { if (e.target === taskDialog) taskDialog.close(); });

taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(taskForm);
  const t = state.tasks.find(x => x.id === fd.get('taskId'));
  if (!t) return;
  const title = String(fd.get('title')).trim();
  const start = String(fd.get('start') || '');
  const end = String(fd.get('end') || '');
  if (!title) { toast('A tarefa precisa de um título.'); return; }
  if (end && !start) { toast('Para ter fim, a tarefa precisa de uma data de início.'); return; }
  if (end && end < start) { toast('A data de fim tem de ser igual ou depois do início.'); return; }
  const discId = String(fd.get('discipline') || '');
  Object.assign(t, { title, date: start, end, disciplineId: findDisc(discId) ? discId : '' });
  normalizeTask(t);
  save();
  taskDialog.close();
  renderAll();
});

$('#task-delete').addEventListener('click', () => {
  const id = taskForm.elements['taskId'].value;
  if (!id || !confirm('Apagar esta tarefa?')) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  taskDialog.close();
  renderAll();
});

/* ==========================================================
   REPOSITÓRIO DE FICHEIROS (só links: Drive, Dropbox, …)
   - Cada disciplina expande/recolhe ao clicar no título
     (o estado fica guardado).
   ========================================================== */
const CATS = [['aulas', 'Aulas'], ['series', 'Séries'], ['resumos', 'Resumos']];
// http(s) ou caminho relativo (sem "esquema" tipo javascript:)
const isSafeUrl = u => typeof u === 'string' && u.trim() !== '' && (/^https?:\/\//i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u.trim()));
const hostOf = url => {
  try { return /^https?:/i.test(url) ? new URL(url).hostname.replace(/^www\./, '') : 'no site'; } catch (e) { return ''; }
};
const fileIcon = url => {
  const ext = (url.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['ppt', 'pptx', 'key'].includes(ext)) return '📊';
  if (['doc', 'docx', 'odt', 'txt', 'md'].includes(ext)) return '📝';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜';
  if (['py', 'ipynb', 'js', 'java', 'c'].includes(ext)) return '💻';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '🖼';
  return '🔗';
};
let fileQuery = '';
const isCollapsed = id => state.ui.collapsedFiles.includes(id);

function renderFiles() {
  fillDisciplineSelect($('#link-form [name="discipline"]'));
  const box = $('#files-list');
  const discs = semDisciplines();
  $('#files-tools').hidden = !discs.length;
  if (!discs.length) {
    box.innerHTML = '<div class="card empty">Ainda não há disciplinas neste semestre. Adiciona-as em ⚙ Definições.</div>';
    return;
  }
  const q = fileQuery.trim().toLowerCase();
  const match = l => !q || l.name.toLowerCase().includes(q) || l.url.toLowerCase().includes(q);

  const html = discs.map(d => {
    const all = state.links.filter(l => l.disciplineId === d.id);
    const links = all.filter(match);
    if (q && !links.length) return '';
    // ao pesquisar mostra tudo aberto
    const open = q ? true : !isCollapsed(d.id);
    const groups = CATS.map(([key, label]) => {
      const ls = links.filter(l => l.category === key);
      if (!ls.length) return '';
      return `<h4 class="file-cat">${label} <span class="count">${ls.length}</span></h4>
        <div class="stack">${ls.map(l => `
          <div class="file-link">
            <span class="file-ico" aria-hidden="true">${fileIcon(l.fileId ? l.fileName || l.name : l.url)}</span>
            ${l.fileId
              ? `<a href="${esc(blobUrls.get(l.fileId) || '#')}" target="_blank" rel="noopener" data-action="open-file" data-id="${esc(l.id)}">${esc(l.name)}</a>
                 <span class="muted host">${esc(fmtSize(l.size))}</span>
                 <button type="button" class="icon-btn" data-action="download-file" data-id="${esc(l.id)}" aria-label="Descarregar ${esc(l.name)}">⤓</button>`
              : `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>
                 <span class="muted host">${esc(hostOf(l.url))}</span>`}
            <button type="button" class="icon-btn danger" data-action="del-link" data-id="${esc(l.id)}" aria-label="Apagar ${esc(l.name)}">✕</button>
          </div>`).join('')}</div>`;
    }).join('');
    const counts = CATS.map(([key, label]) => [label, all.filter(l => l.category === key).length]).filter(x => x[1]);
    return `
      <article class="card file-group${open ? ' open' : ''}" data-disc="${esc(d.id)}" style="--c:${isHex(d.color) ? d.color : DEFAULT_COLOR}">
        <button type="button" class="file-head" data-action="toggle-disc" data-id="${esc(d.id)}" aria-expanded="${open}" aria-controls="files-${esc(d.id)}">
          <span class="dot"></span>
          <span class="file-title">${esc(d.name)}</span>
          <span class="file-sum">${all.length ? counts.map(([l, n]) => `${n} ${l.toLowerCase()}`).join(' · ') : 'vazio'}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        <div class="file-body" id="files-${esc(d.id)}"${open ? '' : ' hidden'}>
          ${groups || '<p class="muted">Ainda sem links.</p>'}
        </div>
      </article>`;
  }).join('');
  box.innerHTML = html || '<div class="card empty">Nenhum ficheiro corresponde à pesquisa.</div>';
  loadBlobUrls();
}

$('#link-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const fd = new FormData(f);
  const discId = String(fd.get('discipline'));
  const category = String(fd.get('category'));
  const name = String(fd.get('name')).trim();
  let url = String(fd.get('url')).trim();
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo');
    url = u.href;
  } catch (err) { toast('O link tem de começar por http:// ou https://'); return; }
  if (!name || !findDisc(discId) || !CATS.some(c => c[0] === category)) { toast('Preenche a disciplina, a categoria e o nome.'); return; }
  state.links.push({ id: uid(), disciplineId: discId, category, name, url });
  state.ui.collapsedFiles = state.ui.collapsedFiles.filter(id => id !== discId); // mostra onde ficou
  save();
  f.querySelector('[name="name"]').value = '';
  f.querySelector('[name="url"]').value = '';
  renderFiles();
});

$('#files-list').addEventListener('click', e => {
  const head = e.target.closest('[data-action="toggle-disc"]');
  if (head) {
    if (fileQuery.trim()) return; // durante a pesquisa fica tudo aberto
    const id = head.dataset.id;
    state.ui.collapsedFiles = isCollapsed(id)
      ? state.ui.collapsedFiles.filter(x => x !== id)
      : state.ui.collapsedFiles.concat(id);
    save();
    renderFiles();
    return;
  }
  const open = e.target.closest('[data-action="open-file"], [data-action="download-file"]');
  if (open) {
    // o link já aponta para o ficheiro; só intervém se ainda não estiver carregado
    if (open.dataset.action === 'open-file' && open.getAttribute('href') !== '#') return;
    e.preventDefault(); openStoredFile(open.dataset.id, true); return;
  }
  const b = e.target.closest('[data-action="del-link"]');
  if (!b) return;
  const link = state.links.find(l => l.id === b.dataset.id);
  if (!link || !confirm(link.fileId ? 'Apagar este ficheiro?' : 'Apagar este link?')) return;
  if (link.fileId) fileStore.del(link.fileId).catch(() => {});
  state.links = state.links.filter(l => l.id !== b.dataset.id);
  save();
  renderFiles();
});

$('#files-search').addEventListener('input', e => { fileQuery = e.target.value; renderFiles(); });
$('#files-expand').addEventListener('click', () => {
  const ids = new Set(semDiscIds());
  state.ui.collapsedFiles = state.ui.collapsedFiles.filter(id => !ids.has(id));
  save(); renderFiles();
});
$('#files-collapse').addEventListener('click', () => {
  state.ui.collapsedFiles = [...new Set(state.ui.collapsedFiles.concat([...semDiscIds()]))];
  save(); renderFiles();
});
/* ==========================================================
   FICHEIROS GUARDADOS NO NAVEGADOR (IndexedDB)
   - Arrastar para a zona ou para cima de uma disciplina.
   - Ficam só neste navegador/dispositivo (não vão no backup).
   ========================================================== */
const fmtSize = n => (!Number.isFinite(n) ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);

const fileStore = (() => {
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('estudo-ficheiros', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = (mode, fn) => db().then(d => new Promise((res, rej) => {
    const tx = d.transaction('files', mode);
    const req = fn(tx.objectStore('files'));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = tx.onabort = () => rej(tx.error);
  }));
  return {
    put: (id, blob) => run('readwrite', st => st.put(blob, id)),
    get: id => run('readonly', st => st.get(id)),
    del: id => {
      if (blobUrls.get(id)) URL.revokeObjectURL(blobUrls.get(id));
      blobUrls.delete(id);
      return run('readwrite', st => st.delete(id));
    }
  };
})();

async function addFiles(files, discId, category) {
  if (!files.length) return;
  if (!findDisc(discId)) { toast('Cria primeiro uma disciplina em ⚙ Definições.'); return; }
  if (!window.indexedDB) { toast('Este navegador não permite guardar ficheiros.'); return; }
  let ok = 0;
  for (const f of files) {
    if (!f.size && !f.type) continue; // pastas
    const id = uid();
    try {
      await fileStore.put(id, f);
      state.links.push({
        id, disciplineId: discId, category, name: f.name.replace(/\.[^.]+$/, '') || f.name,
        url: '', fileId: id, fileName: f.name, size: f.size, mime: f.type || ''
      });
      ok++;
    } catch (err) {
      console.warn(err);
      toast(`Não foi possível guardar «${f.name}» (espaço cheio?).`);
    }
  }
  if (!ok) return;
  state.ui.collapsedFiles = state.ui.collapsedFiles.filter(x => x !== discId);
  save();
  renderFiles();
  toast(`${ok} ficheiro(s) guardado(s) em ${discName(discId)} · ${CATS.find(c => c[0] === category)[1]}.`);
}

// URLs (blob:) dos ficheiros guardados, para os links abrirem diretamente
const blobUrls = new Map();
async function loadBlobUrls() {
  for (const l of state.links) {
    if (!l.fileId || blobUrls.has(l.fileId)) continue;
    let blob = null;
    try { blob = await fileStore.get(l.fileId); } catch (e) {}
    if (!blob) { blobUrls.set(l.fileId, ''); continue; }
    const url = URL.createObjectURL(blob);
    blobUrls.set(l.fileId, url);
    $$(`[data-action="open-file"][data-id="${CSS.escape(l.id)}"]`).forEach(a => { a.href = url; });
  }
}

async function openStoredFile(linkId, download) {
  const l = state.links.find(x => x.id === linkId);
  if (!l) return;
  // abre já a janela (senão o bloqueador de pop-ups trava-a depois do await)
  const win = download ? null : window.open('', '_blank');
  let blob;
  try { blob = await fileStore.get(l.fileId); } catch (e) { blob = null; }
  if (!blob) {
    if (win) win.close();
    toast('Este ficheiro não está guardado neste navegador.');
    return;
  }
  const url = URL.createObjectURL(blob);
  if (download || !win) {
    const a = document.createElement('a');
    a.href = url; a.download = l.fileName || l.name;
    document.body.appendChild(a); a.click(); a.remove();
  } else {
    win.location.href = url;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const linkForm = $('#link-form');
const dropzone = $('#dropzone');
const formTarget = () => [String(linkForm.elements['discipline'].value), String(linkForm.elements['category'].value)];

dropzone.addEventListener('click', () => $('#file-input').click());
dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file-input').click(); } });
$('#file-input').addEventListener('change', e => {
  const files = [...e.target.files];
  e.target.value = '';
  addFiles(files, ...formTarget());
});

// arrastar: para a zona (usa disciplina/categoria do formulário) ou para cima de uma disciplina
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
let dragDepth = 0;
document.addEventListener('dragenter', e => {
  if (!hasFiles(e) || !$('#tab-files').classList.contains('active')) return;
  dragDepth++;
  document.body.classList.add('dragging-files');
});
document.addEventListener('dragleave', e => {
  if (!hasFiles(e)) return;
  if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging-files'); }
});
document.addEventListener('dragover', e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); // permite largar (e evita o navegador abrir o ficheiro)
  $$('.drop-over').forEach(x => x.classList.remove('drop-over'));
  const t = e.target.closest('#dropzone, .file-group');
  if (t) t.classList.add('drop-over');
  e.dataTransfer.dropEffect = t ? 'copy' : 'none';
});
document.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging-files');
  $$('.drop-over').forEach(x => x.classList.remove('drop-over'));
  const files = [...e.dataTransfer.files];
  const group = e.target.closest('.file-group');
  if (group) addFiles(files, group.dataset.disc, formTarget()[1]);
  else if (e.target.closest('#dropzone')) addFiles(files, ...formTarget());
});

/* ==========================================================
   ARRANQUE
   ========================================================== */
function renderAll() {
  renderSemesterSelect();
  renderDashboard();
  renderCalendar();
  renderChecklist();
  renderFiles();
  renderGrades();
}

// atualiza a contagem decrescente e as datas quando voltas à app
setInterval(renderDashboard, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });

applyTheme();
renderAll();
showTab('dashboard');
