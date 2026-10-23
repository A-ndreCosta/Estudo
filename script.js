/* ==========================================================
   Estudo · Dashboard — script.js
   Núcleo (estado, tema, semestres, definições, exportar/importar)
   + Notas e Médias + Dashboard + Calendário + Checklist + Ficheiros.
   A sincronização na nuvem está em sync.js.
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
const isISODate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

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
    updatedAt: 0, // 0 = nunca alterado (dados iniciais)
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
      ]),
      TOT_DISC()
    ],
    addedTot: true,
    addedCalcPlan: false,
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

// plano de estudo para o teste de Cálculo (27/10) — acrescentado uma única vez
const CALC_PLAN = [
  ['2026-10-16', 'resto do dia', 3, 'Terminar a Série 2 (do 3d ao fim) e começar a Série 3 (regras de derivação, regra da cadeia)'],
  ['2026-10-17', 'todo o dia', 5, 'Acabar a Série 3 e fazer a Série 4 (implícita, log/exp, trig. inversas, L’Hôpital)'],
  ['2026-10-18', 'todo o dia', 5, 'Acabar a Série 4 e começar a Série 5 (monotonia, concavidade, 2.º teste, extremos absolutos)'],
  ['2026-10-19', 'depois das 14h', 3, 'Acabar a Série 5 e rever a Aula 5'],
  ['2026-10-20', 'depois das 17h30', 2, 'Miniteste antigo a 18 min, cronometrado, e correção. Rever os exercícios difíceis das Séries 1 e 2 (1b, 1d, 2a, 2c, 2d, 4, 7, 8, 9, 10d)'],
  ['2026-10-21', 'depois das 16h30', 2, 'Aula 6 / Série 6, se já tiverem saído. Se não, refazer os erros do miniteste e da Série 5'],
  ['2026-10-22', 'depois das 13h30', 3, 'Aula 6 / Série 6 (primitivas, integral definido, área)'],
  ['2026-10-23', 'todo o dia', 5, 'Simulacro 1 de 80 min (teste antigo, só o que cai nas aulas 1 a 6). Depois correção e lista dos erros por tipo'],
  ['2026-10-24', 'todo o dia', 5, 'Simulacro 2 de 80 min, correção e refazer todos os erros'],
  ['2026-10-25', 'todo o dia', 3, 'Resumo, formulário (derivadas, limites, tabela de primitivas, TFC) e 3 a 4 exercícios por tema'],
  ['2026-10-26', 'a confirmar', '1 a 2', 'Só o formulário e uma leitura leve. Deita-te cedo']
];
// plano revisto a 18/10: substitui os dias de 18 a 26 do plano anterior
const CALC_PLAN_V2 = [
  ['2026-10-18', 'até ao fim do dia', 3, 'Série 5, ex. 1 e 2 (monotonia, extremos locais, concavidade, inflexão)'],
  ['2026-10-19', 'depois das 14h', 3, 'Série 5, ex. 3 e 4 (2.º teste da derivada, extremos absolutos) e o resto do núcleo'],
  ['2026-10-20', 'depois das 17h30', 2, 'Acabar a Série 5 (otimização incluída) e anotar os erros'],
  ['2026-10-21', 'depois das 16h30', 2, 'Revisão da Série 3: só os exercícios difíceis e um de cada regra (produto, quociente, cadeia)'],
  ['2026-10-22', 'depois das 13h30', 3, 'Revisão da Série 4: implícita, trig. inversas, L’Hôpital. Se a Aula 6 já saiu, começa por ela'],
  ['2026-10-23', 'todo o dia', 5, 'Aula 6 / Série 6 (primitivas, integral definido, área). Miniteste antigo a 18 min de manhã, com correção'],
  ['2026-10-24', 'todo o dia', 5, 'Simulacro 1 de 80 min, só com o que cai nas aulas 1 a 6. Correção e lista de erros por tipo'],
  ['2026-10-25', 'todo o dia', 4, 'Simulacro 2 de 80 min, correção e refazer os erros. Depois o formulário (derivadas, limites, primitivas, TFC)'],
  ['2026-10-26', 'depois das 14h', '1 a 2', 'Só o formulário e uma leitura leve. Dormir cedo']
];
// plano revisto a 22/10 (50 min + 10 de pausa; 30 min de pausa longa a cada 3 blocos)
const CALC_PLAN_V3 = [
  ['2026-10-22', 'depois das 13h30', 4, 'Série 6: ex. 1, 2, 4, 5, 6, 8, 9, 10 (primitivas, integrais definidos, área, TFC, velocidade)'],
  ['2026-10-23', 'todo o dia', 5, 'Série 6: ex. 3 e 7. Ficha 2: 1b/d, 2c, 3a, 4d, 5, 6a/b, 7c (limites e continuidade). Ficha 5 (ainda por explicar): 7, 8d, 9, 10c'],
  ['2026-10-24', 'todo o dia', 5, 'Simulacro 1 de 80 min de manhã e correção. Depois refazer sem ajuda a Ficha 5 (1a/b/c, 3d, 4b/c/d, 5, 6) e Ficha 1 domínios (1b, 1d)'],
  ['2026-10-25', 'todo o dia', 4, 'Simulacro 2 de 80 min e correção. Ficha 2 restante (8c, 9c/d, 10c). Ficha 1 (7, 8, 9) se der tempo. Formulário e tabela trigonométrica'],
  ['2026-10-26', 'depois das 14h', '1 a 2', 'Só o formulário, os erros dos simulacros e uma leitura leve. Dormir cedo']
];
// plano final (24 a 26/10), um bloco por tarefa; substitui tudo o que havia no Diário
const CALC_PLAN_V4 = [
  ['2026-10-24', 'Simulacro 1 de 80 min (miniteste completo + exame ex. 1 a 5, sem consulta)'],
  ['2026-10-24', 'Correção e lista de erros'],
  ['2026-10-24', 'Ficha 2, limites e continuidade: 1b/d, 2c, 3a, 4d, 5, 6a/b, 7c'],
  ['2026-10-24', 'Ficha 2 restante (8c, 9c/d, 10c) e Ficha 1 (1b, 1d, 4)'],
  ['2026-10-24', 'Série 6, ex. 3 (b, c, d) e 6d'],
  ['2026-10-25', 'Simulacro 2 de 80 min (exame ex. 6, 7, 8a, 9a e o que errares)'],
  ['2026-10-25', 'Correção'],
  ['2026-10-25', 'Ficha 5 por explicar (7, 8d, 9, 10c) e refazer sem ajuda 1b/c, 4b/c/d, 5, 6'],
  ['2026-10-25', 'Série 6 a repetir (2c, 8d, 9c, 9d) e decorar o formulário e a tabela trigonométrica'],
  ['2026-10-26', 'Só o formulário, os erros dos simulacros e 3 a 4 exercícios de derivadas e limites. Dormir cedo']
];
const V4_NOTES = { '2026-10-24': ['todo o dia', 5], '2026-10-25': ['todo o dia', 4], '2026-10-26': ['depois das 14h', '1 a 2'] };

// plano até ao teste (27/10), versão final: substitui TODAS as tarefas
const CALC_PLAN_V5 = [
  ['2026-10-24', 'B1 · Simulacro 1 (80 min, sem consulta, miniteste + exame ex. 1 a 5)', 'Não pode falhar'],
  ['2026-10-24', 'B2 · Correção e lista de erros do simulacro', 'Não pode falhar'],
  ['2026-10-24', 'B3 · Série 3 (núcleo), exercícios-chave: 2b, 3b, 3d, 4c, 4d, 4e, 5a, 5b, 6d, 8b, 8d, 10', 'Se estiveres cansado, passa para domingo'],
  ['2026-10-24', 'B4 · Ficha 2: limites e continuidade (1b/d, 2c, 3a, 4d, 5, 6a/b, 7c)', 'Se estiveres cansado, passa para domingo'],
  ['2026-10-24', 'B5 · Ficha 1: 1b, 1d, 4, e Série 6 ex. 3 (b, c, d) e 6d', 'Se estiveres cansado, passa para domingo'],
  ['2026-10-25', 'B1 · Série 4 (núcleo), derivação: 1a, 1b, 2a, 3a, 3e, 4a, 4b, 5c, 6a, 10a, 10b', ''],
  ['2026-10-25', 'B2 · Série 4, L’Hôpital e aproximação linear: 7a, 7b, 8a, 8c, 8d, 9', ''],
  ['2026-10-25', 'B3 · Ficha 5 em falta: ex. 7, 8d, 9, 10c', ''],
  ['2026-10-25', 'B4 · Simulacro 2 (80 min, sem consulta, com provas diferentes do 1)', ''],
  ['2026-10-25', 'B5 · Correção do Simulacro 2 e repetir só o que errei nos dois simulacros', ''],
  ['2026-10-26', 'Tarde · Refazer sozinho 1 exercício de cada tipo (otimização, estudo de função, integral definido, área, TFC)', ''],
  ['2026-10-26', 'Noite (máx. 1 h) · Passar o formulário e a tabela trigonométrica a limpo, de memória, e confirmar com o original', 'Dormir cedo'],
  ['2026-10-27', 'Acordar com tempo, comer, sair com margem', 'Dia do teste (80 min)'],
  ['2026-10-27', 'Só reler o formulário que escrevi. Nada de matéria nova', ''],
  ['2026-10-27', 'No teste: ler tudo primeiro, fazer primeiro o que sei, deixar o mais longo para o fim', '']
];

const calcPlanTasks = (discId, plan = CALC_PLAN, prefix = 't-calc-plano-') => plan.map(([date, avail, blocks, title], i) => ({
  id: `${prefix}${i + 1}`, title, date, disciplineId: discId, done: false,
  note: `Disponível: ${avail} · ${blocks} ${blocks === 1 ? 'bloco' : 'blocos'}`
}));

const TOT_DISC = () => ({ id: 'd-tot', semester: 's1', name: 'TOT', color: '#0ea5e9', components: [] });

/* ---------- Estado + localStorage ---------- */
/* Tarefa: com dia (date), com início e fim (start+end) ou sem prazo (date vazio). */
function normalizeTask(t) {
  if (!t || typeof t.title !== 'string') return null;
  const start = isISODate(t.start) ? t.start : (isISODate(t.startDate) ? t.startDate : '');
  const end = isISODate(t.end) ? t.end : (isISODate(t.endDate) ? t.endDate : '');
  const out = {
    id: typeof t.id === 'string' && t.id ? t.id : uid(),
    title: t.title,
    disciplineId: typeof t.disciplineId === 'string' ? t.disciplineId : '',
    done: !!t.done,
    date: ''
  };
  if (isISODate(t.doneDate)) out.doneDate = t.doneDate;
  if (typeof t.note === 'string' && t.note.trim()) out.note = t.note.trim();
  if (start && end && start <= end) { out.start = start; out.end = end; }
  else out.date = isISODate(t.date) ? t.date : (end || '');
  return out;
}

function normalizeState(s) {
  const st = Object.assign({
    version: 1, updatedAt: 0, currentSemester: 's1', theme: null,
    semesters: seedState().semesters,
    disciplines: [], grades: [], events: [], tasks: [], links: []
  }, s);
  ['disciplines', 'grades', 'events', 'tasks', 'links'].forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
  if (!st.semesters || typeof st.semesters !== 'object') st.semesters = seedState().semesters;
  st.disciplines.forEach(d => { if (!Array.isArray(d.components)) d.components = []; });
  st.tasks = st.tasks.map(normalizeTask).filter(Boolean);
  // acrescenta a disciplina TOT uma única vez (se a apagares, não volta)
  if (!st.addedTot) {
    if (st.semesters.s1 && !st.disciplines.some(d => d.id === 'd-tot' || d.name.trim().toUpperCase() === 'TOT')) st.disciplines.push(TOT_DISC());
    st.addedTot = true;
  }
  if (!st.addedCalcPlan) {
    const calc = st.disciplines.find(d => d.id === 'd-calculo') || st.disciplines.find(d => /c[aá]lculo/i.test(d.name));
    const ids = new Set(st.tasks.map(t => t.id));
    calcPlanTasks(calc ? calc.id : '').forEach(t => { if (!ids.has(t.id)) st.tasks.push(t); });
    st.addedCalcPlan = true;
  }
  if (!st.calcPlanV2) {
    const calc = st.disciplines.find(d => d.id === 'd-calculo') || st.disciplines.find(d => /c[aá]lculo/i.test(d.name));
    // tira as tarefas do plano antigo a partir de 18/10 que ainda não foram feitas
    st.tasks = st.tasks.filter(t => !(/^t-calc-plano-\d+$/.test(t.id) && t.date >= '2026-10-18' && !t.done));
    const ids = new Set(st.tasks.map(t => t.id));
    calcPlanTasks(calc ? calc.id : '', CALC_PLAN_V2, 't-calc-plano2-').forEach(t => { if (!ids.has(t.id)) st.tasks.push(t); });
    st.calcPlanV2 = true;
  }
  if (!st.calcPlanV3) {
    const calc = st.disciplines.find(d => d.id === 'd-calculo') || st.disciplines.find(d => /c[aá]lculo/i.test(d.name));
    // tira as tarefas por fazer dos planos anteriores a partir de 22/10
    st.tasks = st.tasks.filter(t => !(/^t-calc-plano2?-\d+$/.test(t.id) && t.date >= '2026-10-22' && !t.done));
    const ids = new Set(st.tasks.map(t => t.id));
    calcPlanTasks(calc ? calc.id : '', CALC_PLAN_V3, 't-calc-plano3-').forEach(t => { if (!ids.has(t.id)) st.tasks.push(t); });
    st.calcPlanV3 = true;
  }
  if (!st.calcPlanV4) {
    const calc = st.disciplines.find(d => d.id === 'd-calculo') || st.disciplines.find(d => /c[aá]lculo/i.test(d.name));
    // tira todas as tarefas com dia ou intervalo (as «Sem prazo» ficam); guarda uma cópia neste aparelho
    const removed = st.tasks.filter(t => t.date || (t.start && t.end));
    try { if (removed.length) localStorage.setItem('estudo-tarefas-removidas-v4', JSON.stringify(removed)); } catch (e) {}
    st.tasks = st.tasks.filter(t => !(t.date || (t.start && t.end)));
    const count = {};
    CALC_PLAN_V4.forEach(([date, title], i) => {
      count[date] = (count[date] || 0) + 1;
      const [avail, blocks] = V4_NOTES[date];
      const total = CALC_PLAN_V4.filter(x => x[0] === date).length;
      st.tasks.push({
        id: `t-calc-plano4-${i + 1}`, title, date, disciplineId: calc ? calc.id : '', done: false,
        note: total > 1 ? `B${count[date]} de ${blocks} · ${avail}` : `${avail} · ${blocks} blocos`
      });
    });
    st.calcPlanV4 = true;
  }
  if (!st.calcPlanV5) {
    const calc = st.disciplines.find(d => d.id === 'd-calculo') || st.disciplines.find(d => /c[aá]lculo/i.test(d.name));
    // tira todas as tarefas (também as «Sem prazo»); guarda uma cópia neste aparelho
    try { if (st.tasks.length) localStorage.setItem('estudo-tarefas-removidas-v5', JSON.stringify(st.tasks)); } catch (e) {}
    st.tasks = CALC_PLAN_V5.map(([date, title, note], i) => Object.assign(
      { id: `t-calc-plano5-${i + 1}`, title, date, disciplineId: calc ? calc.id : '', done: false },
      note ? { note } : {}));
    st.calcPlanV5 = true;
  }
  if (!st.addedPagarUni) {
    if (!st.events.some(ev => ev.id === 'e-pagar-uni')) {
      st.events.push({ id: 'e-pagar-uni', title: 'Pagar universidade', date: '2026-10-21', time: '20:00', disciplineId: '', type: 'tarefa', repeat: 'monthly' });
    }
    st.addedPagarUni = true;
  }
  if (!st.semesters[st.currentSemester]) st.currentSemester = Object.keys(st.semesters)[0];
  if (!Number.isFinite(st.updatedAt)) st.updatedAt = 0;
  return st;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') return normalizeState(s);
    }
  } catch (e) { console.warn('Não foi possível ler os dados guardados.', e); }
  return normalizeState(seedState());
}

let state = loadState();

// guarda só neste aparelho (tema, semestre escolhido)
function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Não foi possível guardar (armazenamento cheio ou bloqueado).'); }
}
// guarda neste aparelho e envia para a nuvem (se tiveres entrado)
function save() {
  state.updatedAt = Date.now();
  saveLocal();
  if (window.estudoCloud) window.estudoCloud.push();
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
  saveLocal();
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
  saveLocal();
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
  $('#theme-select').value = state.theme || '';
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
    events: ev => typeof ev.title === 'string' && isDate(ev.date) && (!ev.disciplineId || discIds.has(ev.disciplineId)) &&
      EVENT_TYPES.includes(ev.type) && (!ev.time || /^\d{2}:\d{2}$/.test(ev.time)),
    tasks: t => typeof t.title === 'string',
    links: l => typeof l.name === 'string' && typeof l.url === 'string' && /^https?:\/\//i.test(l.url) &&
      discIds.has(l.disciplineId) && ['aulas', 'series', 'resumos'].includes(l.category)
  };
  for (const [k, ok] of Object.entries(rules)) {
    if (!Array.isArray(inc[k])) continue;
    const ids = new Set(state[k].map(x => x.id));
    inc[k].forEach(x => {
      if (x && typeof x === 'object' && typeof x.id === 'string' && !ids.has(x.id) && ok(x)) {
        const item = k === 'tasks' ? normalizeTask(x) : x;
        if (item) { state[k].push(item); ids.add(x.id); added++; }
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
const EVENT_TYPES = ['teste', 'ficha', 'tarefa'];
const typeLabel = t => ({ ficha: 'Ficha', tarefa: 'Tarefa' }[t] || 'Teste');

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
  const upcoming = state.events
    .filter(ev => ev.type === 'teste' && (!ev.disciplineId || discIds.has(ev.disciplineId)))
    .map(ev => ({ ev, at: eventDateTime(ev) }))
    .filter(x => x.at >= now)
    .sort((a, b) => a.at - b.at);
  const next = upcoming[0];

  // o teste a seguir: versão pequena, só com os dias que faltam
  const after = upcoming[1];
  $('#next-test').hidden = !after;
  if (after) {
    const days = daysBetween(todayISO(), after.ev.date);
    $('#next-test').style.setProperty('--c', discColor(after.ev.disciplineId));
    $('#next-test-title').textContent = [after.ev.title, discName(after.ev.disciplineId)].filter(Boolean).join(' · ');
    $('#next-test-days').textContent = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `faltam ${days} dias`;
  }

  if (next) {
    const diff = next.at - now;
    $('#countdown-title').textContent = [next.ev.title, discName(next.ev.disciplineId)].filter(Boolean).join(' · ');
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
  return state.events.filter(ev => !ev.disciplineId || ids.has(ev.disciplineId));
};
// eventos que se repetem todos os meses no mesmo dia (num mês mais curto, fica no último dia)
const isMonthly = ev => ev.repeat === 'monthly';
function occursOn(ev, iso) {
  if (!isMonthly(ev)) return ev.date === iso;
  if (iso < ev.date) return false;
  const want = Number(ev.date.slice(8, 10));
  const d = parseISO(iso);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === Math.min(want, lastDay);
}
const evDone = (ev, iso) => (isMonthly(ev) ? (ev.doneDates || []).includes(iso) : !!ev.done);
const sortEvents = (a, b) => (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title);

function goToDate(iso) {
  const d = parseISO(iso);
  calSelected = iso; calYear = d.getFullYear(); calMonth = d.getMonth();
}

const taskColor = t => (t.disciplineId ? discColor(t.disciplineId) : 'var(--muted)');

// tarefas com início e fim, por dia (as "Sem prazo" e as de um só dia não vão para o calendário)
function rangeTasksByDate() {
  const ids = new Set(semDisciplines().map(d => d.id));
  const map = {};
  state.tasks.forEach(t => {
    if (!t.start || !t.end) return;
    if (t.disciplineId && !ids.has(t.disciplineId)) return;
    let d = t.start, guard = 0;
    while (d <= t.end && visibleOn(t, d) && guard++ < 400) { (map[d] = map[d] || []).push(t); d = addDays(d, 1); }
  });
  return map;
}

function renderCalendar() {
  $('#cal-title').textContent = new Date(calYear, calMonth, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  const byDate = {};
  const tByDate = rangeTasksByDate();

  const first = new Date(calYear, calMonth, 1);
  const start = new Date(calYear, calMonth, 1 - ((first.getDay() + 6) % 7)); // semana começa à segunda
  const evs0 = semEvents();
  const visible = new Set([calSelected]);
  for (let i = 0; i < 42; i++) visible.add(toISO(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  visible.forEach(iso => { const l = evs0.filter(ev => occursOn(ev, iso)); if (l.length) byDate[iso] = l; });
  const today = todayISO();
  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(d);
    const evs = (byDate[iso] || []).sort(sortEvents);
    const tks = tByDate[iso] || [];
    const total = evs.length + tks.length;
    const taskChip = t => `<span class="cal-chip ctask${t.done ? ' done' : ''}" style="--c:${taskColor(t)}">${esc((t.done ? '☑ ' : '☐ ') + t.title)}</span>`;
    html += `
      <button type="button" class="cal-cell${d.getMonth() !== calMonth ? ' other' : ''}${iso === today ? ' today' : ''}${iso === calSelected ? ' selected' : ''}"
              data-date="${iso}" aria-label="${esc(longDate(iso))}${total ? `, ${total} item(ns)` : ''}">
        <span class="cal-num">${d.getDate()}</span>
        <span class="cal-dots">${evs.slice(0, 4).map(ev => `<span class="cal-dot ${ev.type}" style="--c:${discColor(ev.disciplineId)}"></span>`).join('')}${tks.slice(0, Math.max(0, 4 - evs.length)).map(t => `<span class="cal-dot ctask" style="--c:${taskColor(t)}"></span>`).join('')}</span>
        ${evs.slice(0, 3).map(ev => `<span class="cal-chip ${ev.type}${evDone(ev, iso) ? ' done' : ''}" style="--c:${discColor(ev.disciplineId)}">${esc(ev.time ? ev.time + ' ' : '')}${esc(ev.title)}</span>`).join('')}${tks.slice(0, Math.max(0, 3 - evs.length)).map(taskChip).join('')}
        ${total > 3 ? `<span class="cal-chip-more">+${total - 3}</span>` : ''}
      </button>`;
  }
  $('#cal-grid').innerHTML = html;

  $('#cal-legend').innerHTML = semDisciplines()
    .map(d => `<span><i class="dot" style="--c:${isHex(d.color) ? d.color : DEFAULT_COLOR}"></i>${esc(d.name)}</span>`).join('');

  // eventos e tarefas do dia selecionado
  $('#cal-selected-title').textContent = `Eventos · ${longDate(calSelected)}`;
  const dayEvs = (byDate[calSelected] || []).sort(sortEvents);
  const dayTasks = tByDate[calSelected] || [];
  $('#cal-day-events').innerHTML = (dayEvs.length || dayTasks.length)
    ? dayEvs.map(ev => `
    <li class="event-item${evDone(ev, calSelected) ? ' is-done' : ''}" style="--c:${discColor(ev.disciplineId)}">
      <input type="checkbox" data-action="toggle-event" data-id="${esc(ev.id)}"${evDone(ev, calSelected) ? ' checked' : ''} aria-label="Concluído: ${esc(ev.title)}">
      <div class="grow">
        <div class="title">${esc(ev.title)}</div>
        <div class="muted">${[ev.time, discName(ev.disciplineId), isMonthly(ev) ? '↻ todos os meses' : ''].filter(Boolean).map(esc).join(' · ')}</div>
      </div>
      <span class="type-badge">${typeLabel(ev.type)}</span>
      <button type="button" class="icon-btn" data-action="edit-event" data-id="${esc(ev.id)}" aria-label="Editar ${esc(ev.title)}">✎</button>
      <button type="button" class="icon-btn danger" data-action="del-event" data-id="${esc(ev.id)}" aria-label="Apagar ${esc(ev.title)}">✕</button>
    </li>`).join('') + dayTasks.map(t => `
    <li class="event-item${t.done ? ' is-done' : ''}" style="--c:${taskColor(t)}">
      <input type="checkbox" data-action="toggle-task" data-id="${esc(t.id)}"${t.done ? ' checked' : ''} aria-label="Concluída: ${esc(t.title)}">
      <div class="grow">
        <div class="title">${esc(t.title)}</div>
        <div class="muted">${fmtDate(t.start)} → ${fmtDate(t.end)}${t.disciplineId && findDisc(t.disciplineId) ? ' · ' + esc(discName(t.disciplineId)) : ''}</div>
      </div>
      <span class="type-badge">Tarefa</span>
      <button type="button" class="icon-btn" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.title)}">✎</button>
      <button type="button" class="icon-btn danger" data-action="del-task" data-id="${esc(t.id)}" aria-label="Apagar ${esc(t.title)}">✕</button>
    </li>`).join('')
    : '<li class="muted">Sem eventos neste dia.</li>';
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
  fillDisciplineSelect(eventForm.elements['discipline'], { empty: true });
  eventForm.reset();
  $('#event-dialog-title').textContent = ev ? 'Editar evento' : 'Novo evento';
  $('#event-delete').hidden = !ev;
  eventForm.elements['eventId'].value = ev ? ev.id : '';
  eventForm.elements['title'].value = ev ? ev.title : '';
  eventForm.elements['date'].value = ev ? ev.date : calSelected;
  eventForm.elements['time'].value = ev ? (ev.time || '') : '';
  eventForm.elements['type'].value = ev ? ev.type : 'teste';
  eventForm.elements['discipline'].value = ev && findDisc(ev.disciplineId) ? ev.disciplineId : '';
  eventForm.elements['repeat'].checked = !!(ev && isMonthly(ev));
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
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Preenche o título e a data.'); return; }
  const rec = { title, date, time: String(fd.get('time') || ''), disciplineId: findDisc(discId) ? discId : '', type: EVENT_TYPES.includes(fd.get('type')) ? String(fd.get('type')) : 'teste' };
  const id = String(fd.get('eventId') || '');
  const existing = id ? state.events.find(x => x.id === id) : null;
  if (fd.get('repeat')) rec.repeat = 'monthly';
  if (existing) {
    if (!rec.repeat) { delete existing.repeat; delete existing.doneDates; }
    Object.assign(existing, rec);
  } else state.events.push({ id: uid(), ...rec });
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

$('#cal-day-events').addEventListener('change', e => {
  const cb = e.target;
  if (cb.dataset.action === 'toggle-event') {
    const ev = state.events.find(x => x.id === cb.dataset.id);
    if (!ev) return;
    if (isMonthly(ev)) {
      // concluído só neste mês
      const set = new Set(ev.doneDates || []);
      if (cb.checked) set.add(calSelected); else set.delete(calSelected);
      ev.doneDates = [...set].sort();
    } else if (cb.checked) ev.done = true; else delete ev.done;
  } else if (cb.dataset.action === 'toggle-task') {
    const t = state.tasks.find(x => x.id === cb.dataset.id);
    if (!t) return;
    setTaskDone(t, cb.checked);
  } else return;
  save();
  renderAll();
});

$('#cal-day-events').addEventListener('click', e => {
  const edit = e.target.closest('[data-action="edit-event"]');
  const del = e.target.closest('[data-action="del-event"]');
  const editT = e.target.closest('[data-action="edit-task"]');
  const delT = e.target.closest('[data-action="del-task"]');
  if (editT) { openTaskDialog(state.tasks.find(t => t.id === editT.dataset.id)); return; }
  if (delT) {
    if (!confirm('Apagar esta tarefa?')) return;
    state.tasks = state.tasks.filter(t => t.id !== delT.dataset.id);
    save(); renderAll(); return;
  }
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
   - Tarefa com dia: aparece nesse dia; se ficar por fazer, passa
     para "Hoje" com aviso a vermelho.
   - Tarefa com início e fim: aparece em todos os dias do intervalo
     (e também no calendário).
   - Tarefa "Sem prazo": lista à parte, nunca fica atrasada.
   ========================================================== */
let dayOffset = 0;
const viewDay = () => addDays(todayISO(), dayOffset);
const isRange = t => !!(t.start && t.end);
const isBacklog = t => !isRange(t) && !t.date;
const dueDate = t => (isRange(t) ? t.end : t.date);
const isLate = t => !t.done && !!dueDate(t) && dueDate(t) < todayISO();
// tarefa concluída só aparece até ao dia em que foi concluída (nos dias seguintes desaparece)
const visibleOn = (t, day) => !t.done || day <= (t.doneDate || dueDate(t) || day);
const lateTasks = () => state.tasks.filter(isLate).sort((a, b) => dueDate(a).localeCompare(dueDate(b)));
const coversDay = (t, day) => (isRange(t) ? t.start <= day && day <= t.end : t.date === day);

function tasksForView() {
  const day = viewDay(), today = todayISO();
  let list = state.tasks.filter(t => !isBacklog(t) && coversDay(t, day) && visibleOn(t, day));
  if (dayOffset === 0) {
    // atrasadas por fazer + as concluídas hoje (para não desaparecerem ao marcar)
    list = list.concat(state.tasks.filter(t =>
      !isBacklog(t) && !coversDay(t, day) && dueDate(t) < today && (!t.done || t.doneDate === today)));
  }
  const rank = t => (isLate(t) ? 0 : t.done ? 2 : 1);
  return list.sort((a, b) => rank(a) - rank(b) || dueDate(a).localeCompare(dueDate(b)));
}

function taskItem(t) {
  const late = isLate(t);
  const n = late ? daysBetween(dueDate(t), todayISO()) : 0;
  const bits = [];
  if (t.disciplineId && findDisc(t.disciplineId)) bits.push(esc(discName(t.disciplineId)));
  if (isRange(t)) bits.push(`${fmtDate(t.start)} → ${fmtDate(t.end)}`);
  if (t.note) bits.push(esc(t.note));
  if (late) bits.push(`<span class="badge-late">Atrasada há ${n} ${n === 1 ? 'dia' : 'dias'}</span>`);
  return `
    <li class="task${t.done ? ' done' : ''}" style="--c:${t.disciplineId ? discColor(t.disciplineId) : 'var(--border)'}">
      <input type="checkbox" data-id="${esc(t.id)}"${t.done ? ' checked' : ''} aria-label="Concluir: ${esc(t.title)}">
      <div class="grow">
        <span class="title">${esc(t.title)}</span>
        ${bits.length ? `<small>${bits.join(' · ')}</small>` : ''}
      </div>
      <button type="button" class="icon-btn" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.title)}">✎</button>
      <button type="button" class="icon-btn danger" data-action="del-task" data-id="${esc(t.id)}" aria-label="Apagar ${esc(t.title)}">✕</button>
    </li>`;
}

function setTaskDone(t, done) {
  t.done = done;
  if (done) t.doneDate = todayISO(); else delete t.doneDate;
}

function renderChecklist() {
  const labels = { '-1': 'Ontem', '0': 'Hoje', '1': 'Amanhã' };
  $$('#day-nav .btn').forEach(b => b.classList.toggle('active', Number(b.dataset.offset) === dayOffset));
  $('#checklist-date').textContent = `${labels[dayOffset]} · ${longDate(viewDay())}`;
  fillDisciplineSelect($('#task-form [name="discipline"]'), { empty: true });

  const list = tasksForView();
  $('#task-list').innerHTML = list.length ? list.map(taskItem).join('') : '<li class="muted">Sem tarefas para este dia.</li>';

  const bl = state.tasks.filter(t => isBacklog(t) && visibleOn(t, viewDay())).sort((a, b) => Number(a.done) - Number(b.done));
  const open = bl.filter(t => !t.done).length;
  $('#backlog').innerHTML = bl.length ? `
    <h3 class="backlog-title">Sem prazo · ${open} por fazer</h3>
    <p class="muted">Para fazer quando quiseres — não ficam atrasadas.</p>
    <ul class="list">${bl.map(taskItem).join('')}</ul>` : '';
}

$('#day-nav').addEventListener('click', e => {
  const b = e.target.closest('[data-offset]');
  if (!b) return;
  dayOffset = Number(b.dataset.offset);
  renderChecklist();
});

const taskForm = $('#task-form');
taskForm.elements['mode'].addEventListener('change', e => {
  const range = e.target.value === 'range';
  $('#task-range').hidden = !range;
  if (range) {
    if (!taskForm.elements['start'].value) taskForm.elements['start'].value = viewDay();
    if (!taskForm.elements['end'].value) taskForm.elements['end'].value = viewDay();
  }
});

taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(taskForm);
  const title = String(fd.get('title')).trim();
  if (!title) return;
  const discId = String(fd.get('discipline') || '');
  const task = { id: uid(), title, disciplineId: findDisc(discId) ? discId : '', done: false, date: '' };
  const mode = String(fd.get('mode') || 'day');
  if (mode === 'day') task.date = viewDay();
  else if (mode === 'range') {
    const start = String(fd.get('start')), end = String(fd.get('end'));
    if (!isISODate(start) || !isISODate(end) || start > end) { toast('Escolhe um início e um fim (o fim não pode ser antes do início).'); return; }
    task.start = start; task.end = end;
  }
  state.tasks.push(task);
  save();
  const input = taskForm.elements['title'];
  input.value = '';
  input.focus();
  renderChecklist();
  if (mode === 'range') renderCalendar();
});

['#task-list', '#backlog'].forEach(sel => {
  $(sel).addEventListener('change', e => {
    if (e.target.type !== 'checkbox') return;
    const t = state.tasks.find(x => x.id === e.target.dataset.id);
    if (!t) return;
    setTaskDone(t, e.target.checked);
    save();
    renderChecklist();
    renderCalendar();
  });
  $(sel).addEventListener('click', e => {
    const ed = e.target.closest('[data-action="edit-task"]');
    if (ed) { openTaskDialog(state.tasks.find(t => t.id === ed.dataset.id)); return; }
    const b = e.target.closest('[data-action="del-task"]');
    if (!b) return;
    if (!confirm('Apagar esta tarefa?')) return;
    state.tasks = state.tasks.filter(t => t.id !== b.dataset.id);
    save();
    renderChecklist();
    renderCalendar();
  });
});

/* ==========================================================
   TAREFAS DIÁRIAS (Ontem · Hoje · Amanhã lado a lado + próximos dias)
   ========================================================== */
const DAILY_COLS = [[-1, 'Ontem'], [0, 'Hoje'], [1, 'Amanhã']];

function dailyTasksFor(day) {
  const rank = t => (t.done ? 1 : 0);
  return state.tasks.filter(t => !isBacklog(t) && coversDay(t, day) && visibleOn(t, day))
    .sort((a, b) => rank(a) - rank(b)); // mantém a ordem em que foram criadas (B1, B2, …)
}

let dailyView = 'days';

function lateItem(t) {
  const n = daysBetween(dueDate(t), todayISO());
  const sev = n >= 7 ? 'sev3' : n >= 3 ? 'sev2' : 'sev1';
  const bits = [];
  if (t.disciplineId && findDisc(t.disciplineId)) bits.push(esc(discName(t.disciplineId)));
  bits.push(isRange(t) ? `${fmtDate(t.start)} → ${fmtDate(t.end)}` : `era para ${esc(longDate(t.date))}`);
  if (t.note) bits.push(esc(t.note));
  return `
    <li class="task late-item" style="--c:${t.disciplineId ? discColor(t.disciplineId) : 'var(--border)'}">
      <input type="checkbox" data-id="${esc(t.id)}" aria-label="Concluir: ${esc(t.title)}">
      <div class="grow">
        <span class="title">${esc(t.title)}</span>
        <small>${bits.join(' · ')}</small>
      </div>
      <span class="late-age ${sev}">há ${n} ${n === 1 ? 'dia' : 'dias'}</span>
      <button type="button" class="btn btn-sm" data-action="to-today" data-id="${esc(t.id)}" title="Passar para hoje">→ Hoje</button>
      <button type="button" class="icon-btn" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Editar ${esc(t.title)}">✎</button>
      <button type="button" class="icon-btn danger" data-action="del-task" data-id="${esc(t.id)}" aria-label="Apagar ${esc(t.title)}">✕</button>
    </li>`;
}

function renderLateBadges() {
  const n = lateTasks().length;
  $$('.late-count').forEach(el => { el.textContent = n; el.hidden = !n; });
  const banner = $('#late-banner');
  if (banner) {
    banner.hidden = !n;
    $('#late-banner-text').textContent = `${n} ${n === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}`;
  }
}

function renderDaily() {
  const today = todayISO();
  renderLateBadges();
  $$('#daily-switch .seg').forEach(b => b.classList.toggle('active', b.dataset.view === dailyView));
  $('#daily-days').hidden = dailyView !== 'days';
  $('#daily-late').hidden = dailyView !== 'late';
  const late = lateTasks();
  $('#late-list').innerHTML = late.length ? late.map(lateItem).join('')
    : '<li class="empty-state">🎉 Nada atrasado. Está tudo em dia!</li>';
  $('#late-all-today').hidden = late.length < 2;
  $('#daily-cols').innerHTML = DAILY_COLS.map(([off, label]) => {
    const day = addDays(today, off);
    const list = dailyTasksFor(day);
    const done = list.filter(t => t.done).length;
    // ontem: avisa o que ficou por fazer
    const late = off === -1 ? list.filter(t => !t.done).length : 0;
    return `
      <section class="card daily-col${off === 0 ? ' is-today' : ''}">
        <div class="between">
          <h2>${label}</h2>
          <span class="muted small">${list.length ? `${done}/${list.length}` : ''}</span>
        </div>
        <p class="muted small daily-date">${esc(longDate(day))}${late ? ` · <span class="badge-late">${late} por fazer</span>` : ''}</p>
        ${list.length ? `<div class="mini-progress"><span style="width:${Math.round(done / list.length * 100)}%"></span></div>` : ''}
        <ul class="list">${list.length ? list.map(taskItem).join('') : '<li class="muted">Sem tarefas.</li>'}</ul>
        <form class="daily-add" data-day="${day}">
          <input name="title" placeholder="+ Tarefa para ${label.toLowerCase()}" required maxlength="120" aria-label="Nova tarefa para ${label}">
        </form>
      </section>`;
  }).join('');

  // próximos dias (depois de amanhã, 2 semanas)
  const rows = [];
  for (let i = 2; i <= 15; i++) {
    const day = addDays(today, i);
    const list = state.tasks.filter(t => !isBacklog(t) && !isRange(t) && t.date === day && visibleOn(t, day));
    if (list.length) rows.push(`
      <li class="upcoming-day">
        <div class="upcoming-date"><strong>${esc(parseISO(day).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' }))}</strong></div>
        <ul class="list">${list.map(taskItem).join('')}</ul>
      </li>`);
  }
  $('#daily-upcoming').innerHTML = rows.join('') || '<li class="muted">Nada marcado para os próximos dias.</li>';
}

$('#tab-daily').addEventListener('submit', e => {
  const f = e.target.closest('.daily-add');
  if (!f) return;
  e.preventDefault();
  const title = String(new FormData(f).get('title')).trim();
  if (!title) return;
  state.tasks.push({ id: uid(), title, date: f.dataset.day, disciplineId: '', done: false });
  save();
  renderAll();
  const again = $(`#tab-daily .daily-add[data-day="${f.dataset.day}"] input`);
  if (again) again.focus();
});
$('#tab-daily').addEventListener('change', e => {
  if (e.target.type !== 'checkbox') return;
  const t = state.tasks.find(x => x.id === e.target.dataset.id);
  if (!t) return;
  setTaskDone(t, e.target.checked);
  save();
  renderAll();
});
$('#daily-switch').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  dailyView = b.dataset.view;
  renderDaily();
});

// passa uma tarefa atrasada para hoje (dia único → hoje; intervalo → o fim passa a ser hoje)
function moveToToday(t) {
  const today = todayISO();
  if (isRange(t)) t.end = today; else t.date = today;
}
$('#late-all-today').addEventListener('click', () => {
  const late = lateTasks();
  if (!late.length || !confirm(`Passar ${late.length} tarefas atrasadas para hoje?`)) return;
  late.forEach(moveToToday);
  save(); renderAll();
});

$('#tab-daily').addEventListener('click', e => {
  const mv = e.target.closest('[data-action="to-today"]');
  if (mv) {
    const t = state.tasks.find(x => x.id === mv.dataset.id);
    if (t) { moveToToday(t); save(); renderAll(); toast('Passou para hoje.'); }
    return;
  }
  const ed = e.target.closest('[data-action="edit-task"]');
  if (ed) { openTaskDialog(state.tasks.find(t => t.id === ed.dataset.id)); return; }
  const b = e.target.closest('[data-action="del-task"]');
  if (!b || !confirm('Apagar esta tarefa?')) return;
  state.tasks = state.tasks.filter(t => t.id !== b.dataset.id);
  save();
  renderAll();
});

/* --- diálogo de tarefa (editar / concluir / apagar) --- */
const taskDialog = $('#task-dialog');
const taskEditForm = $('#task-edit-form');

function openTaskDialog(t) {
  if (!t) return;
  const f = taskEditForm.elements;
  fillDisciplineSelect(f['discipline'], { empty: true });
  f['taskId'].value = t.id;
  f['title'].value = t.title;
  f['discipline'].value = t.disciplineId && findDisc(t.disciplineId) ? t.disciplineId : '';
  f['start'].value = isRange(t) ? t.start : (t.date || '');
  f['end'].value = isRange(t) ? t.end : '';
  f['done'].checked = !!t.done;
  f['note'].value = t.note || '';
  openDialog(taskDialog);
}

$('#task-cancel').addEventListener('click', () => taskDialog.close());
taskDialog.addEventListener('click', e => { if (e.target === taskDialog) taskDialog.close(); });

taskEditForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(taskEditForm);
  const t = state.tasks.find(x => x.id === fd.get('taskId'));
  if (!t) return;
  const title = String(fd.get('title')).trim();
  const start = String(fd.get('start') || ''), end = String(fd.get('end') || '');
  if (!title) { toast('A tarefa precisa de um título.'); return; }
  if (end && !start) { toast('Para ter fim, a tarefa precisa de início.'); return; }
  if (start && end && end < start) { toast('O fim não pode ser antes do início.'); return; }
  const discId = String(fd.get('discipline') || '');
  t.title = title;
  const note = String(fd.get('note') || '').trim();
  if (note) t.note = note; else delete t.note;
  t.disciplineId = findDisc(discId) ? discId : '';
  delete t.start; delete t.end; t.date = '';
  if (start && end) { t.start = start; t.end = end; } else t.date = start;
  if (!!fd.get('done') !== !!t.done) setTaskDone(t, !!fd.get('done'));
  save();
  taskDialog.close();
  renderAll();
});

$('#task-delete').addEventListener('click', () => {
  const id = taskEditForm.elements['taskId'].value;
  if (!id || !confirm('Apagar esta tarefa?')) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  taskDialog.close();
  renderAll();
});

/* ==========================================================
   REPOSITÓRIO DE FICHEIROS (só links: Drive, Dropbox, …)
   Cada disciplina é uma secção que se recolhe/expande; a escolha
   fica lembrada neste aparelho.
   ========================================================== */
const CATS = [['aulas', 'Aulas'], ['series', 'Séries'], ['resumos', 'Resumos']];
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

const UI_KEY = 'estudo-ui-v1';
let ui = {};
try { ui = JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch (e) { ui = {}; }
if (!ui.collapsed || typeof ui.collapsed !== 'object') ui.collapsed = {};
const saveUI = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) {} };

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
    const n = links.length;
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
      <details class="card file-group" data-disc="${esc(d.id)}"${ui.collapsed[d.id] ? '' : ' open'} style="--c:${isHex(d.color) ? d.color : DEFAULT_COLOR}">
        <summary>
          <span class="dot"></span>
          <h2>${esc(d.name)}</h2>
          <span class="muted file-count">${n} ${n === 1 ? 'ficheiro' : 'ficheiros'}</span>
          <span class="chevron" aria-hidden="true">▾</span>
        </summary>
        <div class="file-body">${groups || '<p class="muted">Ainda sem links.</p>'}</div>
      </details>`;
  }).join('');
}

// o evento "toggle" não sobe na árvore: apanha-se na fase de captura
$('#files-list').addEventListener('toggle', e => {
  const det = e.target && e.target.closest ? e.target.closest('details.file-group') : null;
  if (!det) return;
  if (det.open) delete ui.collapsed[det.dataset.disc]; else ui.collapsed[det.dataset.disc] = true;
  saveUI();
}, true);

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
  renderDaily();
  renderFiles();
  renderGrades();
}

// ---- ligação ao sync.js (nuvem) ----
function applyRemoteState(remote) {
  // guarda uma cópia dos dados deste aparelho antes de os substituir
  try { localStorage.setItem(STORAGE_KEY + '-backup', JSON.stringify(state)); } catch (e) {}
  state = normalizeState(Object.assign({}, remote, { theme: state.theme, currentSemester: state.currentSemester }));
  saveLocal();
  renderAll();
}
window.estudoApp = {
  getState: () => state,
  applyRemote: applyRemoteState,
  touch() { state.updatedAt = Date.now(); saveLocal(); return state.updatedAt; },
  toast
};
$('#auth-btn').addEventListener('click', () => {
  if (window.estudoCloud) window.estudoCloud.toggle();
  else toast('A sincronização não carregou. Verifica a ligação à internet e recarrega a página.');
});

// atualiza a contagem decrescente e as datas quando voltas à app
setInterval(renderDashboard, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });

applyTheme();
renderAll();
showTab('dashboard');

$('#late-banner').addEventListener('click', () => {
  dailyView = 'late';
  showTab('daily');
  renderDaily();
});

$('#theme-select').addEventListener('change', e => {
  state.theme = e.target.value === 'light' || e.target.value === 'dark' ? e.target.value : null;
  saveLocal();
  applyTheme();
});
$('#cleanup-btn').addEventListener('click', () => {
  const limit = addDays(todayISO(), -30);
  const old = state.tasks.filter(t => t.done && (t.doneDate || dueDate(t) || '') && (t.doneDate || dueDate(t)) < limit);
  if (!old.length) { toast('Não há tarefas concluídas há mais de 30 dias.'); return; }
  if (!confirm(`Apagar ${old.length} tarefa(s) concluída(s) há mais de 30 dias?`)) return;
  const ids = new Set(old.map(t => t.id));
  state.tasks = state.tasks.filter(t => !ids.has(t.id));
  save(); renderAll();
  toast(`${old.length} tarefa(s) apagada(s).`);
});
