/* ==========================================================
   Estudo · Dashboard — sync.js
   Login com Google + sincronização com o Firestore.
   Se este ficheiro não carregar (sem internet, por exemplo), a app
   continua a funcionar normalmente só com os dados deste aparelho.
   ========================================================== */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, onSnapshot, setDoc }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// Identificação pública do projeto (não é uma palavra-passe). O acesso aos dados
// é protegido pelo login e pelas regras de segurança do Firestore.
const firebaseConfig = {
  apiKey: 'AIzaSyBBmsc6-FaX4SvJG9prFkiWJPIa_mnOHS8',
  authDomain: 'estudo-8e98c.firebaseapp.com',
  projectId: 'estudo-8e98c',
  storageBucket: 'estudo-8e98c.firebasestorage.app',
  messagingSenderId: '206976555699',
  appId: '1:206976555699:web:bca4bc70cb31800d036ec6'
};

const host = window.estudoApp;           // ligação ao script.js
const btn = document.getElementById('auth-btn');
const info = document.getElementById('sync-text');

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

let user = null, ref = null, unsub = null, timer = null;

/* ---------- Estado visual ---------- */
const OFF_TEXT = 'Sincronização desligada. Toca na nuvem (☁) no topo e entra com a Google para veres os mesmos dados no telemóvel e no computador.';
function setStatus(kind, detail) {
  btn.classList.remove('on', 'busy', 'err');
  let label = 'Entrar com Google para sincronizar', text = OFF_TEXT;
  if (kind === 'pending') { btn.classList.add('busy'); label = 'A sincronizar…'; text = 'A sincronizar…'; }
  if (kind === 'synced') {
    btn.classList.add('on');
    label = 'Sincronizado · toca para sair';
    text = `Sincronizado${user && user.email ? ' como ' + user.email : ''}. Os dados são os mesmos em todos os aparelhos onde entrares.`;
  }
  if (kind === 'error') {
    btn.classList.add('err');
    label = 'Erro de sincronização · toca para sair';
    text = detail || 'Erro de sincronização. Os dados continuam guardados neste aparelho.';
  }
  btn.title = label;
  btn.setAttribute('aria-label', label);
  if (info) info.textContent = text;
}

function fail(e) {
  console.warn('Sync:', e);
  if (e && e.code === 'permission-denied') {
    setStatus('error', 'Sem permissão. O email desta conta Google tem de ser o mesmo que está nas regras do Firestore.');
    host.toast('Sem permissão para guardar na nuvem (verifica o email nas regras do Firestore).');
  } else {
    setStatus('error', 'Erro de sincronização' + (e && e.code ? ` (${e.code})` : '') + '. Os dados continuam guardados neste aparelho.');
  }
}

/* ---------- Enviar para a nuvem ---------- */
async function doPush() {
  if (!ref) return;
  const s = host.getState();
  // o tema e o semestre escolhido são preferências de cada aparelho: não vão para a nuvem
  const { theme, currentSemester, ...shared } = s;
  try {
    setStatus('pending');
    await setDoc(ref, { json: JSON.stringify(shared), updatedAt: s.updatedAt || 0, savedAt: Date.now() });
    setStatus('synced');
  } catch (e) { fail(e); }
}

function push() {
  if (!ref) return;
  clearTimeout(timer);
  setStatus('pending');
  timer = setTimeout(doPush, 800);   // junta várias alterações seguidas num só envio
}

/* ---------- Receber da nuvem ---------- */
function onRemote(snap) {
  if (snap.metadata && snap.metadata.hasPendingWrites) return; // eco da nossa própria escrita
  if (!snap.exists()) {
    // primeira vez: envia o que existe neste aparelho
    host.touch();
    doPush();
    return;
  }
  const data = snap.data();
  let remote;
  try { remote = JSON.parse(data.json); } catch (e) { fail(e); return; }
  const rU = data.updatedAt || 0;
  const lU = host.getState().updatedAt || 0;
  if (rU > lU) { host.applyRemote(Object.assign({}, remote, { updatedAt: rU })); setStatus('synced'); }
  else if (lU > rU) { doPush(); }
  else setStatus('synced');
}

/* ---------- Login / logout ---------- */
async function toggle() {
  if (user) {
    if (confirm('Sair da conta? Os dados ficam neste aparelho, mas deixam de sincronizar.')) await signOut(auth);
    return;
  }
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    if (e.code === 'auth/unauthorized-domain') host.toast('Domínio não autorizado: adiciona este endereço em Authentication → Configurações → Domínios autorizados.');
    else if (e.code === 'auth/popup-blocked') host.toast('O browser bloqueou a janela de login. Permite pop-ups neste site e tenta outra vez.');
    else host.toast('Não foi possível entrar (' + (e.code || e.message) + ').');
  }
}

onAuthStateChanged(auth, u => {
  user = u;
  if (unsub) { unsub(); unsub = null; }
  clearTimeout(timer);
  ref = null;
  if (!u) { setStatus('off'); return; }
  ref = doc(db, 'users', u.uid, 'app', 'state');
  setStatus('pending');
  unsub = onSnapshot(ref, onRemote, fail);
});

window.estudoCloud = { push, toggle };
setStatus('off');
