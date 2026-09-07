/* Смена на станции — протяжка плёнки.
   Кадры текста, полноэкранные тренажёры, подмена кадра под сцену игры,
   часы и жетоны в шапке, обязательная пауза. Кнопок переключения нет. */
(function () {
  "use strict";

  var blocks = Array.prototype.slice.call(document.querySelectorAll(".block"));
  var beats  = Array.prototype.slice.call(document.querySelectorAll(".beat"));
  var clock = document.getElementById("clock");
  var now = document.getElementById("now");
  var progress = document.getElementById("progress");
  var menu = document.getElementById("menu");
  var menuBtn = document.querySelector(".bar__menu");
  var sndBtn = document.getElementById("snd");
  var bar = document.getElementById("bar");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var S = window.Snd, F = window.FX;

  F.init();

  /* ── свет блока по кельвинам ─────────────────────────── */
  blocks.forEach(function (b) {
    var k = parseInt((b.querySelector(".hero__kelvin") || {}).textContent || "", 10);
    if (!k) return;
    b.style.setProperty("--tint", k < 3200 ? "rgba(242,180,65,.18)"
      : k <= 5200 ? "rgba(191,217,232,.10)" : "rgba(150,200,255,.16)");
  });

  /* ── меню ────────────────────────────────────────────── */
  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  menuBtn.addEventListener("click", function () { S.click(); setMenu(menu.hidden); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) setMenu(false);
  });

  /* ── звук ────────────────────────────────────────────── */
  sndBtn.setAttribute("aria-pressed", S.enabled() ? "true" : "false");
  sndBtn.classList.toggle("off", !S.enabled());
  sndBtn.addEventListener("click", function () {
    var on = S.toggle();
    sndBtn.setAttribute("aria-pressed", on ? "true" : "false");
    sndBtn.classList.toggle("off", !on);
    if (on) ambience(curBlock, true);
  });

  var amb = null;
  function ambience(b, force) {
    if (!b) return;
    var outdoor = /cover|outside|mast|sunrise|passage|drift|porch|hail/.test(b.getAttribute("style") || "");
    var want = outdoor ? "wind" : "gen";
    if (want === amb && !force) return;
    S.stop("wind"); S.stop("gen");
    amb = want;
    if (S.enabled()) S[want]();
  }

  /* ── протяжка: какой кадр сейчас ─────────────────────── */
  var curBeat = null, curBlock = blocks[0], ticking = false, idle = null;

  function frame() {
    ticking = false;
    var vh = window.innerHeight, mid = vh * 0.5, best = null, bestD = 1e9;

    for (var i = 0; i < beats.length; i++) {
      var el = beats[i];
      if (el.hidden) continue;
      var r = el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) { el.classList.remove("on"); continue; }
      var c = r.top + r.height / 2, d = Math.abs(c - mid);
      if (d < bestD) { bestD = d; best = el; }
      // кадр проявлен, пока его середина близко к середине экрана
      var visible = r.top < vh * 0.82 && r.bottom > vh * 0.18;
      el.classList.toggle("on", visible);
      el.classList.toggle("past", r.bottom <= vh * 0.18);
    }

    if (best && best !== curBeat) {
      curBeat = best;
      var b = best.closest(".block");
      if (b) {
        b.classList.add("seen");
        // чем светлее кадр, тем плотнее вуаль — иначе текст на нём тонет
        var bright = parseFloat(best.getAttribute("data-bright") || b.getAttribute("data-bright") || "0.3");
        var boost = Math.max(0, bright - 0.26) * 1.35;
        var veil = best.classList.contains("beat--title") ? 0.42
                 : best.classList.contains("beat--stage") ? 0.78 : 0.62;
        veil = Math.min(0.93, veil + boost);
        b.style.setProperty("--veil", veil);
        if (b !== curBlock) {
          curBlock = b;
          clock.textContent = b.getAttribute("data-time");
          now.textContent = b.getAttribute("data-title");
          ambience(b);
          if (!reduced) F.flash("rgba(191,217,232,.09)");
        }
        swapScene(b, best.getAttribute("data-scene"));
      }
    }

    var h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
  }

  /* кадр блока подменяется на сцену тренажёра — без швов */
  function swapScene(block, scene) {
    var sw = block.querySelector(".block__swap");
    if (!sw) return;
    if (scene) {
      var url = "assets/" + scene + ".jpg";
      if (sw.dataset.src !== url) { sw.dataset.src = url; sw.style.backgroundImage = "url('" + url + "')"; }
      sw.classList.add("on");
    } else sw.classList.remove("on");
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    bar.classList.remove("dim");
    clearTimeout(idle);
    idle = setTimeout(function () { bar.classList.add("dim"); }, 2600);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", frame);
  frame(); onScroll();
  document.addEventListener("pointerdown", function once() {
    ambience(curBlock, true);
    document.removeEventListener("pointerdown", once);
  }, { once: true });

  /* ── листание клавишами ──────────────────────────────── */
  function go(dir) {
    var list = beats.filter(function (b) { return !b.hidden; });
    var i = list.indexOf(curBeat);
    var next = list[i + dir];
    if (next) next.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }
  document.addEventListener("keydown", function (e) {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " ) { e.preventDefault(); go(1); }
    else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); go(-1); }
  });

  /* ── жетоны ──────────────────────────────────────────── */
  var stages = Array.prototype.slice.call(document.querySelectorAll(".beat--stage"));
  var tokN = document.getElementById("tok-n"), tokDots = document.getElementById("tok-dots");
  var earned = {};
  try { earned = JSON.parse(localStorage.getItem("station-tokens") || "{}") || {}; } catch (e) {}
  function drawTokens() {
    var n = 0; tokDots.textContent = "";
    stages.forEach(function (st) {
      var got = !!earned[st.dataset.stage]; if (got) n++;
      var d = document.createElement("i");
      d.className = "tok" + (got ? " tok--on" : "");
      d.title = st.dataset.name; tokDots.appendChild(d);
    });
    tokN.textContent = n; return n;
  }
  function award(id, win) {
    if (earned[id]) return;
    earned[id] = win ? 2 : 1;
    try { localStorage.setItem("station-tokens", JSON.stringify(earned)); } catch (e) {}
    var n = drawTokens();
    F.pop(document.getElementById("tokens"), "+жетон", "good");
    if (n === stages.length) { S.win(); F.flash("rgba(95,211,160,.3)"); }
  }
  drawTokens();

  /* ── тренажёры ───────────────────────────────────────── */
  stages.forEach(function (st) {
    var id = st.dataset.stage;
    var play = st.querySelector("[data-play]");
    var hint = st.querySelector("[data-hint]");
    var block = st.closest(".block");
    var res = block.querySelector('.beat--res[data-res="' + id + '"]');
    var after = Array.prototype.slice.call(block.querySelectorAll(".beat--after"));

    function openAfter() {
      after.forEach(function (b) { b.hidden = false; });
      beats = Array.prototype.slice.call(document.querySelectorAll(".beat"));
    }

    var ctx = {
      remount: function () {
        if (res) { res.hidden = true; res.textContent = ""; }
        play.textContent = "";
        if (hint) hint.classList.remove("gone");
        window.Games.run(id, play, ctx);
      },
      done: function (r) {
        if (hint) hint.classList.add("gone");
        if (res) {
          res.textContent = "";
          var wrap = document.createElement("div");
          wrap.className = "beat__in";
          var h = document.createElement("p");
          h.className = "res__title" + (r.win ? " res__title--win" : "");
          h.textContent = r.title; wrap.appendChild(h);
          (r.lines || []).forEach(function (l) {
            var p = document.createElement("p");
            p.className = "res__line"; p.textContent = l; wrap.appendChild(p);
          });
          var row = document.createElement("div");
          row.className = "res__btns";
          if (r.again) {
            var a = document.createElement("button");
            a.type = "button"; a.className = "gb gb--ghost"; a.textContent = r.again.label;
            a.addEventListener("click", function () {
              S.click(); r.again.fn();
              st.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
            });
            row.appendChild(a);
          }
          if (r.copy) {
            var c = document.createElement("button");
            c.type = "button"; c.className = "gb gb--ghost"; c.textContent = "Скопировать обещание";
            c.addEventListener("click", function () {
              try { navigator.clipboard.writeText(r.copy); } catch (e) {}
              c.textContent = "Скопировано"; S.good();
            });
            row.appendChild(c);
          }
          if (row.children.length) wrap.appendChild(row);
          res.appendChild(wrap);
          res.hidden = false;
        }
        openAfter();
        award(id, r.win);
        // плёнка едет дальше сама
        setTimeout(function () {
          if (res && !reduced) res.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 900);
      }
    };

    if (window.Games.has(id)) {
      var started = false;
      var run = function () { if (started) return; started = true; window.Games.run(id, play, ctx); };
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (en, obs) {
          en.forEach(function (e) { if (e.isIntersecting) { run(); obs.disconnect(); } });
        }, { rootMargin: "400px" }).observe(st);
      } else run();
    } else {
      play.innerHTML = '<p class="stage__hint">Тренажёр в работе</p>';
      openAfter();
    }
  });

  /* ── параллакс сцены за курсором ─────────────────────── */
  if (!reduced && matchMedia("(pointer:fine)").matches) {
    document.addEventListener("mousemove", function (e) {
      var st = curBeat && curBeat.classList.contains("beat--stage") ? curBeat.querySelector(".stage__play") : null;
      if (!st) return;
      var r = st.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / Math.max(r.height, 1);
      st.style.setProperty("--ry", (dx * 5).toFixed(2) + "deg");
      st.style.setProperty("--rx", (-dy * 3.4).toFixed(2) + "deg");
    }, { passive: true });
  }

  /* ── обязательная пауза ──────────────────────────────── */
  var timer = document.querySelector(".timer");
  if (timer) {
    var total = parseInt(timer.getAttribute("data-seconds"), 10) || 60;
    var num = timer.querySelector(".timer__num");
    var left = total, iv = null, savedY = 0, state = "wait";
    try { if (sessionStorage.getItem("station-pause") === "done") state = "done"; } catch (e) {}
    if (state === "done") finish(true);

    function lock() {
      savedY = window.scrollY;
      document.body.classList.add("locked");
      document.body.style.position = "fixed";
      document.body.style.top = -savedY + "px";
      document.body.style.width = "100%";
    }
    function unlock() {
      document.body.classList.remove("locked");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, savedY);
    }
    function finish(silent) {
      state = "done";
      if (iv) { clearInterval(iv); iv = null; }
      timer.classList.add("done");
      num.textContent = "Смена продолжается";
      if (!silent) { unlock(); S.good(); }
      try { sessionStorage.setItem("station-pause", "done"); } catch (e) {}
    }
    function start() {
      if (state !== "wait") return;
      state = "run"; num.textContent = left;
      if (!reduced) lock();
      S.wind();
      iv = setInterval(function () {
        left--; num.textContent = left > 0 ? left : 0;
        if (left % 10 === 0) S.tick();
        if (left <= 0) finish(false);
      }, 1000);
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state === "run") finish(false);   // страховка
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) start(); });
      }, { threshold: 0.6 }).observe(timer);
    }
  }

  /* ── чек-лист финала ─────────────────────────────────── */
  var KEY = "station-checklist", saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
  document.querySelectorAll(".checklist input").forEach(function (b, i) {
    b.checked = !!saved[i];
    b.addEventListener("change", function () {
      saved[i] = b.checked; S[b.checked ? "good" : "tick"]();
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
    });
  });
})();
