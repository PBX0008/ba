(() => {
  'use strict';
  const RESULTS_KEY = 'nclex-clean-results-v1';
  const STATE_KEY = 'nclex-clean-run-state-v1';
  const THEME_KEY = 'nclex-clean-theme';
  const $ = (id) => document.getElementById(id);
  const pct = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;
  const getJSON = (key, fallback = {}) => {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (_) { return fallback; }
  };
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = String(value); };

  let catalog = [];
  let results = getJSON(RESULTS_KEY, {});
  let runStates = getJSON(STATE_KEY, {});

  function applyTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');
    const icon = $('themeBtn')?.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    localStorage.setItem(THEME_KEY, theme);
  }

  function renderDashboard() {
    const total = catalog.reduce((sum, test) => sum + Number(test.questions || 0), 0);
    const values = Object.values(results);
    const used = Math.min(total, values.reduce((sum, result) => sum + Number(result.attempted || 0), 0));
    const unused = Math.max(0, total - used);
    const correct = values.reduce((sum, result) => sum + Number(result.correct || 0), 0);
    const incorrect = values.reduce((sum, result) => sum + Number(result.incorrect || 0), 0);
    const partial = values.reduce((sum, result) => sum + Number(result.partial || 0), 0);
    const classified = correct + incorrect + partial;
    const usage = pct(used, total);
    const correctP = pct(correct, classified);
    const incorrectP = pct(incorrect, classified);
    const partialP = pct(partial, classified);

    setText('totalQuestions', total);
    setText('usedQuestions', used);
    setText('unusedQuestions', unused);
    setText('usagePercent', `${usage}%`);
    setText('usedPercent', `${usage}%`);
    setText('unusedPercent', `${pct(unused, total)}%`);
    setText('totalCorrect', correct);
    setText('totalIncorrect', incorrect);
    setText('totalPartial', partial);
    setText('correctPercent', `${correctP}%`);
    setText('incorrectPercent', `${incorrectP}%`);
    setText('partialPercent', `${partialP}%`);
    setText('resultPercent', `${correctP}%`);
    $('usageRing')?.style.setProperty('--used-angle', `${usage * 3.6}deg`);
    $('resultRing')?.style.setProperty('--correct-end', `${correctP * 3.6}deg`);
    $('resultRing')?.style.setProperty('--incorrect-end', `${(correctP + incorrectP) * 3.6}deg`);
    $('resultRing')?.style.setProperty('--partial-end', `${(correctP + incorrectP + partialP) * 3.6}deg`);
  }

  function testProgress(test) {
    const result = results[test.id];
    const state = runStates[test.id];
    const attempted = result?.attempted ?? state?.attempted ?? 0;
    return {
      attempted: Math.min(Number(test.questions || 0), Number(attempted || 0)),
      score: result ? Number(result.percent || 0) : null,
      resumable: Boolean(state && !state.finished && (state.attempted > 0 || state.currentIndex > 0))
    };
  }

  function renderCatalog() {
    const grid = $('testGrid');
    grid.innerHTML = '';
    setText('testCount', `${catalog.length} test${catalog.length === 1 ? '' : 's'}`);
    catalog.forEach((test) => {
      const progress = testProgress(test);
      const total = Number(test.questions || 0);
      const progressPct = pct(progress.attempted, total);
      const card = document.createElement('article');
      card.className = 'test-card';
      card.innerHTML = `
        <div class="test-card-head">
          <span class="test-icon"><span class="material-symbols-outlined">description</span></span>
          <span class="question-count">${total} questions</span>
        </div>
        <h3>${escapeHTML(test.title || 'Untitled Test')}</h3>
        <p>${escapeHTML(test.description || `${total} questions`)}</p>
        <div class="test-progress">
          <div class="test-progress-row"><span>${progress.attempted} used</span><span>${progress.score === null ? `${progressPct}% complete` : `${progress.score}% last score`}</span></div>
          <div class="progress-track"><span style="width:${progressPct}%"></span></div>
          <button class="start-button" type="button"><span class="material-symbols-outlined">${progress.resumable ? 'play_circle' : 'arrow_forward'}</span>${progress.resumable ? 'Resume Test' : 'Open Test'}</button>
        </div>`;
      card.querySelector('button').addEventListener('click', () => {
        const params = new URLSearchParams({ id: test.id, file: test.file, title: test.title || 'NCLEX RN Test' });
        location.href = `runner.html?${params.toString()}`;
      });
      grid.appendChild(card);
    });
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  }

  async function init() {
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
    $('themeBtn')?.addEventListener('click', () => applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
    $('clearProgressBtn')?.addEventListener('click', () => {
      if (!confirm('Clear all saved test progress and results?')) return;
      localStorage.removeItem(RESULTS_KEY);
      localStorage.removeItem(STATE_KEY);
      results = {};
      runStates = {};
      renderDashboard();
      renderCatalog();
    });
    try {
      const response = await fetch('data/tests.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      catalog = await response.json();
      if (!Array.isArray(catalog)) throw new Error('Catalog must be an array.');
      renderDashboard();
      renderCatalog();
    } catch (error) {
      const notice = $('notice');
      notice.classList.remove('hidden');
      notice.textContent = 'The question catalog could not be loaded. Open the repository through a local or hosted web server.';
      console.error(error);
    }
  }
  init();
})();
