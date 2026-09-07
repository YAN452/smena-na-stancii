/* Тренажёры курса «Смена на станции».
   Каждый регистрируется в Games и монтируется в свой слот сборщиком. */
window.Games = (function () {
  "use strict";
  var reg = {};
  var S = window.Snd, F = window.FX;

  /* ── мелкие помощники ─────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(text, cls, fn) {
    var b = el("button", "gb " + (cls || ""), text);
    b.type = "button";
    b.addEventListener("click", function (e) { S.click(); fn(e, b); });
    return b;
  }
  function hhmm(min) {
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function bar(cls) {
    var w = el("div", "meter " + (cls || "")), i = el("i");
    w.appendChild(i); w.set = function (v) { i.style.width = Math.max(0, Math.min(100, v)) + "%"; };
    return w;
  }
  function img(name, cls) {
    var i = el("img", cls || "");
    i.src = "assets/" + name; i.alt = ""; i.loading = "lazy";
    i.addEventListener("error", function () { i.classList.add("no-file"); i.removeAttribute("src"); });
    return i;
  }

  /* ═══════════════ 1. Вахтенный журнал ═══════════════════ */
  reg.log = function (root, ctx) {
    var TASKS = ["Свести суточную сводку", "Перезвонить на базу", "Заказать солярку",
      "Проверить показания", "Отправить отчёт за неделю", "Согласовать смету",
      "Починить антенну", "Ответить механику", "Снять данные с датчика",
      "Подтвердить рейс", "Списать израсходованное", "Записать расход топлива",
      "Уточнить сроки поставки", "Собрать заявку"];
    var round = 1, hist = [];

    function play(forceLog) {
      root.textContent = "";
      var head = [], logged = 0, lost = 0, left = 45, spawned = 0, t0 = Date.now();
      var wrap = el("div", "log");
      var top = el("div", "log__in");
      var cols = el("div", "log__cols");
      var headBox = el("div", "log__box log__box--head");
      var bookBox = el("div", "log__box log__box--book");
      headBox.appendChild(el("p", "log__cap", "В голове · 4 места"));
      bookBox.appendChild(el("p", "log__cap", "Вахтенный журнал"));
      var headList = el("div", "log__slots"), bookList = el("div", "log__list");
      headBox.appendChild(headList); bookBox.appendChild(bookList);
      cols.appendChild(headBox); cols.appendChild(bookBox);
      var hud = el("div", "ghud");
      var tEl = el("b", "", "0:45"), lEl = el("b", "", "0"), fEl = el("b", "", "0");
      hud.append(el("span", "", "осталось "), tEl, el("span", "", " · записано "), lEl,
                 el("span", "", " · потеряно "), fEl);
      wrap.append(hud, top, cols);
      root.appendChild(wrap);

      for (var i = 0; i < 4; i++) headList.appendChild(el("div", "slot"));

      function drawHead() {
        var slots = headList.children;
        for (var i = 0; i < 4; i++) {
          var c = head[i], s = slots[i];
          s.textContent = ""; s.className = "slot";
          if (!c) continue;
          var age = (Date.now() - c.at) / 1000;
          s.className = "slot slot--full" + (age > 16 ? " slot--iced" : age > 9 ? " slot--frost" : "");
          s.textContent = age > 16 ? "· · ·" : age > 9 ? c.text.split(" ")[0] + " …" : c.text;
        }
      }
      var card = null;
      function spawn() {
        if (card || left <= 0) return;
        var text = TASKS[spawned % TASKS.length]; spawned++;
        S.radio();
        card = el("div", "log__card");
        card.appendChild(el("p", "log__text", text));
        var row = el("div", "log__btns");
        row.appendChild(btn("Записать в журнал", "gb--ok", function () {
          S.pen(); logged++; lEl.textContent = logged;
          var li = el("div", "log__item", text); bookList.appendChild(li);
          bookList.scrollTop = bookList.scrollHeight;
          F.pop(card, "+1", "good");
          close(1.1);
        }));
        if (!forceLog) {
          row.appendChild(btn("Запомню так", "gb--ghost", function () {
            if (head.length >= 4) {
              var out = head.shift(); lost++; fEl.textContent = lost;
              S.bad(); F.pop(headList, "забыл: " + out.text.split(" ")[0], "bad");
            }
            head.push({ text: text, at: Date.now() });
            drawHead(); close(0);
          }));
        }
        card.appendChild(row);
        top.appendChild(card);
      }
      function close(lockSec) {
        if (!card) return;
        var c = card; card = null;
        c.classList.add("out");
        setTimeout(function () { c.remove(); }, 220);
        setTimeout(spawn, 400 + lockSec * 1000);
      }
      spawn();

      var iv = setInterval(function () {
        left--; tEl.textContent = "0:" + (left < 10 ? "0" : "") + left;
        // старение того, что в голове
        for (var i = head.length - 1; i >= 0; i--) {
          var age = (Date.now() - head[i].at) / 1000;
          if (age > 22) {
            S.ice(); lost++; fEl.textContent = lost;
            F.pop(headList, "забыл целиком", "bad");
            head.splice(i, 1);
          }
        }
        drawHead();
        F.frost(Math.min(head.length / 5 + lost * 0.08, 0.85));
        if (!card && left > 2) spawn();
        if (left <= 0) { clearInterval(iv); finish(); }
      }, 1000);

      function finish() {
        F.frost(0);
        var kept = head.length;
        hist.push({ round: round, logged: logged, lost: lost, kept: kept });
        var win = lost === 0 && logged >= 6;
        S[win ? "win" : "lose"]();
        var lines = [
          "Записано в журнал: " + logged,
          "Осталось в голове к концу смены: " + kept,
          "Потеряно: " + lost
        ];
        if (round === 1 && lost > 0) {
          lines.push("Каждая потерянная строка — это задача, про которую вы вспомните в неудобный момент.");
          ctx.done({ win: false, title: "Смена закрыта с потерями", lines: lines,
            again: { label: "Сыграть ещё раз, записывая всё", fn: function () { round = 2; play(true); } } });
        } else {
          ctx.done({ win: win, title: win ? "Ни одной потерянной задачи" : "Уже лучше", lines: lines });
        }
      }
    }
    play(false);
  };

  /* ═══════════════ 2. График вахты ═══════════════════════ */
  reg.board = function (root, ctx) {
    var TYPES = {
      radio:  { name: "связь",   icon: "obj-magnet-radio.png" },
      wrench: { name: "ремонт",  icon: "obj-magnet-wrench.png" },
      paper:  { name: "тексты",  icon: "obj-magnet-paper.png" },
      obs:    { name: "рутина",  icon: "obj-magnet-balloon.png" }
    };
    var TASKS = [
      { id: 1, t: "radio", n: "Созвон с базой" }, { id: 2, t: "radio", n: "Планёрка" },
      { id: 3, t: "paper", n: "Сводка за неделю" }, { id: 4, t: "paper", n: "Смета" },
      { id: 5, t: "wrench", n: "Ремонт генератора" }, { id: 6, t: "wrench", n: "Замена троса" },
      { id: 7, t: "obs", n: "Снять показания" }, { id: 8, t: "obs", n: "Запуск зонда" }
    ];
    var CELLS = 18, START = 9 * 60;                    // 9:00, шаг 30 минут
    var grid = new Array(CELLS).fill(null);
    grid[8] = { kind: "lunch" }; grid[9] = { kind: "lunch" };   // 13:00–14:00

    var picked = null;
    var wrap = el("div", "board");
    var pal = el("div", "board__pal");
    var strip = el("div", "board__grid");
    var hint = el("p", "board__hint", "Возьмите магнит и поставьте в сетку. Обед в 13:00 занят.");
    var run = btn("Запустить смену", "gb--go", simulate);
    wrap.append(el("p", "log__cap", "Смена 09:00 – 18:00, шаг 30 минут"), strip, pal, hint, run);
    root.appendChild(wrap);

    function drawPal() {
      pal.textContent = "";
      TASKS.forEach(function (t) {
        if (grid.some(function (c) { return c && c.id === t.id; })) return;
        var m = el("button", "magnet magnet--" + t.t); m.type = "button";
        m.appendChild(img(TYPES[t.t].icon, "magnet__i"));
        m.appendChild(el("span", "", t.n));
        m.addEventListener("click", function () { S.pick(); pick({ kind: "task", id: t.id, t: t.t, n: t.n }, m); });
        pal.appendChild(m);
      });
      var br = el("button", "magnet magnet--break"); br.type = "button";
      br.appendChild(img("obj-magnet-break.png", "magnet__i"));
      br.appendChild(el("span", "", "Перерыв"));
      br.addEventListener("click", function () { S.pick(); pick({ kind: "break", n: "Перерыв" }, br); });
      pal.appendChild(br);
    }
    function pick(item, node) {
      picked = item;
      Array.prototype.forEach.call(pal.children, function (c) { c.classList.remove("on"); });
      if (node) node.classList.add("on");
      hint.textContent = "Теперь щёлкните по клетке. Ещё раз по магниту — снять выбор.";
    }
    function drawGrid() {
      strip.textContent = "";
      grid.forEach(function (c, i) {
        var cell = el("button", "cell"); cell.type = "button";
        cell.appendChild(el("span", "cell__t", hhmm(START + i * 30)));
        if (c && c.kind === "lunch") { cell.classList.add("cell--lunch"); cell.appendChild(el("span", "cell__n", "обед")); }
        else if (c && c.kind === "break") { cell.classList.add("cell--break"); cell.appendChild(el("span", "cell__n", "перерыв")); }
        else if (c) { cell.classList.add("cell--task", "cell--" + c.t); cell.appendChild(el("span", "cell__n", c.n)); }
        cell.addEventListener("click", function () {
          if (c && c.kind === "lunch") { S.bad(); F.shake(cell, 4); return; }
          if (c) { grid[i] = null; S.pick(); drawGrid(); drawPal(); return; }
          if (!picked) { hint.textContent = "Сначала возьмите магнит снизу."; S.bad(); return; }
          grid[i] = picked; S.place(); F.burst(cell, "#BFD9E8", 6);
          picked = null; drawGrid(); drawPal();
        });
        strip.appendChild(cell);
      });
    }
    drawGrid(); drawPal();

    function simulate() {
      var placed = TASKS.filter(function (t) { return grid.some(function (c) { return c && c.id === t.id; }); });
      if (placed.length < TASKS.length) {
        hint.textContent = "Ещё не все задачи на доске — осталось " + (TASKS.length - placed.length) + ".";
        S.bad(); F.shake(strip, 5); return;
      }
      run.disabled = true;
      var min = START, sinceBreak = 0, lastType = null, extra = 0, notes = [], free = 0;
      var i = 0;
      (function step() {
        if (i >= CELLS) { return finish(); }
        var c = grid[i], cell = strip.children[i];
        cell.classList.add("cell--now");
        var add = 30;
        if (!c) { free++; sinceBreak = 0; }
        else if (c.kind === "lunch") { sinceBreak = 0; lastType = null; }
        else if (c.kind === "break") { sinceBreak = 0; lastType = null; S.tick(); }
        else {
          if (lastType && lastType !== c.t) { add += 12; extra += 12; notes.push("разогрев после смены типа: +12 мин"); F.pop(cell, "+12 мин", "bad"); }
          sinceBreak += 30;
          if (sinceBreak > 60) { add += 10; extra += 10; notes.push("час без перерыва: +10 мин"); F.pop(cell, "+10", "bad"); }
          lastType = c.t; S.place();
        }
        min += add;
        if (i === 10) {                              // 14:20 — форс-мажор
          S.alarm(); F.flash("rgba(226,112,90,.35)");
          var slot = grid.slice(10, 14).some(function (x) { return !x; });
          if (slot) { notes.push("срочный созвон в 14:20 влез в свободный слот"); F.pop(cell, "форс-мажор принят", "good"); }
          else { min += 40; extra += 40; notes.push("срочный созвон в 14:20 некуда было деть: +40 мин"); F.pop(cell, "+40 мин", "bad"); }
        }
        setTimeout(function () { cell.classList.remove("cell--now"); i++; step(); }, 130);
      })();

      function finish() {
        var end = min, over = end > 18 * 60;
        S[over ? "lose" : "win"]();
        if (!over) F.flash("rgba(242,180,65,.28)");
        S.horn();
        var uniq = notes.filter(function (v, k, a) { return a.indexOf(v) === k; });
        ctx.done({
          win: !over,
          title: over ? "Смена закончилась в " + hhmm(end) : "Смена закрыта в " + hhmm(end),
          lines: [
            over ? "Все задачи сделаны — но день утёк за 18:00. По правилам курса это поражение."
                 : "Все задачи закрыты внутри смены. Это и есть победа.",
            "Потеряно на переключениях и усталости: " + extra + " мин",
            "Свободных слотов оставалось: " + free + " из 16"
          ].concat(uniq),
          again: { label: "Разложить заново", fn: function () {
            grid = new Array(CELLS).fill(null); grid[8] = { kind: "lunch" }; grid[9] = { kind: "lunch" };
            run.disabled = false; drawGrid(); drawPal();
          } }
        });
      }
    }
  };

  /* ═══════════════ 3. Утренний занос ═════════════════════ */
  reg.drift = function (root, ctx) {
    var tasks = [
      { n: "Разгрести занос у двери", drift: true, base: 40 },
      { n: "Свести сводку", base: 55 }, { n: "Созвон с базой", base: 45 },
      { n: "Проверить датчики", base: 50 }, { n: "Отчёт за неделю", base: 60 },
      { n: "Заявка на солярку", base: 40 }
    ];
    var min = 9 * 60, stage = 0, driftDone = false, lostMin = 0, busy = false;
    var wrap = el("div", "drift");
    var scene = el("div", "drift__scene");
    var pile = img("obj-drift-1.png", "drift__pile");
    scene.appendChild(pile);
    var clock = el("p", "drift__clock", "09:00");
    var list = el("div", "drift__list");
    wrap.append(clock, scene, list);
    root.appendChild(wrap);

    function draw() {
      list.textContent = "";
      tasks.forEach(function (t, i) {
        if (t.done) return;
        var b = el("button", "task" + (t.drift ? " task--bad" : "")); b.type = "button";
        b.appendChild(el("span", "task__n", t.n));
        b.appendChild(el("span", "task__m", Math.round(t.base * (1 + stage * 0.18)) + " мин"));
        b.addEventListener("click", function () { doTask(t, b); });
        list.appendChild(b);
      });
      pile.src = "assets/obj-drift-" + Math.min(4, stage + 1) + ".png";
      scene.style.setProperty("--grow", (0.34 + stage * 0.22).toFixed(2));
      F.frost(stage * 0.22);
      F.storm(1 + stage * 0.5);
    }
    function doTask(t, node) {
      if (busy) return;
      busy = true;
      var cost = Math.round(t.base * (1 + stage * 0.18));
      if (!t.drift) lostMin += cost - t.base;
      node.classList.add("task--run");
      S[t.drift ? "shovel" : "tick"]();
      var p = 0, iv = setInterval(function () {
        p += 8; node.style.setProperty("--p", p + "%");
        if (p >= 100) {
          clearInterval(iv); busy = false;
          t.done = true; min += cost;
          if (t.drift) { driftDone = true; S.good(); F.burst(node, "#CFE3EF", 18); }
          else if (!driftDone) { stage = Math.min(4, stage + 1); S.ice(); }
          clock.textContent = hhmm(min);
          if (tasks.every(function (x) { return x.done; })) return finish();
          draw();
        }
      }, 55);
    }
    function finish() {
      F.frost(0); F.storm(1);
      var win = lostMin === 0;
      S[win ? "win" : "lose"]();
      ctx.done({
        win: win,
        title: win ? "День закрыт в " + hhmm(min) : "День закрыт в " + hhmm(min) + " — и это дороже, чем кажется",
        lines: win
          ? ["Занос разгребли первым, и остальные дела шли в свою обычную длину.",
             "Потеряно на отложенной задаче: 0 минут."]
          : ["Пока занос стоял у двери, каждое следующее дело шло медленнее.",
             "Потеряно на этом: " + lostMin + " мин — почти " + Math.max(1, Math.round(lostMin / 60)) + " ч из смены.",
             "Сама задача заняла бы 40 минут."],
        again: { label: "Прожить день заново", fn: function () {
          tasks.forEach(function (t) { t.done = false; });
          min = 9 * 60; stage = 0; driftDone = false; lostMin = 0; clock.textContent = "09:00"; draw();
        } }
      });
    }
    draw();
  };

  /* ═══════════════ 4. Мачта ══════════════════════════════ */
  reg.mast = function (root, ctx) {
    var ice = 100, left = 60, hits = 0, opened = 0, over = false;
    var wrap = el("div", "mast");
    var stage = el("div", "mast__stage");
    var sleeve = img("obj-ice-1.png", "mast__ice");
    stage.appendChild(sleeve);
    var m = bar("meter--ice"); m.set(100);
    var locked = el("div", "mast__locked");
    ["Ответить в чат", "Разобрать почту", "Свести отчёт", "Заказать запчасть"].forEach(function (n) {
      var d = el("div", "lockrow");
      d.appendChild(img("obj-lock.png", "lockrow__i"));
      d.appendChild(el("span", "", n));
      locked.appendChild(d);
    });
    var hud = el("div", "ghud");
    var tEl = el("b", "", "60"); hud.append(el("span", "", "лёд · "), m, el("span", "", " · "), tEl, el("span", "", " с"));
    var hit = btn("Бить", "gb--go gb--big", function (e, b) {
      if (over) return;
      ice = Math.max(0, ice - 3.2); hits++;
      S.crack(); F.shake(stage, 5); F.burst(b, "#DCEBF5", 6);
      sleeve.src = "assets/obj-ice-" + (ice > 66 ? 1 : ice > 33 ? 2 : 3) + ".png";
      m.set(ice);
      if (ice <= 0) finish(true);
    });
    wrap.append(hud, stage, hit, el("p", "mast__cap", "Пока мачта во льду, всё остальное закрыто"), locked);
    root.appendChild(wrap);

    var pop = null;
    function distract() {
      if (over || pop) return;
      var names = ["Сообщение в общем чате", "Письмо «на минутку»", "Звонок не по делу", "Лента обновилась"];
      pop = el("div", "distract");
      pop.appendChild(el("p", "", names[Math.floor(Math.random() * names.length)]));
      var row = el("div", "distract__b");
      row.appendChild(btn("Отложить", "gb--ok", function () { S.good(); kill(); }));
      row.appendChild(btn("Открыть", "gb--ghost", function () {
        opened++; ice = Math.min(100, ice + 12); m.set(ice); S.bad(); F.flash("rgba(226,112,90,.25)");
        sleeve.src = "assets/obj-ice-" + (ice > 66 ? 1 : ice > 33 ? 2 : 3) + ".png";
        kill();
      }));
      pop.appendChild(row);
      wrap.appendChild(pop);
      S.alarm();
    }
    function kill() { if (pop) { pop.remove(); pop = null; } }
    var d1 = setInterval(distract, 7000);
    var iv = setInterval(function () {
      left--; tEl.textContent = left;
      if (left <= 0) finish(false);
    }, 1000);
    function finish(win) {
      over = true; clearInterval(iv); clearInterval(d1); kill(); hit.disabled = true;
      if (win) { locked.classList.add("open"); S.win(); F.flash("rgba(95,211,160,.28)"); } else S.lose();
      ctx.done({
        win: win,
        title: win ? "Лёд сбит, связь есть" : "Время вышло, мачта во льду",
        lines: [
          "Ударов: " + hits + ", принятых отвлечений: " + opened,
          opened ? "Каждое открытое сообщение возвращало на мачту лёд — буквально то же, что происходит с задачей, которую вы бросаете на середине."
                 : "Ни одного отвлечения — поэтому и получилось за минуту.",
          "Пока главное не сделано, всё остальное закрыто. В этом весь приём."
        ],
        again: { label: "Ещё раз", fn: function () { ctx.remount(); } }
      });
    }
  };

  /* ═══════════════ 5. Весы ═══════════════════════════════ */
  reg.scales = function (root, ctx) {
    var WORK = [
      { n: "Ответственная", ax: { resp: 2 } },
      { n: "Малоподвижная", ax: { move: 2 } },
      { n: "Экранная", ax: { eyes: 2 } },
      { n: "Разговорная", ax: { talk: 1 } }
    ];
    var REST = [
      { n: "Пробежка", ax: { move: 2 } },
      { n: "Турник во дворе", ax: { move: 2 } },
      { n: "Прогулка без телефона", ax: { move: 1, eyes: 2 } },
      { n: "Готовка руками", ax: { resp: 2 } },
      { n: "Мастерить", ax: { resp: 2, eyes: 1 } },
      { n: "Побыть одному", ax: { talk: 1 } },
      { n: "Сон", ax: {} },
      { n: "Сериал", ax: { eyes: -2 } },
      { n: "Лента в телефоне", ax: { eyes: -2, move: -1 } }
    ];
    var need = {}, got = {}, chosen = [];
    WORK.forEach(function (w) {
      Object.keys(w.ax).forEach(function (k) { need[k] = (need[k] || 0) + w.ax[k]; });
    });

    var wrap = el("div", "scales");
    var beam = el("div", "scales__beam");
    var panL = el("div", "pan pan--l"), panR = el("div", "pan pan--r");
    beam.append(panL, panR);
    var stand = el("div", "scales__stand");
    stand.appendChild(img("obj-scale-frame.png", "scales__frame"));
    var body = el("div", "scales__body"); body.append(beam, stand);
    WORK.forEach(function (w) { panL.appendChild(el("span", "chip chip--work", w.n)); });
    var pool = el("div", "scales__pool");
    var out = el("p", "scales__out",
      "Смена была ответственная, малоподвижная, экранная и разговорная. Уравновесьте её.");
    wrap.append(el("p", "log__cap", "Слева — какой была смена. Справа — чем отдыхать"), body, pool, out);
    root.appendChild(wrap);

    REST.forEach(function (r) {
      var b = el("button", "chip chip--rest"); b.type = "button"; b.textContent = r.n;
      b.addEventListener("click", function () {
        if (b.disabled) return;
        b.disabled = true; chosen.push(r);
        var helps = false;
        Object.keys(r.ax).forEach(function (k) {
          got[k] = (got[k] || 0) + r.ax[k];
          if (r.ax[k] > 0 && (need[k] || 0) > 0) helps = true;
        });
        panR.appendChild(el("span", "chip chip--on", r.n));
        S[helps ? "good" : "bad"]();
        if (!helps) F.shake(body, 5);
        recalc(r, helps);
      });
      pool.appendChild(b);
    });

    function recalc(last, helps) {
      var score = 0, total = 0, left = [];
      Object.keys(need).forEach(function (k) {
        total += need[k];
        var v = Math.min(need[k], Math.max(0, got[k] || 0));
        score += v;
        if (v < need[k]) left.push(k);
      });
      beam.style.setProperty("--tilt", (14 - (score / total) * 28).toFixed(1) + "deg");
      if (score >= total - 1 && chosen.length >= 2) return finish(true);
      if (chosen.length >= 5) return finish(false);
      var NAMES = { resp: "ответственность", move: "неподвижность", eyes: "экран", talk: "разговоры" };
      out.textContent = helps
        ? "Чаша пошла вверх. Не уравновешено пока: " + left.map(function (k) { return NAMES[k]; }).join(", ") + "."
        : "«" + last.n + "» чашу не поднимает: это та же поза и тот же экран, от которых вы устали.";
    }
    function finish(win) {
      pool.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      S[win ? "win" : "lose"]();
      ctx.done({
        win: win,
        title: win ? "Чаши сошлись" : "Весы так и стоят",
        lines: win
          ? ["Вы взяли полярное тому, чем был занят день: движение против сидячей работы, руки против головы, тишину против разговоров.",
             "Правило простое: отдых должен быть противоположен работе, а не просто приятен.",
             "Сон и сериал сюда не годятся не потому, что они плохие, а потому, что это та же неподвижность."]
          : ["Чаша не поднялась: выбранное не противоположно тому, чем был занят день.",
             "Сон и лента после сидячей экранной смены оставляют вас в той же позе и перед тем же экраном."],
        again: { label: "Ещё раз", fn: function () { ctx.remount(); } }
      });
    }
  };

  /* ═══════════════ 6. Неприкосновенный запас ═════════════ */
  reg.ration = function (root, ctx) {
    var opened = 0, tasks = ["Сводка сдана", "Антенна починена", "Отчёт отправлен"];
    var wrap = el("div", "ration");
    var locker = el("button", "locker"); locker.type = "button";
    locker.setAttribute("aria-label", "Шкафчик с неприкосновенным запасом");
    locker.appendChild(img("obj-hasp-key.png", "locker__lock"));
    var shelf = el("div", "locker__shelf");
    ["obj-condensed-milk.png", "obj-chocolate.png", "obj-canned.png"].forEach(function (n) {
      shelf.appendChild(img(n, "locker__item"));
    });
    locker.appendChild(shelf);
    var pool = el("div", "ration__pool");
    var out = el("p", "scales__out", "Замок закрыт.");
    wrap.append(el("p", "log__cap", "НЗ"), locker, pool, out);
    root.appendChild(wrap);

    var armed = null;
    tasks.forEach(function (t) {
      var b = el("button", "chip chip--task"); b.type = "button"; b.textContent = "✓ " + t;
      b.addEventListener("click", function () {
        if (b.disabled) return;
        armed = b; b.classList.add("on"); S.pick();
        out.textContent = "Задача в руке. Теперь можно открывать.";
      });
      pool.appendChild(b);
    });
    locker.addEventListener("click", function () {
      if (!armed) {
        S.bad(); F.shake(locker, 7);
        out.textContent = "Замок не поддался. Награда без результата рвёт связь — в этом весь приём.";
        return;
      }
      armed.disabled = true; armed.classList.remove("on"); armed = null;
      opened++; S.open(); locker.classList.add("open");
      F.burst(locker, "#F2B441", 16); F.pop(locker, "+эндорфины", "good");
      setTimeout(function () { locker.classList.remove("open"); }, 900);
      if (opened >= 3) {
        S.win();
        ctx.done({ win: true, title: "Связь закреплена",
          lines: ["Три раза подряд награда пришла только после закрытой задачи.",
                  "Организм учится выделять эндорфины на результат, а не на нажатие кнопки."] });
      } else out.textContent = "Открыто за результат. Осталось задач: " + (3 - opened);
    });
  };

  /* ═══════════════ 7. Скины ══════════════════════════════ */
  reg.skins = function (root, ctx) {
    var SET = [
      { f: "char-you-f-pyjama.png", n: "Термобельё и плед", feel: 25, out: false, s: "Тепло, удобно и совершенно нерабоче." },
      { f: "char-you-f-sweater.png", n: "Растянутый свитер", feel: 60, out: false, s: "Компромисс, в котором живёт большинство." },
      { f: "char-you-f-overall.png", n: "Рабочая роба", feel: 95, out: true, s: "В этом можно выйти к людям — и это меняет осанку." },
      { f: "char-you-f-parka.png", n: "Парка", feel: 70, out: true, s: "Для выхода наружу. В модуле будет жарко." }
    ];
    var wrap = el("div", "skins");
    var fig = el("div", "skins__fig"); var pic = img(SET[0].f, "skins__img"); fig.appendChild(pic);
    var m = bar("meter--feel"); var lbl = el("p", "scales__out", SET[0].s);
    var row = el("div", "skins__row");
    wrap.append(el("p", "log__cap", "Самоощущение"), m, fig, row, lbl);
    root.appendChild(wrap); m.set(SET[0].feel);

    SET.forEach(function (s, i) {
      var b = el("button", "chip chip--rest"); b.type = "button"; b.textContent = s.n;
      b.addEventListener("click", function () {
        S.click(); pic.src = "assets/" + s.f; m.set(s.feel); lbl.textContent = s.s;
        pic.animate([{transform:"rotateY(-12deg) scale(.97)"},{transform:"none"}],{duration:420,easing:"cubic-bezier(.2,.8,.3,1)"});
        row.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        if (s.out) { S.good(); F.pop(fig, "+" + s.feel, "good"); }
        if (i === 2) {
          ctx.done({ win: true, title: "Скин выбран",
            lines: ["Работать нужно в том, в чём вы могли бы свободно выйти на улицу.",
                    "Удобно — но при этом красиво и чисто. Через такие мелочи формируется отношение к работе."] });
        }
      });
      row.appendChild(b);
    });
  };

  /* ═══════════════ 8. Выйди на связь ═════════════════════ */
  reg.radio = function (root, ctx) {
    var WHO = [
      { f: null, n: "Никому", p: 35, s: "Обещание, которое никто не слышал, легко переносится на завтра." },
      { f: "char-face-chief.png", n: "Начальству", p: 70, s: "Начальству — работает: есть кому спросить." },
      { f: "char-face-friend.png", n: "Приятелю", p: 78, s: "Приятель спросит без формальностей — и это неудобнее." },
      { f: "char-face-crush.png", n: "Тому, кто нравится", p: 92, s: "Приём работает сильнее всего именно здесь." },
      { f: "char-face-crew.png", n: "Всей смене", p: 85, s: "Мосты сожжены публично." }
    ];
    var wrap = el("div", "radio");
    var m = bar("meter--feel"); m.set(35);
    var row = el("div", "radio__row");
    var out = el("p", "scales__out", "Назовите срок вслух — и выберите, кто это услышит.");
    var text = el("textarea", "radio__text");
    text.setAttribute("aria-label", "Текст обещания");
    text.value = "Сделаю сводку за неделю до пятницы, 18:00.";
    wrap.append(el("p", "log__cap", "Вероятность, что сделаете в срок"), m, text, row, out);
    root.appendChild(wrap);

    WHO.forEach(function (w) {
      var b = el("button", "who"); b.type = "button";
      if (w.f) b.appendChild(img(w.f, "who__i")); else b.appendChild(el("span", "who__i who__i--none", "—"));
      b.appendChild(el("span", "", w.n));
      b.addEventListener("click", function () {
        S.radio(); m.set(w.p); out.textContent = w.s + " — " + w.p + " %";
        row.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        if (w.p >= 85) {
          S.good();
          ctx.done({ win: true, title: "Слово дано",
            lines: [w.s, "Проговорите, что сделаете и в какие сроки. Всё, мосты сожжены."],
            copy: text.value });
        }
      });
      row.appendChild(b);
    });
  };

  /* ═══════════════ 9. Аппаратная ═════════════════════════ */
  reg.room = function (root, ctx) {
    var kelvin = 2700, items = {};
    var GOOD = [["obj-desk.png", "Стол", 14], ["obj-chair.png", "Кресло", 12],
                ["obj-monitor.png", "Большой монитор", 16], ["obj-lamp-arm.png", "Лампа", 10],
                ["obj-shelf.png", "Полка", 6], ["obj-rug.png", "Половик — граница зон", 8],
                ["obj-plant-lamp.png", "Зелень под фитолампой", 6], ["obj-cable-tray.png", "Кабель-канал", 4]];
    var BAD  = [["obj-bunk.png", "Койка вплотную", -18], ["obj-radio-set.png", "Приёмник на столе", -10],
                ["obj-heater.png", "Обогреватель в ноги", 4]];
    var wrap = el("div", "room");
    var view = el("div", "room__view");
    var glow = el("div", "room__glow");
    var floor = el("div", "room__floor");
    view.append(glow, floor);
    var lightLbl = el("p", "room__k", "2700 K — тёплый, убаюкивает");
    var slider = el("input", "room__slider");
    slider.type = "range"; slider.min = 2000; slider.max = 6500; slider.step = 100; slider.value = 2700;
    slider.setAttribute("aria-label", "Температура света лампы в кельвинах");
    var m = bar("meter--feel");
    var out = el("p", "scales__out", "Соберите угол и выставьте свет.");
    var pool = el("div", "room__pool");
    wrap.append(el("p", "log__cap", "Фокус"), m, view, lightLbl, slider, pool, out);
    root.appendChild(wrap);

    GOOD.concat(BAD).forEach(function (it) {
      var b = el("button", "chip"); b.type = "button"; b.textContent = it[1];
      b.addEventListener("click", function () {
        items[it[0]] = !items[it[0]];
        b.classList.toggle("on", items[it[0]]);
        if (items[it[0]]) {
          var i = img(it[0], "room__item"); i.dataset.k = it[0]; floor.appendChild(i);
          S.place(); if (it[2] < 0) { S.bad(); F.shake(view, 6); }
        } else {
          var n = floor.querySelector('[data-k="' + it[0] + '"]'); if (n) n.remove(); S.pick();
        }
        recalc();
      });
      pool.appendChild(b);
    });

    slider.addEventListener("input", function () {
      kelvin = +slider.value;
      var warm = kelvin < 3500, cold = kelvin >= 4000 && kelvin <= 5000;
      view.style.setProperty("--tint", kelvin < 3500 ? "rgba(242,180,65,.30)"
        : kelvin > 5600 ? "rgba(150,200,255,.32)" : "rgba(191,217,232,.16)");
      view.style.setProperty("--glow", kelvin < 3500 ? "rgba(242,180,65,.42)"
        : kelvin > 5600 ? "rgba(160,205,255,.40)" : "rgba(207,232,248,.38)");
      lightLbl.textContent = kelvin + " K — " + (warm ? "тёплый, убаюкивает"
        : cold ? "то, что нужно для работы" : kelvin > 5600 ? "слишком синий, глаза устанут" : "почти");
      recalc();
    });
    function recalc() {
      var s = 0;
      GOOD.concat(BAD).forEach(function (it) { if (items[it[0]]) s += it[2]; });
      if (kelvin >= 4000 && kelvin <= 5000) s += 22; else if (kelvin < 3200) s -= 8;
      s = Math.max(0, Math.min(100, s));
      m.set(s);
      if (s >= 80) {
        S.good();
        ctx.done({ win: true, title: "Место собрано",
          lines: ["Отдельный угол только для работы, удобная мебель и холодный свет 4000–5000 K.",
                  "Тёплый свет эффективно убаюкивает — в рабочее время это не то, что нужно.",
                  "Койка и приёмник рядом со столом — те самые отвлекающие факторы, которых должно быть минимум."] });
      }
    }
    slider.dispatchEvent(new Event("input"));
  };

  /* ═══════════════ 10. Эфир ══════════════════════════════ */
  reg.ether = function (root, ctx) {
    var ROUNDS = [
      { id: "silence", n: "В тишине", snd: null },
      { id: "letsplay", n: "Под летсплей", snd: "letsplay" },
      { id: "drone", n: "Под обзор книг", snd: "drone" }
    ];
    var r = 0, res = [], t0 = 0, errs = 0;
    var wrap = el("div", "ether");
    var cap = el("p", "log__cap", "Перепишите столбец метеоданных в бланк");
    var table = el("div", "ether__cols");
    var start = btn("Начать: в тишине", "gb--go", begin);
    var out = el("p", "scales__out", "Одна и та же нудная работа три раза. Считаем ваше время и ошибки.");
    wrap.append(cap, table, start, out);
    root.appendChild(wrap);

    var nums = [], inputs = [];
    function build() {
      table.textContent = ""; inputs = []; nums = [];
      var src = el("div", "ether__src"), dst = el("div", "ether__dst");
      src.appendChild(el("p", "ether__h", "Сводка"));
      dst.appendChild(el("p", "ether__h", "Бланк"));
      for (var i = 0; i < 8; i++) {
        var v = Math.floor(100 + Math.random() * 900);
        nums.push(v);
        src.appendChild(el("div", "ether__num", v));
        var inp = el("input", "ether__in"); inp.type = "text"; inp.inputMode = "numeric"; inp.maxLength = 3;
        inp.setAttribute("aria-label", "Строка бланка " + (i + 1));
        inp.disabled = true;
        inp.addEventListener("input", check);
        inputs.push(inp); dst.appendChild(inp);
      }
      table.append(src, dst);
    }
    function check() {
      var full = inputs.every(function (x) { return x.value.length === 3; });
      if (!full) return;
      errs = 0;
      inputs.forEach(function (x, i) { if (+x.value !== nums[i]) errs++; });
      var sec = (Date.now() - t0) / 1000;
      res.push({ n: ROUNDS[r].n, sec: sec, errs: errs });
      if (ROUNDS[r].snd) S.stop(ROUNDS[r].snd);
      S.good();
      r++;
      if (r >= ROUNDS.length) return finish();
      inputs.forEach(function (x) { x.disabled = true; });
      start.textContent = "Начать: " + ROUNDS[r].n.toLowerCase();
      start.disabled = false;
      out.textContent = res.map(function (x) {
        return x.n + " — " + x.sec.toFixed(1) + " с, ошибок " + x.errs;
      }).join(" · ");
    }
    function begin() {
      build(); start.disabled = true;
      inputs.forEach(function (x) { x.disabled = false; x.value = ""; });
      inputs[0].focus();
      if (ROUNDS[r].snd) { S.boot(); S[ROUNDS[r].snd](); }
      t0 = Date.now();
      out.textContent = "Пошли. " + ROUNDS[r].n.toLowerCase() + ".";
    }
    function finish() {
      S.stopAll();
      var fast = res.slice().sort(function (a, b) { return a.sec - b.sec; })[0];
      var slow = res.slice().sort(function (a, b) { return b.sec - a.sec; })[0];
      start.remove();
      ctx.done({
        win: true, title: "Ваши собственные цифры",
        lines: res.map(function (x) { return x.n + ": " + x.sec.toFixed(1) + " с, ошибок " + x.errs; })
          .concat([
            "Быстрее всего — " + fast.n.toLowerCase() + ", медленнее всего — " + slow.n.toLowerCase() + ".",
            "Фон должен быть достаточно плотным, чтобы забить тишину, и достаточно скучным, чтобы вы его не смотрели."
          ]),
        again: { label: "Прогнать заново", fn: function () { ctx.remount(); } }
      });
    }
    build();
  };

  /* ═══════════════ 11. Распорядок вахты ══════════════════ */
  reg.plan = function (root, ctx) {
    var wrap = el("div", "plan");
    function field(label, node) {
      var f = el("label", "plan__f");
      f.appendChild(el("span", "", label)); f.appendChild(node); return f;
    }
    function inp(v, type, label) {
      var i = el("input", "plan__i"); i.type = type || "text"; i.value = v;
      if (label) i.setAttribute("aria-label", label);
      return i;
    }
    var from = inp("09:00", "time"), to = inp("18:00", "time");
    var slot = inp("60", "number"), brk = inp("15", "number"), buf = inp("15", "number");
    var days = el("div", "plan__chips");
    var DAYS = ["Созвоны", "Тексты", "Ремонт", "Аналитика", "Креатив"];
    var chosen = {};
    DAYS.forEach(function (d) {
      var b = el("button", "chip chip--rest"); b.type = "button"; b.textContent = d;
      b.addEventListener("click", function () { chosen[d] = !chosen[d]; b.classList.toggle("on", chosen[d]); S.pick(); });
      days.appendChild(b);
    });
    var goals = [inp(""), inp(""), inp("")];
    goals.forEach(function (g, i) {
      g.placeholder = "личная цель " + (i + 1);
      g.setAttribute("aria-label", "Личная цель " + (i + 1));
    });
    var reward = inp("Сгущёнка после закрытой задачи", "text", "Награда за закрытую задачу");
    var out = el("p", "scales__out", "Заполните — и валидатор скажет, что с этим не так.");

    wrap.append(el("p", "log__cap", "Распорядок вахты"),
      field("Смена с", from), field("до", to),
      field("Слот, мин", slot), field("Перерыв, мин", brk), field("Запас, %", buf),
      el("p", "plan__lab", "Дни по типам задач"), days,
      el("p", "plan__lab", "Личные цели"), goals[0], goals[1], goals[2],
      field("Награда", reward), out);
    var save = btn("Проверить и сохранить", "gb--go", validate);
    var dl = btn("Скачать для календаря (.ics)", "gb--ghost", ics);
    dl.style.display = "none";
    wrap.append(save, dl);
    root.appendChild(wrap);

    try {
      var st = JSON.parse(localStorage.getItem("station-plan") || "null");
      if (st) { from.value = st.from; to.value = st.to; slot.value = st.slot; brk.value = st.brk;
                buf.value = st.buf; reward.value = st.reward;
                st.goals.forEach(function (g, i) { goals[i].value = g; });
                (st.days || []).forEach(function (d) {
                  chosen[d] = true;
                  Array.prototype.forEach.call(days.children, function (b) {
                    if (b.textContent === d) b.classList.add("on"); }); }); }
    } catch (e) {}

    function mins(v) { var p = v.split(":"); return +p[0] * 60 + +p[1]; }
    function validate() {
      var probs = [];
      var len = mins(to.value) - mins(from.value);
      if (len > 9 * 60) probs.push("Смена длиннее девяти часов — это уже переработка по умолчанию.");
      if (+brk.value < 10) probs.push("Перерыв меньше 10 минут не считается перерывом.");
      if (+slot.value > 90) probs.push("Слот длиннее полутора часов вы не досидите на фокусе.");
      if (+buf.value < 10) probs.push("Запас меньше 10 % — первый же срочный созвон обрушит день.");
      if (goals.filter(function (g) { return g.value.trim(); }).length === 0)
        probs.push("Ни одной личной цели. Именно так и появляется перекос в сторону работы.");
      if (!Object.keys(chosen).some(function (k) { return chosen[k]; }))
        probs.push("Не выбрано ни одного дня по типу задач.");
      if (probs.length) {
        S.bad(); F.shake(wrap, 5);
        out.innerHTML = "";
        probs.forEach(function (p) { out.appendChild(el("span", "plan__err", "— " + p)); });
        return;
      }
      var data = { from: from.value, to: to.value, slot: slot.value, brk: brk.value, buf: buf.value,
        reward: reward.value, goals: goals.map(function (g) { return g.value; }),
        days: Object.keys(chosen).filter(function (k) { return chosen[k]; }) };
      try { localStorage.setItem("station-plan", JSON.stringify(data)); } catch (e) {}
      S.win(); F.flash("rgba(95,211,160,.25)");
      dl.style.display = "";
      out.textContent = "Принято. Распорядок сохранён в браузере — и его можно забрать в календарь.";
      ctx.done({ win: true, title: "Распорядок принят",
        lines: ["Смена " + data.from + "–" + data.to + ", слоты по " + data.slot +
                " мин с перерывом " + data.brk + " мин, запас " + data.buf + " %.",
                "Дни по типам: " + data.days.join(", ") + ".",
                "Личные цели вписаны — значит, перекос будет видно вовремя.",
                "Через три месяца вернитесь и сравните самочувствие."] });
    }
    function ics() {
      var d = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
      function stamp(dt) {
        return dt.getFullYear() + pad(dt.getMonth() + 1) + pad(dt.getDate()) + "T" +
               pad(dt.getHours()) + pad(dt.getMinutes()) + "00";
      }
      var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Смена на станции//RU"];
      var day = new Date(d.getTime() + 86400000);
      var s = from.value.split(":"), e = to.value.split(":");
      day.setHours(+s[0], +s[1], 0, 0);
      var end = new Date(day); end.setHours(+e[0], +e[1], 0, 0);
      lines.push("BEGIN:VEVENT", "DTSTART:" + stamp(day), "DTEND:" + stamp(end),
        "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "SUMMARY:Смена", "END:VEVENT");
      var rem = new Date(d.getTime() + 90 * 86400000); rem.setHours(10, 0, 0, 0);
      var rem2 = new Date(rem.getTime() + 1800000);
      lines.push("BEGIN:VEVENT", "DTSTART:" + stamp(rem), "DTEND:" + stamp(rem2),
        "SUMMARY:Три месяца на удалёнке — сравнить самочувствие", "END:VEVENT", "END:VCALENDAR");
      var blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "распорядок-вахты.ics";
      document.body.appendChild(a); a.click(); a.remove();
      S.good();
    }
  };

  return {
    has: function (id) { return !!reg[id]; },
    run: function (id, root, ctx) { reg[id](root, ctx); }
  };
})();
