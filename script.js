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
    links: []
  };
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
    tasks: t => typeof t.title === 'string' && isDate(t.date),
    links: l => typeof l.name === 'string' && typeof l.url === 'string' && /^https?:\/\//i.test(l.url) &&
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
   ========================================================== */
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelected = todayISO();

const semEvents = () => {
  const ids = new Set(semDisciplines().map(d => d.id));
  return state.events.filter(ev => ids.has(ev.disciplineId));
};
const sortEvents = (a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title);

function goToDate(iso) {
  const d = parseISO(iso);
  calSelected = iso; calYear = d.getFullYear(); calMonth = d.getMonth();
}

function renderCalendar() {
  $('#cal-title').textContent = new Date(calYear, calMonth, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  const byDate = {};
  semEvents().forEach(ev => { (byDate[ev.date] = byDate[ev.date] || []).push(ev); });

  const first = new Date(calYear, calMonth, 1);
  const start = new Date(calYear, calMonth, 1 - ((first.getDay() + 6) % 7)); // semana começa à segunda
  const today = todayISO();
  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(d);
    const evs = (byDate[iso] || []).sort(sortEvents);
    html += `
      <button type="button" class="cal-cell${d.getMonth() !== calMonth ? ' other' : ''}${iso === today ? ' today' : ''}${iso === calSelected ? ' selected' : ''}"
              data-date="${iso}" aria-label="${esc(longDate(iso))}${evs.length ? `, ${evs.length} evento(s)` : ''}">
        <span class="cal-num">${d.getDate()}</span>
        <span class="cal-dots">${evs.slice(0, 4).map(ev => `<span class="cal-dot ${ev.type}" style="--c:${discColor(ev.disciplineId)}"></span>`).join('')}</span>
        ${evs.slice(0, 3).map(ev => `<span class="cal-chip ${ev.type}" style="--c:${discColor(ev.disciplineId)}">${esc(ev.time ? ev.time + ' ' : '')}${esc(ev.title)}</span>`).join('')}
        ${evs.length > 3 ? `<span class="cal-chip-more">+${evs.length - 3}</span>` : ''}
      </button>`;
  }
  $('#cal-grid').innerHTML = html;

  $('#cal-legend').innerHTML = semDisciplines()
    .map(d => `<span><i class="dot" style="--c:${isHex(d.color) ? d.color : DEFAULT_COLOR}"></i>${esc(d.name)}</span>`).join('');

  // eventos do dia selecionado
  $('#cal-selected-title').textContent = `Eventos · ${longDate(calSelected)}`;
  const dayEvs = (byDate[calSelected] || []).sort(sortEvents);
  $('#cal-day-events').innerHTML = dayEvs.length ? dayEvs.map(ev => `
    <li class="event-item" style="--c:${discColor(ev.disciplineId)}">
      <div class="grow">
        <div class="title">${esc(ev.title)}</div>
        <div class="muted">${ev.time ? esc(ev.time) + ' · ' : ''}${esc(discName(ev.disciplineId))}</div>
      </div>
      <span class="type-badge">${typeLabel(ev.type)}</span>
      <button type="button" class="icon-btn" data-action="edit-event" data-id="${esc(ev.id)}" aria-label="Editar ${esc(ev.title)}">✎</button>
      <button type="button" class="icon-btn danger" data-action="del-event" data-id="${esc(ev.id)}" aria-label="Apagar ${esc(ev.title)}">✕</button>
    </li>`).join('') : '<li class="muted">Sem eventos neste dia.</li>';
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
   - As tarefas por fazer de dias anteriores passam
     automaticamente para "Hoje", com aviso a vermelho.
   ========================================================== */
let dayOffset = 0;
const viewDay = () => addDays(todayISO(), dayOffset);
const isLate = t => !t.done && t.date < todayISO();

function tasksForView() {
  const day = viewDay(), today = todayISO();
  let list = state.tasks.filter(t => t.date === day);
  if (dayOffset === 0) {
    // atrasadas por fazer + as que foram concluídas hoje (para não desaparecerem ao marcar)
    list = list.concat(state.tasks.filter(t => t.date < today && (!t.done || t.doneDate === today)));
  }
  const rank = t => (isLate(t) ? 0 : t.done ? 2 : 1);
  return list.sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date));
}

function renderChecklist() {
  const labels = { '-1': 'Ontem', '0': 'Hoje', '1': 'Amanhã' };
  $$('#day-nav .btn').forEach(b => b.classList.toggle('active', Number(b.dataset.offset) === dayOffset));
  $('#checklist-date').textContent = `${labels[dayOffset]} · ${longDate(viewDay())}`;
  fillDisciplineSelect($('#task-form [name="discipline"]'), { empty: true });

  const today = todayISO();
  const list = tasksForView();
  $('#task-list').innerHTML = list.length ? list.map(t => {
    const late = isLate(t);
    const n = late ? daysBetween(t.date, today) : 0;
    const bits = [];
    if (t.disciplineId && findDisc(t.disciplineId)) bits.push(esc(discName(t.disciplineId)));
    if (late) bits.push(`<span class="badge-late">Atrasada desde ${n} ${n === 1 ? 'dia' : 'dias'}</span>`);
    return `
      <li class="task${t.done ? ' done' : ''}" style="--c:${t.disciplineId ? discColor(t.disciplineId) : 'var(--border)'}">
        <input type="checkbox" data-id="${esc(t.id)}"${t.done ? ' checked' : ''} aria-label="Concluir: ${esc(t.title)}">
        <div class="grow">
          <span class="title">${esc(t.title)}</span>
          ${bits.length ? `<small>${bits.join(' · ')}</small>` : ''}
        </div>
        <button type="button" class="icon-btn danger" data-action="del-task" data-id="${esc(t.id)}" aria-label="Apagar ${esc(t.title)}">✕</button>
      </li>`;
  }).join('') : '<li class="muted">Sem tarefas para este dia.</li>';
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
  state.tasks.push({ id: uid(), title, date: viewDay(), disciplineId: findDisc(discId) ? discId : '', done: false });
  save();
  const input = f.querySelector('[name="title"]');
  input.value = '';
  input.focus();
  renderChecklist();
});

$('#task-list').addEventListener('change', e => {
  if (e.target.type !== 'checkbox') return;
  const t = state.tasks.find(x => x.id === e.target.dataset.id);
  if (!t) return;
  t.done = e.target.checked;
  if (t.done) t.doneDate = todayISO(); else delete t.doneDate;
  save();
  renderChecklist();
});

$('#task-list').addEventListener('click', e => {
  const b = e.target.closest('[data-action="del-task"]');
  if (!b) return;
  if (!confirm('Apagar esta tarefa?')) return;
  state.tasks = state.tasks.filter(t => t.id !== b.dataset.id);
  save();
  renderChecklist();
});

/* ==========================================================
   REPOSITÓRIO DE FICHEIROS (só links: Drive, Dropbox, …)
   ========================================================== */
const CATS = [['aulas', 'Aulas'], ['series', 'Séries'], ['resumos', 'Resumos']];
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

function renderFiles() {
  fillDisciplineSelect($('#link-form [name="discipline"]'));
  const box = $('#files-list');
  const discs = semDisciplines();
  if (!discs.length) {
    box.innerHTML = '<div class="card empty">Ainda não há disciplinas neste semestre. Adiciona-as em ⚙ Definições.</div>';
    return;
  }
  box.innerHTML = discs.map(d => {
    const links = state.links.filter(l => l.disciplineId === d.id);
    const groups = CATS.map(([key, label]) => {
      const ls = links.filter(l => l.category === key);
      if (!ls.length) return '';
      return `<h4 class="file-cat">${label}</h4>
        <div class="stack">${ls.map(l => `
          <div class="file-link">
            <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>
            <span class="muted">${esc(hostOf(l.url))}</span>
            <button type="button" class="icon-btn danger" data-action="del-link" data-id="${esc(l.id)}" aria-label="Apagar ${esc(l.name)}">✕</button>
          </div>`).join('')}</div>`;
    }).join('');
    return `
      <article class="card file-group" style="--c:${isHex(d.color) ? d.color : DEFAULT_COLOR}">
        <h2><span class="dot"></span>${esc(d.name)}</h2>
        ${groups || '<p class="muted">Ainda sem links.</p>'}
      </article>`;
  }).join('');
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
  save();
  f.querySelector('[name="name"]').value = '';
  f.querySelector('[name="url"]').value = '';
  renderFiles();
});

$('#files-list').addEventListener('click', e => {
  const b = e.target.closest('[data-action="del-link"]');
  if (!b) return;
  if (!confirm('Apagar este link?')) return;
  state.links = state.links.filter(l => l.id !== b.dataset.id);
  save();
  renderFiles();
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
