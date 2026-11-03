(() => {
  "use strict";
  const KEY = "cms_qbank_2026_v1";
  const EXTRA_KEY = "cms_qbank_2026_ui_v1";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const paperKey = paper => `paper${paper}`;
  const questions = paper => QUESTIONS_DATA[paperKey(paper)].questions;
  const allSubjects = Object.entries(SUBJECTS);
  const state = {
    view: "home", paper: 1, subjectPaper: 1, subject: null, mode: "sequential", order: [], index: 0,
    answers: { paper1: {}, paper2: {} }, bookmarks: { paper1: new Set(), paper2: new Set() },
    notes: {}, confidence: {}, activity: [], bookmarkLists: [], activeBookmarkList: null,
    visited: { paper1: new Set(), paper2: new Set() }, reviewMarks: { paper1: new Set(), paper2: new Set() },
    pendingRef: "", pendingAnswer: null
  };

  function load() {
    try {
      const old = JSON.parse(localStorage.getItem(KEY) || "{}");
      state.answers.paper1 = old.answers?.paper1 || {};
      state.answers.paper2 = old.answers?.paper2 || {};
      state.bookmarks.paper1 = new Set(old.bookmarks?.paper1 || []);
      state.bookmarks.paper2 = new Set(old.bookmarks?.paper2 || []);
      const extra = JSON.parse(localStorage.getItem(EXTRA_KEY) || "{}");
      state.notes = extra.notes || {};
      state.confidence = extra.confidence || {};
      state.activity = Array.isArray(extra.activity) ? extra.activity : [];
      for (const paper of [1, 2]) {
        state.visited[paperKey(paper)] = new Set(extra.visited?.[paperKey(paper)] || []);
        state.reviewMarks[paperKey(paper)] = new Set(extra.reviewMarks?.[paperKey(paper)] || []);
      }
      state.subjectPaper = Number(localStorage.getItem("cms_subject_paper")) === 2 ? 2 : 1;
      state.bookmarkLists = Array.isArray(extra.bookmarkLists) ? extra.bookmarkLists.slice(0, 3)
        .filter(list => typeof list.id === "string" && typeof list.name === "string")
        .map(list => ({ id: list.id, name: list.name.slice(0, 32), questions: Array.isArray(list.questions) ? [...new Set(list.questions.filter(ref => typeof ref === "string"))] : [] })) : [];
      document.documentElement.dataset.theme = localStorage.getItem("cms_theme") || "light";
    } catch { document.documentElement.dataset.theme = "light"; }
    syncTheme();
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify({ answers: state.answers, bookmarks: {
      paper1: [...state.bookmarks.paper1], paper2: [...state.bookmarks.paper2]
    }}));
    localStorage.setItem(EXTRA_KEY, JSON.stringify({
      notes: state.notes, confidence: state.confidence, activity: state.activity.slice(-300), bookmarkLists: state.bookmarkLists,
      visited: { paper1: [...state.visited.paper1], paper2: [...state.visited.paper2] },
      reviewMarks: { paper1: [...state.reviewMarks.paper1], paper2: [...state.reviewMarks.paper2] }
    }));
  }
  function syncTheme() {
    const dark = document.documentElement.dataset.theme === "dark";
    $("#theme-toggle").textContent = dark ? "☀" : "☾";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#111111" : "#ffffff";
  }
  function toast(message) {
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = message;
    $("#toast-container").append(el);
    setTimeout(() => { el.classList.add("leaving"); setTimeout(() => el.remove(), 300); }, 2200);
  }
  function answerMap(paper) { return state.answers[paperKey(paper)]; }
  function savedSet(paper) { return state.bookmarks[paperKey(paper)]; }
  function subjectQuestions(paper, key) { return questions(paper).filter(q => !key || q.subject === key); }
  function subjectStats(paper, key) {
    const qs = subjectQuestions(paper, key), map = answerMap(paper);
    const attempted = qs.filter(q => map[q.id]).length;
    const correct = qs.filter(q => map[q.id]?.correct).length;
    return { total: qs.length, attempted, correct, wrong: attempted - correct, accuracy: attempted ? Math.round(correct / attempted * 100) : 0 };
  }
  function pct(done, total) { return total ? Math.round(done / total * 100) : 0; }
  function recommendation() {
    const stats = allSubjects.map(([key, data]) => ({ key, paper: data.paper, label: data.label, ...subjectStats(data.paper, key) }))
      .filter(s => s.total > 0);
    const started = stats.filter(s => s.attempted > 0 && s.attempted < s.total);
    if (started.length) return started.sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted)[0];
    return stats.find(s => s.attempted === 0) || stats.sort((a, b) => a.accuracy - b.accuracy)[0];
  }
  function recommendText(s) {
    if (!s) return "Choose a subject to start practicing.";
    if (s.attempted === 0) return `Start ${s.label}. It has ${s.total} questions waiting for you.`;
    return `Focus on ${s.label}. You have answered ${s.attempted} of ${s.total} questions with ${s.accuracy}% accuracy.`;
  }
  function showView(name) {
    if (name !== "practice" && $("#practice-bookmarks-dialog").open) $("#practice-bookmarks-dialog").close();
    if (name !== "practice" && $("#exam-instructions-dialog").open) $("#exam-instructions-dialog").close();
    if (name === "practice" && state.mode === "custom" && state.view !== "practice") {
      const list = state.bookmarkLists.find(item => item.id === state.activeBookmarkList);
      if (!list?.questions.some(ref => ref.startsWith(`${state.paper}:`))) {
        startPractice(state.paper);
        return;
      }
      buildOrder();
    }
    if (name === "practice" && !state.order.length && state.view !== "practice") {
      startPractice(state.paper);
      return;
    }
    state.view = name;
    $$(".view").forEach(el => el.classList.toggle("active", el.id === `view-${name}`));
    $$(".nav-btn,.bnav-btn").forEach(el => {
      const active = el.dataset.view === name;
      el.classList.toggle("active", active);
      if (active) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
    });
    if (name === "subjects") renderSubjects();
    if (name === "practice") renderQuestion();
    if (name === "results") renderResults();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderSubjects() {
    $("#subject-sections").replaceChildren();
    $$(".subject-paper-tab").forEach(tab => {
      const selected = Number(tab.dataset.subjectPaper) === state.subjectPaper;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });
    for (const paper of [state.subjectPaper]) {
      let items = allSubjects.filter(([, data]) => data.paper === paper).map(([key, data]) => ({
        key, label: data.label, paper, ...subjectStats(paper, key)
      }));
      if (!items.length) continue;
      const section = document.createElement("section"); section.className = "subject-section";
      const total = items.reduce((n, s) => n + s.total, 0), done = items.reduce((n, s) => n + s.attempted, 0);
      section.innerHTML = `<div class="section-title"><svg><use href="#i-clipboard"/></svg><h2>Paper ${paper === 1 ? "I" : "II"} Subjects (${items.length})</h2><span></span><small>${total} questions · ${done} attempted</small></div><div class="subject-grid subject-page-grid"></div>`;
      const grid = section.querySelector(".subject-grid");
      items.forEach(s => {
        const card = document.createElement("button"); card.className = "subject-card"; card.type = "button";
        card.innerHTML = `<div class="subject-card-top"><span>Paper ${paper === 1 ? "I" : "II"}</span><span>${s.total} Qs</span></div><div class="subject-card-name"></div><div class="subject-mini-prog"><div class="progress-track"><span style="width:${pct(s.attempted,s.total)}%"></span></div><small>${s.attempted}/${s.total}</small></div><div class="subject-card-foot"><span>${s.attempted ? `${s.accuracy}% accuracy` : "Not attempted"}</span><span>${s.attempted ? "Continue" : "Start"} →</span></div>`;
        card.querySelector(".subject-card-name").textContent = s.label;
        card.setAttribute("aria-label", `Practice ${s.label}, Paper ${paper}, ${s.attempted} of ${s.total} attempted`);
        card.addEventListener("click", () => startPractice(paper, s.key));
        grid.append(card);
      });
      $("#subject-sections").append(section);
    }
  }

  function buildOrder() {
    const pool = questions(state.paper).map((_, i) => i).filter(i => !state.subject || questions(state.paper)[i].subject === state.subject);
    if (state.mode === "custom") {
      const list = state.bookmarkLists.find(item => item.id === state.activeBookmarkList);
      state.order = pool.filter(i => list?.questions.includes(`${state.paper}:${questions(state.paper)[i].id}`));
    }
    else if (state.mode === "bookmarked") state.order = pool.filter(i => savedSet(state.paper).has(questions(state.paper)[i].id));
    else if (state.mode === "wrong") state.order = pool.filter(i => answerMap(state.paper)[questions(state.paper)[i].id] && !answerMap(state.paper)[questions(state.paper)[i].id].correct);
    else if (state.mode === "random") {
      state.order = [...pool];
      for (let i = state.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
      }
    } else state.order = pool;
    state.index = 0;
  }
  function startPractice(paper, subject = null, mode = "sequential", listId = null) {
    if ($("#practice-bookmarks-dialog").open) $("#practice-bookmarks-dialog").close();
    state.paper = paper; state.subject = subject; state.mode = mode; state.activeBookmarkList = listId; state.pendingRef = "";
    buildOrder();
    const list = state.bookmarkLists.find(item => item.id === listId);
    $$(".exam-paper-tab").forEach(tab => {
      const selected = Number(tab.dataset.examPaper) === paper;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });
    $("#exam-section-label").textContent = list ? list.name : subject ? SUBJECTS[subject].label : `Paper ${paper === 1 ? "I" : "II"}`;
    $("#exam-palette-heading").textContent = `Paper ${paper === 1 ? "I" : "II"}`;
    $("[data-mobile-palette-heading]").textContent = `Paper ${paper === 1 ? "I" : "II"}`;
    $("#practice-title").textContent = list ? list.name : subject ? SUBJECTS[subject].label : `Paper ${paper === 1 ? "I" : "II"}`;
    $("#practice-breadcrumb").textContent = list ? `Paper ${paper === 1 ? "I" : "II"}  ›  Custom bookmarks` : subject ? `Paper ${paper === 1 ? "I" : "II"}  ›  ${SUBJECTS[subject].label}` : `UPSC CMS 2026  ›  Paper ${paper === 1 ? "I" : "II"}`;
    showView("practice"); renderGrid();
  }
  function currentQuestion() { return state.order.length ? questions(state.paper)[state.order[state.index]] : null; }
  function questionRef(q = currentQuestion()) { return q ? `${state.paper}:${q.id}` : ""; }
  function renderSessionStats() {
    const pool = state.order.map(index => questions(state.paper)[index]);
    const map = answerMap(state.paper);
    const attempted = pool.filter(q => map[q.id]).length;
    $("#exam-progress-label").textContent = `${attempted} of ${pool.length} answered`;
    const visited = state.visited[paperKey(state.paper)], review = state.reviewMarks[paperKey(state.paper)];
    const counts = {
      answered: pool.filter(q => map[q.id] && !review.has(q.id)).length,
      unanswered: pool.filter(q => visited.has(q.id) && !map[q.id] && !review.has(q.id)).length,
      unvisited: pool.filter(q => !visited.has(q.id) && !map[q.id] && !review.has(q.id)).length,
      review: pool.filter(q => review.has(q.id) && !map[q.id]).length,
      "review-answered": pool.filter(q => review.has(q.id) && map[q.id]).length
    };
    for (const [status, count] of Object.entries(counts)) {
      const desktop = status === "review-answered" ? "#exam-review-answered-count" : `#exam-${status}-count`;
      $(desktop).textContent = count;
      $(`[data-exam-count="${status}"]`).textContent = count;
    }
  }
  function renderQuestion() {
    if (state.view !== "practice") return;
    const q = currentQuestion();
    const ref = questionRef(q);
    if (state.pendingRef !== ref) {
      state.pendingRef = ref;
      state.pendingAnswer = q ? answerMap(state.paper)[q.id]?.selected || null : null;
    }
    if (q && !state.visited[paperKey(state.paper)].has(q.id)) {
      state.visited[paperKey(state.paper)].add(q.id);
      save();
    }
    $("#q-counter").textContent = `${q ? state.index + 1 : 0} of ${state.order.length}`;
    $("#q-number").textContent = q ? `Question no : ${q.id}` : "No questions";
    $("#q-subject-tag").textContent = q ? SUBJECTS[q.subject]?.label || "" : "";
    $("#q-dropped").classList.toggle("hidden", !q?.dropped);
    $("#question-text").textContent = q ? q.text : state.mode === "custom" ? "No questions are in this bookmark list for this paper." : "No questions match this practice session.";
    $("#question-text").classList.toggle("hidden", !!q?.image);
    $("#question-context-wrap").classList.toggle("hidden", !q?.contextText);
    $("#question-context-text").textContent = q?.contextText || "";
    const scan = $("#question-scan");
    scan.classList.toggle("hidden", !q?.image);
    $("#question-scan-link").classList.toggle("hidden", !q?.image);
    if (q?.image) {
      scan.src = q.image;
      $("#question-scan-link").href = q.image;
      scan.alt = `UPSC CMS 2026 Paper ${state.paper === 1 ? "I" : "II"}, Series A, question ${q.id} with its printed answer choices`;
    } else scan.removeAttribute("src");
    $("#question-source").textContent = q?.image
      ? "2026 Series A · Open the question image to enlarge · Provisional answer key"
      : "2026 Series A · Transcribed from the question paper · Provisional answer key";
    $("#options-list").replaceChildren();
    $("#answer-feedback").classList.add("hidden");
    $("#explanation-box").classList.add("hidden");
    $("#prev-btn").disabled = !q || state.index === 0;
    $("#next-btn").disabled = !q;
    $("#next-btn").textContent = q && state.index === state.order.length - 1 ? "Save Answer" : "Save and Next";
    $("#mark-review-btn").disabled = !q;
    $("#mark-review-btn").textContent = q && state.reviewMarks[paperKey(state.paper)].has(q.id) ? "Unmark & Next" : "Mark for Review & Next";
    $("#clear-response-btn").disabled = !q || (!state.pendingAnswer && !answerMap(state.paper)[q.id]);
    $("#bookmark-btn").disabled = !q;
    const saved = q && savedSet(state.paper).has(q.id);
    $("#bookmark-btn").classList.toggle("active", !!saved);
    $("#bookmark-btn").setAttribute("aria-pressed", String(!!saved));
    $("#review-saved").checked = !!saved;
    $("#question-note").value = state.notes[questionRef(q)] || "";
    renderBookmarkLists();
    if (!q) { renderSessionStats(); renderGrid(); return; }
    const result = answerMap(state.paper)[q.id];
    q.options.forEach((option, i) => {
      const letter = "ABCD"[i], btn = document.createElement("button");
      btn.className = "option-btn"; btn.type = "button"; btn.disabled = q.dropped || state.mode === "wrong";
      const label = document.createElement("span"); label.className = "option-label"; label.textContent = letter;
      const text = document.createElement("span"); text.className = "option-text"; text.textContent = option;
      btn.append(label, text);
      if (state.mode === "wrong" && result) {
        if (letter === q.answer) {
          btn.classList.add("correct");
          const note = document.createElement("span"); note.className = "option-status"; note.textContent = "✓ Correct"; btn.append(note);
        } else if (letter === result.selected) {
          btn.classList.add("wrong");
          const note = document.createElement("span"); note.className = "option-status"; note.textContent = "× Your answer"; btn.append(note);
        } else btn.classList.add("faded");
      }
      else if (letter === state.pendingAnswer) btn.classList.add("selected");
      btn.setAttribute("aria-pressed", String(letter === state.pendingAnswer));
      if (!btn.disabled) btn.addEventListener("click", () => answerQuestion(q, letter));
      $("#options-list").append(btn);
    });
    if ((state.mode === "wrong" && result) || q.dropped) {
      $("#answer-feedback").classList.remove("hidden");
      $("#feedback-icon").textContent = q.dropped ? "—" : result.correct ? "✓" : "×";
      $("#feedback-title").textContent = q.dropped ? "Dropped by UPSC" : result.correct ? "Correct" : "Incorrect";
      $("#feedback-text").textContent = q.dropped ? "This question is not scored." : q.image ? `Provisional answer key: (${q.answer}).` : result.correct ? "Well done. Review the explanation below." : `Correct answer: (${q.answer}) ${q.options["ABCD".indexOf(q.answer)] || ""}`;
      if (q.explanation) {
        $("#explanation-box").classList.remove("hidden");
        $("#explanation-content").textContent = q.explanation;
      }
    }
    renderSessionStats(); renderGrid();
  }
  function answerQuestion(q, letter) {
    if (q.dropped || state.mode === "wrong") return;
    state.pendingAnswer = letter;
    renderQuestion();
  }
  function saveCurrentAnswer() {
    const q = currentQuestion();
    if (!q || q.dropped || !state.pendingAnswer) return;
    const previous = answerMap(state.paper)[q.id];
    if (previous?.selected === state.pendingAnswer) return;
    const correct = state.pendingAnswer === q.answer;
    answerMap(state.paper)[q.id] = { selected: state.pendingAnswer, correct };
    state.activity = state.activity.filter(item => !(item.kind === "answer" && item.paper === state.paper && item.id === q.id));
    state.activity.push({ kind: "answer", time: Date.now(), paper: state.paper, subject: q.subject, id: q.id, correct });
    save();
  }
  function saveAndNext() {
    saveCurrentAnswer();
    if (state.index < state.order.length - 1) moveQuestion(1);
    else renderQuestion();
  }
  function markForReviewAndNext() {
    const q = currentQuestion(); if (!q) return;
    saveCurrentAnswer();
    const review = state.reviewMarks[paperKey(state.paper)];
    if (review.has(q.id)) review.delete(q.id); else review.add(q.id);
    save();
    if (state.index < state.order.length - 1) moveQuestion(1);
    else renderQuestion();
  }
  function clearResponse() {
    const q = currentQuestion(); if (!q) return;
    state.pendingAnswer = null;
    delete answerMap(state.paper)[q.id];
    state.activity = state.activity.filter(item => !(item.kind === "answer" && item.paper === state.paper && item.id === q.id));
    save(); renderQuestion();
  }
  function renderGrid() {
    for (const target of ["#q-grid", "#mobile-q-grid"]) {
      const grid = $(target); grid.replaceChildren();
      state.order.forEach((idx, position) => {
        const q = questions(state.paper)[idx], result = answerMap(state.paper)[q.id];
        const review = state.reviewMarks[paperKey(state.paper)].has(q.id);
        const visited = state.visited[paperKey(state.paper)].has(q.id);
        const bookmarked = savedSet(state.paper).has(q.id) || state.bookmarkLists.some(list => list.questions.includes(`${state.paper}:${q.id}`));
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "q-grid-btn";
        const status = review ? result ? "review-answered" : "review" : result ? "answered" : visited ? "unanswered" : "unvisited";
        btn.textContent = q.id; btn.setAttribute("aria-label", `Question ${q.id}, ${status === "review-answered" ? "answered and marked for review" : status === "review" ? "marked for review" : status === "unvisited" ? "not visited" : status === "unanswered" ? "not answered" : "answered"}${bookmarked ? ", bookmarked" : ""}`);
        if (position === state.index) btn.classList.add("current");
        btn.classList.add(status);
        if (bookmarked) btn.classList.add("bookmarked");
        btn.addEventListener("click", () => { state.index = position; renderQuestion(); closeMobileGrid(); });
        grid.append(btn);
      });
    }
  }
  function moveQuestion(delta) {
    if (state.index + delta < 0 || state.index + delta >= state.order.length) return;
    state.index += delta; renderQuestion();
  }
  function closeMobileGrid() {
    $("#mobile-grid-drawer").classList.add("hidden");
    $("#q-grid-overlay").classList.add("hidden");
    document.body.style.overflow = "";
  }
  function toggleBookmark() {
    const q = currentQuestion(); if (!q) return;
    const set = savedSet(state.paper);
    if (set.has(q.id)) set.delete(q.id); else set.add(q.id);
    save(); renderQuestion(); toast(set.has(q.id) ? "Saved question" : "Removed from saved");
  }

  function bookmarkName(value) { return value.trim().replace(/\s+/g, " ").slice(0, 32); }
  function nameTaken(name, exceptId = null) {
    return state.bookmarkLists.some(list => list.id !== exceptId && list.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  }
  function renderBookmarkLists() {
    const root = $("#bookmark-list-items"); root.replaceChildren();
    $("#bookmark-list-count").textContent = `${state.bookmarkLists.length} / 3`;
    const full = state.bookmarkLists.length >= 3;
    $("#bookmark-list-name").disabled = full;
    $("#bookmark-list-form button").disabled = full;
    $("#bookmark-list-name").placeholder = full ? "Three lists created" : "Name a bookmark list";
    if (!state.bookmarkLists.length) {
      const empty = document.createElement("p"); empty.className = "bookmark-empty";
      empty.textContent = "Create up to three lists to organise questions."; root.append(empty);
    }
    const ref = questionRef();
    state.bookmarkLists.forEach(list => {
      const row = document.createElement("div"); row.className = "bookmark-list-row";
      const label = document.createElement("label"); label.className = "bookmark-list-label";
      const checkbox = document.createElement("input"); checkbox.type = "checkbox";
      checkbox.disabled = !ref; checkbox.checked = !!ref && list.questions.includes(ref);
      checkbox.setAttribute("aria-label", `Add current question to ${list.name}`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked && !list.questions.includes(ref)) list.questions.push(ref);
        if (!checkbox.checked) list.questions = list.questions.filter(item => item !== ref);
        save();
        if (state.mode === "custom" && state.activeBookmarkList === list.id) {
          const oldIndex = state.index, oldRef = ref;
          buildOrder();
          const keptIndex = state.order.findIndex(index => `${state.paper}:${questions(state.paper)[index].id}` === oldRef);
          state.index = keptIndex >= 0 ? keptIndex : Math.min(oldIndex, Math.max(0, state.order.length - 1));
          renderQuestion();
        } else { renderBookmarkLists(); renderGrid(); }
      });
      const name = document.createElement("span"); name.textContent = list.name;
      label.append(checkbox, name); row.append(label);
      const counts = [1, 2].map(paper => list.questions.filter(item => item.startsWith(`${paper}:`)).length);
      const count = document.createElement("small"); count.textContent = `Paper I: ${counts[0]} · Paper II: ${counts[1]}`;
      row.append(count);
      const actions = document.createElement("div"); actions.className = "bookmark-list-actions";
      [1, 2].forEach((paper, index) => {
        const review = document.createElement("button"); review.type = "button";
        review.textContent = `Review ${paper === 1 ? "I" : "II"}`;
        review.disabled = counts[index] === 0;
        review.setAttribute("aria-label", `Review ${list.name}, Paper ${paper === 1 ? "I" : "II"}`);
        review.addEventListener("click", () => startPractice(paper, null, "custom", list.id));
        actions.append(review);
      });
      const rename = document.createElement("button"); rename.type = "button"; rename.textContent = "Rename";
      rename.setAttribute("aria-label", `Rename ${list.name}`);
      rename.addEventListener("click", () => {
        const entered = prompt("Rename bookmark list", list.name);
        if (entered === null) return;
        const next = bookmarkName(entered);
        if (!next) { toast("Enter a bookmark name"); return; }
        if (nameTaken(next, list.id)) { toast("That name is already in use"); return; }
        list.name = next; save(); renderBookmarkLists();
        if (state.activeBookmarkList === list.id) {
          $("#practice-title").textContent = next;
          $("#exam-section-label").textContent = next;
        }
      });
      actions.append(rename);
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete";
      remove.setAttribute("aria-label", `Delete ${list.name}`);
      remove.addEventListener("click", () => {
        if (!confirm(`Delete "${list.name}" and its ${list.questions.length} bookmarked questions?`)) return;
        state.bookmarkLists = state.bookmarkLists.filter(item => item.id !== list.id);
        save();
        if (state.activeBookmarkList === list.id) startPractice(state.paper);
        else renderBookmarkLists();
        toast("Bookmark list deleted");
      });
      actions.append(remove); row.append(actions); root.append(row);
    });
  }

  function renderResults() {
    [1, 2].forEach(paper => {
      const s = subjectStats(paper);
      $(`#r-attempted-p${paper}`).textContent = s.attempted;
      $(`#r-correct-p${paper}`).textContent = s.correct;
      $(`#r-wrong-p${paper}`).textContent = s.wrong;
      $(`#ring-label-p${paper}`).textContent = `${s.accuracy}%`;
      $(`#ring-p${paper}`).style.setProperty("--pct", `${s.accuracy}%`);
      $(`#r-progress-p${paper}`).textContent = `${s.attempted} / ${s.total} (${pct(s.attempted,s.total)}%)`;
      $(`#r-fill-p${paper}`).style.width = `${pct(s.attempted,s.total)}%`;
      const breakdown = $(`#breakdown-p${paper}`); breakdown.replaceChildren();
      const items = allSubjects.filter(([, data]) => data.paper === paper).map(([key, data]) => ({
        key, label: data.label, ...subjectStats(paper, key)
      }));
      items.forEach(item => {
        const row = document.createElement("div"); row.className = "breakdown-row";
        const label = document.createElement("span"); label.className = "breakdown-label"; label.textContent = item.label; label.title = item.label;
        const bar = document.createElement("div"); bar.className = "progress-track";
        const fill = document.createElement("span"); fill.style.width = `${pct(item.correct,item.total)}%`; bar.append(fill);
        const score = document.createElement("span"); score.className = "breakdown-score"; score.textContent = `${item.accuracy}%`;
        row.append(label, bar, score); breakdown.append(row);
      });
      const tried = items.filter(item => item.attempted);
      const insights = $(`#insights-p${paper}`);
      if (!tried.length) insights.innerHTML = '<p class="empty-copy">No attempts yet. Practice this paper to see subject insights.</p>';
      else {
        const best = [...tried].sort((a, b) => b.accuracy - a.accuracy)[0];
        const weak = [...tried].sort((a, b) => a.accuracy - b.accuracy)[0];
        insights.replaceChildren();
        for (const [heading, value] of [["Strongest subject", `${best.label} (${best.accuracy}%)`], ["Needs most focus", `${weak.label} (${weak.accuracy}%)`]]) {
          const p = document.createElement("p"); const strong = document.createElement("strong");
          strong.textContent = heading; p.append(strong, document.createElement("br"), document.createTextNode(value)); insights.append(p);
        }
      }
    });
    const rec = recommendation();
    $("#results-recommendation").textContent = recommendText(rec);
    $("#results-recommend-button").dataset.subject = rec?.key || "";
    renderTrend(); renderStrengths();
  }
  function renderTrend() {
    const events = state.activity.filter(a => a.kind === "answer").slice(-14);
    const root = $("#accuracy-trend"); root.replaceChildren();
    if (!events.length) { root.classList.remove("trend-chart"); root.innerHTML = '<p class="empty-copy">Answer questions to build an accuracy trend.</p>'; return; }
    root.classList.add("trend-chart");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 500 160");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Accuracy after each recent answer");
    const scores = events.map((_, i) => pct(events.slice(0, i + 1).filter(a => a.correct).length, i + 1));
    const points = scores.map((score, i) => [20 + (events.length === 1 ? 0 : i * 460 / (events.length - 1)), 145 - score * 1.3]);
    for (const y of [15, 80, 145]) {
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("x1", "20"); line.setAttribute("x2", "480");
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("class", "trend-gridline"); svg.append(line);
    }
    const path = document.createElementNS(svg.namespaceURI, "polyline");
    path.setAttribute("points", points.map(p => p.join(",")).join(" "));
    path.setAttribute("class", "trend-line"); svg.append(path);
    points.forEach(([x, y], i) => {
      const circle = document.createElementNS(svg.namespaceURI, "circle");
      circle.setAttribute("cx", x); circle.setAttribute("cy", y); circle.setAttribute("r", "4");
      const title = document.createElementNS(svg.namespaceURI, "title");
      title.textContent = `Answer ${i + 1}: ${scores[i]}% accuracy`;
      circle.append(title); svg.append(circle);
    });
    root.append(svg);
  }
  function renderStrengths() {
    const stats = allSubjects.map(([key, data]) => ({ label: data.label, ...subjectStats(data.paper, key) })).filter(s => s.attempted);
    const root = $("#strengths-weaknesses"); root.replaceChildren();
    const strong = stats.filter(s => s.accuracy >= 70).sort((a,b) => b.accuracy-a.accuracy).slice(0,3);
    const weak = stats.filter(s => s.accuracy < 70).sort((a,b) => a.accuracy-b.accuracy).slice(0,3);
    for (const [heading, items, empty] of [["Strengths (≥ 70%)", strong, "No subjects at 70% yet."], ["Focus areas (< 70%)", weak, "No focus areas yet."]]) {
      const box = document.createElement("div"); box.className = "strength-box";
      const h = document.createElement("strong"); h.textContent = heading; box.append(h);
      if (!items.length) { const p = document.createElement("p"); p.textContent = empty; box.append(p); }
      items.forEach(s => { const p = document.createElement("p"); p.textContent = `${s.label} · ${s.accuracy}%`; box.append(p); });
      root.append(box);
    }
  }
  function startRecommended(button) {
    const key = button.dataset.subject, data = SUBJECTS[key];
    if (data) startPractice(data.paper, key); else showView("subjects");
  }
  function resetPaper(paper) {
    if (!confirm(`Reset Paper ${paper === 1 ? "I" : "II"} answers and saved questions?`)) return;
    state.answers[paperKey(paper)] = {}; state.bookmarks[paperKey(paper)] = new Set();
    state.visited[paperKey(paper)] = new Set(); state.reviewMarks[paperKey(paper)] = new Set();
    state.bookmarkLists.forEach(list => { list.questions = list.questions.filter(ref => !ref.startsWith(`${paper}:`)); });
    state.activity = state.activity.filter(a => a.paper !== paper);
    for (const key of Object.keys(state.notes)) if (key.startsWith(`${paper}:`)) delete state.notes[key];
    for (const key of Object.keys(state.confidence)) if (key.startsWith(`${paper}:`)) delete state.confidence[key];
    save(); renderResults(); toast("Paper progress reset");
  }
  function bind() {
    $("#brand-home").addEventListener("click", e => { e.preventDefault(); showView("home"); });
    $$(".nav-btn,.bnav-btn").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
    $$(".subject-paper-tab").forEach(tab => tab.addEventListener("click", () => {
      state.subjectPaper = Number(tab.dataset.subjectPaper);
      localStorage.setItem("cms_subject_paper", String(state.subjectPaper));
      renderSubjects();
    }));
    $$(".exam-paper-tab").forEach(tab => tab.addEventListener("click", () => {
      const paper = Number(tab.dataset.examPaper);
      if (paper !== state.paper || state.subject || state.mode !== "sequential") startPractice(paper);
    }));
    $("#theme-toggle").addEventListener("click", () => {
      document.documentElement.dataset.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      localStorage.setItem("cms_theme", document.documentElement.dataset.theme); syncTheme();
    });
    $("#results-recommend-button").addEventListener("click", e => startRecommended(e.currentTarget));
    $("#exam-exit").addEventListener("click", () => showView("home"));
    $("#exam-question-paper").addEventListener("click", () => $("#q-grid-toggle").click());
    $("#exam-instructions").addEventListener("click", () => $("#exam-instructions-dialog").showModal());
    $("#exam-instructions-close").addEventListener("click", () => $("#exam-instructions-dialog").close());
    $("#exam-submit").addEventListener("click", () => {
      if (!confirm("Submit this practice session and view your results?")) return;
      saveCurrentAnswer(); showView("results");
    });
    $("#exam-submit-mobile").addEventListener("click", () => $("#exam-submit").click());
    $("#back-to-home").addEventListener("click", () => showView("home"));
    $("#prev-btn").addEventListener("click", () => moveQuestion(-1));
    $("#next-btn").addEventListener("click", saveAndNext);
    $("#mark-review-btn").addEventListener("click", markForReviewAndNext);
    $("#clear-response-btn").addEventListener("click", clearResponse);
    $("#bookmark-btn").addEventListener("click", toggleBookmark);
    $("#bookmark-tools-btn").addEventListener("click", () => $("#practice-bookmarks-dialog").showModal());
    $("#practice-bookmarks-close").addEventListener("click", () => $("#practice-bookmarks-dialog").close());
    $("#practice-bookmarks-dialog").addEventListener("click", event => {
      if (event.target === $("#practice-bookmarks-dialog")) $("#practice-bookmarks-dialog").close();
    });
    $("#review-saved").addEventListener("change", toggleBookmark);
    $("#bookmark-list-form").addEventListener("submit", event => {
      event.preventDefault();
      if (state.bookmarkLists.length >= 3) { toast("You can create up to three lists"); return; }
      const input = $("#bookmark-list-name"), name = bookmarkName(input.value);
      if (!name) { toast("Enter a bookmark name"); return; }
      if (nameTaken(name)) { toast("That name is already in use"); return; }
      state.bookmarkLists.push({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name, questions: [] });
      input.value = ""; save(); renderBookmarkLists(); toast("Bookmark list created");
    });
    $("#save-note").addEventListener("click", () => {
      const q = currentQuestion(); if (!q) return;
      const value = $("#question-note").value.trim();
      if (value) state.notes[questionRef(q)] = value; else delete state.notes[questionRef(q)];
      save(); toast("Note saved");
    });
    $("#q-grid-toggle").addEventListener("click", () => {
      if (window.innerWidth > 850) { $("#q-grid").scrollIntoView({ behavior:"smooth", block:"center" }); return; }
      $("#mobile-grid-drawer").classList.remove("hidden");
      $("#q-grid-overlay").classList.remove("hidden"); document.body.style.overflow = "hidden";
    });
    $("#q-grid-close").addEventListener("click", closeMobileGrid);
    $("#q-grid-overlay").addEventListener("click", closeMobileGrid);
    $("#review-incorrect").addEventListener("click", () => {
      const paper = [1,2].find(p => Object.values(answerMap(p)).some(a => !a.correct));
      if (paper) startPractice(paper, null, "wrong"); else toast("No incorrect answers to review yet");
    });
    $("#focus-weak").addEventListener("click", () => startRecommended($("#results-recommend-button")));
    $$(".reset-paper").forEach(btn => btn.addEventListener("click", () => resetPaper(Number(btn.dataset.paper))));
    $("#reset-all").addEventListener("click", () => {
      if (!confirm("Reset all answers, bookmark lists, notes and activity?")) return;
      for (const paper of [1,2]) { state.answers[paperKey(paper)] = {}; state.bookmarks[paperKey(paper)] = new Set(); state.visited[paperKey(paper)] = new Set(); state.reviewMarks[paperKey(paper)] = new Set(); }
      state.activity = []; state.notes = {}; state.confidence = {}; state.bookmarkLists = [];
      save(); renderResults(); toast("All progress reset");
    });
    document.addEventListener("keydown", e => {
      if (state.view !== "practice" || $("dialog[open]") || e.altKey || e.ctrlKey || e.metaKey || ["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); moveQuestion(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); moveQuestion(1); }
      if ("1234".includes(e.key) && e.key.length === 1) {
        const q = currentQuestion(); if (q) answerQuestion(q, "ABCD"[Number(e.key)-1]);
      }
      if (e.key.toLowerCase() === "b") toggleBookmark();
      if (e.key.toLowerCase() === "g") $("#q-grid-toggle").click();
      if (e.key === "Escape") closeMobileGrid();
    });
  }
  function init() {
    load(); bind();
    const requested = location.hash.slice(1);
    showView(["home", "subjects", "practice", "results"].includes(requested) ? requested : "home");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
