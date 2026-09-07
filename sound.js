/* Звук курса. Ни одного файла — всё синтезируется на месте (WebAudio).
   Включается первым кликом пользователя, гасится кнопкой ♪. */
window.Snd = (function () {
  "use strict";
  var ctx = null, master = null, on = true, hums = {};

  try { on = localStorage.getItem("station-sound") !== "off"; } catch (e) {}

  function boot() {
    if (ctx || !window.AudioContext && !window.webkitAudioContext) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = on ? 0.5 : 0;
    master.connect(ctx.destination);
    return ctx;
  }
  function now() { return ctx ? ctx.currentTime : 0; }

  function env(node, t, a, d, peak) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g); g.connect(master);
    return g;
  }

  function tone(freq, dur, type, peak, slideTo) {
    if (!boot() || !on) return;
    var t = now(), o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(o, t, 0.008, dur, peak || 0.18);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, cut, peak, q) {
    if (!boot() || !on) return;
    var t = now(), len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = cut || 1200; f.Q.value = q || 1;
    src.connect(f);
    env(f, t, 0.006, dur, peak || 0.14);
    src.start(t);
  }

  /* ── непрерывные слои ─────────────────────────────────── */
  function hum(id, opts) {
    if (!boot() || hums[id]) return;
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = opts.type || "sawtooth";
    o.frequency.value = opts.freq || 70;
    f.type = "lowpass"; f.frequency.value = opts.cut || 260;
    g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(master);
    o.start();
    g.gain.linearRampToValueAtTime(opts.vol || 0.05, now() + (opts.fade || 1.2));
    hums[id] = { o: o, g: g };
  }
  function noiseHum(id, opts) {
    if (!boot() || hums[id]) return;
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || "lowpass"; f.frequency.value = opts.cut || 700; f.Q.value = opts.q || 0.6;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
    g.gain.linearRampToValueAtTime(opts.vol || 0.05, now() + (opts.fade || 1.0));
    hums[id] = { o: src, g: g, f: f };
  }
  function stop(id, fade) {
    var h = hums[id]; if (!h) return;
    var t = now(); h.g.gain.cancelScheduledValues(t);
    h.g.gain.setValueAtTime(h.g.gain.value, t);
    h.g.gain.linearRampToValueAtTime(0.0001, t + (fade || 0.5));
    setTimeout(function () { try { h.o.stop(); } catch (e) {} }, (fade || 0.5) * 1000 + 60);
    delete hums[id];
  }
  function stopAll() { Object.keys(hums).forEach(function (k) { stop(k, 0.3); }); }

  var API = {
    /* интерфейс */
    tick:    function () { tone(880, 0.05, "square", 0.05); },
    click:   function () { tone(420, 0.07, "triangle", 0.12); },
    place:   function () { tone(300, 0.09, "sine", 0.16, 210); noise(0.06, 900, 0.05); },
    pick:    function () { tone(520, 0.06, "sine", 0.10); },
    good:    function () { tone(660, 0.10, "sine", 0.16); setTimeout(function(){ tone(990, 0.16, "sine", 0.14); }, 90); },
    bad:     function () { tone(150, 0.22, "sawtooth", 0.14, 90); },
    lose:    function () { tone(200, 0.5, "sawtooth", 0.16, 70); noise(0.4, 300, 0.10); },
    win:     function () { [523, 659, 784, 1047].forEach(function (f, i) {
                 setTimeout(function () { tone(f, 0.26, "sine", 0.15); }, i * 110); }); },
    /* мир станции */
    radio:   function () { tone(1200, 0.05, "square", 0.08); setTimeout(function(){ tone(900, 0.05, "square", 0.07); }, 70); },
    pen:     function () { noise(0.16, 2600, 0.07, 2); },
    ice:     function () { noise(0.28, 420, 0.13, 1.6); },
    crack:   function () { noise(0.12, 1800, 0.18, 3); tone(120, 0.16, "square", 0.10, 60); },
    shovel:  function () { noise(0.24, 700, 0.14, 0.8); },
    horn:    function () { tone(180, 0.9, "sawtooth", 0.16); setTimeout(function(){ tone(150, 1.1, "sawtooth", 0.13); }, 260); },
    alarm:   function () { [0,1,2].forEach(function(i){ setTimeout(function(){ tone(760, 0.16, "square", 0.13); }, i*220); }); },
    open:    function () { tone(260, 0.12, "triangle", 0.14, 520); noise(0.1, 1400, 0.06); },
    /* слои */
    wind:    function () { noiseHum("wind", { cut: 420, vol: 0.035, q: 0.4 }); },
    gen:     function () { hum("gen", { freq: 58, cut: 200, vol: 0.045 }); },
    static_: function (v) { noiseHum("static", { cut: 2400, filter: "bandpass", q: 0.7, vol: v || 0.05 }); },
    letsplay: function () {           /* «захватывающий» фон: скачки и всплески */
      hum("lp", { type: "square", freq: 180, cut: 900, vol: 0.03 });
      hums.lpTimer = { o: { stop: function () {} }, g: { gain: { value: 0, cancelScheduledValues: function(){}, setValueAtTime: function(){}, linearRampToValueAtTime: function(){} } } };
      API._lp = setInterval(function () {
        tone(300 + Math.random() * 700, 0.12, "square", 0.10);
        if (Math.random() < 0.35) noise(0.2, 1500, 0.08);
      }, 700);
    },
    drone: function () {              /* «скучный» фон: ровный бубнёж */
      hum("dr", { type: "triangle", freq: 120, cut: 420, vol: 0.035 });
      API._dr = setInterval(function () { tone(150 + Math.random() * 40, 0.5, "triangle", 0.05); }, 1200);
    },
    stop: function (id) {
      if (id === "letsplay") { clearInterval(API._lp); stop("lp"); return; }
      if (id === "drone") { clearInterval(API._dr); stop("dr"); return; }
      stop(id);
    },
    stopAll: function () { clearInterval(API._lp); clearInterval(API._dr); stopAll(); },
    /* управление */
    boot: boot,
    enabled: function () { return on; },
    toggle: function () {
      on = !on; boot();
      if (master) master.gain.value = on ? 0.5 : 0;
      try { localStorage.setItem("station-sound", on ? "on" : "off"); } catch (e) {}
      if (!on) stopAll();
      return on;
    }
  };
  /* первый клик разблокирует аудио в браузере */
  document.addEventListener("pointerdown", function once() {
    boot(); if (ctx && ctx.state === "suspended") ctx.resume();
    document.removeEventListener("pointerdown", once);
  }, { once: true });

  return API;
})();
