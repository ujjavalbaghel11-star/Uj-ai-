const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let csrfToken = '';
let authMode = 'login';
let currentChatId = null;
let currentMode = 'personal';
let voiceOutput = true;
let voiceConversationActive = false;
let wakeWordArmed = false;
let activeRecognition = null;
let speechQueueToken = 0;
let pendingSpeechResolve = null;
let activeHeyGenAudio = null;
let voiceRestartTimer = null;
let voiceRetryDelay = 500;
let installPrompt = null;
let refreshTimer = null;

function setStatus(message, kind = 'muted') {
  const el = $('#composerStatus');
  if (el) { el.textContent = message; el.dataset.kind = kind; }
}
function setAuthStatus(message) { $('#authStatus').textContent = message; }
async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD'].includes(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(path, {
    method, headers, credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function showAuth() {
  $('#authScreen').hidden = false;
  $('#appShell').hidden = true;
  clearInterval(refreshTimer);
}
function showApp(user) {
  $('#authScreen').hidden = true;
  $('#appShell').hidden = false;
  $('#accountEmail').textContent = user.email;
  $('#sidebar').classList.remove('open');
  $('#sidebarScrim').hidden = true;
}
function setAuthMode(mode) {
  authMode = mode;
  const register = mode === 'register';
  $('#signInTab').classList.toggle('active', !register);
  $('#signUpTab').classList.toggle('active', register);
  $('#authTitle').textContent = register ? 'अपना UJ AI account बनाएं' : 'UJ AI में स्वागत है';
  $('#authSubmit').textContent = register ? 'Create account' : 'Sign in';
  $('#password').autocomplete = register ? 'new-password' : 'current-password';
  $('#passwordHint').textContent = register ? 'कम से कम 10 characters का मजबूत password चुनें।' : 'अपना account password डालें।';
  setAuthStatus('');
}
function messageElement(message) {
  const wrapper = document.createElement('article');
  wrapper.className = `message ${message.role}`;
  const role = document.createElement('div');
  role.className = 'message-role';
  role.textContent = message.role === 'user' ? 'आप' : 'UJ AI';
  const body = document.createElement('div');
  body.textContent = message.content;
  wrapper.append(role, body);
  return wrapper;
}
function renderMessages(messages) {
  const area = $('#chatMessages');
  const wasNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
  area.replaceChildren();
  if (!messages.length) {
    const welcome = document.createElement('section');
    welcome.id = 'welcome';
    welcome.className = 'welcome-panel';
    welcome.innerHTML = '<div class="welcome-orb">UJ</div><p class="eyebrow">NAMASTE</p><h1>आज क्या सीखें या बनाएं?</h1><p class="muted">Hindi या Hinglish में पूछें। UJ आपकी बातों के भावनात्मक संदर्भ को संवेदनशीलता से समझने की कोशिश करेगा। आपकी chat history account के साथ sync होती है।</p><div class="suggestion-grid"><button class="suggestion" data-prompt="Mujhe aaj ke din ka simple plan banane mein help karo.">आज का plan बनाओ</button><button class="suggestion" data-prompt="Nursing study ke liye vital signs ko simple Hindi mein samjhao.">Nursing topic समझाओ</button><button class="suggestion" data-prompt="Mujhe JavaScript ka ek beginner-friendly example samjhao.">Coding शुरू करें</button><button class="suggestion" data-prompt="Cybersecurity ke basic defensive principles Hindi mein samjhao.">Cybersecurity सीखें</button></div>';
    area.append(welcome);
  } else {
    for (const item of messages) area.append(messageElement(item));
  }
  if (wasNearBottom || !messages.length) area.scrollTop = area.scrollHeight;
}
async function loadChats(preferredId = currentChatId) {
  const data = await api('/api/chats');
  const list = $('#chatList');
  list.replaceChildren();
  for (const chat of data.chats) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chat-item${chat.id === preferredId ? ' active' : ''}`;
    button.textContent = chat.title;
    button.title = chat.title;
    button.addEventListener('click', () => openChat(chat.id, chat.mode));
    list.append(button);
  }
  return data.chats;
}
async function createChat(mode = currentMode) {
  const data = await api('/api/chats', { method: 'POST', body: { mode } });
  currentChatId = data.chat.id;
  currentMode = data.chat.mode;
  await loadChats(currentChatId);
  await loadMessages();
  return data.chat;
}
async function openChat(id, mode = 'personal') {
  currentChatId = id;
  currentMode = mode;
  updateModeButtons();
  await loadChats(id);
  await loadMessages();
  $('#sidebar').classList.remove('open');
  $('#sidebarScrim').hidden = true;
}
async function loadMessages() {
  if (!currentChatId) return;
  const data = await api(`/api/chats/${encodeURIComponent(currentChatId)}/messages`);
  renderMessages(data.messages);
}
function updateModeButtons() {
  $$('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === currentMode));
  const hints = { personal: 'UJ AI से कुछ भी पूछें…', nursing: 'Nursing Study के बारे में पूछें…', coding: 'Code या programming के बारे में पूछें…', cybersecurity: 'Cybersecurity, networking या logs के बारे में पूछें…', folax: 'Folax Mode में कुछ भी पूछें…' };
  $('#messageInput').placeholder = hints[currentMode] || hints.personal;
}
async function enterApp(user) {
  const pinState = await api('/api/auth/pin/status');
  if (pinState.enabled) {
    let unlocked = false;
    for (let attempt = 0; attempt < 5 && !unlocked; attempt++) {
      const entered = window.prompt('UJ AI App PIN डालें (6–12 digits):');
      if (entered === null) { await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {}); csrfToken = ''; showAuth(); setAuthStatus('PIN lock के कारण sign out किया गया।'); return; }
      try { await api('/api/auth/pin/verify', { method: 'POST', body: { pin: entered } }); unlocked = true; }
      catch (error) { if (attempt === 4) { await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {}); csrfToken = ''; showAuth(); setAuthStatus('कई गलत PIN प्रयासों के बाद sign out किया गया।'); return; } window.alert(error.message); }
    }
  }
  showApp(user);
  const health = await api('/api/health');
  $('#connectionStatus').textContent = health.aiReady ? 'Secure server connected' : 'AI server key setup pending';
  $('#passkeyLogin').hidden = !health.passkeysAvailable || !window.PublicKeyCredential;
  $('#addPasskey').hidden = !health.passkeysAvailable || !window.PublicKeyCredential;
  const chats = await loadChats(null);
  if (chats.length) await openChat(chats[0].id, chats[0].mode);
  else await createChat('personal');
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (!document.hidden && currentChatId) loadMessages().catch(() => {});
  }, 20000);
}

$('#signInTab').addEventListener('click', () => setAuthMode('login'));
$('#signUpTab').addEventListener('click', () => setAuthMode('register'));
$('#authForm').addEventListener('submit', async event => {
  event.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  $('#authSubmit').disabled = true;
  setAuthStatus('Account verify ho raha hai…');
  try {
    const data = await api(endpoint, { method: 'POST', body: { email, password } });
    csrfToken = data.csrfToken;
    $('#password').value = '';
    await enterApp(data.user);
  } catch (error) { setAuthStatus(error.message); }
  finally { $('#authSubmit').disabled = false; }
});
$('#passkeyLogin').addEventListener('click', async () => {
  if (!window.PublicKeyCredential || !navigator.credentials) { setAuthStatus('Is browser mein passkey supported nahi hai. Password se sign in karein.'); return; }
  const email = $('#email').value.trim();
  if (!email) { setAuthStatus('Pehle apna email enter karein.'); return; }
  $('#passkeyLogin').disabled = true;
  setAuthStatus('Device verification shuru ho raha hai…');
  try {
    const start = await api('/api/auth/passkey/login/options', { method: 'POST', body: { email } });
    const credential = await navigator.credentials.get({ publicKey: decodeRequestOptions(start.options) });
    const data = await api('/api/auth/passkey/login/verify', { method: 'POST', body: { flowId: start.flowId, credential: serializeAssertion(credential) } });
    csrfToken = data.csrfToken;
    await enterApp(data.user);
  } catch (error) { setAuthStatus(error.message || 'Passkey sign in complete nahi hua.'); }
  finally { $('#passkeyLogin').disabled = false; }
});
$('#setPin').addEventListener('click', async () => {
  const first = window.prompt('नया App PIN डालें (6–12 digits):');
  if (first === null) return;
  const second = window.prompt('PIN दोबारा डालें:');
  if (second === null) return;
  if (first !== second) { setStatus('दोनों PIN match नहीं हुए।', 'error'); return; }
  try {
    await api('/api/auth/pin/set', { method: 'POST', body: { pin: first } });
    setStatus('App PIN सुरक्षित रूप से सेट हो गया। अगली बार sign in पर PIN माँगा जाएगा।', 'success');
  } catch (error) { setStatus(error.message, 'error'); }
});

$('#addPasskey').addEventListener('click', async () => {
  if (!window.PublicKeyCredential || !navigator.credentials) { setStatus('Is browser mein passkey supported nahi hai.'); return; }
  $('#addPasskey').disabled = true;
  try {
    const start = await api('/api/auth/passkey/register/options', { method: 'POST', body: {} });
    const credential = await navigator.credentials.create({ publicKey: decodeCreationOptions(start.options) });
    await api('/api/auth/passkey/register/verify', { method: 'POST', body: { flowId: start.flowId, credential: serializeAttestation(credential) } });
    setStatus('Passkey add ho gayi. Agli baar supported device par biometrics use kar sakte hain.', 'success');
  } catch (error) { setStatus(error.message); }
  finally { $('#addPasskey').disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch {}
  csrfToken = '';
  currentChatId = null;
  showAuth();
  setAuthStatus('Aap sign out ho gaye.');
});
$('#newChat').addEventListener('click', () => createChat(currentMode).catch(error => setStatus(error.message)));

$$('[data-mode]').forEach(button => button.addEventListener('click', () => {
  currentMode = button.dataset.mode;
  updateModeButtons();
  setStatus(`${button.textContent} mode selected.`);
}));

function addTemporaryMessage(role, content) {
  const area = $('#chatMessages');
  $('#welcome')?.remove();
  const element = messageElement({ role, content });
  area.append(element);
  area.scrollTop = area.scrollHeight;
  return element.querySelector('div:last-child');
}
async function sendMessage(text, { fromVoice = false } = {}) {
  const message = String(text || '').trim();
  if (!message) return;
  const phoneAction = detectPhoneCommand(message);
  if (phoneAction) {
    $('#messageInput').value = '';
    addTemporaryMessage('user', message);
    const result = addTemporaryMessage('assistant', `फोन action: ${phoneAction.label}. Android पर browser अनुमति दे तो app/settings खुलेगा; नहीं तो नीचे button दबाएँ।`);
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'phone-open-button'; retry.textContent = `अब ${phoneAction.label} खोलें`;
    retry.addEventListener('click', () => launchPhoneAction(phoneAction.key));
    result.append(document.createElement('br'), retry);
    launchPhoneAction(phoneAction.key);
    return;
  }
  if (!currentChatId) return;
  const input = $('#messageInput');
  input.value = '';
  input.style.height = '42px';
  addTemporaryMessage('user', message);
  const answer = addTemporaryMessage('assistant', 'Jawab aa raha hai…');
  $('#sendButton').disabled = true;
  try {
    const data = await api('/api/chat', { method: 'POST', body: { chatId: currentChatId, message, mode: currentMode } });
    answer.textContent = data.reply;
    if (voiceOutput) {
      await speak(data.reply);
      if (fromVoice && voiceConversationActive) setStatus('जवाब पूरा हुआ। अब आप बोल सकते हैं।');
    }
    await loadChats(currentChatId);
  } catch (error) {
    answer.textContent = error.message;
    setStatus(error.message, 'error');
  } finally {
    $('#sendButton').disabled = false;
    if (!fromVoice) input.focus();
  }
}
const PHONE_ACTIONS = {
  youtube: { label: 'YouTube', android: 'intent://www.youtube.com/#Intent;scheme=https;package=com.google.android.youtube;end', ios: 'youtube://' },
  whatsapp: { label: 'WhatsApp', android: 'intent://send/#Intent;scheme=whatsapp;package=com.whatsapp;end', ios: 'whatsapp://' },
  camera: { label: 'Camera', android: 'intent://#Intent;action=android.media.action.IMAGE_CAPTURE;end', ios: 'camera://' },
  chrome: { label: 'Chrome', android: 'intent://www.google.com/#Intent;scheme=https;package=com.android.chrome;end', ios: 'googlechrome://' },
  settings: { label: 'Settings', android: 'intent://#Intent;action=android.settings.SETTINGS;end' },
  wifi: { label: 'Wi-Fi settings', android: 'intent://#Intent;action=android.settings.WIFI_SETTINGS;end' },
  bluetooth: { label: 'Bluetooth settings', android: 'intent://#Intent;action=android.settings.BLUETOOTH_SETTINGS;end' },
  dialer: { label: 'Phone dialer', android: 'tel:', ios: 'tel:' }
};
function detectPhoneCommand(text) {
  const value = text.toLocaleLowerCase('en-IN').replace(/[.,!?।]/g, ' ').replace(/\s+/g, ' ').trim();
  const patterns = [
    ['youtube', /(?:youtube|यूट्यूब).*(?:kholo|khol do|open|chalao)|(?:kholo|open).*(?:youtube|यूट्यूब)/],
    ['whatsapp', /(?:whatsapp|व्हाट्सएप).*(?:kholo|khol do|open)|(?:kholo|open).*(?:whatsapp|व्हाट्सएप)/],
    ['camera', /(?:camera|कैमरा).*(?:kholo|khol do|open)|(?:kholo|open).*(?:camera|कैमरा)/],
    ['chrome', /(?:chrome|क्रोम|browser).*(?:kholo|khol do|open)|(?:kholo|open).*(?:chrome|क्रोम|browser)/],
    ['wifi', /(?:wifi|wi fi|वाई.?फाई).*(?:setting|सेटिंग).*(?:kholo|open)|(?:wifi|wi fi|वाई.?फाई).*(?:kholo|open)/],
    ['bluetooth', /(?:bluetooth|ब्लूटूथ).*(?:setting|सेटिंग)?.*(?:kholo|open)/],
    ['settings', /(?:phone )?(?:settings|setting|सेटिंग).*(?:kholo|khol do|open)|(?:kholo|open).*(?:settings|setting|सेटिंग)/],
    ['dialer', /(?:phone|dialer|call screen|डायलर).*(?:kholo|khol do|open)|(?:kholo|open).*(?:phone|dialer|डायलर)/]
  ];
  for (const [key, pattern] of patterns) if (pattern.test(value)) return { key, label: PHONE_ACTIONS[key].label };
  return null;
}
async function launchPhoneAction(key) {
  const action = PHONE_ACTIONS[key];
  if (!action) return;
  const nativePlugin = window.Capacitor?.Plugins?.UJNative;
  if (nativePlugin?.openPhoneTarget) {
    try { await nativePlugin.openPhoneTarget({ target: key }); setStatus(`${action.label} खुल गया।`); }
    catch (error) { setStatus(error.message || `${action.label} नहीं खुल सका।`, 'error'); }
    return;
  }
  const android = /Android/i.test(navigator.userAgent);
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const target = android ? action.android : (ios ? action.ios : null);
  if (!target) { setStatus(`${action.label}: यह shortcut Android/iOS phone पर उपलब्ध है।`, 'error'); return; }
  if (key === 'dialer') { window.location.href = target; return; }
  setStatus(`${action.label} खोलने की कोशिश…`);
  window.location.href = target;
  window.setTimeout(() => setStatus(`अगर ${action.label} नहीं खुला, ऊपर का “अब ${action.label} खोलें” button दबाएँ।`), 900);
}
$$('[data-phone-action]').forEach(button => button.addEventListener('click', () => launchPhoneAction(button.dataset.phoneAction)));
const defaultAssistantButton = $('#setDefaultAssistant');
if (defaultAssistantButton) defaultAssistantButton.addEventListener('click', async () => {
  const nativePlugin = window.Capacitor?.Plugins?.UJNative;
  const status = $('#nativeAssistantStatus');
  if (!nativePlugin?.requestAssistantRole) {
    status.textContent = 'यह सुविधा native Android APK में उपलब्ध होगी। अभी PWA/browser में नहीं।';
    return;
  }
  defaultAssistantButton.disabled = true;
  status.textContent = 'Android Assistant permission खुल रही है…';
  try {
    const result = await nativePlugin.requestAssistantRole();
    status.textContent = result.isDefault ? 'UJ AI अब Default Assistant है।' : 'UJ AI को Default Assistant नहीं चुना गया। Android Settings में जाकर चुन सकते हैं।';
  } catch (error) { status.textContent = error.message || 'Default Assistant सेट नहीं हो सका।'; }
  finally { defaultAssistantButton.disabled = false; }
});

const THEME_PRESETS = {
  jarvis: { name:'Jarvis', bg:'#07111f', panel:'#10243a', panel2:'#173652', text:'#e8f7ff', muted:'#9bb8cc', line:'#28506b', accent:'#26c6da', accent2:'#448aff', gradient:'radial-gradient(ellipse at 18% 8%, #174a67 0, transparent 42%), radial-gradient(ellipse at 88% 80%, #172b60 0, transparent 45%), #07111f' },
  galaxy: { name:'Galaxy', bg:'#100b25', panel:'#21183b', panel2:'#30214f', text:'#f7edff', muted:'#c0add8', line:'#49346b', accent:'#c084fc', accent2:'#6366f1', gradient:'radial-gradient(ellipse at 20% 10%, #4c1d75 0, transparent 42%), radial-gradient(ellipse at 85% 80%, #1e3a8a 0, transparent 45%), #100b25' },
  neon: { name:'Neon Blue', bg:'#061321', panel:'#10263a', panel2:'#173b56', text:'#e6f7ff', muted:'#9dbed0', line:'#24516e', accent:'#00d4ff', accent2:'#2563eb', gradient:'radial-gradient(ellipse at 50% 0%, #075985 0, transparent 48%), #061321' },
  nature: { name:'Nature', bg:'#0b1b15', panel:'#142c22', panel2:'#1d3d2e', text:'#effcf2', muted:'#b1cdb8', line:'#315b43', accent:'#86efac', accent2:'#22c55e', gradient:'radial-gradient(ellipse at 15% 0%, #245c3a 0, transparent 45%), #0b1b15' },
  amoled: { name:'AMOLED', bg:'#000000', panel:'#090909', panel2:'#151515', text:'#ffffff', muted:'#aaaaaa', line:'#292929', accent:'#ffffff', accent2:'#777777', gradient:'#000000' }
};
function applyTheme(theme, backgroundImage = '') {
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.bg); root.style.setProperty('--panel', theme.panel); root.style.setProperty('--panel-2', theme.panel2);
  root.style.setProperty('--text', theme.text); root.style.setProperty('--muted', theme.muted); root.style.setProperty('--line', theme.line);
  root.style.setProperty('--purple', theme.accent); root.style.setProperty('--teal', theme.accent2);
  document.body.style.background = backgroundImage ? `linear-gradient(#07101dcc,#07101dcc), url("${backgroundImage}") center / cover fixed` : theme.gradient;
  document.body.classList.toggle('theme-image-active', Boolean(backgroundImage));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg);
  localStorage.setItem('ujai-theme-v1', JSON.stringify({ theme, backgroundImage }));
  const status = $('#themeStatus'); if (status) status.textContent = `${theme.name || 'Custom'} theme लागू हो गई।`;
}
function loadSavedTheme() {
  try { const saved = JSON.parse(localStorage.getItem('ujai-theme-v1') || 'null'); if (saved?.theme) applyTheme(saved.theme, saved.backgroundImage || ''); } catch {}
}
$$('[data-theme-preset]').forEach(button => button.addEventListener('click', () => applyTheme(THEME_PRESETS[button.dataset.themePreset])));
$('#generateTheme').addEventListener('click', () => {
  const prompt = ($('#themePrompt').value || '').trim().toLowerCase();
  if (!prompt) { $('#themeStatus').textContent = 'पहले Theme का नाम या आइडिया लिखें।'; return; }
  const key = /jarvis|iron ?man|arc|रोबोट/.test(prompt) ? 'jarvis' : /galaxy|space|अंतरिक्ष|तारे/.test(prompt) ? 'galaxy' : /nature|forest|green|प्रकृति/.test(prompt) ? 'nature' : /amoled|black|dark|काला/.test(prompt) ? 'amoled' : 'neon';
  applyTheme({ ...THEME_PRESETS[key], name: prompt.replace(/\b\w/g, c => c.toUpperCase()) });
  $('#themeStatus').textContent = `“${prompt}” के लिए ${THEME_PRESETS[key].name} visual theme लागू की गई। यह prompt-based theme styling है; असली AI-generated image के लिए Image API जोड़ना बाकी है।`;
});
$('#generateThemeImage').addEventListener('click', async () => {
  const prompt = ($('#themePrompt').value || '').trim();
  if (!prompt) { $('#themeStatus').textContent = 'पहले Theme का नाम या आइडिया लिखें।'; return; }
  const button = $('#generateThemeImage');
  button.disabled = true; button.textContent = '⏳ Background बन रहा है…';
  $('#themeStatus').textContent = 'AI आपके लिए नया background तैयार कर रही है। इसमें थोड़ा समय लग सकता है।';
  try {
    const result = await api('/api/theme/generate-image', { method: 'POST', body: { prompt } });
    const saved = JSON.parse(localStorage.getItem('ujai-theme-v1') || 'null');
    const key = /jarvis|iron ?man|arc|रोबोट/i.test(prompt) ? 'jarvis' : /galaxy|space|अंतरिक्ष|तारे/i.test(prompt) ? 'galaxy' : /nature|forest|green|प्रकृति/i.test(prompt) ? 'nature' : /amoled|black|dark|काला/i.test(prompt) ? 'amoled' : 'neon';
    applyTheme({ ...(saved?.theme || THEME_PRESETS[key]), name: prompt }, result.image);
    $('#themeStatus').textContent = 'आपका AI-generated background तैयार है और इस device पर save हो गया है।';
  } catch (error) { $('#themeStatus').textContent = error.message; }
  finally { button.disabled = false; button.textContent = '✨ AI से Background बनाएं'; }
});
$('#themeImage').addEventListener('change', event => {
  const file = event.target.files?.[0]; if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { $('#themeStatus').textContent = 'कृपया 5 MB से छोटी PNG, JPG या WebP image चुनें।'; event.target.value = ''; return; }
  const reader = new FileReader(); reader.onload = () => { const saved = JSON.parse(localStorage.getItem('ujai-theme-v1') || 'null'); applyTheme(saved?.theme || THEME_PRESETS.jarvis, reader.result); $('#themeStatus').textContent = 'आपका background image इस device पर लागू और local रूप से save हो गया।'; }; reader.readAsDataURL(file);
});
$('#resetTheme').addEventListener('click', () => { localStorage.removeItem('ujai-theme-v1'); document.documentElement.removeAttribute('style'); document.body.style.background = ''; document.body.classList.remove('theme-image-active'); $('#themeStatus').textContent = 'Default theme वापस आ गई।'; });
loadSavedTheme();
$('#composer').addEventListener('submit', event => { event.preventDefault(); sendMessage($('#messageInput').value); });
$('#messageInput').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(event.currentTarget.value); }
});
$('#messageInput').addEventListener('input', event => {
  event.currentTarget.style.height = '42px';
  event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 150)}px`;
});
document.addEventListener('click', event => {
  const suggestion = event.target.closest('[data-prompt]');
  if (suggestion) sendMessage(suggestion.dataset.prompt);
});
const SAFE_TEXT_EXTENSIONS = new Set(['txt','log','csv','json','html','css','js','py','md','xml','yaml','yml','conf','ini']);
$('#attachButton').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!SAFE_TEXT_EXTENSIONS.has(extension)) { setStatus('Abhi sirf text, log, config aur source-code files supported hain.', 'error'); return; }
  if (file.size > 12 * 1024) { setStatus('File 12 KB se chhoti honi chahiye. Sensitive files upload na karein.', 'error'); return; }
  try {
    const content = await file.text();
    if (content.includes('\u0000')) { setStatus('Binary file supported nahi hai.', 'error'); return; }
    const input = $('#messageInput');
    const attachment = `

[Attached text file: ${file.name}]\n--- FILE CONTENT START ---\n${content}\n--- FILE CONTENT END ---`;
    if ((input.value + attachment).length > 20000) { setStatus('File content aur message milakar 20,000 characters se zyada hai.', 'error'); return; }
    input.value += attachment;
    input.focus();
    input.dispatchEvent(new Event('input'));
    setStatus(`${file.name} ka text message mein attach hua. Send dabane par AI analyze karega. API keys/passwords wali files attach na karein.`, 'success');
  } catch { setStatus('File read nahi ho payi.', 'error'); }
});

function detectSpeechLanguage(value) {
  // Prefer Hindi voice for Devanagari; use Indian English for Roman Hinglish/English.
  return /[\u0900-\u097F]/.test(value) ? 'hi-IN' : 'en-IN';
}
function chooseSpeechVoice(lang) {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  const base = lang.toLowerCase().split('-')[0];
  const languageMatches = voices.filter(voice => voice.lang.toLowerCase() === lang.toLowerCase())
    .concat(voices.filter(voice => voice.lang.toLowerCase().startsWith(`${base}-`) && voice.lang.toLowerCase() !== lang.toLowerCase()));
  // Prefer a feminine-sounding installed voice when the browser exposes one.
  const feminine = languageMatches.find(voice => /female|woman|girl|priti|lekha|heera|samantha/i.test(voice.name));
  return feminine || languageMatches[0] || voices.find(voice => voice.lang.toLowerCase().startsWith('en-in')) || null;
}
async function speak(value) {
  if (!voiceOutput) return;
  stopVoiceOutput();
  const token = ++speechQueueToken;
  // Use the configured UJ HeyGen voice when the server has credentials; otherwise use the device voice.
  try {
    const generated = await api('/api/voice/tts', { method: 'POST', body: { text: String(value).slice(0, 5000) } });
    if (token !== speechQueueToken) return;
    if (generated.audioUrl) {
      await new Promise(resolve => {
        const audio = new Audio(generated.audioUrl);
        activeHeyGenAudio = audio;
        const finish = () => { if (activeHeyGenAudio === audio) activeHeyGenAudio = null; resolve(); };
        audio.onended = finish; audio.onerror = finish;
        audio.play().then(() => {}).catch(finish);
      });
      return;
    }
  } catch { /* HeyGen not configured or temporarily unavailable: use local browser voice. */ }
  if (token !== speechQueueToken || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (pendingSpeechResolve === finish) pendingSpeechResolve = null;
      resolve();
    };
    pendingSpeechResolve = finish;
    const utterance = new SpeechSynthesisUtterance(String(value).slice(0, 12000));
    utterance.lang = detectSpeechLanguage(value);
    utterance.rate = 1;
    utterance.pitch = 1;
    const voice = chooseSpeechVoice(utterance.lang);
    if (voice) utterance.voice = voice;
    utterance.onend = () => { if (token === speechQueueToken) finish(); };
    utterance.onerror = () => { if (token === speechQueueToken) finish(); };
    try { speechSynthesis.speak(utterance); } catch { finish(); }
  });
}
function stopVoiceOutput() {
  speechQueueToken++;
  const finish = pendingSpeechResolve;
  pendingSpeechResolve = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (activeHeyGenAudio) { activeHeyGenAudio.pause(); activeHeyGenAudio.currentTime = 0; activeHeyGenAudio = null; }
  if (finish) finish();
}

// One-time HeyGen sample preview; live replies use configured HeyGen TTS with browser fallback.
const UJ_VOICE_SAMPLE_URL = 'https://resource2.heygen.ai/text_to_speech/b169817a9e424da899aee1e30eb88ba8/da9659970e9d4250be76c3f628565bc7/id=c6928cd9d8824c9da2849bef96b4a963.wav';
let ujVoicePreview = null;
const previewVoiceButton = $('#ujVoicePreview');
if (previewVoiceButton) {
  previewVoiceButton.addEventListener('click', async () => {
    try {
      if (!ujVoicePreview) { ujVoicePreview = new Audio(UJ_VOICE_SAMPLE_URL); ujVoicePreview.preload = 'none'; }
      if (!ujVoicePreview.paused) { ujVoicePreview.pause(); ujVoicePreview.currentTime = 0; }
      previewVoiceButton.disabled = true;
      previewVoiceButton.textContent = '▶ UJ की आवाज़ चल रही है…';
      await ujVoicePreview.play();
      ujVoicePreview.onended = () => { previewVoiceButton.disabled = false; previewVoiceButton.textContent = '🎙 UJ की आवाज़ सुनें'; };
      ujVoicePreview.onerror = () => { previewVoiceButton.disabled = false; previewVoiceButton.textContent = '🎙 आवाज़ फिर सुनें'; setStatus('Voice sample अभी load नहीं हुआ। Internet connection जाँचें.', 'error'); };
    } catch { previewVoiceButton.disabled = false; previewVoiceButton.textContent = '🎙 आवाज़ फिर सुनें'; setStatus('Voice sample चलाने की अनुमति नहीं मिली। दोबारा tap करें.', 'error'); }
  });
}

function updateVoiceControls() {
  $('#voiceToggle').textContent = voiceOutput ? '🔊 जवाब बोलें: On' : '🔇 जवाब बोलें: Off';
  $('#voiceToggle').setAttribute('aria-pressed', String(voiceOutput));
  $('#voiceConversation').textContent = voiceConversationActive ? '🎧 बातचीत मोड: On' : '🎧 बातचीत मोड: Off';
  $('#voiceConversation').setAttribute('aria-pressed', String(voiceConversationActive));
  const wakeButton = $('#wakeButton');
  if (wakeButton) { wakeButton.textContent = wakeWordArmed ? '🟢 UJ Wake: सुन रहा है' : '🎙 UJ Wake'; wakeButton.setAttribute('aria-pressed', String(wakeWordArmed)); }
  $('#micButton').classList.toggle('voice-active', Boolean(activeRecognition) || voiceConversationActive);
}
function stopListening() {
  voiceConversationActive = false;
  wakeWordArmed = false;
  if (voiceRestartTimer) { clearTimeout(voiceRestartTimer); voiceRestartTimer = null; }
  stopVoiceOutput();
  if (activeRecognition) {
    const current = activeRecognition;
    activeRecognition = null;
    try { current.stop(); } catch {}
  }
  updateVoiceControls();
  setStatus('Voice बातचीत बंद है।');
}
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
function startListening({ autoSend = false, wakeMode = false } = {}) {
  if (!SpeechRecognition) {
    setStatus('इस browser में speech recognition उपलब्ध नहीं है। Chrome Android पर HTTPS में कोशिश करें या keyboard से लिखें।', 'error');
    if (voiceConversationActive) stopListening();
    return;
  }
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    setStatus('Microphone के लिए secure HTTPS website जरूरी है।', 'error');
    if (voiceConversationActive) stopListening();
    return;
  }
  if (activeRecognition) return;
  const recognition = new SpeechRecognition();
  activeRecognition = recognition;
  recognition.lang = 'hi-IN';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let finalTranscript = '';
  recognition.onstart = () => { setStatus('🎙 सुन रहा हूँ… अब बोलें।'); updateVoiceControls(); };
  recognition.onresult = event => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) finalTranscript += transcript;
      else interim += transcript;
    }
    if (autoSend) setStatus(interim ? `सुन रहा हूँ: ${interim}` : 'आपकी आवाज़ समझ रहा हूँ…');
    else setStatus(interim ? `सुन रहा हूँ: ${interim}` : 'आवाज़ समझ रहा हूँ…');
  };
  recognition.onerror = event => {
    const messages = { 'not-allowed': 'Microphone permission blocked है। Browser settings में अनुमति दें।', 'no-speech': 'आवाज़ सुनाई नहीं दी। फिर से सुनने की कोशिश करूँगा।', 'audio-capture': 'इस device पर microphone नहीं मिला।', 'network': 'Speech recognition network उपलब्ध नहीं है। Internet जाँचें।', 'aborted': 'Voice listening रोकी गई।' };
    setStatus(messages[event.error] || 'Voice recognition शुरू नहीं हो पाया।', 'error');
    if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) voiceConversationActive = false;
  };
  recognition.onend = async () => {
    if (activeRecognition === recognition) activeRecognition = null;
    updateVoiceControls();
    const transcript = finalTranscript.trim();
    if (wakeMode && wakeWordArmed) {
      const wakeText = transcript.toLocaleLowerCase('hi-IN').replace(/[\s._-]+/g, '');
      const heardWakeWord = /uj|यूजे|यूज|यूजेआई|युजे|युज/.test(wakeText);
      if (heardWakeWord) {
        wakeWordArmed = false;
        voiceConversationActive = true;
        voiceOutput = true;
        setStatus('जी, बोलिए। UJ सुन रहा है।', 'success');
        updateVoiceControls();
        await speak('जी, बोलिए।');
      } else {
        setStatus('UJ नाम सुनने का इंतज़ार है…');
      }
      if (wakeWordArmed || voiceConversationActive) {
        if (voiceRestartTimer) clearTimeout(voiceRestartTimer);
        voiceRestartTimer = window.setTimeout(() => {
          voiceRestartTimer = null;
          if ((wakeWordArmed || voiceConversationActive) && !activeRecognition && !document.hidden) startListening({ autoSend: voiceConversationActive, wakeMode: wakeWordArmed });
        }, heardWakeWord ? 300 : 450);
      }
      return;
    }
    if (transcript && autoSend && voiceConversationActive) {
      setStatus('आपका सवाल भेज रहा हूँ…');
      await sendMessage(transcript, { fromVoice: true });
    } else if (transcript && !autoSend) {
      const input = $('#messageInput');
      input.value = `${input.value}${input.value ? ' ' : ''}${transcript}`;
      input.focus();
      setStatus('Voice text तैयार है। Send दबाएँ।', 'success');
    }
    if (voiceConversationActive && autoSend && !document.hidden) {
      if (transcript) voiceRetryDelay = 500;
      else voiceRetryDelay = Math.min(Math.max(voiceRetryDelay * 1.7, 900), 5000);
      if (voiceRestartTimer) clearTimeout(voiceRestartTimer);
      voiceRestartTimer = window.setTimeout(() => {
        voiceRestartTimer = null;
        if ((voiceConversationActive || wakeWordArmed) && !activeRecognition && !document.hidden) startListening({ autoSend: voiceConversationActive, wakeMode: wakeWordArmed });
      }, voiceRetryDelay);
    }
  };
  try { recognition.start(); }
  catch { activeRecognition = null; updateVoiceControls(); setStatus('Mic अभी start नहीं हो पाया। दोबारा दबाएँ।', 'error'); }
}
$('#voiceToggle').addEventListener('click', () => {
  voiceOutput = !voiceOutput;
  if (!voiceOutput) stopVoiceOutput();
  updateVoiceControls();
  setStatus(voiceOutput ? 'AI के जवाब आवाज़ में सुनाए जाएँगे।' : 'Voice replies बंद हैं।');
});
$('#stopSpeaking').addEventListener('click', () => {
  stopListening();
  setStatus('Voice बातचीत और बोलना रोक दिया गया।');
});
$('#voiceConversation').addEventListener('click', () => {
  if (voiceConversationActive) { stopListening(); return; }
  if (!SpeechRecognition) { setStatus('इस browser में hands-free voice conversation supported नहीं है। Chrome Android पर HTTPS में कोशिश करें।', 'error'); return; }
  if (!('speechSynthesis' in window)) { setStatus('इस browser में AI voice output उपलब्ध नहीं है।', 'error'); return; }
  if (voiceRestartTimer) { clearTimeout(voiceRestartTimer); voiceRestartTimer = null; }
  voiceOutput = true;
  voiceRetryDelay = 500;
  voiceConversationActive = true;
  updateVoiceControls();
  setStatus('🎧 बातचीत चालू है। बोलें; आपका सवाल भेजकर जवाब आवाज़ में सुनाऊँगा। रोकने के लिए ⏹ दबाएँ।');
  startListening({ autoSend: true });
});
$('#wakeButton').addEventListener('click', async () => {
  if (wakeWordArmed || voiceConversationActive) { stopListening(); return; }
  if (!SpeechRecognition) { setStatus('इस browser में voice wake supported नहीं है। Chrome Android पर HTTPS में कोशिश करें।', 'error'); return; }
  if (!window.isSecureContext && location.hostname !== 'localhost') { setStatus('UJ Wake के लिए secure HTTPS जरूरी है।', 'error'); return; }
  const button = $('#wakeButton');
  button.disabled = true;
  setStatus('UJ server को जगाने की कोशिश कर रहा हूँ…');
  try {
    const health = await fetch('/api/health', { cache: 'no-store', credentials: 'same-origin' });
    if (!health.ok) throw new Error('Server अभी उपलब्ध नहीं है।');
    wakeWordArmed = true;
    voiceOutput = true;
    updateVoiceControls();
    setStatus('अब “UJ” बोलें। ऐप खुला और स्क्रीन चालू रखें।');
    startListening({ wakeMode: true });
  } catch (error) {
    setStatus(error.message || 'Server अभी नहीं जागा। थोड़ी देर बाद फिर कोशिश करें।', 'error');
  } finally { button.disabled = false; }
});
$('#micButton').addEventListener('click', () => {
  if (activeRecognition) {
    try { activeRecognition.stop(); } catch {}
    return;
  }
  startListening({ autoSend: false });
});
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
window.addEventListener('pagehide', () => {
  voiceConversationActive = false;
  wakeWordArmed = false;
  if (voiceRestartTimer) clearTimeout(voiceRestartTimer);
  if (activeRecognition) { try { activeRecognition.stop(); } catch {} }
  stopVoiceOutput();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (voiceConversationActive || wakeWordArmed)) stopListening();
});
updateVoiceControls();

$('#openSidebar').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#sidebarScrim').hidden = false; });
$('#closeSidebar').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#sidebarScrim').hidden = true; });
$('#sidebarScrim').addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#sidebarScrim').hidden = true; });

function base64urlToBuffer(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
function bufferToBase64url(value) {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decodeRequestOptions(options) {
  return { ...options, challenge: base64urlToBuffer(options.challenge), allowCredentials: (options.allowCredentials || []).map(item => ({ ...item, id: base64urlToBuffer(item.id) })) };
}
function decodeCreationOptions(options) {
  return { ...options, challenge: base64urlToBuffer(options.challenge), user: { ...options.user, id: base64urlToBuffer(options.user.id) }, excludeCredentials: (options.excludeCredentials || []).map(item => ({ ...item, id: base64urlToBuffer(item.id) })) };
}
function serializeAssertion(credential) {
  return {
    id: credential.id, rawId: bufferToBase64url(credential.rawId), type: credential.type,
    response: {
      authenticatorData: bufferToBase64url(credential.response.authenticatorData),
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      signature: bufferToBase64url(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64url(credential.response.userHandle) : null
    },
    clientExtensionResults: credential.getClientExtensionResults()
  };
}
function serializeAttestation(credential) {
  return {
    id: credential.id, rawId: bufferToBase64url(credential.rawId), type: credential.type,
    response: {
      attestationObject: bufferToBase64url(credential.response.attestationObject),
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
      transports: credential.response.getTransports ? credential.response.getTransports() : []
    },
    clientExtensionResults: credential.getClientExtensionResults()
  };
}

async function bootstrap() {
  try {
    const data = await api('/api/auth/session');
    if (!data.authenticated) {
      const health = await api('/api/health');
      $('#passkeyLogin').hidden = !health.passkeysAvailable || !window.PublicKeyCredential;
      showAuth();
      return;
    }
    csrfToken = data.csrfToken;
    await enterApp(data.user);
  } catch {
    showAuth();
    setAuthStatus('Server se connection nahi ho paya. Hosted app URL aur backend check karein.');
  }
}
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  $('#installApp').hidden = false;
});
$('#installApp').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#installApp').hidden = true;
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && csrfToken && currentChatId) loadMessages().catch(() => {});
});
bootstrap();
