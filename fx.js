/* Спецэффекты курса: позёмка на канвасе, иней по краям, тряска, всплывающие цифры.
   Всё выключается при prefers-reduced-motion. */
window.FX = (function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cv, cx, flakes = [], raf = null, wind = 0.25, density = 1;

  function init() {
    if (reduced || cv) return;
    cv = document.createElement("canvas");
    cv.className = "fx-snow"; cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv);
    cx = cv.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    for (var i = 0; i < 150; i++) flakes.push(mk(true));
    loop();
  }
  function resize() {
    if (!cv) return;
    var d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = window.innerWidth * d; cv.height = window.innerHeight * d;
    cv.style.width = window.innerWidth + "px"; cv.style.height = window.innerHeight + "px";
    cx.setTransform(d, 0, 0, d, 0, 0);
  }
  function mk(anywhere) {
    return {
      x: Math.random() * window.innerWidth,
      y: anywhere ? Math.random() * window.innerHeight : -8,
      r: 0.6 + Math.random() * 1.9,
      s: 0.25 + Math.random() * 0.85,
      a: 0.18 + Math.random() * 0.42,
      p: Math.random() * 6.28
    };
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!cx) return;
    var w = window.innerWidth, h = window.innerHeight;
    cx.clearRect(0, 0, w, h);
    cx.fillStyle = "#dfeefb";
    for (var i = 0; i < flakes.length * density; i++) {
      var f = flakes[i]; if (!f) continue;
      f.y += f.s; f.p += 0.01;
      f.x += Math.sin(f.p) * 0.35 + wind;
      if (f.y > h + 6 || f.x > w + 10 || f.x < -10) flakes[i] = mk(false);
      cx.globalAlpha = f.a;
      cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 6.283); cx.fill();
    }
    cx.globalAlpha = 1;
  }

  var API = {
    init: init,
    /* усилить/ослабить позёмку */
    storm: function (level) { density = level; wind = 0.25 + level * 0.9; },
    /* иней наползает по краям экрана: 0…1 */
    frost: function (v) {
      document.documentElement.style.setProperty("--frost", Math.max(0, Math.min(1, v)).toFixed(2));
    },
    /* короткая вспышка света */
    flash: function (color) {
      if (reduced) return;
      var d = document.createElement("div");
      d.className = "fx-flash"; d.style.background = color || "rgba(191,217,232,.5)";
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 480);
    },
    /* тряска элемента */
    shake: function (el, power) {
      if (reduced || !el) return;
      el.style.setProperty("--shake", (power || 6) + "px");
      el.classList.remove("fx-shake"); void el.offsetWidth; el.classList.add("fx-shake");
      setTimeout(function () { el.classList.remove("fx-shake"); }, 460);
    },
    /* всплывающая цифра или слово над элементом */
    pop: function (el, text, kind) {
      if (!el) return;
      var r = el.getBoundingClientRect();
      var d = document.createElement("div");
      d.className = "fx-pop " + (kind ? "fx-pop--" + kind : "");
      d.textContent = text;
      d.style.left = (r.left + r.width / 2) + "px";
      d.style.top = (r.top + 8) + "px";
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 1100);
    },
    /* осколки льда / снега из точки */
    burst: function (el, color, n) {
      if (reduced || !el) return;
      var r = el.getBoundingClientRect();
      for (var i = 0; i < (n || 14); i++) {
        var p = document.createElement("i");
        p.className = "fx-particle";
        p.style.left = (r.left + r.width / 2) + "px";
        p.style.top = (r.top + r.height / 2) + "px";
        p.style.background = color || "#CFE3EF";
        var a = Math.random() * 6.283, d = 40 + Math.random() * 90;
        p.style.setProperty("--dx", Math.cos(a) * d + "px");
        p.style.setProperty("--dy", Math.sin(a) * d + "px");
        p.style.setProperty("--sz", (2 + Math.random() * 4) + "px");
        document.body.appendChild(p);
        (function (node) { setTimeout(function () { node.remove(); }, 900); })(p);
      }
    },
    reduced: reduced
  };
  return API;
})();
