(() => {
  "use strict";

  const ERAS = [
    { key: "Prehistoric", color: "var(--era-prehistoric)" },
    { key: "Ancient", color: "var(--era-ancient)" },
    { key: "Medieval", color: "var(--era-medieval)" },
    { key: "Early Modern", color: "var(--era-early-modern)" },
    { key: "Industrial", color: "var(--era-industrial)" },
    { key: "Modern", color: "var(--era-modern)" },
  ];
  const ERA_COLOR = Object.fromEntries(ERAS.map((e) => [e.key, e.color]));
  const SPACING = 22;     // px between markers
  const ERA_GAP = 90;     // extra px between eras
  const PAD = 140;        // px before first / after last marker
  const EDGE_ZONE = 0.2;  // fraction of width on each side that drives auto-scroll
  const MAX_SPEED = 16;   // px per frame at the very edge

  const $ = (s) => document.querySelector(s);
  const els = {
    search: $("#search"), results: $("#results"), count: $("#count"), chips: $("#chips"),
    detail: $("#detail"), stage: $("#stage"), eras: $("#eras"), timeline: $("#timeline"), track: $("#track"),
  };

  const state = {
    items: [], pos: [], ticks: [], width: 0,
    offset: 0, target: null, velocity: 0, pointerX: null,
    category: null, query: "", matches: null, activeIdx: -1, resultIdx: -1,
    hoverTimer: 0, tip: null, near: [],
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtYear = (y) => (y < 0 ? `${Math.abs(y).toLocaleString()} BCE` : y < 1000 ? `${y} CE` : String(y));

  // ---------- Load ----------
  fetch("timeless-objects.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(init)
    .catch(() => {
      els.count.textContent = "No data";
      els.detail.innerHTML = `<div class="empty">Couldn't load <code>timeless-objects.json</code>.<br>
        Run <code>node merge.mjs</code>, then <code>node serve.mjs</code>.</div>`;
    });

  function init(data) {
    state.items = data
      .filter((d) => d?.invention && Number.isFinite(d.invention.year))
      .sort((a, b) => a.invention.year - b.invention.year || a.name.localeCompare(b.name));
    state.items.forEach((it) => {
      it._hay = [it.name, it.category, it.place_of_invention?.region, it.place_of_invention?.modern_country,
        it.inventor, (it.tags || []).join(" "), (it.materials || []).join(" "), it.short_description]
        .join(" ").toLowerCase();
    });
    els.count.textContent = `${state.items.length.toLocaleString()} objects`;
    if (!state.items.length) {
      els.detail.innerHTML = `<div class="empty">The dataset is empty. Run <code>node merge.mjs</code> once the parts are generated.</div>`;
      return;
    }
    buildChips();
    buildTimeline();
    bindTimeline();
    bindSearch();
    requestAnimationFrame(loop);

    const fromHash = state.items.findIndex((it) => it.slug === decodeURIComponent(location.hash.slice(1)));
    select(fromHash >= 0 ? fromHash : Math.floor(Math.random() * state.items.length), { center: true, instant: true });
  }

  // ---------- Category chips ----------
  function buildChips() {
    const cats = [...new Set(state.items.map((i) => i.category))].sort();
    const mk = (label, value) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = label;
      b.setAttribute("aria-pressed", String(value === state.category));
      b.onclick = () => {
        state.category = value;
        els.chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
        applyFilter();
      };
      return b;
    };
    els.chips.append(mk("All", null), ...cats.map((c) => mk(c, c)));
  }

  // ---------- Timeline ----------
  function buildTimeline() {
    const frag = document.createDocumentFragment();
    let x = PAD, prevEra = null, eraStart = 0, lastLabelX = -1e9;
    const bands = [];

    state.items.forEach((it, i) => {
      const era = it.invention.era;
      if (prevEra && era !== prevEra) {
        bands.push({ era: prevEra, from: eraStart, to: x - SPACING });
        x += ERA_GAP;
      }
      if (era !== prevEra) eraStart = x;
      prevEra = era;
      state.pos[i] = x;

      const t = document.createElement("button");
      t.className = "tick";
      t.dataset.i = i;
      t.style.left = `${x}px`;
      t.style.setProperty("--h", `${34 + (i % 5) * 13}px`);
      t.style.setProperty("--c", ERA_COLOR[era] || "var(--muted)");
      t.setAttribute("aria-label", `${it.name}, ${it.invention.display}`);
      frag.append(t);
      state.ticks[i] = t;

      if (x - lastLabelX > 150 && (i === 0 || it.invention.year !== state.items[i - 1].invention.year)) {
        const y = document.createElement("div");
        y.className = "year";
        y.style.left = `${x}px`;
        y.textContent = fmtYear(it.invention.year);
        frag.append(y);
        lastLabelX = x;
      }
      x += SPACING;
    });
    bands.push({ era: prevEra, from: eraStart, to: x - SPACING });
    state.width = x - SPACING + PAD;

    const axis = document.createElement("div");
    axis.className = "axis";
    frag.prepend(axis);
    bands.forEach((b) => {
      const band = document.createElement("div");
      band.className = "band";
      band.style.cssText = `left:${b.from - 6}px;width:${b.to - b.from + 12}px;background:${ERA_COLOR[b.era]}`;
      const label = document.createElement("div");
      label.className = "band-label";
      label.style.cssText = `left:${b.from}px;color:${ERA_COLOR[b.era]}`;
      label.textContent = b.era;
      frag.prepend(band);
      frag.append(label);
    });

    els.track.style.width = `${state.width}px`;
    els.track.append(frag);

    // Era jump buttons
    ERAS.filter((e) => bands.some((b) => b.era === e.key)).forEach((e) => {
      const btn = document.createElement("button");
      btn.className = "era-btn";
      btn.dataset.era = e.key;
      btn.innerHTML = `<i style="background:${e.color}"></i>${e.key}`;
      btn.onclick = () => {
        const b = bands.find((b) => b.era === e.key);
        state.target = clamp(b.from - 160);
      };
      els.eras.append(btn);
    });
  }

  const viewW = () => els.timeline.clientWidth;
  const clamp = (v) => Math.max(0, Math.min(v, Math.max(0, state.width - viewW())));

  function bindTimeline() {
    const tl = els.timeline;
    tl.addEventListener("mousemove", (e) => {
      const r = tl.getBoundingClientRect();
      state.pointerX = e.clientX - r.left;
      markNear();
    });
    tl.addEventListener("mouseleave", () => {
      state.pointerX = null;
      state.velocity = 0;
      clearNear();
      hideTip();
    });
    tl.addEventListener("wheel", (e) => {
      e.preventDefault();
      state.target = null;
      state.offset = clamp(state.offset + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.2);
    }, { passive: false });

    // Touch / pen drag
    let drag = null;
    tl.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      drag = { x: e.clientX, o: state.offset };
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      state.target = null;
      state.offset = clamp(drag.o - (e.clientX - drag.x));
    });
    window.addEventListener("pointerup", () => (drag = null));

    els.track.addEventListener("mouseover", (e) => {
      const t = e.target.closest(".tick");
      if (!t) return;
      const i = Number(t.dataset.i);
      showTip(i);
      clearTimeout(state.hoverTimer);
      state.hoverTimer = setTimeout(() => select(i), 110);
    });
    els.track.addEventListener("click", (e) => {
      const t = e.target.closest(".tick");
      if (t) select(Number(t.dataset.i), { center: true });
    });
  }

  function loop() {
    const w = viewW();
    if (state.pointerX != null && state.target == null) {
      const rel = state.pointerX / w;
      let v = 0;
      if (rel < EDGE_ZONE) v = -((EDGE_ZONE - rel) / EDGE_ZONE);
      else if (rel > 1 - EDGE_ZONE) v = (rel - (1 - EDGE_ZONE)) / EDGE_ZONE;
      state.velocity += (v * v * Math.sign(v) * MAX_SPEED - state.velocity) * 0.15;
    } else {
      state.velocity *= 0.9;
    }
    if (state.target != null) {
      const d = state.target - state.offset;
      state.offset += d * 0.12;
      if (Math.abs(d) < 0.5) { state.offset = state.target; state.target = null; }
    } else if (Math.abs(state.velocity) > 0.05) {
      state.offset = clamp(state.offset + state.velocity);
      if (state.pointerX != null) markNear();
    }
    els.track.style.transform = `translate3d(${-state.offset}px,0,0)`;
    $(".edge-left").style.opacity = state.offset > 2 ? 1 : 0;
    $(".edge-right").style.opacity = state.offset < state.width - w - 2 ? 1 : 0;
    if (state.tip) state.tip.style.left = `${state.pos[state.tip._i]}px`;
    updateEraButtons();
    requestAnimationFrame(loop);
  }

  // Magnify markers near the cursor
  function markNear() {
    clearNear();
    const x = state.pointerX + state.offset;
    let lo = 0, hi = state.pos.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (state.pos[m] < x) lo = m + 1; else hi = m; }
    for (let i = Math.max(0, lo - 3); i <= Math.min(state.pos.length - 1, lo + 2); i++) {
      if (Math.abs(state.pos[i] - x) < SPACING * 2.5) { state.ticks[i].classList.add("near"); state.near.push(i); }
    }
  }
  function clearNear() {
    state.near.forEach((i) => state.ticks[i].classList.remove("near"));
    state.near = [];
  }

  let lastEra = null;
  function updateEraButtons() {
    const mid = state.offset + viewW() / 2;
    let i = state.pos.findIndex((p) => p >= mid);
    if (i < 0) i = state.pos.length - 1;
    const era = state.items[i]?.invention.era;
    if (era === lastEra) return;
    lastEra = era;
    els.eras.querySelectorAll(".era-btn").forEach((b) => b.classList.toggle("active", b.dataset.era === era));
  }

  function showTip(i) {
    hideTip();
    const it = state.items[i];
    const tip = document.createElement("div");
    tip.className = "tip";
    tip._i = i;
    tip.style.setProperty("--h", state.ticks[i].style.getPropertyValue("--h"));
    tip.style.left = `${state.pos[i]}px`;
    tip.innerHTML = `<strong>${esc(it.name)}</strong><span>${esc(it.invention.display)}</span>`;
    els.track.append(tip);
    state.tip = tip;
  }
  function hideTip() {
    state.tip?.remove();
    state.tip = null;
  }

  function centerOn(i, instant) {
    const t = clamp(state.pos[i] - viewW() / 2);
    if (instant) state.offset = t;
    else state.target = t;
  }

  // ---------- Detail ----------
  function select(i, { center = false, instant = false } = {}) {
    if (i == null || !state.items[i]) return;
    if (i !== state.activeIdx) {
      state.ticks[state.activeIdx]?.classList.remove("active");
      state.ticks[i].classList.add("active");
      state.activeIdx = i;
      renderDetail(state.items[i]);
      history.replaceState(null, "", `#${state.items[i].slug}`);
    }
    if (center) centerOn(i, instant);
  }

  function renderDetail(it) {
    const p = it.place_of_invention || {};
    const place = [p.region, p.modern_country && p.modern_country !== p.region ? p.modern_country : null]
      .filter(Boolean).join(", ");
    const eraColor = ERA_COLOR[it.invention.era];

    els.detail.innerHTML = `
      <div class="card">
        <figure class="figure">
          <div class="placeholder">${esc(it.name[0])}</div>
          <img alt="${esc(it.image?.alt || it.name)}">
          <figcaption hidden></figcaption>
        </figure>
        <div>
          <div class="eyebrow">
            <span class="pill era" style="background:${eraColor}">${esc(it.invention.era)}</span>
            <span class="pill">${esc(it.category)}</span>
            ${it.confidence ? `<span class="pill" title="How solid the dating is">${esc(it.confidence)} confidence</span>` : ""}
          </div>
          <h2 class="title">${esc(it.name)}</h2>
          <p class="date">${esc(it.invention.display)}</p>
          <p class="lead">${esc(it.short_description)}</p>
          <p class="desc">${esc(it.description)}</p>
          <dl class="facts">
            <div class="fact"><dt>Place of invention</dt><dd>${esc(place || "Unknown")}
              ${p.notes ? `<small>${esc(p.notes)}</small>` : ""}</dd></div>
            <div class="fact"><dt>Inventor</dt><dd>${esc(it.inventor || "Unknown / many cultures")}</dd></div>
            ${it.materials?.length ? `<div class="fact"><dt>Materials</dt><dd>${esc(it.materials.join(", "))}</dd></div>` : ""}
          </dl>
          ${it.why_unchanged ? `<blockquote class="why">${esc(it.why_unchanged)}</blockquote>` : ""}
          ${it.faqs?.length ? `<section class="faqs"><h3>FAQ</h3>${it.faqs.map((f, n) => `
            <details${n === 0 ? " open" : ""}><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join("")}
          </section>` : ""}
          ${it.tags?.length ? `<div class="tags">${it.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
      </div>`;
    els.stage.scrollTop = 0;
    loadImage(it, els.detail.querySelector(".figure"));
  }

  // Images come from Wikipedia's page summary API at view time; nothing is stored in the dataset.
  const imgCache = new Map();
  function wikiSummary(title) {
    if (!imgCache.has(title)) {
      imgCache.set(title, fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j?.thumbnail ? { src: j.originalimage?.source || j.thumbnail.source, page: j.content_urls?.desktop?.page } : null))
        .catch(() => null));
    }
    return imgCache.get(title);
  }
  async function loadImage(it, fig) {
    const titles = [it.name, it.image?.wikimedia_commons_category].filter(Boolean);
    let hit = null;
    for (const t of titles) { hit = await wikiSummary(t); if (hit) break; }
    if (!hit || !fig.isConnected) return;
    const img = fig.querySelector("img");
    img.onload = () => { img.classList.add("loaded"); fig.querySelector(".placeholder").remove(); };
    img.src = hit.src;
    const cap = fig.querySelector("figcaption");
    cap.innerHTML = `Image: <a href="${esc(hit.page)}" target="_blank" rel="noopener">Wikipedia</a>`;
    cap.hidden = false;
  }

  // ---------- Search ----------
  function score(it, q) {
    const n = it.name.toLowerCase();
    if (n === q) return 1000;
    if (n.startsWith(q)) return 500;
    if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) return 300;
    if (n.includes(q)) return 200;
    if (it._hay.includes(q)) return 50;
    return 0;
  }

  function bindSearch() {
    const input = els.search;
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.query = input.value.trim().toLowerCase();
        applyFilter();
        renderResults();
      }, 80);
    });
    input.addEventListener("keydown", (e) => {
      const lis = [...els.results.querySelectorAll("li[data-i]")];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!lis.length) return;
        state.resultIdx = (state.resultIdx + (e.key === "ArrowDown" ? 1 : -1) + lis.length) % lis.length;
        lis.forEach((li, n) => li.setAttribute("aria-selected", String(n === state.resultIdx)));
        lis[state.resultIdx].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        const li = lis[Math.max(0, state.resultIdx)];
        if (li) pick(Number(li.dataset.i));
      } else if (e.key === "Escape") {
        input.value = "";
        input.dispatchEvent(new Event("input"));
        input.blur();
      }
    });
    input.addEventListener("focus", () => state.query && renderResults());
    document.addEventListener("click", (e) => { if (!e.target.closest(".search")) closeResults(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    });
    els.results.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) pick(Number(li.dataset.i));
    });
  }

  function pick(i) {
    select(i, { center: true });
    closeResults();
    els.search.blur();
  }

  function closeResults() {
    els.results.hidden = true;
    els.search.setAttribute("aria-expanded", "false");
  }

  function highlight(text, q) {
    const s = esc(text);
    const at = s.toLowerCase().indexOf(esc(q));
    return at < 0 ? s : `${s.slice(0, at)}<mark>${s.slice(at, at + esc(q).length)}</mark>${s.slice(at + esc(q).length)}`;
  }

  function renderResults() {
    const q = state.query;
    if (!q) { closeResults(); return; }
    const ranked = state.items
      .map((it, i) => ({ i, s: score(it, q) }))
      .filter((r) => r.s > 0 && (!state.category || state.items[r.i].category === state.category))
      .sort((a, b) => b.s - a.s || state.items[a.i].name.localeCompare(state.items[b.i].name))
      .slice(0, 12);
    state.resultIdx = ranked.length ? 0 : -1;
    els.results.innerHTML = ranked.length
      ? ranked.map(({ i }, n) => {
        const it = state.items[i];
        const p = it.place_of_invention || {};
        return `<li role="option" data-i="${i}" aria-selected="${n === 0}">
          <span class="r-name">${highlight(it.name, q)}</span>
          <span class="r-date">${esc(it.invention.display)}</span>
          <span class="r-meta">${esc(it.category)} · ${esc(p.region || p.modern_country || "Unknown origin")}</span></li>`;
      }).join("")
      : `<li class="r-empty">No objects match “${esc(q)}”.</li>`;
    els.results.hidden = false;
    els.search.setAttribute("aria-expanded", "true");
  }

  function applyFilter() {
    const q = state.query.length >= 2 ? state.query : "";
    let shown = 0;
    state.items.forEach((it, i) => {
      const okCat = !state.category || it.category === state.category;
      const okQ = !q || score(it, q) > 0;
      const t = state.ticks[i];
      t.classList.toggle("dim", !(okCat && okQ));
      t.classList.toggle("hit", Boolean(q) && okCat && okQ);
      if (okCat && okQ) shown++;
    });
    els.count.textContent = q || state.category
      ? `${shown.toLocaleString()} of ${state.items.length.toLocaleString()} objects`
      : `${state.items.length.toLocaleString()} objects`;
  }
})();
