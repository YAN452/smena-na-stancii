# -*- coding: utf-8 -*-
"""
Проверка курса. Гоняет собранный index.html в системном Chrome.

    python tools/audit.py            — быстрый прогон
    python tools/audit.py --shots    — плюс скриншоты каждого десятого кадра

Что проверяет:
  · ошибки JS и несостоявшиеся запросы;
  · горизонтальный вылет на десктопе и на телефоне;
  · кадры, которые не помещаются в экран по высоте;
  · битые картинки (грузились и не загрузились);
  · монтируются ли все тренажёры;
  · контраст текста кадров относительно того, что под ним.
Возвращает ненулевой код, если что-то сломано, — годится для хука перед сборкой.
"""
import os, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent.parent
SHOTS = HERE / "tools" / "shots"

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    from playwright.sync_api import sync_playwright

    want_shots = "--shots" in sys.argv
    url = (HERE / "index.html").as_uri()
    problems = []

    with sync_playwright() as pw:
        br = pw.chromium.launch(channel="chrome")
        pg = br.new_page(viewport={"width": 1440, "height": 900})
        errs, failed = [], []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        pg.on("requestfailed", lambda r: failed.append(r.url.split("/")[-1]))

        pg.goto(url)
        pg.evaluate("sessionStorage.setItem('station-pause','done')")
        pg.reload()
        pg.add_style_tag(content="html{scroll-behavior:auto!important;scroll-snap-type:none!important}")
        pg.wait_for_timeout(900)

        beats = pg.evaluate("document.querySelectorAll('.beat').length")
        stages = pg.evaluate("document.querySelectorAll('.beat--stage').length")
        print("кадров: %d, тренажёров: %d" % (beats, stages))

        if want_shots:
            SHOTS.mkdir(parents=True, exist_ok=True)

        # прогон по всем кадрам, чтобы всё смонтировалось и проявилось
        for i in range(beats):
            pg.evaluate("""(i)=>{var e=document.querySelectorAll('.beat')[i];
                if(!e) return; var y=e.getBoundingClientRect().top+window.scrollY;
                window.scrollTo(0, y + e.offsetHeight/2 - innerHeight/2);}""", i)
            pg.wait_for_timeout(70)
            if want_shots and i % 10 == 0:
                pg.screenshot(path=str(SHOTS / ("beat-%03d.png" % i)))

        mounted = pg.evaluate("[...document.querySelectorAll('[data-play]')].filter(e=>e.children.length).length")
        if mounted != stages:
            problems.append("смонтировано тренажёров %d из %d" % (mounted, stages))

        tall = pg.evaluate("""()=>{var bad=[];document.querySelectorAll('.beat__in').forEach(function(e){
            if(e.scrollHeight > innerHeight-90) bad.push(e.textContent.trim().slice(0,40));});return bad;}""")
        if tall:
            problems.append("кадры выше экрана: %s" % "; ".join(tall[:3]))

        broken = pg.evaluate("""()=>[...document.images]
            .filter(i=>i.complete && i.naturalWidth===0).map(i=>i.getAttribute('src'))""")
        if broken:
            problems.append("битые картинки: %s" % ", ".join(broken[:5]))

        over = pg.evaluate("document.documentElement.scrollWidth-window.innerWidth")
        if over > 0:
            problems.append("горизонтальный вылет на десктопе: %d px" % over)

        pg.set_viewport_size({"width": 390, "height": 844})
        pg.wait_for_timeout(400)
        over_m = pg.evaluate("document.documentElement.scrollWidth-window.innerWidth")
        if over_m > 0:
            problems.append("горизонтальный вылет на телефоне: %d px" % over_m)

        js_errors = list(errs)          # снимок до axe: он сам шумит CORS по file://
        net_failed = list(failed)

        # ── доступность: axe-core, если он поставлен ────────────────────
        axe = HERE / "node_modules" / "axe-core" / "axe.min.js"
        if axe.exists():
            pg.set_viewport_size({"width": 1440, "height": 900})
            # проявление кадров гасим: иначе axe меряет полупрозрачный текст
            pg.add_style_tag(content=".beat__in,.stage{opacity:1!important;transform:none!important}")
            pg.wait_for_timeout(200)
            pg.add_script_tag(path=str(axe))
            report = pg.evaluate("""async () => {
                // color-contrast отключён намеренно: axe не умеет мерить текст
                // поверх фотографии и помечает вообще весь курс. Ниже — своя проверка.
                const r = await axe.run(document, {
                  resultTypes: ['violations'],
                  rules: { 'color-contrast': { enabled: false } }
                });
                return r.violations
                  .filter(v => v.impact === 'critical' || v.impact === 'serious')
                  .map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length,
                               help: v.help, sample: (v.nodes[0] && v.nodes[0].target[0]) || '' }));
            }""")
            if report:
                print("")
                print("доступность — серьёзных замечаний: %d" % len(report))
                for v in report:
                    print("   · %-22s %s (%d шт., напр. %s)" % (v["id"], v["help"], v["n"], v["sample"][:40]))
            else:
                print("доступность: критичных и серьёзных замечаний нет")
        else:
            print("доступность: axe-core не установлен (npm i -D axe-core)")

        # ── читаемость: меряем реальные пиксели под текстом ─────────────
        from PIL import Image
        import io as _io
        def lum_srgb(r, g, b):
            def f(v):
                v /= 255.0
                return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

        weak = []
        step = max(1, beats // 24)
        for i in range(0, beats, step):
            box = pg.evaluate("""(i)=>{const b=document.querySelectorAll('.beat')[i];
                if(!b) return null;
                const y=b.getBoundingClientRect().top+window.scrollY;
                window.scrollTo(0, y + b.offsetHeight/2 - innerHeight/2);
                const p=b.querySelector('.beat__in p, .stage__intro');
                if(!p) return null;
                const r=p.getBoundingClientRect();
                if(r.width<40||r.height<10||r.top>innerHeight||r.bottom<0) return null;
                const c=getComputedStyle(p).color.match(/\d+/g).map(Number);
                return {x:Math.max(0,r.left),y:Math.max(0,r.top),
                        w:Math.min(r.width,innerWidth-r.left),
                        h:Math.min(r.height,innerHeight-r.top),
                        color:c, text:p.textContent.trim().slice(0,34)};}""", i)
            if not box:
                continue
            # прячем только глифы: подложки и вуаль должны остаться на месте
            pg.evaluate("""(i)=>{const b=document.querySelectorAll('.beat')[i];
                const p=b.querySelector('.beat__in p, .stage__intro');
                if(p){p.dataset.oldColor=p.style.color; p.style.color='transparent';
                      p.style.textShadow='none';}}""", i)
            pg.wait_for_timeout(50)
            shot = pg.screenshot(clip={"x": box["x"], "y": box["y"],
                                       "width": max(8, box["w"]), "height": max(8, box["h"])})
            pg.evaluate("""(i)=>{const b=document.querySelectorAll('.beat')[i];
                const p=b.querySelector('.beat__in p, .stage__intro');
                if(p){p.style.color=p.dataset.oldColor||''; p.style.textShadow='';}}""", i)
            im = Image.open(_io.BytesIO(shot)).convert("RGB")
            px = list(im.getdata())
            lums = sorted(lum_srgb(*p3) for p3 in px)
            bg = lums[int(len(lums) * 0.92)]              # худший (самый светлый) участок фона
            tx = lum_srgb(*box["color"][:3])
            ratio = (max(bg, tx) + 0.05) / (min(bg, tx) + 0.05)
            if ratio < 3.2:
                weak.append("%.1f : %s" % (ratio, box["text"]))
        if weak:
            problems.append("текст сливается с кадром (%d): %s" % (len(weak), "; ".join(weak[:4])))
        else:
            print("читаемость: текст держится на всех проверенных кадрах")

        if js_errors:
            problems.append("ошибки JS: %s" % "; ".join(js_errors[:3]))
        if net_failed:
            problems.append("не загрузилось: %s" % ", ".join(sorted(set(net_failed))[:5]))

        br.close()

    if problems:
        print("\nПРОБЛЕМЫ (%d):" % len(problems))
        for p in problems:
            print("   ✗ %s" % p)
        sys.exit(1)
    print("\nвсё чисто")

if __name__ == "__main__":
    main()
