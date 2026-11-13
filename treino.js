/* ==========================================================
   Separador «Treino» — alimentação + treino de cada dia.
   Conteúdo estático (plano de 4 semanas a partir de 16/11/2026).
   Não mexe nos dados do Estudo nem na sincronização.
   ========================================================== */
(function () {
  'use strict';

  const START = '2026-11-16'; // segunda-feira da semana 1
  const root = document.getElementById('tab-treino');
  if (!root) return;

  const $ = (sel, r = root) => r.querySelector(sel);
  const $$ = (sel, r = root) => [...r.querySelectorAll(sel)];
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* ---------- Dados ---------- */
  const TARGETS = [
    ['', 'Dia de treino (seg–sex)', 'Dia de descanso (sáb–dom)'],
    ['Calorias', '≈ 2.430 kcal', '≈ 2.235 kcal'],
    ['Proteína', '159 g', '152 g'],
    ['Hidratos', '322 g', '288 g'],
    ['Gorduras', '53 g', '50 g']
  ];

  const PRODUCTS = [
    ['Proteína de soja isolada', '60 g', '60 g', '30 g ao pequeno-almoço + 30 g no pré-treino'],
    ['Farinha de aveia instantânea', '100 g', '50 g', '50 g no pequeno-almoço; 50 g no pré-treino (só dias de treino)'],
    ['Creatina monohidratada', '5 g', '5 g', 'No batido da manhã, todos os dias, sem fase de carga'],
    ['Whey', '0 g', '0 g', 'Não tens; a soja faz esse papel']
  ];

  const MEALS_TRAIN = [
    ['08:00', 'Batido: aveia 50 g + soja 30 g + 1 banana + kefir 150 g + creatina 5 g', 38, 67, 9, 495],
    ['12:00', 'Arroz 150 g (cru) + frango 200 g (cru) + legumes 200 g + azeite 15 g', 60, 127, 19, 940],
    ['Pré-treino', 'Aveia 50 g + soja 30 g + água (shake) + 1 maçã', 33, 55, 4, 385],
    ['Jantar', 'Arroz 80 g (cru) + 3 ovos + legumes 200 g + azeite 5 g', 28, 73, 21, 610]
  ];
  const MEALS_REST = [
    MEALS_TRAIN[0],
    MEALS_TRAIN[1],
    ['Tarde', 'Soja 30 g + água (shake) + 1 maçã', 26, 21, 1, 190],
    MEALS_TRAIN[3]
  ];

  const WEEK = [
    {
      key: 'seg', short: 'Seg', name: 'Segunda', title: 'Superior A + bíceps pesado',
      train: '16:00', pre: '15:15', dinner: '18:00',
      focus: 'Peito (plano + inclinado), ombros, tríceps e bíceps com carga alta.',
      rows: [
        ['Supino plano com barra', '4 × 8–12', '2 min', '3-1-1-0'],
        ['Supino inclinado (~30°) com barra', '3 × 8–12', '2 min', '3-1-1-0'],
        ['Press militar em pé', '3 × 8–12', '2 min', '2-0-1-0'],
        ['Press francês deitado (alt.: flexões diamante)', '3 × 10–15', '90 s', '3-0-1-0'],
        ['Curl com barra', '4 × 6–10', '2 min', '2-0-1-1']
      ],
      notes: ['Supino: travões na altura certa, fechos nos discos, pelo menos 2 reps em reserva. Nunca à falha.']
    },
    {
      key: 'ter', short: 'Ter', name: 'Terça', title: 'Inferior A (quadríceps)',
      train: '18:15', pre: '17:15', dinner: '19:45',
      focus: 'Pernas com foco em quadríceps. Jantar mais tarde, depois do treino.',
      rows: [
        ['Agachamento frontal', '4 × 10–15', '2 min', '3-1-1-0'],
        ['Afundo búlgaro (pé de trás no banco)', '3 × 8–12 /perna', '90 s', '3-0-1-0'],
        ['Stiff com barra', '3 × 10–15', '2 min', '3-1-1-0'],
        ['Gémeos em pé com barra', '4 × 12–20', '60 s', '2-1-1-1'],
        ['Prancha', '3 × 30–60 s', '60 s', '—']
      ],
      notes: [
        'Agachamento frontal: puxa a barra do chão até às clavículas (clean), cotovelos à frente. Na semana 1 aprende o movimento com 10 kg.',
        'Se perderes o equilíbrio, larga a barra para a frente. Deixa espaço livre.'
      ]
    },
    {
      key: 'qua', short: 'Qua', name: 'Quarta', title: 'Costas/ombros + bíceps volume',
      train: '16:15', pre: '15:15', dinner: '18:00',
      focus: 'Costas, deltoides e bíceps com muitas séries.',
      rows: [
        ['Remada curvada com barra', '4 × 8–12', '2 min', '2-1-1-0'],
        ['Pullover com barra deitado', '3 × 10–15', '90 s', '3-1-1-0'],
        ['Elevações laterais (3 kg)', '3 × 15–25', '60 s', '2-0-1-1'],
        ['Pássaros inclinado (3 kg)', '3 × 15–25', '60 s', '2-0-1-1'],
        ['Curl inclinado (3 kg), banco a 45–60°', '3 × 12–20', '60 s', '3-1-1-0'],
        ['Curl com barra, pegada estreita', '2 × 12–15', '90 s', '3-0-1-1']
      ],
      notes: ['Remada: se a barra pendurar sem tocar no chão, podes fazê-la de peito apoiado no banco inclinado (alivia a lombar).']
    },
    {
      key: 'qui', short: 'Qui', name: 'Quinta', title: 'Inferior B + core',
      train: '14:30', pre: '14:00', dinner: '18:00',
      focus: 'Posterior da coxa, glúteos, gémeos e abdominais.',
      rows: [
        ['Hip thrust com barra (costas no banco)', '4 × 10–15', '2 min', '1-0-1-2'],
        ['Afundo estático com barra', '3 × 10 /perna', '90 s', '2-0-1-0'],
        ['Stiff unilateral (barra ou 3 kg)', '3 × 10–12 /perna', '90 s', '3-1-1-0'],
        ['Gémeos unilateral', '3 × 12–20 /perna', '60 s', '2-1-1-1'],
        ['Elevação de pernas deitado', '3 × 12–20', '60 s', '2-0-2-0']
      ],
      notes: ['Almoço às 12h, shake às 14h e treino às 14h30.']
    },
    {
      key: 'sex', short: 'Sex', name: 'Sexta', title: 'Superior C + bíceps',
      train: '16:00', pre: '15:15', dinner: '18:00',
      focus: 'Superior misto, com tempo sob tensão e bíceps no fim.',
      rows: [
        ['Supino com pausa no peito', '3 × 10–15', '2 min', '2-2-1-0'],
        ['Remada curvada, pegada supinada', '3 × 8–12', '2 min', '2-1-1-0'],
        ['Press militar em pé', '3 × 10–15', '90 s', '3-0-1-0'],
        ['Tríceps por cima da cabeça com barra', '3 × 10–15', '90 s', '3-1-1-0'],
        ['Curl martelo (3 kg), pausa de 2 s em cima', '3 × 12–20 /braço', '60 s', '2-2-1-0'],
        ['Curl com barra em drop set (carga alta → baixa)', '2 séries', '90 s', '2-0-1-0']
      ],
      notes: ['Supino com pausa: aguenta 2 s no peito sem descontrair, com travões montados.']
    }
  ];

  const PROGRESSION = [
    ['1', 'RIR 3', 'Descobre as cargas (10 / 20 / 30 / 40 kg) e a técnica. Começa no fundo do intervalo de reps. Regista tudo.'],
    ['2', 'RIR 2', 'Mesma carga, +1–2 reps por série face à semana 1.'],
    ['3', 'RIR 1–2', '+1 s no excêntrico (3 s passa a 4 s). +1 série de curl na segunda e na sexta (bíceps 14 → 16 séries). Nos compostos em que bateste o topo do intervalo, sobe 10 kg.'],
    ['4', 'RIR 1 isoladores · RIR 2 compostos', 'Mesmas séries da semana 3. Última série de curl, elevação lateral e gémeos em drop set ou rest-pause. No fim, teste de reps máximas (RIR 1–2) no supino e na remada.']
  ];

  /* ---------- Utilitários ---------- */
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
  const todayKey = () => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][new Date().getDay()];

  function weekInfo() {
    const diff = daysBetween(START, toISO(new Date()));
    if (diff < 0) return { state: 'before', days: -diff };
    const w = Math.floor(diff / 7) + 1;
    if (w > 4) return { state: 'after' };
    return { state: 'on', week: w };
  }

  const table = (head, rows, cls = '') =>
    `<div class="tr-scroll"><table class="tr-table ${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  /* ---------- Estrutura ---------- */
  root.innerHTML = `
    <div class="segmented" id="treino-switch" role="tablist">
      <button type="button" class="seg active" data-view="train" role="tab">Treino</button>
      <button type="button" class="seg" data-view="food" role="tab">Alimentação</button>
    </div>
    <div id="treino-banner"></div>
    <div id="treino-train"></div>
    <div id="treino-food" hidden></div>
  `;

  /* ---------- Banner da semana ---------- */
  function renderBanner() {
    const info = weekInfo();
    let eyebrow, text;
    if (info.state === 'before') {
      eyebrow = 'Plano de 4 semanas';
      text = `Começa segunda, 16/11 (faltam ${info.days} ${info.days === 1 ? 'dia' : 'dias'}).`;
    } else if (info.state === 'after') {
      eyebrow = 'Bloco concluído';
      text = 'As 4 semanas acabaram. Envia o check-in para montar o bloco seguinte.';
    } else {
      const p = PROGRESSION[info.week - 1];
      eyebrow = `Semana ${info.week} de 4 · ${p[1]}`;
      text = p[2];
    }
    $('#treino-banner').innerHTML = `<div class="card tr-banner"><p class="eyebrow-sm">${eyebrow}</p><p>${text}</p></div>`;
  }

  /* ---------- Treino ---------- */
  let selected = (() => { const k = todayKey(); return WEEK.some(d => d.key === k) ? k : 'seg'; })();

  function renderTrain() {
    const box = $('#treino-train');
    const day = WEEK.find(d => d.key === selected);
    const today = todayKey();
    const chips = WEEK.map(d =>
      `<button type="button" class="seg${d.key === selected ? ' active' : ''}" data-day="${d.key}">${d.short}${d.key === today ? ' •' : ''}</button>`
    ).join('');

    const weekend = (today === 'sab' || today === 'dom')
      ? `<p class="muted small tr-weekend">Hoje é descanso total. Passos: 8.000 e dieta de dia de descanso (separador Alimentação).</p>` : '';

    box.innerHTML = `
      <div class="segmented" id="treino-days">${chips}</div>
      ${weekend}
      <div class="card">
        <div class="between">
          <div>
            <h2>${day.name} · ${day.title}</h2>
            <p class="muted">${day.focus}</p>
          </div>
        </div>
        <div class="tr-times">
          <span><strong>${day.pre}</strong> pré-treino</span>
          <span><strong>${day.train}</strong> treino</span>
          <span><strong>${day.dinner}</strong> jantar</span>
        </div>
        ${table(['Exercício', 'Séries × reps', 'Descanso', 'Ritmo'], day.rows, 'tr-ex')}
        ${day.notes.map(n => `<p class="muted small tr-note">${n}</p>`).join('')}
        <p class="muted small tr-note">Aquecimento: 1–2 séries leves no primeiro exercício (barra de 10 kg × 10–12).</p>
      </div>

      <details class="card tr-details">
        <summary>Como ler esta tabela</summary>
        <p class="muted small"><strong>Ritmo</strong> = descida – pausa em baixo – subida – pausa em cima, em segundos. 3-1-1-0 = 3 s a descer, 1 s de pausa, 1 s a subir, 0 s em cima.</p>
        <p class="muted small"><strong>RIR</strong> = repetições que ainda te sobravam antes da falha.</p>
        <p class="muted small"><strong>Cargas na barra:</strong> só 10, 20, 30 e 40 kg (barra + discos de 5 e 10 kg). Só sobes 10 kg em supino, agachamento, stiff, hip thrust e remada, e só se as reps não caírem abaixo de 6. Curls, ombros e tríceps progridem com reps, ritmo e pausas.</p>
      </details>

      <div class="card">
        <h2>Progressão das 4 semanas</h2>
        ${table(['Sem.', 'Esforço', 'O que muda'], PROGRESSION, 'tr-prog')}
        <p class="muted small tr-note"><strong>Deload:</strong> não planeado. Se as reps caírem em 2 sessões seguidas, dormires mal ou sentires dor, faz a semana seguinte com −40 % de séries.</p>
      </div>

      <div class="card">
        <h2>Bíceps na semana</h2>
        <p class="muted">14 séries diretas (16 a partir da semana 3): segunda 4, quarta 5, sexta 5. Com cargas leves, ~5 séries em 3 sessões dão mais estímulo do que uma sessão enorme, e seg/qua/sex dão 48 h de recuperação.</p>
      </div>

      <div class="card">
        <h2>Barriga e passos</h2>
        <p class="muted">Faz <strong>8.000 passos/dia</strong>, todos os dias. Sem cardio dedicado nas semanas 1–2. Se o peso e a cintura não se moverem na direção certa em 2 semanas, junta 2 × 20 min de passadeira a 8–10 % de inclinação e 5 km/h, às quartas e sextas, depois do treino.</p>
      </div>

      <div class="card">
        <h2>Medições e check-in</h2>
        ${table(['O quê', 'Quando', 'Como'], [
          ['Peso', 'Todos os dias', 'De manhã, depois da casa de banho, em jejum, mesma balança. Usa a média semanal.'],
          ['Cintura', 'Segunda de manhã', 'Fita ao nível do umbigo, na expiração normal, sem encolher a barriga. 2 medições.'],
          ['Braço relaxado e tenso', 'Semanas 2 e 4', 'Braço dominante, ponto mais alto do bíceps, de manhã e antes de treinar.'],
          ['Cargas e reps', 'Todos os treinos', 'Carga, reps por série, RIR e ritmo de cada exercício.'],
          ['Sono, fome, energia', 'Diário', 'Escala 1–5.']
        ], 'tr-meas')}
        <p class="muted small tr-note"><strong>Check-in no fim da semana 2:</strong> peso médio das semanas 1 e 2, cintura de 16/11 e 23/11, braços, cargas e reps dos principais exercícios, dias em que cumpriste calorias e proteína (x/14), sono/fome/energia e qualquer dor.</p>
      </div>
    `;

    $('#treino-days').addEventListener('click', e => {
      const b = e.target.closest('[data-day]');
      if (!b) return;
      selected = b.dataset.day;
      renderTrain();
    });
  }

  /* ---------- Alimentação ---------- */
  function mealRows(meals) {
    const tot = meals.reduce((a, m) => [a[0] + m[2], a[1] + m[3], a[2] + m[4], a[3] + m[5]], [0, 0, 0, 0]);
    const rows = meals.map(m => [`<strong>${m[0]}</strong>`, m[1], m[2], m[3], m[4], m[5]]);
    rows.push(['<strong>Total</strong>', '', `<strong>${tot[0]}</strong>`, `<strong>${tot[1]}</strong>`, `<strong>${tot[2]}</strong>`, `<strong>≈ ${tot[3].toLocaleString('pt-PT')}</strong>`]);
    return rows;
  }

  function renderFood() {
    const isRestToday = ['sab', 'dom'].includes(todayKey());
    $('#treino-food').innerHTML = `
      <div class="card">
        <h2>Metas diárias</h2>
        <p class="muted">Manutenção estimada ≈ 2.520 kcal (Mifflin-St Jeor 1.740 × 1,45). Média semanal ≈ 2.360 kcal (−6 %).${isRestToday ? ' Hoje: dia de descanso.' : ''}</p>
        ${table(TARGETS[0], TARGETS.slice(1), 'tr-targets')}
      </div>

      <div class="card">
        <h2>Os teus produtos, por dia</h2>
        ${table(['Produto', 'Treino', 'Descanso', 'Quando'], PRODUCTS, 'tr-prod')}
        <p class="muted small tr-note">Água: 2,5–3 L por dia. Nas primeiras 1–2 semanas o peso pode subir 0,5–1 kg por causa da creatina (água, não gordura).</p>
      </div>

      <div class="card">
        <h2>Dia de treino</h2>
        ${table(['Hora', 'Refeição', 'P', 'H', 'G', 'kcal'], mealRows(MEALS_TRAIN), 'tr-meals')}
      </div>

      <div class="card">
        <h2>Dia de descanso (sáb–dom)</h2>
        <p class="muted">Igual, mas sem aveia no pré-treino.</p>
        ${table(['Hora', 'Refeição', 'P', 'H', 'G', 'kcal'], mealRows(MEALS_REST), 'tr-meals')}
      </div>

      <div class="card">
        <h2>Horários por dia</h2>
        ${table(['Dia', 'Pré-treino', 'Treino', 'Jantar'], WEEK.map(d => [d.name, d.pre, d.train, d.dinner]), 'tr-sched')}
        <p class="muted small tr-note">P = proteína, H = hidratos, G = gorduras (gramas). Pesos dos alimentos em cru.</p>
      </div>
    `;
  }

  /* ---------- Eventos ---------- */
  $('#treino-switch').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    $$('#treino-switch .seg').forEach(s => s.classList.toggle('active', s === b));
    $('#treino-train').hidden = b.dataset.view !== 'train';
    $('#treino-food').hidden = b.dataset.view !== 'food';
  });

  renderBanner();
  renderTrain();
  renderFood();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { renderBanner(); renderFood(); }
  });
})();
