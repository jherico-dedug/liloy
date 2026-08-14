/* =========================================================
   SAKADINGDINGDONG — interactions
   Vanilla JS. localStorage prototype store (swap-ready).
   ========================================================= */
(function () {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const TRIP_DATE = new Date("2026-08-22T00:00:00").getTime();

  /* =======================================================
     STORE — single seam to swap localStorage for Supabase/Firebase.
     Replace these method bodies with async network calls later;
     the rest of the app already treats them as the source of truth.
     ======================================================= */
  const Store = {
    _read(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
      catch (_) { return fallback; }
    },
    _write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} },

    getRSVPs()        { return this._read("sdd_rsvps_v1", []); },
    saveRSVPs(list)   { this._write("sdd_rsvps_v1", list); },
    getMyId()         { return this._read("sdd_my_rsvp", null); },
    setMyId(id)       { this._write("sdd_my_rsvp", id); },

    getMap(key)       { return this._read(key, {}); },
    setMap(key, obj)  { this._write(key, obj); },
  };

  const uid = () => "r" + Math.abs(Date.now() ^ (performance.now() * 1000 | 0)).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

  /* =======================================================
     INTRO + WAVE TRANSITION
     ======================================================= */
  const intro     = $("#intro");
  const enterBtn  = $("#enterBtn");
  const waveCanvas= $("#waveCanvas");
  const site      = $("#site");
  const topnav    = $("#topnav");
  const bottomnav = $("#bottomnav");
  let introDone   = false;
  let revealsStarted = false;   // declared early so revealSite() can call startReveals() without a TDZ error

  // Preload the hero background so the reveal has no flash
  ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
   "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=80"
  ].forEach((u) => { const i = new Image(); i.src = u; });

  // floating particles in intro
  (function particles() {
    const box = $("#introParticles");
    if (!box || reduceMotion) return;
    const n = window.innerWidth < 600 ? 14 : 22;
    let html = "";
    for (let i = 0; i < n; i++) {
      const size = 4 + Math.random() * 8;
      const left = Math.random() * 100;
      const dur = 9 + Math.random() * 12;
      const delay = -Math.random() * dur;
      const op = 0.2 + Math.random() * 0.4;
      html += `<span style="left:${left}%;width:${size}px;height:${size}px;opacity:${op};animation-duration:${dur}s;animation-delay:${delay}s"></span>`;
    }
    box.innerHTML = html;
  })();

  // rotating microcopy under button
  (function rotator() {
    const el = $("#introRotator");
    if (!el) return;
    const msgs = ["Walay atrasan.", "Attendance is highly encouraged.", "Your excuse will be reviewed.", "Ready na ba mo?", "Hydrate before the kalat."];
    let i = 0;
    setInterval(() => {
      if (introDone) return;
      i = (i + 1) % msgs.length;
      el.style.opacity = "0";
      setTimeout(() => { el.textContent = msgs[i]; el.style.opacity = "1"; }, 350);
    }, 2800);
  })();

  // desktop: intro title reacts to mouse
  if (canHover && !reduceMotion) {
    const title = $("#introTitle");
    intro.addEventListener("mousemove", (e) => {
      const rx = (e.clientY / window.innerHeight - 0.5) * -10;
      const ry = (e.clientX / window.innerWidth - 0.5) * 12;
      title.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    intro.addEventListener("mouseleave", () => { title.style.transform = ""; });
  }

  function showSiteChrome() {
    topnav.classList.add("is-ready");
    bottomnav.classList.add("is-ready");
  }

  function revealSite() {
    document.body.classList.remove("no-scroll");
    intro.classList.add("is-gone");
    site.classList.add("site-in");
    showSiteChrome();
    introDone = true;
    startReveals();
  }

  // Wave transition on canvas
  function runWaveTransition() {
    if (reduceMotion) { // simple fade
      intro.style.transition = "opacity .5s ease";
      intro.style.opacity = "0";
      setTimeout(revealSite, 480);
      return;
    }

    const ctx = waveCanvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = window.innerWidth, H = window.innerHeight;
    const resize = () => { W = window.innerWidth; H = window.innerHeight; waveCanvas.width = W * dpr; waveCanvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    waveCanvas.classList.add("is-active");

    const layers = [
      { amp: 26, len: 0.9, speed: 1.4, col: "#7fdbe6", off: 0.00 },
      { amp: 20, len: 1.3, speed: -1.9, col: "#2fb6c9", off: 0.04 },
      { amp: 30, len: 0.6, speed: 2.5, col: "#0f8ea6", off: 0.09 },
    ];
    const bubbles = Array.from({ length: 26 }, () => ({
      x: Math.random() * W, y: Math.random(), r: 1.5 + Math.random() * 4, sp: 0.15 + Math.random() * 0.4
    }));

    const D = 2200;                 // total duration
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeIn  = (t) => t * t;
    const start = performance.now();
    let swapped = false;

    function frame(now) {
      const t = Math.min((now - start) / D, 1);
      ctx.clearRect(0, 0, W, H);

      // coverage: rise to full by t=0.5, recede after
      let coverage;
      if (t <= 0.5) coverage = easeOut(t / 0.5);
      else          coverage = 1 - easeIn((t - 0.5) / 0.5);

      // baseline: top edge of the water (0 = top of screen, H = bottom)
      const baseTop = H * (1 - coverage);
      const phase = now / 1000;

      layers.forEach((L) => {
        const top = baseTop + H * L.off;
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, top);
        const step = 10;
        for (let x = 0; x <= W; x += step) {
          const y = top + Math.sin((x / W) * Math.PI * 2 * (2 / L.len) + phase * L.speed) * L.amp
                        + Math.sin((x / W) * Math.PI * 6 + phase * L.speed * 0.6) * (L.amp * 0.25);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = L.col;
        ctx.globalAlpha = L === layers[2] ? 1 : 0.85;
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // foam line
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y = baseTop + H * layers[2].off + Math.sin((x / W) * Math.PI * 2 * (2 / layers[2].len) + phase * layers[2].speed) * layers[2].amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // bubbles inside the water
      ctx.fillStyle = "rgba(255,255,255,.6)";
      bubbles.forEach((b) => {
        b.y += b.sp * 0.012;
        if (b.y > 1) { b.y = 0; b.x = Math.random() * W; }
        const by = baseTop + (H - baseTop) * (1 - b.y);
        if (by > baseTop + 6) { ctx.beginPath(); ctx.arc(b.x, by, b.r, 0, Math.PI * 2); ctx.fill(); }
      });

      // swap underneath while fully covered
      if (!swapped && t >= 0.5) { swapped = true; revealSite(); }

      if (t < 1) requestAnimationFrame(frame);
      else { waveCanvas.classList.remove("is-active"); ctx.clearRect(0, 0, W, H); }
    }
    requestAnimationFrame(frame);
  }

  function startIntro() {
    document.body.classList.add("no-scroll");
    intro.classList.remove("is-gone");
    intro.style.opacity = "";
    introDone = false;
  }

  // Should we show the intro? First visit this session → yes.
  const seenThisSession = sessionStorage.getItem("sdd_intro_seen") === "1";
  if (seenThisSession) {
    revealSite();
  } else {
    startIntro();
    // title zoom + press feedback, then wave
    enterBtn.addEventListener("click", () => {
      if (introDone) return;
      sessionStorage.setItem("sdd_intro_seen", "1");
      enterBtn.classList.add("is-press");
      const title = $("#introTitle");
      if (title && !reduceMotion) { title.style.transition = "transform .5s ease"; title.style.transform = "scale(1.12) translateZ(40px)"; }
      setTimeout(() => { enterBtn.classList.remove("is-press"); runWaveTransition(); }, 160);
    });
  }

  // Replay intro (footer)
  $("#replayIntro").addEventListener("click", () => {
    sessionStorage.removeItem("sdd_intro_seen");
    site.classList.remove("site-in");
    window.scrollTo(0, 0);
    const t = $("#introTitle"); if (t) t.style.transform = "";
    startIntro();
    // re-bind a one-shot enter handler
    const handler = () => {
      if (introDone) return;
      sessionStorage.setItem("sdd_intro_seen", "1");
      enterBtn.classList.add("is-press");
      setTimeout(() => { enterBtn.classList.remove("is-press"); runWaveTransition(); }, 160);
      enterBtn.removeEventListener("click", handler);
    };
    enterBtn.addEventListener("click", handler);
  });

  /* =======================================================
     COUNTDOWN
     ======================================================= */
  function tickCountdown() {
    const diff = Math.max(0, TRIP_DATE - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    $$("[data-cd='days']").forEach((e) => e.textContent = pad(d));
    $$("[data-cd='hours']").forEach((e) => e.textContent = pad(h));
    $$("[data-cd='mins']").forEach((e) => e.textContent = pad(m));
    $$("[data-cd='secs']").forEach((e) => e.textContent = pad(s));
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  /* =======================================================
     NAV — scroll state, smooth scroll, scrollspy
     ======================================================= */
  const onScroll = () => { topnav.classList.toggle("is-scrolled", window.scrollY > 40); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function smoothTo(sel) {
    const el = $(sel); if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
  }
  $$("[data-scroll]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      e.preventDefault();
      smoothTo(href);
    });
  });

  // scrollspy for bottom nav + brand -> home
  const spyMap = { home: "#home", itinerary: "#itinerary", food: "#food", activities: "#activities" };
  const bnItems = $$(".bn[data-bn]");
  const spyTargets = Object.entries(spyMap).map(([k, sel]) => ({ k, el: $(sel) })).filter((o) => o.el);
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const key = spyTargets.find((o) => o.el === en.target)?.k;
        bnItems.forEach((b) => b.classList.toggle("is-active", b.dataset.bn === key));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    spyTargets.forEach((o) => spy.observe(o.el));
  }
  $("#brand").addEventListener("click", () => smoothTo("#home"));

  /* =======================================================
     ITINERARY TABS
     ======================================================= */
  const tabs = $$(".tab");
  const panels = { day1: $("#day1"), day2: $("#day2") };
  function activateTab(name) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    Object.entries(panels).forEach(([k, p]) => {
      const on = k === name;
      p.classList.toggle("is-hidden", !on);
      on ? p.removeAttribute("hidden") : p.setAttribute("hidden", "");
    });
    // re-trigger reveal on the freshly shown panel
    $$(".reveal", panels[name]).forEach((el) => el.classList.add("is-visible"));
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => activateTab(t.dataset.tab));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const nx = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      activateTab(nx.dataset.tab); nx.focus();
    });
  });

  /* =======================================================
     SHOPPING LIST
     ======================================================= */
  const SHOP = [
    { n: "Rice", q: "8 kg" }, { n: "Chicken", q: "5 kg" }, { n: "Pork", q: "4 kg" },
    { n: "Hotdogs / Longganisa", q: "2 kg" }, { n: "Eggs", q: "30 pcs" }, { n: "Water", q: "40–50 L" },
    { n: "Soft drinks", q: "5–6 btls" }, { n: "Juice", q: "3–4 btls" }, { n: "Ice", q: "4–6 bags" },
    { n: "Vegetables", q: "" }, { n: "Fruit", q: "" }, { n: "Bread", q: "" }, { n: "Coffee", q: "" },
    { n: "Milo", q: "" }, { n: "Sugar", q: "" }, { n: "Creamer", q: "" }, { n: "Chips", q: "" },
    { n: "Biscuits", q: "" }, { n: "Marshmallows", q: "" }, { n: "Charcoal", q: "" }, { n: "Soy sauce", q: "" },
    { n: "Vinegar", q: "" }, { n: "Cooking oil", q: "" }, { n: "Salt", q: "" }, { n: "Pepper", q: "" },
    { n: "Ketchup", q: "" }, { n: "BBQ sauce", q: "" }, { n: "Tissue", q: "" }, { n: "Trash bags", q: "" },
  ];
  const SHOP_STATES = ["not", "bought", "assigned"];
  const SHOP_LABEL = { not: "Not bought", bought: "Bought", assigned: "Assigned" };
  (function renderShop() {
    const wrap = $("#shopList");
    const saved = Store.getMap("sdd_shop_v1");
    wrap.innerHTML = SHOP.map((it, i) => {
      const st = saved[i] || "not";
      return `<button class="shop__item" data-i="${i}" data-state="${st}" aria-label="${it.n}, ${SHOP_LABEL[st]}. Tap to change.">
        <span class="shop__dot" aria-hidden="true"></span>
        <span class="shop__txt"><span class="shop__name">${it.n}</span>${it.q ? `<span class="shop__qty">${it.q}</span>` : ""}</span>
        <span class="shop__state">${SHOP_LABEL[st]}</span>
      </button>`;
    }).join("");
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".shop__item"); if (!btn) return;
      const cur = btn.dataset.state;
      const next = SHOP_STATES[(SHOP_STATES.indexOf(cur) + 1) % SHOP_STATES.length];
      btn.dataset.state = next;
      btn.querySelector(".shop__state").textContent = SHOP_LABEL[next];
      btn.setAttribute("aria-label", `${SHOP[btn.dataset.i].n}, ${SHOP_LABEL[next]}. Tap to change.`);
      const map = Store.getMap("sdd_shop_v1"); map[btn.dataset.i] = next; Store.setMap("sdd_shop_v1", map);
    });
  })();

  /* =======================================================
     ACTIVITIES — I'm In + counts
     ======================================================= */
  const ACTS = [
    { id: "atv", ic: "🏍️", n: "ATV Riding", d: "Sand and speed.", badge: "confirm" },
    { id: "kayak", ic: "🛶", n: "Kayaking", d: "Paddle the cove.", badge: "confirm" },
    { id: "snorkel", ic: "🤿", n: "Snorkeling", d: "Peek underwater.", badge: "confirm" },
    { id: "surf", ic: "🌊", n: "Surfing", d: "Catch a wave.", badge: "confirm" },
    { id: "skim", ic: "🏄", n: "Skimboarding", d: "Slide the shore.", badge: "free" },
    { id: "volley", ic: "🏐", n: "Beach Volleyball", d: "Team kalat.", badge: "free" },
    { id: "pool", ic: "🏊", n: "Swimming Pool", d: "Always open.", badge: "free" },
    { id: "bonfire", ic: "🔥", n: "Bonfire", d: "Chika HQ.", badge: "confirm" },
    { id: "camp", ic: "⛺", n: "Tent Camping", d: "Sleep under stars.", badge: "confirm" },
    { id: "tambay", ic: "🍹", n: "Tambay", d: "Do nothing, expertly.", badge: "free" },
  ];
  const BADGE = { free: ["FREE", "free"], paid: ["PAID", "paid"], confirm: ["CONFIRM PRICE", "confirm"] };
  (function renderActs() {
    const wrap = $("#actList");
    const mine = Store.getMap("sdd_act_me_v1");   // { id: true } this device joined
    const counts = Store.getMap("sdd_act_cnt_v1"); // { id: number }
    wrap.innerHTML = ACTS.map((a) => {
      const inIt = !!mine[a.id];
      const c = counts[a.id] || 0;
      const [txt, cls] = BADGE[a.badge];
      return `<article class="act ${inIt ? "is-in" : ""}" data-id="${a.id}">
        <span class="act__ic" aria-hidden="true">${a.ic}</span>
        <h3>${a.n}</h3>
        <p class="act__desc">${a.d}</p>
        <span class="act__badge act__badge--${cls}">${txt}</span>
        <button class="act__join" aria-pressed="${inIt}">${inIt ? "You're In ✓" : "I'm In"}</button>
        <span class="act__count">${c} interested</span>
      </article>`;
    }).join("");
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".act__join"); if (!btn) return;
      const card = btn.closest(".act"); const id = card.dataset.id;
      const mine = Store.getMap("sdd_act_me_v1");
      const counts = Store.getMap("sdd_act_cnt_v1");
      const nowIn = !mine[id];
      if (nowIn) { mine[id] = true; counts[id] = (counts[id] || 0) + 1; }
      else { delete mine[id]; counts[id] = Math.max(0, (counts[id] || 0) - 1); }
      Store.setMap("sdd_act_me_v1", mine); Store.setMap("sdd_act_cnt_v1", counts);
      card.classList.toggle("is-in", nowIn);
      btn.setAttribute("aria-pressed", String(nowIn));
      btn.textContent = nowIn ? "You're In ✓" : "I'm In";
      card.querySelector(".act__count").textContent = `${counts[id] || 0} interested`;
    });
  })();

  /* =======================================================
     CHECKLISTS — packing + confirm
     ======================================================= */
  function buildChecklist(mountSel, storeKey, items) {
    const wrap = $(mountSel);
    const saved = Store.getMap(storeKey);
    wrap.innerHTML = items.map((label, i) =>
      `<label class="check"><input type="checkbox" data-i="${i}" ${saved[i] ? "checked" : ""}/><span>${label}</span></label>`
    ).join("");
    wrap.addEventListener("change", (e) => {
      const box = e.target.closest("input"); if (!box) return;
      const map = Store.getMap(storeKey);
      if (box.checked) map[box.dataset.i] = 1; else delete map[box.dataset.i];
      Store.setMap(storeKey, map);
    });
  }
  buildChecklist("#packList", "sdd_pack_v1", [
    "Extra clothes", "Swimwear", "Towel", "Slippers", "Toiletries", "Sunscreen", "Power bank",
    "Phone charger", "Water bottle", "Medicine", "Mosquito repellent", "Plastic bag for wet clothes",
    "Sunglasses", "Hat", "Cash", "ID", "Speaker", "Cards / games",
  ]);
  buildChecklist("#confirmList", "sdd_confirm_v1", [
    "Check-in time", "Checkout time", "ATV price", "Kayaking price", "Snorkeling price", "Surfing price",
    "Bonfire fee", "Firewood availability", "Towels", "Kitchen equipment", "Rice cooker", "Stove", "Grill",
    "Cooking gas", "Outside food policy", "Alcohol policy", "Parking", "Life jackets", "Weather policy", "Cancellation policy",
  ]);
  $("#resetPack").addEventListener("click", () => {
    Store.setMap("sdd_pack_v1", {});
    $$("#packList input").forEach((b) => b.checked = false);
  });

  /* =======================================================
     PHOTOS — tap to bring forward
     ======================================================= */
  $$(".pw").forEach((p) => p.addEventListener("click", () => {
    const on = p.classList.contains("is-front");
    $$(".pw").forEach((x) => x.classList.remove("is-front"));
    if (!on) p.classList.add("is-front");
  }));

  /* =======================================================
     RSVP SHEET + FORM + GUEST LIST
     ======================================================= */
  const sheet = $("#rsvpSheet");
  const form  = $("#rsvpForm");
  const rsvpBody = $("#rsvpBody");
  const rsvpDone = $("#rsvpDone");
  const RSVP_ACTS = ["Swimming","ATV","Kayaking","Snorkeling","Surfing","Beach Volleyball","Skimboarding","Bonfire","Tambay lang","Photoshoot","Inom","Sleep lang"];

  // build activity chips in the form
  $("#rsvpActs").innerHTML = RSVP_ACTS.map((a) =>
    `<label class="opt"><input type="checkbox" name="acts" value="${a}"/><span>${a}</span></label>`
  ).join("");

  let lastFocus = null;
  function openSheet(editing) {
    lastFocus = document.activeElement;
    // toggle done vs form
    rsvpDone.hidden = true; rsvpBody.hidden = false;
    if (editing) loadMyRSVP();
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    setTimeout(() => { form.querySelector("input[name=name]").focus(); }, 300);
  }
  function closeSheet() {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    if (lastFocus) lastFocus.focus();
  }
  $$("[data-open-rsvp]").forEach((b) => b.addEventListener("click", () => openSheet(!!Store.getMyId())));
  $$("[data-close-rsvp]").forEach((b) => b.addEventListener("click", closeSheet));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("is-open")) closeSheet(); });
  $("#editRsvpBtn").addEventListener("click", () => openSheet(true));
  $("#editAgain").addEventListener("click", () => { rsvpDone.hidden = true; rsvpBody.hidden = false; loadMyRSVP(); });

  function loadMyRSVP() {
    const id = Store.getMyId(); if (!id) return;
    const me = Store.getRSVPs().find((r) => r.id === id); if (!me) return;
    form.name.value = me.name || "";
    form.nickname.value = me.nickname || "";
    form.food.value = me.food || "";
    form.message.value = me.message || "";
    $$("input[name=coming]", form).forEach((r) => r.checked = r.value === me.coming);
    $$("input[name=transpo]", form).forEach((r) => r.checked = r.value === me.transpo);
    $$("input[name=acts]", form).forEach((c) => c.checked = (me.activities || []).includes(c.value));
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const coming = (form.querySelector("input[name=coming]:checked") || {}).value;
    const err = $("#rsvpErr");
    if (!name || !coming) { err.hidden = false; return; }
    err.hidden = true;

    const entry = {
      id: Store.getMyId() || uid(),
      name,
      nickname: form.nickname.value.trim(),
      coming,
      transpo: (form.querySelector("input[name=transpo]:checked") || {}).value || "",
      food: form.food.value.trim(),
      activities: $$("input[name=acts]:checked", form).map((c) => c.value),
      message: form.message.value.trim(),
      ts: Date.now(),
    };
    const list = Store.getRSVPs();
    const idx = list.findIndex((r) => r.id === entry.id);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    Store.saveRSVPs(list);
    Store.setMyId(entry.id);

    renderGuests();
    // show done screen + confetti
    rsvpBody.hidden = true; rsvpDone.hidden = false;
    if (!reduceMotion) fireConfetti();
  });

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  }
  const COMING_LBL = { yes: "Going", maybe: "Maybe", no: "Traydor" };
  const TRANSPO_LBL = { have: "Has a ride", need: "Needs a ride", offer: "Can take passengers" };

  function renderGuests() {
    const list = Store.getRSVPs();
    const yes = list.filter((r) => r.coming === "yes").length;
    const maybe = list.filter((r) => r.coming === "maybe").length;
    const no = list.filter((r) => r.coming === "no").length;
    $("#cntYes").textContent = yes; $("#cntMaybe").textContent = maybe; $("#cntNo").textContent = no;

    const empty = $("#guestsEmpty");
    const wrap = $("#guestList");
    if (!list.length) { empty.classList.remove("is-hidden"); wrap.innerHTML = ""; }
    else {
      empty.classList.add("is-hidden");
      const order = { yes: 0, maybe: 1, no: 2 };
      const sorted = [...list].sort((a, b) => (order[a.coming] - order[b.coming]) || (a.ts - b.ts));
      const myId = Store.getMyId();
      wrap.innerHTML = sorted.map((r) => {
        const bits = [];
        if (r.transpo) bits.push(TRANSPO_LBL[r.transpo]);
        if (r.activities && r.activities.length) bits.push(r.activities.slice(0, 3).join(", ") + (r.activities.length > 3 ? "…" : ""));
        return `<div class="guest guest--${r.coming}">
          <span class="guest__av" aria-hidden="true">${initials(r.name)}</span>
          <span class="guest__main">
            <span class="guest__name">${escapeHtml(r.name)}${r.id === myId ? " · you" : ""}${r.nickname ? ` <span class="guest__nick">“${escapeHtml(r.nickname)}”</span>` : ""}</span>
            ${bits.length ? `<span class="guest__meta">${escapeHtml(bits.join(" · "))}</span>` : ""}
          </span>
          <span class="guest__status">${COMING_LBL[r.coming]}</span>
        </div>`;
      }).join("");
    }
    // toggle edit button
    $("#editRsvpBtn").hidden = !Store.getMyId();
    const mainBtn = $("#mainRsvpBtn");
    if (mainBtn) mainBtn.textContent = Store.getMyId() ? "Update My RSVP" : "RSVP Now";
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  renderGuests();

  /* =======================================================
     CONFETTI
     ======================================================= */
  const confettiCanvas = $("#confetti");
  function fireConfetti() {
    const ctx = confettiCanvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    confettiCanvas.width = W * dpr; confettiCanvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    confettiCanvas.classList.add("is-active");
    const cols = ["#F97316", "#FDBA74", "#FDE68A", "#115E59", "#38bdf8", "#ffffff"];
    const N = 140;
    const parts = Array.from({ length: N }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 9, vy: Math.random() * -11 - 4,
      r: 4 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0],
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, life: 0,
    }));
    const start = performance.now();
    function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      parts.forEach((p) => {
        p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore();
      });
      if (t < 2600) requestAnimationFrame(frame);
      else { confettiCanvas.classList.remove("is-active"); ctx.clearRect(0, 0, W, H); }
    }
    requestAnimationFrame(frame);
  }

  /* =======================================================
     3D TILT (desktop pointer only)
     ======================================================= */
  if (canHover && !reduceMotion) {
    $$(".tilt").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(700px) rotateX(${py * -6}deg) rotateY(${px * 8}deg) translateY(-4px)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  /* =======================================================
     REVEAL ON SCROLL
     ======================================================= */
  function startReveals() {
    if (revealsStarted) return; revealsStarted = true;
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) { els.forEach((e) => e.classList.add("is-visible")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    els.forEach((e) => io.observe(e));
  }
  // if intro is skipped, reveals already kick in via revealSite()

  /* =======================================================
     EASTER EGG — click brand 5x
     ======================================================= */
  (function egg() {
    let count = 0, timer = null;
    const toast = $("#eggToast");
    $("#brand").addEventListener("click", () => {
      count++;
      clearTimeout(timer);
      timer = setTimeout(() => { count = 0; }, 1200);
      if (count >= 5) {
        count = 0;
        if (!reduceMotion) fireConfetti();
        toast.classList.add("is-show");
        setTimeout(() => toast.classList.remove("is-show"), 2600);
      }
    });
  })();

})();
