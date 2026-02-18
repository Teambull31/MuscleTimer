/* ========================================
   MUSCLE TIMER — Application Logic v2
   Timer + Tab navigation + Module init
   ======================================== */

(function () {
  'use strict';

  // ---- RPE / Feeling → rest time mapping (in seconds) ----
  const RPE_MAP = {
    '6': 60, '7': 90, '7.5': 120, '8': 150,
    '8.5': 180, '9': 210, '9.5': 240, '10': 300
  };

  const FEELING_MAP = {
    'easy': 60, 'moderate': 120, 'hard': 180, 'exhausting': 270
  };

  // ---- State ----
  let currentMode = 'rpe';
  let selectedRestTime = 0;
  let baseRestTime = 0;
  let timerInterval = null;
  let timerRemaining = 0;
  let timerTotal = 0;
  let isRunning = false;

  // Free timer state
  let freeTimerInterval = null;
  let freeTimerRemaining = 0;
  let freeTimerTotal = 0;
  let freeTimerRunning = false;

  // ---- DOM refs ----
  const app = document.getElementById('app');
  const bgLayer = document.getElementById('bg-layer');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const modeIndicator = document.querySelector('.mode-indicator');
  const rpeSelector = document.getElementById('rpe-selector');
  const feelingSelector = document.getElementById('feeling-selector');
  const rpeBtns = document.querySelectorAll('.rpe-btn');
  const feelingBtns = document.querySelectorAll('.feeling-btn');
  const timerDisplay = document.getElementById('timer-display');
  const timerLabel = document.getElementById('timer-label');
  const timerContainer = document.getElementById('timer-container');
  const ringProgress = document.getElementById('ring-progress');
  const timeAdjuster = document.getElementById('time-adjuster');
  const adjMinus = document.getElementById('adj-minus');
  const adjPlus = document.getElementById('adj-plus');
  const startBtn = document.getElementById('start-btn');
  const startText = document.getElementById('start-text');

  // Free timer DOM refs
  const freeRingProgress = document.getElementById('free-ring-progress');
  const freeTimerDisplay = document.getElementById('free-timer-display');
  const freeTimerRingWrap = document.getElementById('free-timer-ring-wrap');
  const freeStartBtn = document.getElementById('free-start-btn');
  const freeMinInput = document.getElementById('free-min');
  const freeSecInput = document.getElementById('free-sec');
  const freeTimerInputs = document.getElementById('free-timer-inputs');
  const FREE_CIRCUMFERENCE = 2 * Math.PI * 52;

  // Settings
  const settingsPanel = document.getElementById('settings-panel');
  const openSettings = document.getElementById('open-settings');
  const closeSettings = document.getElementById('close-settings');
  const themeGrid = document.getElementById('theme-grid');
  const bgUpload = document.getElementById('bg-upload');
  const removeBg = document.getElementById('remove-bg');
  const positionGrid = document.getElementById('position-grid');

  // Tab navigation
  const bottomNav = document.getElementById('bottom-nav');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  const CIRCUMFERENCE = 2 * Math.PI * 90;

  // ---- Utility ----
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function setRingProgress(fraction) {
    const offset = CIRCUMFERENCE * (1 - fraction);
    ringProgress.style.strokeDashoffset = offset;
  }

  // ---- Audio (Web Audio API) ----
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playBeep(frequency, duration) {
    return new Promise(resolve => {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.6, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
      setTimeout(resolve, duration);
    });
  }

  async function playDoubleBeep() {
    await playBeep(880, 200);
    await new Promise(r => setTimeout(r, 200));
    await playBeep(880, 200);
  }

  // ---- Tab Navigation ----
  function switchTab(tabName) {
    navTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    tabContents.forEach(tc => tc.classList.toggle('active', tc.id === `tab-${tabName}`));

    // Notify progress tab when activated
    if (tabName === 'progress') {
      ProgressManager.onTabActivated();
    }
  }

  // ---- Mode switching ----
  function switchMode(mode) {
    currentMode = mode;
    modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    if (mode === 'rpe') {
      modeIndicator.classList.remove('right');
      rpeSelector.classList.add('visible');
      feelingSelector.classList.remove('visible');
    } else {
      modeIndicator.classList.add('right');
      rpeSelector.classList.remove('visible');
      feelingSelector.classList.add('visible');
    }
    clearSelection();
  }

  function clearSelection() {
    rpeBtns.forEach(b => b.classList.remove('selected'));
    feelingBtns.forEach(b => b.classList.remove('selected'));
    selectedRestTime = 0;
    baseRestTime = 0;
    updateTimerDisplay();
    startBtn.disabled = true;
    timeAdjuster.classList.remove('visible');
  }

  function selectRPE(rpe) {
    rpeBtns.forEach(b => b.classList.toggle('selected', b.dataset.rpe === rpe));
    baseRestTime = RPE_MAP[rpe] || 0;
    selectedRestTime = baseRestTime;
    updateTimerDisplay();
    startBtn.disabled = false;
    timeAdjuster.classList.add('visible');
  }

  function selectFeeling(feeling) {
    feelingBtns.forEach(b => b.classList.toggle('selected', b.dataset.feeling === feeling));
    baseRestTime = FEELING_MAP[feeling] || 0;
    selectedRestTime = baseRestTime;
    updateTimerDisplay();
    startBtn.disabled = false;
    timeAdjuster.classList.add('visible');
  }

  function adjustTime(delta) {
    selectedRestTime = Math.max(15, Math.min(600, selectedRestTime + delta));
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    if (selectedRestTime > 0) {
      timerDisplay.textContent = formatTime(selectedRestTime);
      timerLabel.textContent = 'Temps de repos';
      setRingProgress(1);
    } else {
      timerDisplay.textContent = '--:--';
      timerLabel.textContent = 'Sélectionne un niveau';
      setRingProgress(0);
    }
  }

  // ---- Timer ----
  function startTimer() {
    if (isRunning) { cancelTimer(); return; }
    getAudioContext();
    isRunning = true;
    timerTotal = selectedRestTime;
    timerRemaining = selectedRestTime;
    timerContainer.classList.add('running');
    timerContainer.classList.remove('finished');
    startText.textContent = 'ANNULER';
    startBtn.classList.add('cancel');
    disableSelectors(true);

    timerInterval = setInterval(() => {
      timerRemaining--;
      if (timerRemaining <= 0) { timerRemaining = 0; finishTimer(); }
      timerDisplay.textContent = formatTime(timerRemaining);
      timerLabel.textContent = 'Repos en cours';
      setRingProgress(timerRemaining / timerTotal);
    }, 1000);
  }

  function cancelTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    timerContainer.classList.remove('running', 'finished');
    startText.textContent = 'DÉMARRER';
    startBtn.classList.remove('cancel');
    disableSelectors(false);
    updateTimerDisplay();
  }

  async function finishTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    timerContainer.classList.remove('running');
    timerContainer.classList.add('finished');
    startText.textContent = 'DÉMARRER';
    startBtn.classList.remove('cancel');
    timerLabel.textContent = 'Repos terminé !';
    timerDisplay.textContent = '0:00';
    setRingProgress(0);
    disableSelectors(false);
    await playDoubleBeep();
    setTimeout(() => {
      timerContainer.classList.remove('finished');
      updateTimerDisplay();
    }, 3000);
  }

  function disableSelectors(disabled) {
    rpeBtns.forEach(b => b.disabled = disabled);
    feelingBtns.forEach(b => b.disabled = disabled);
    adjMinus.disabled = disabled;
    adjPlus.disabled = disabled;
    if (disabled) timeAdjuster.classList.remove('visible');
    else if (selectedRestTime > 0) timeAdjuster.classList.add('visible');
  }

  // ---- Settings / Personalization ----
  function openSettingsPanel() { settingsPanel.classList.add('open'); }
  function closeSettingsPanel() { settingsPanel.classList.remove('open'); }

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    themeGrid.querySelectorAll('.theme-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.theme === theme)
    );
    savePrefs();
  }

  function applyPosition(pos) {
    app.className = 'app';
    app.classList.add(`align-${pos}`);
    positionGrid.querySelectorAll('.pos-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.pos === pos)
    );
    savePrefs();
  }

  function applyBgImage(dataUrl) {
    if (dataUrl) {
      bgLayer.style.backgroundImage = `url(${dataUrl})`;
      document.body.classList.add('has-bg-image');
      removeBg.classList.add('visible');
    } else {
      bgLayer.style.backgroundImage = '';
      document.body.classList.remove('has-bg-image');
      removeBg.classList.remove('visible');
    }
  }

  function handleBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      applyBgImage(ev.target.result);
      saveBgImage(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function removeBgImage() {
    applyBgImage(null);
    saveBgImage(null);
    bgUpload.value = '';
  }

  // ---- Persistence ----
  const PREFS_KEY = 'muscle-timer-prefs';
  const BG_KEY = 'muscle-timer-bg';

  function savePrefs() {
    const prefs = {
      theme: document.body.getAttribute('data-theme') || 'night',
      position: getCurrentPosition()
    };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { }
  }

  function saveBgImage(dataUrl) {
    try {
      if (dataUrl) localStorage.setItem(BG_KEY, dataUrl);
      else localStorage.removeItem(BG_KEY);
    } catch (e) { }
  }

  function loadPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY));
      if (prefs) {
        if (prefs.theme) applyTheme(prefs.theme);
        if (prefs.position) applyPosition(prefs.position);
      }
      const bgData = localStorage.getItem(BG_KEY);
      if (bgData) applyBgImage(bgData);
    } catch (e) { }
  }

  function getCurrentPosition() {
    if (app.classList.contains('align-top')) return 'top';
    if (app.classList.contains('align-bottom')) return 'bottom';
    return 'center';
  }

  // ---- Event bindings ----
  // Tab nav
  bottomNav.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab');
    if (tab) switchTab(tab.dataset.tab);
  });

  // Timer
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => { if (!isRunning) switchMode(btn.dataset.mode); });
  });
  rpeBtns.forEach(btn => {
    btn.addEventListener('click', () => { if (!isRunning) selectRPE(btn.dataset.rpe); });
  });
  feelingBtns.forEach(btn => {
    btn.addEventListener('click', () => { if (!isRunning) selectFeeling(btn.dataset.feeling); });
  });
  adjMinus.addEventListener('click', () => !isRunning && adjustTime(-15));
  adjPlus.addEventListener('click', () => !isRunning && adjustTime(15));
  startBtn.addEventListener('click', startTimer);

  // Settings
  openSettings.addEventListener('click', openSettingsPanel);
  closeSettings.addEventListener('click', closeSettingsPanel);
  settingsPanel.addEventListener('click', (e) => { if (e.target === settingsPanel) closeSettingsPanel(); });
  themeGrid.addEventListener('click', (e) => {
    const swatch = e.target.closest('.theme-swatch');
    if (swatch) applyTheme(swatch.dataset.theme);
  });
  positionGrid.addEventListener('click', (e) => {
    const posBtn = e.target.closest('.pos-btn');
    if (posBtn) applyPosition(posBtn.dataset.pos);
  });
  bgUpload.addEventListener('change', handleBgUpload);
  removeBg.addEventListener('click', removeBgImage);

  // ---- Free Timer ----
  function setFreeRingProgress(fraction) {
    const offset = FREE_CIRCUMFERENCE * (1 - fraction);
    freeRingProgress.style.strokeDashoffset = offset;
  }

  function startFreeTimer() {
    if (freeTimerRunning) { cancelFreeTimer(); return; }
    const mins = Math.max(0, parseInt(freeMinInput.value) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(freeSecInput.value) || 0));
    const total = mins * 60 + secs;
    if (total <= 0) { freeMinInput.focus(); return; }
    getAudioContext();
    freeTimerRunning = true;
    freeTimerTotal = total;
    freeTimerRemaining = total;
    freeTimerRingWrap.classList.add('running');
    freeTimerRingWrap.classList.remove('finished');
    freeStartBtn.textContent = '■ STOP';
    freeStartBtn.classList.add('cancel');
    freeTimerInputs.style.opacity = '0.4';
    freeTimerInputs.style.pointerEvents = 'none';
    setFreeRingProgress(1);
    freeTimerDisplay.textContent = formatTime(freeTimerRemaining);
    freeTimerInterval = setInterval(() => {
      freeTimerRemaining--;
      if (freeTimerRemaining <= 0) { freeTimerRemaining = 0; finishFreeTimer(); return; }
      freeTimerDisplay.textContent = formatTime(freeTimerRemaining);
      setFreeRingProgress(freeTimerRemaining / freeTimerTotal);
    }, 1000);
  }

  function cancelFreeTimer() {
    clearInterval(freeTimerInterval);
    freeTimerInterval = null;
    freeTimerRunning = false;
    freeTimerRingWrap.classList.remove('running', 'finished');
    freeStartBtn.textContent = '▶ START';
    freeStartBtn.classList.remove('cancel');
    freeTimerInputs.style.opacity = '';
    freeTimerInputs.style.pointerEvents = '';
    freeTimerDisplay.textContent = '--:--';
    setFreeRingProgress(0);
  }

  async function finishFreeTimer() {
    clearInterval(freeTimerInterval);
    freeTimerInterval = null;
    freeTimerRunning = false;
    freeTimerRingWrap.classList.remove('running');
    freeTimerRingWrap.classList.add('finished');
    freeStartBtn.textContent = '▶ START';
    freeStartBtn.classList.remove('cancel');
    freeTimerInputs.style.opacity = '';
    freeTimerInputs.style.pointerEvents = '';
    freeTimerDisplay.textContent = '0:00';
    setFreeRingProgress(0);
    await playDoubleBeep();
    setTimeout(() => {
      freeTimerRingWrap.classList.remove('finished');
      freeTimerDisplay.textContent = '--:--';
    }, 3000);
  }

  freeStartBtn.addEventListener('click', startFreeTimer);

  // ---- Init ----
  loadPrefs();
  setRingProgress(0);
  setFreeRingProgress(0);

  // Initialize modules
  SessionManager.init();
  ProgressManager.init();
})();
