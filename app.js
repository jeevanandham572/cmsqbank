// =========================================================
// CMS QBank 2018 — Application Logic (Mobile First)
// =========================================================
(function () {
  "use strict";

  // ---- State ----
  const STORAGE_KEY = "cms_qbank_2018_v3";
  let state = {
    currentPaper: null,
    currentSubject: null,
    currentIndex: 0,
    mode: "sequential",
    questionOrder: [],
    answers: { paper1: {}, paper2: {} },
    bookmarks: { paper1: new Set(), paper2: new Set() }
  };

  // ---- DOM Cache & Helpers ----
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      answers: state.answers,
      bookmarks: {
        paper1: [...state.bookmarks.paper1],
        paper2: [...state.bookmarks.paper2]
      }
    }));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.answers) state.answers = d.answers;
      if (d.bookmarks) {
        state.bookmarks.paper1 = new Set(d.bookmarks.paper1 || []);
        state.bookmarks.paper2 = new Set(d.bookmarks.paper2 || []);
      }
    } catch (e) {}
  }

  function initTheme() {
    document.documentElement.setAttribute("data-theme", localStorage.getItem("cms_theme") || "dark");
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("cms_theme", next);
  }

  function showToast(msg, duration = 2000) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    $("#toast-container").appendChild(t);
    setTimeout(() => { t.classList.add("leaving"); setTimeout(() => t.remove(), 300); }, duration);
  }

  // Data helpers
  function getQuestions(paper) { return paper === 1 ? QUESTIONS_DATA.paper1.questions : QUESTIONS_DATA.paper2.questions; }
  function getAnswers(paper) { return paper === 1 ? state.answers.paper1 : state.answers.paper2; }
  function getBookmarks(paper) { return paper === 1 ? state.bookmarks.paper1 : state.bookmarks.paper2; }
  function indexToLetter(i) { return ["A", "B", "C", "D"][i]; }

  function getSubjectStats(paper, subjectKey) {
    const qs = getQuestions(paper).filter(q => !subjectKey || q.subject === subjectKey);
    const ans = getAnswers(paper);
    const total = qs.length;
    const attempted = qs.filter(q => ans[q.id]).length;
    const correct = qs.filter(q => ans[q.id] && ans[q.id].correct).length;
    return { total, attempted, correct };
  }

  // ========================================================
  // VIEW NAVIGATION
  // ========================================================
  function showView(viewName) {
    $$(".view").forEach(v => v.classList.remove("active"));
    $(`#view-${viewName}`).classList.add("active");
    
    // Update both Desktop & Mobile Navs
    $$(".nav-btn, .bnav-btn").forEach(b => b.classList.remove("active"));
    $$(`[data-view="${viewName}"]`).forEach(b => b.classList.add("active"));

    // Scroll to top
    window.scrollTo(0, 0);

    if (viewName === "home") updateHomeStats();
    if (viewName === "subjects") renderSubjectsView(currentPaperTab);
    if (viewName === "results") updateResults();
  }

  // ========================================================
  // HOME STATS
  // ========================================================
  function updateHomeStats() {
    let totalAttempted = 0, totalCorrect = 0;
    [1, 2].forEach(paper => {
      const ans = getAnswers(paper);
      const attempted = Object.keys(ans).length;
      const correct = Object.values(ans).filter(a => a.correct).length;
      totalAttempted += attempted;
      totalCorrect += correct;
      const fill = $(`#prog-p${paper}`);
      const txt = $(`#prog-text-p${paper}`);
      if (fill) fill.style.width = `${(attempted / 120) * 100}%`;
      if (txt) txt.textContent = `${attempted}/120`;
    });
    const acc = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    $("#home-attempted").textContent = totalAttempted;
    $("#home-correct").textContent = totalCorrect;
    $("#home-accuracy").textContent = `${acc}%`;
  }

  // ========================================================
  // SUBJECTS VIEW
  // ========================================================
  let currentPaperTab = "all";

  function renderSubjectsView(paperTab) {
    currentPaperTab = paperTab;
    $$(".paper-tab").forEach(b => b.classList.remove("active"));
    $(`#ptab-${paperTab === "all" ? "all" : paperTab}`).classList.add("active");

    const grid = $("#subject-grid");
    grid.innerHTML = "";

    Object.entries(SUBJECTS).forEach(([key, subj]) => {
      if (paperTab !== "all" && subj.paper !== parseInt(paperTab)) return;

      const stats = getSubjectStats(subj.paper, key);
      const pct = stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0;
      const progPct = stats.total > 0 ? Math.round((stats.attempted / stats.total) * 100) : 0;

      const card = document.createElement("div");
      card.className = "subject-card";
      card.style.setProperty("--subject-color", subj.color);
      card.innerHTML = `
        <div class="subject-card-top">
          <span class="subject-card-icon">${subj.icon}</span>
          <span class="subject-count-badge">${stats.total} Qs</span>
        </div>
        <div class="subject-card-name">${subj.label}</div>
        <div class="subject-paper-tag">Paper ${subj.paper}</div>
        <div class="subject-mini-prog">
          <div class="subject-mini-bar">
            <div class="subject-mini-fill" style="width:${progPct}%"></div>
          </div>
          <span class="subject-mini-text">${stats.attempted}/${stats.total}</span>
        </div>
        <div class="subject-card-start">
          <span>${stats.attempted > 0 ? `${pct}% correct` : "Start"}</span>
          <span>→</span>
        </div>
      `;
      card.addEventListener("click", () => startSubjectPractice(subj.paper, key));
      grid.appendChild(card);
    });
  }

  // ========================================================
  // START PRACTICE
  // ========================================================
  function startPractice(paper) {
    state.currentPaper = paper;
    state.currentSubject = null;
    state.mode = "sequential";
    state.currentIndex = 0;
    buildQuestionOrder();

    $("#practice-title").textContent = `Paper ${paper}`;
    $("#practice-subject-badge").classList.add("hidden");

    resetModeButtons();
    showView("practice");
    renderQuestion("none");
    buildGrid();
  }

  function startSubjectPractice(paper, subjectKey) {
    const subj = SUBJECTS[subjectKey];
    state.currentPaper = paper;
    state.currentSubject = subjectKey;
    state.mode = "sequential";
    state.currentIndex = 0;
    buildQuestionOrder();

    $("#practice-title").textContent = subj.label;
    const badge = $("#practice-subject-badge");
    badge.textContent = `Paper ${paper}`;
    badge.style.background = subj.color;
    badge.classList.remove("hidden");

    resetModeButtons();
    showView("practice");
    renderQuestion("none");
    buildGrid();
  }

  function resetModeButtons() {
    $$(".mode-btn").forEach(b => b.classList.remove("active"));
    $('[data-mode="sequential"]').classList.add("active");
    // Scroll modes to start
    const wrap = $(".mode-scroll-wrap");
    if(wrap) wrap.scrollLeft = 0;
  }

  function buildQuestionOrder() {
    const questions = getQuestions(state.currentPaper);
    const answers = getAnswers(state.currentPaper);
    const bookmarks = getBookmarks(state.currentPaper);

    let pool = questions.map((_, i) => i);
    if (state.currentSubject) {
      pool = pool.filter(i => questions[i].subject === state.currentSubject);
    }

    switch (state.mode) {
      case "sequential": state.questionOrder = pool; break;
      case "random": 
        state.questionOrder = [...pool];
        for (let i = state.questionOrder.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.questionOrder[i], state.questionOrder[j]] = [state.questionOrder[j], state.questionOrder[i]];
        }
        break;
      case "bookmarked": state.questionOrder = pool.filter(i => bookmarks.has(questions[i].id)); break;
      case "wrong": state.questionOrder = pool.filter(i => { const a = answers[questions[i].id]; return a && !a.correct; }); break;
    }
  }

  // ========================================================
  // RENDER QUESTION
  // ========================================================
  function renderQuestion(animation = "none") {
    const card = $("#question-card");
    
    // Handle Swipe Animations
    if (animation === "next") {
        card.className = "question-card swipe-in-right";
    } else if (animation === "prev") {
        card.className = "question-card swipe-in-left";
    } else {
        card.className = "question-card";
    }

    const order = state.questionOrder;
    if (order.length === 0) {
      $("#question-text").textContent = "No questions found for this filter.";
      $("#options-list").innerHTML = "";
      $("#answer-feedback").classList.add("hidden");
      $("#q-number").textContent = "—";
      $("#q-counter").textContent = "0 / 0";
      $("#q-dropped").classList.add("hidden");
      $("#q-subject-tag").classList.add("hidden");
      return;
    }

    const idx = state.currentIndex;
    const questions = getQuestions(state.currentPaper);
    const q = questions[order[idx]];
    const answers = getAnswers(state.currentPaper);
    const bookmarks = getBookmarks(state.currentPaper);
    const userAnswer = answers[q.id];
    const subj = SUBJECTS[q.subject];

    $("#q-number").textContent = `Q.${q.id}`;
    $("#q-counter").textContent = `${idx + 1} / ${order.length}`;

    const subjTag = $("#q-subject-tag");
    if (subj) {
      subjTag.textContent = `${subj.icon} ${subj.label}`;
      subjTag.style.background = subj.color;
      subjTag.classList.remove("hidden");
    } else {
      subjTag.classList.add("hidden");
    }

    $("#q-dropped").classList.toggle("hidden", !q.dropped);
    $("#bookmark-btn").classList.toggle("active", bookmarks.has(q.id));
    $("#question-text").textContent = q.text;

    const optList = $("#options-list");
    optList.innerHTML = "";
    q.options.forEach((opt, i) => {
      const letter = indexToLetter(i);
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.setAttribute("data-option", letter);
      btn.innerHTML = `<span class="option-label">${letter}</span><span class="option-text">${opt}</span>`;

      if (userAnswer) {
        btn.classList.add("disabled");
        if (letter === q.answer) btn.classList.add("correct");
        else if (letter === userAnswer.selected) btn.classList.add("wrong");
        else btn.classList.add("faded");
      } else if (!q.dropped) {
        btn.addEventListener("click", () => handleAnswer(q, letter));
      } else {
        btn.classList.add("disabled", "faded");
      }
      optList.appendChild(btn);
    });

    const feedback = $("#answer-feedback");
    feedback.style.cssText = "";
    
    const expBox = $("#explanation-box");
    expBox.classList.add("hidden");
    $("#explanation-content").innerHTML = "";
    
    if (userAnswer) {
      feedback.classList.remove("hidden", "correct-feedback", "wrong-feedback");
      if (userAnswer.correct) {
        feedback.classList.add("correct-feedback");
        $("#feedback-icon").textContent = "✅";
        $("#feedback-text").textContent = "Correct!";
      } else {
        feedback.classList.add("wrong-feedback");
        $("#feedback-icon").textContent = "❌";
        $("#feedback-text").textContent = `Answer: (${q.answer})`;
      }
      if (q.explanation) {
        expBox.classList.remove("hidden");
        $("#explanation-content").innerHTML = q.explanation;
      }
    } else if (q.dropped) {
      feedback.classList.remove("hidden", "correct-feedback", "wrong-feedback");
      feedback.style.background = "var(--dropped-bg)";
      feedback.style.color = "var(--dropped)";
      feedback.style.border = "1px solid var(--dropped)";
      $("#feedback-icon").textContent = "⚠️";
      $("#feedback-text").textContent = "Dropped by UPSC";
      if (q.explanation) {
        expBox.classList.remove("hidden");
        $("#explanation-content").innerHTML = q.explanation;
      }
    } else {
      feedback.classList.add("hidden");
    }

    $("#prev-btn").disabled = idx === 0;
    $("#next-btn").disabled = idx >= order.length - 1;
    updateGridHighlight();
  }

  function handleAnswer(q, letter) {
    const isCorrect = letter === q.answer;
    const answers = getAnswers(state.currentPaper);
    answers[q.id] = { selected: letter, correct: isCorrect };
    saveState();
    renderQuestion("none");
    updateHomeStats();
  }

  // ========================================================
  // QUESTION GRID DRAWER
  // ========================================================
  function buildGrid() {
    const grid = $("#q-grid");
    grid.innerHTML = "";
    state.questionOrder.forEach((qIdx, orderIdx) => {
      const q = getQuestions(state.currentPaper)[qIdx];
      const btn = document.createElement("button");
      btn.className = "q-grid-btn";
      btn.textContent = q.id;
      btn.setAttribute("data-order-idx", orderIdx);
      btn.addEventListener("click", () => { 
          state.currentIndex = orderIdx; 
          renderQuestion("none"); 
          closeGridDrawer();
      });
      grid.appendChild(btn);
    });
    updateGridHighlight();
  }

  function updateGridHighlight() {
    $$(".q-grid-btn").forEach(btn => {
      const orderIdx = parseInt(btn.getAttribute("data-order-idx"), 10);
      const qIdx = state.questionOrder[orderIdx];
      const q = getQuestions(state.currentPaper)[qIdx];
      const a = getAnswers(state.currentPaper)[q.id];
      const bm = getBookmarks(state.currentPaper);
      btn.className = "q-grid-btn";
      if (orderIdx === state.currentIndex) btn.classList.add("current");
      if (a) btn.classList.add(a.correct ? "answered-correct" : "answered-wrong");
      if (bm.has(q.id)) btn.classList.add("bookmarked");
    });
  }

  function openGridDrawer() {
    $("#q-grid-drawer").classList.add("open");
    $("#q-grid-overlay").classList.remove("hidden");
    document.body.style.overflow = "hidden"; // Prevent background scroll
  }

  function closeGridDrawer() {
    $("#q-grid-drawer").classList.remove("open");
    $("#q-grid-overlay").classList.add("hidden");
    document.body.style.overflow = "";
  }

  // ========================================================
  // RESULTS VIEW
  // ========================================================
  function updateResults() {
    [1, 2].forEach(paper => {
      const ans = getAnswers(paper);
      const attempted = Object.keys(ans).length;
      const correct = Object.values(ans).filter(a => a.correct).length;
      const wrong = attempted - correct;
      const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

      $(`#r-attempted-p${paper}`).textContent = attempted;
      $(`#r-correct-p${paper}`).textContent = correct;
      $(`#r-wrong-p${paper}`).textContent = wrong;
      $(`#r-unattempted-p${paper}`).textContent = 120 - attempted;
      $(`#ring-label-p${paper}`).textContent = `${pct}%`;

      const circ = 2 * Math.PI * 52;
      const ring = $(`#ring-p${paper}`);
      ring.style.strokeDashoffset = circ - (pct / 100) * circ;
      ring.style.transition = "stroke-dashoffset 1s ease";

      renderBreakdown(paper);
    });
  }

  function renderBreakdown(paper) {
    const container = $(`#breakdown-p${paper}`);
    container.innerHTML = "";

    const paperSubjects = Object.entries(SUBJECTS).filter(([, s]) => s.paper === paper);
    const ans = getAnswers(paper);

    paperSubjects.forEach(([key, subj]) => {
      const qs = getQuestions(paper).filter(q => q.subject === key);
      const attempted = qs.filter(q => ans[q.id]).length;
      const correct = qs.filter(q => ans[q.id] && ans[q.id].correct).length;
      const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
      const fillPct = qs.length > 0 ? (correct / qs.length) * 100 : 0;

      const row = document.createElement("div");
      row.className = "breakdown-row";
      row.innerHTML = `
        <span class="breakdown-icon">${subj.icon}</span>
        <span class="breakdown-label">${subj.label}</span>
        <div class="breakdown-bar">
          <div class="breakdown-fill" style="width:${fillPct}%;background:${subj.color}"></div>
        </div>
        <span class="breakdown-score">${attempted > 0 ? `${pct}%` : "—"}</span>
      `;
      container.appendChild(row);
    });
  }

  // ========================================================
  // SWIPE HANDLING (Mobile)
  // ========================================================
  let touchStartX = 0;
  let touchEndX = 0;
  const SWIPE_THRESHOLD = 50;

  function handleSwipe() {
    if (!state.currentPaper) return;
    const diffX = touchEndX - touchStartX;
    if (Math.abs(diffX) < SWIPE_THRESHOLD) return;

    if (diffX > 0) {
      // Swiped Right -> Go Previous
      if (state.currentIndex > 0) {
        state.currentIndex--;
        renderQuestion("prev");
      }
    } else {
      // Swiped Left -> Go Next
      if (state.currentIndex < state.questionOrder.length - 1) {
        state.currentIndex++;
        renderQuestion("next");
      }
    }
  }

  // ========================================================
  // BIND EVENTS
  // ========================================================
  function bindEvents() {
    $("#theme-toggle").addEventListener("click", toggleTheme);

    // Nav linking
    $$(".nav-btn, .bnav-btn").forEach(btn => {
      btn.addEventListener("click", () => showView(btn.getAttribute("data-view")));
    });

    $$(".start-btn").forEach(btn => {
      btn.addEventListener("click", () => startPractice(parseInt(btn.getAttribute("data-paper"), 10)));
    });

    $("#back-to-home").addEventListener("click", () => showView("home"));

    // Prev / Next
    $("#prev-btn").addEventListener("click", () => {
      if (state.currentIndex > 0) { state.currentIndex--; renderQuestion("prev"); }
    });
    $("#next-btn").addEventListener("click", () => {
      if (state.currentIndex < state.questionOrder.length - 1) { state.currentIndex++; renderQuestion("next"); }
    });

    // Swipe gestures
    const qArea = $("#question-area");
    qArea.addEventListener("touchstart", e => touchStartX = e.changedTouches[0].screenX, {passive: true});
    qArea.addEventListener("touchend", e => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, {passive: true});

    // Modes
    $$(".mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.mode = btn.getAttribute("data-mode");
        state.currentIndex = 0;
        $$(".mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        buildQuestionOrder();
        renderQuestion("none");
        buildGrid();
        if (state.questionOrder.length === 0) showToast("No questions match this filter.");
      });
    });

    // Bookmark
    $("#bookmark-btn").addEventListener("click", () => {
      if (!state.currentPaper || !state.questionOrder.length) return;
      const q = getQuestions(state.currentPaper)[state.questionOrder[state.currentIndex]];
      const bm = getBookmarks(state.currentPaper);
      if (bm.has(q.id)) { bm.delete(q.id); showToast("Removed"); }
      else { bm.add(q.id); showToast("Saved ★"); }
      saveState();
      renderQuestion("none");
    });

    // Grid Drawer
    $("#q-grid-toggle").addEventListener("click", openGridDrawer);
    $("#q-grid-close").addEventListener("click", closeGridDrawer);
    $("#q-grid-overlay").addEventListener("click", closeGridDrawer);

    // Subject tabs
    $$(".paper-tab").forEach(btn => {
      btn.addEventListener("click", () => renderSubjectsView(btn.getAttribute("data-paper-tab")));
    });

    // Resets
    $("#reset-p1").addEventListener("click", () => {
      if (confirm("Reset Paper I?")) {
        state.answers.paper1 = {}; state.bookmarks.paper1 = new Set();
        saveState(); updateResults(); updateHomeStats(); showToast("Reset done");
      }
    });
    $("#reset-p2").addEventListener("click", () => {
      if (confirm("Reset Paper II?")) {
        state.answers.paper2 = {}; state.bookmarks.paper2 = new Set();
        saveState(); updateResults(); updateHomeStats(); showToast("Reset done");
      }
    });
    $("#reset-all").addEventListener("click", () => {
      if (confirm("Reset ALL?")) {
        state.answers = { paper1: {}, paper2: {} }; state.bookmarks = { paper1: new Set(), paper2: new Set() };
        saveState(); updateResults(); updateHomeStats(); showToast("Reset done");
      }
    });
  }

  function init() {
    initTheme();
    loadState();
    bindEvents();
    updateHomeStats();
    showView("home");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

})();
