(() => {
  'use strict';
  const RESULTS_KEY = 'nclex-clean-results-v1';
  const STATE_KEY = 'nclex-clean-run-state-v1';
  const $ = (id) => document.getElementById(id);
  const pct = (value, total) => total > 0 ? Math.round((Number(value || 0) / Number(total || 0)) * 100) : 0;
  const getJSON = (key, fallback = {}) => {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (_) { return fallback; }
  };
  const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = String(value); };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  let catalog = [];
  let results = getJSON(RESULTS_KEY, {});
  let runStates = getJSON(STATE_KEY, {});

  function summarizeState(test, state) {
    const total = Number(test.questions || state?.questions?.length || 0);
    const questions = Array.isArray(state?.questions) ? state.questions : [];
    let attempted = 0, correct = 0, incorrect = 0, partial = 0;
    questions.forEach((q) => {
      const answered = Boolean(q?.submitted) && Array.isArray(q?.userAnswer) && q.userAnswer.length > 0;
      if (!answered) return;
      attempted += 1;
      const qMax = Math.max(1, Number(q?.qMax || 1));
      const qScore = Math.max(0, Number(q?.qScore || 0));
      if (qScore >= qMax) correct += 1;
      else if (qScore <= 0) incorrect += 1;
      else partial += 1;
    });
    return { total, attempted, correct, incorrect, partial, finished:Boolean(state?.finished) };
  }

  function statsFor(test) {
    const state = runStates[test.id];
    const result = results[test.id];
    if (state && !state.finished) {
      const live = summarizeState(test, state);
      return { ...live, status:(live.attempted > 0 || Number(state.currentIndex || 0) > 0) ? 'progress' : 'new' };
    }
    if (result) {
      return {
        total:Number(test.questions || result.total || 0),
        attempted:Number(result.attempted || 0),
        correct:Number(result.correct || 0),
        incorrect:Number(result.incorrect || 0),
        partial:Number(result.partial || 0),
        finished:true,
        status:'completed'
      };
    }
    if (state && state.finished) {
      const done = summarizeState(test, state);
      return { ...done, status:'completed' };
    }
    return { total:Number(test.questions || 0), attempted:0, correct:0, incorrect:0, partial:0, finished:false, status:'new' };
  }

  function statusInfo(status) {
    if (status === 'completed') return { icon:'verified', label:'Completed' };
    if (status === 'progress') return { icon:'play_circle', label:'In progress' };
    return { icon:'fiber_new', label:'New' };
  }

  function goToTest(test) {
    const params = new URLSearchParams({ id:test.id, file:test.file, title:test.title || 'NCLEX RN Test' });
    location.href = `runner.html?${params.toString()}`;
  }

  function clearTest(test) {
    delete results[test.id];
    delete runStates[test.id];
    saveJSON(RESULTS_KEY, results);
    saveJSON(STATE_KEY, runStates);
  }

  function renderDashboard() {
    const all = catalog.map(statsFor);
    const total = all.reduce((sum, x) => sum + x.total, 0);
    const used = Math.min(total, all.reduce((sum, x) => sum + x.attempted, 0));
    const unused = Math.max(0, total - used);
    const correct = all.reduce((sum, x) => sum + x.correct, 0);
    const incorrect = all.reduce((sum, x) => sum + x.incorrect, 0);
    const partial = all.reduce((sum, x) => sum + x.partial, 0);
    const usageP = pct(used, total);
    const classified = correct + incorrect + partial;
    const correctP = pct(correct, classified);
    const incorrectP = pct(incorrect, classified);
    const partialP = pct(partial, classified);

    setText('totalQuestions', total);
    setText('usedQuestions', used);
    setText('unusedQuestions', unused);
    setText('usagePercent', `${usageP}%`);
    setText('usedPercent', `${usageP}%`);
    setText('unusedPercent', `${pct(unused,total)}%`);
    setText('totalCorrect', correct);
    setText('totalIncorrect', incorrect);
    setText('totalPartial', partial);
    setText('correctPercent', `${correctP}%`);
    setText('incorrectPercent', `${incorrectP}%`);
    setText('partialPercent', `${partialP}%`);
    setText('resultPercent', `${correctP}%`);
    $('usageRing')?.style.setProperty('--used-angle', `${usageP * 3.6}deg`);
    $('resultRing')?.style.setProperty('--correct-end', `${correctP * 3.6}deg`);
    $('resultRing')?.style.setProperty('--incorrect-end', `${(correctP + incorrectP) * 3.6}deg`);
    $('resultRing')?.style.setProperty('--partial-end', `${(correctP + incorrectP + partialP) * 3.6}deg`);
  }

  function renderCatalog() {
    const grid = $('testGrid');
    grid.innerHTML = '';
    catalog.forEach((test) => {
      const s = statsFor(test);
      const status = statusInfo(s.status);
      const usageP = pct(s.attempted, s.total);
      const correctP = pct(s.correct, s.attempted);
      const incorrectP = pct(s.incorrect, s.attempted);
      const partialP = pct(s.partial, s.attempted);
      const correctEnd = pct(s.correct, s.total) * 3.6;
      const incorrectEnd = correctEnd + pct(s.incorrect, s.total) * 3.6;
      const partialEnd = incorrectEnd + pct(s.partial, s.total) * 3.6;

      const card = document.createElement('article');
      card.className = 'test-card';
      card.innerHTML = `
        <div class="test-card-head">
          <h2>${escapeHTML(test.title || 'Untitled Test')}</h2>
          <span class="status-pill"><span class="material-symbols-outlined" aria-hidden="true">${status.icon}</span>${status.label}</span>
        </div>
        <div class="card-body">
          <div class="card-stats">
            <div class="card-row"><span class="label">USED QUE'S:</span><span class="value">${s.attempted} / ${s.total}</span><em class="mini-pill pill-blue">${usageP}%</em></div>
            <div class="card-row"><span class="label">CORRECT QUE'S:</span><span class="value">${s.correct}</span><em class="mini-pill pill-green">${correctP}%</em></div>
            <div class="card-row"><span class="label">INCORRECT QUE'S:</span><span class="value">${s.incorrect}</span><em class="mini-pill pill-red">${incorrectP}%</em></div>
            <div class="card-row"><span class="label">PARTIALLY INCORR:</span><span class="value">${s.partial}</span><em class="mini-pill pill-yellow">${partialP}%</em></div>
          </div>
          <div class="meter card-meter" style="background:conic-gradient(var(--green) 0 ${correctEnd}deg,var(--red) ${correctEnd}deg ${incorrectEnd}deg,var(--yellow) ${incorrectEnd}deg ${partialEnd}deg,#6f7a8c ${partialEnd}deg 360deg)">
            <div class="meter-core"><strong>${usageP}%</strong><span>USED</span></div>
          </div>
        </div>
        <div class="card-actions"></div>`;

      const actions = card.querySelector('.card-actions');
      if (s.status === 'progress') {
        const resume = document.createElement('button');
        resume.className = 'card-action';
        resume.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>Resume';
        resume.addEventListener('click', () => goToTest(test));
        const restart = document.createElement('button');
        restart.className = 'card-action light';
        restart.innerHTML = '<span class="material-symbols-outlined">refresh</span>Restart';
        restart.addEventListener('click', () => { clearTest(test); goToTest(test); });
        actions.append(resume, restart);
      } else if (s.status === 'completed') {
        const retake = document.createElement('button');
        retake.className = 'card-action light single';
        retake.innerHTML = '<span class="material-symbols-outlined">refresh</span>Retake';
        retake.addEventListener('click', () => { clearTest(test); goToTest(test); });
        actions.append(retake);
      } else {
        const start = document.createElement('button');
        start.className = 'card-action single';
        start.innerHTML = '<span class="material-symbols-outlined">rocket_launch</span>Start';
        start.addEventListener('click', () => goToTest(test));
        actions.append(start);
      }
      grid.appendChild(card);
    });
  }

  async function init() {
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
      const response = await fetch('data/tests.json', { cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      catalog = await response.json();
      if (!Array.isArray(catalog)) throw new Error('Catalog must be an array.');
      renderDashboard();
      renderCatalog();
    } catch (error) {
      const notice = $('notice');
      notice.classList.remove('hidden');
      notice.textContent = 'The question catalog could not be loaded. Open this repository through a local or hosted web server.';
      console.error(error);
    }
  }
  init();
})();
