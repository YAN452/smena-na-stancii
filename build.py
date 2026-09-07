# -*- coding: utf-8 -*-
"""
Сборка курса «Смена на станции».

    python build.py

Читает slides-deck.html (единственный источник содержания) и собирает index.html.

Курс собирается как плёнка: кадр на весь экран, поверх него — по одной мысли
за раз («кадр текста»). Тренажёр — такой же кадр, только интерактивный, во всю
ширину и высоту, без рамок и без кнопок переключения. Разбор приёма лежит
следующими кадрами и появляется сам, когда тренажёр пройден.

Картинка подставляется, только если файл лежит в assets/, иначе рисуется плашка.
"""
import io, os, re, sys, html

SRC, OUT, ASSETS = "slides-deck.html", "index.html", "assets"

WHO = {
    "chief": ("char-chief-face-idle.png", "Начальство"),
    "dog":   ("char-dog-sit.png",         "Пёс станции"),
}

def has(name): return os.path.exists(os.path.join(ASSETS, name))

_BRIGHT = {}
def brightness(name):
    """средняя яркость кадра 0..1 — по ней подбирается плотность вуали"""
    if name in _BRIGHT: return _BRIGHT[name]
    v = 0.30
    try:
        from PIL import Image
        im = Image.open(os.path.join(ASSETS, name)).convert("L").resize((32, 18))
        px = list(im.getdata())
        px.sort()
        v = px[int(len(px) * 0.75)] / 255.0      # верхний квартиль: светлые пятна важнее среднего
    except Exception:
        pass
    _BRIGHT[name] = round(v, 3)
    return _BRIGHT[name]
def attr(tag, name, default=""):
    m = re.search(r'%s="([^"]*)"' % name, tag)
    return m.group(1) if m else default

# ── заметки на полях ────────────────────────────────────────────────────────
def build_notes(body):
    def repl(m):
        tag, inner = m.group(0), m.group(2)
        img, name = WHO.get(attr(tag, "data-who"), (None, ""))
        pic = ('<img class="note__face" src="%s/%s" alt="%s" loading="lazy">' % (ASSETS, img, name)
               if img and has(img) else '<span class="note__face note__face--none"></span>')
        return ('<aside class="note">%s<div class="note__text"><b>%s</b>%s</div></aside>'
                % (pic, name, inner))
    return re.sub(r'<aside class="note"([^>]*)>(.*?)</aside>', repl, body, flags=re.S)

def build_checklist(body):
    def repl(m):
        items = re.findall(r"<span>(.*?)</span>", m.group(2), flags=re.S)
        li = "".join('<li><label><input type="checkbox"><span>%s</span></label></li>' % i for i in items)
        return ('<div class="checklist"><p class="checklist__title">%s</p><ul>%s</ul></div>'
                % (attr(m.group(0), "data-title", "Чек-лист"), li))
    return re.sub(r'<div class="checklist"([^>]*)>(.*?)</div>', repl, body, flags=re.S)

def build_timer(body):
    return re.sub(r'<div class="timer" data-seconds="(\d+)"></div>',
                  lambda m: ('<div class="timer" data-seconds="%s">'
                             '<div class="timer__ring"><span class="timer__num">%s</span></div>'
                             '</div>' % (m.group(1), m.group(1))), body)

# ── режиссура текста: фразы, позиции, акценты ───────────────────────────────
SENT = re.compile(r"(?<=[.!?…])\s+")
PLAIN = re.compile(r'^<p( class="[^"]*")?>(.*)</p>$', re.S)
NUM = re.compile(r"(\d{1,2}:\d{2}|\d+(?:[–—-]\d+)?(?:\s?(?:%|K|мин|минут|часов|часа|час))?)")
# слова, которые зритель должен унести с собой
KEYS = ["на полярную", "три месяца", "раз в час", "по одной в день",
        "ровно в девять", "в восемнадцать", "только при", "первым делом",
        "мосты сожжены", "не разрывайте", "полностью отключаетесь"]

# ритм позиций: длинные куски держим по центру, короткие фразы гуляют по кадру
RHYTHM = ["c", "bl", "tr", "l", "br", "t", "r", "tl", "c", "b"]

def hl(text):
    """подсветить то, что зритель должен унести с собой"""
    text = NUM.sub(lambda m: '<b class="hl">%s</b>' % m.group(0) if m.group(0).strip() else m.group(0), text)
    for k in KEYS:
        if k in text:
            text = text.replace(k, '<b class="hl">%s</b>' % k, 1)
    return text

def phrase_split(inner, limit=130):
    """длинный абзац → несколько фраз-кадров"""
    parts, cur = [], ""
    for sent in SENT.split(inner.strip()):
        if not sent: continue
        cur = (cur + " " + sent).strip() if cur else sent
        if len(cur) >= limit:
            parts.append(cur); cur = ""
    if cur:
        if parts and len(cur) < 70: parts[-1] += " " + cur
        else: parts.append(cur)
    return parts

def direct(el, i, block_i):
    """один верхнеуровневый элемент → один или несколько кадров с позицией"""
    m = PLAIN.match(el.strip())
    if not m:
        return [(el, "c", "")]                       # карточки, заметки, списки — по центру
    cls = (m.group(1) or "").strip()
    inner = m.group(2).strip()
    big = "big" in cls
    chunks = [inner] if big or len(inner) <= 170 else phrase_split(inner)
    out = []
    for k, ch in enumerate(chunks):
        pos = "c" if (big or len(ch) > 260) else RHYTHM[(block_i * 3 + i + k) % len(RHYTHM)]
        extra = "big" if big else ("punch" if len(ch) < 150 else "")
        out.append(('<p class="%s">%s</p>' % (extra, hl(ch)), pos, extra))
    return out

# ── разбор тела блока на кадры ──────────────────────────────────────────────
OPEN = re.compile(r'<(p|div|aside)\b')

def split_beats(chunk):
    """верхнеуровневые элементы → отдельные кадры, с учётом вложенности"""
    out, i = [], 0
    while True:
        m = OPEN.search(chunk, i)
        if not m:
            break
        name = m.group(1)
        depth, closed = 0, False
        for t in re.finditer(r"</?%s\b" % name, chunk[m.start():]):
            pos = m.start() + t.start()
            depth += -1 if chunk[pos + 1] == "/" else 1
            if depth == 0:
                end = chunk.index(">", pos) + 1
                out.append(chunk[m.start():end])
                i = end
                closed = True
                break
        if not closed:
            break
    return out

def build_body(body, stats, block_i=0):
    """возвращает список кадров: (класс, атрибуты, содержимое)"""
    games = []
    def grab(m):
        tag, inner = m.group(0), m.group(2)
        gid = attr(tag, "data-id")
        names = [a for a in attr(tag, "data-assets").split(",") if a]
        scene = next((a for a in names if a.startswith("scene-")), "")
        ready = [a for a in names if has(a + ".png") or has(a + ".jpg")]
        miss = [a for a in names if a not in ready]
        stats["games"] += 1; stats["missing"].update(miss)
        games.append({
            "id": gid, "name": attr(tag, "data-game"), "goal": attr(tag, "data-goal"),
            "text": inner.strip(),
            "scene": scene if has(scene + ".jpg") else "",
            "miss": miss,
        })
        return "\x00GAME%d\x00" % (len(games) - 1)

    rest = re.sub(r'<div class="game"([^>]*)>(.*?)</div>', grab, body, flags=re.S)
    parts = re.split(r'\x00GAME(\d+)\x00', rest)

    beats = []
    for i, chunk in enumerate(parts):
        if i % 2 == 1:                       # это место тренажёра
            g = games[int(chunk)]
            beats.append(("stage", g, None))
        else:
            for j, el in enumerate(split_beats(chunk)):
                for html_el, pos, extra in direct(el, j, block_i):
                    beats.append(("text", pos, html_el))
    return beats

def render_beats(beats):
    """первый текстовый кадр остаётся открытым, всё после тренажёра — разбор"""
    out, seen_game = [], False
    for kind, g, el in beats:
        if kind == "stage":
            seen_game = True
            miss = ('<p class="stage__miss">не хватает файлов: %s</p>'
                    % ", ".join(html.escape(x) for x in g["miss"])) if g["miss"] else ""
            out.append(
                '<div class="beat beat--stage" data-stage="%s" data-name="%s" data-scene="%s" data-bright="%s">'
                '  <div class="stage">'
                '    <p class="stage__intro">%s</p>'
                '    <div class="stage__play" data-play="%s"></div>'
                '    <p class="stage__hint" data-hint="1">Играйте прямо здесь — курс продолжится сам</p>%s'
                '  </div>'
                '</div>' % (g["id"], html.escape(g["name"]), g["scene"],
                            brightness(g["scene"] + ".jpg") if g["scene"] else 0.2,
                            g["text"], g["id"], miss))
            out.append('<div class="beat beat--res" data-res="%s" hidden></div>' % g["id"])
        else:
            cls = "beat beat--after" if seen_game else "beat"
            hid = " hidden" if seen_game else ""
            out.append('<div class="%s" data-pos="%s"%s><div class="beat__in">%s</div></div>'
                       % (cls, g or "c", hid, el))
    return "\n".join(out)

def parse():
    src = io.open(SRC, encoding="utf-8").read()
    out = []
    for m in re.finditer(r'<section class="block([^"]*)"([^>]*)>(.*?)</section>', src, flags=re.S):
        tag = m.group(2)
        out.append({"mod": m.group(1).strip(), "time": attr(tag, "data-time"),
                    "title": attr(tag, "data-title"), "bg": attr(tag, "data-bg"),
                    "kelvin": attr(tag, "data-kelvin"), "lead": attr(tag, "data-lead"),
                    "part": attr(tag, "data-part"), "num": attr(tag, "data-num"),
                    "body": m.group(3).strip()})
    return out

TPL = u"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Смена на станции — курс по работе на удалёнке</title>
<link rel="stylesheet" href="vendor/fonts/fonts.css">
<link rel="stylesheet" href="vendor/fonts/brand.css">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<div class="film" id="film" aria-hidden="true"></div>

<header class="bar" id="bar">
  <button class="bar__menu" type="button" aria-expanded="false" aria-controls="menu" aria-label="Список блоков">
    <span></span><span></span><span></span>
  </button>
  <div class="bar__clock"><span id="clock">08:40</span></div>
  <div class="bar__now" id="now">Смена на станции</div>
  <div class="tokens" id="tokens" title="Жетоны за пройденные тренажёры">
    <span class="tokens__n"><b id="tok-n">0</b>/%(games)d</span>
    <span class="tokens__dots" id="tok-dots"></span>
  </div>
  <button class="bar__snd" id="snd" type="button" aria-pressed="true" title="Звук" aria-label="Звук">♪</button>
  <div class="bar__progress"><i id="progress"></i></div>
</header>

<nav class="menu" id="menu" hidden>
  <ol>%(menu)s</ol>
</nav>

<main>
%(blocks)s
</main>

<script src="sound.js"></script>
<script src="fx.js"></script>
<script src="game.js"></script>
<script src="course.js"></script>
</body>
</html>
"""

BLOCK = u"""<section class="block %(mod)s" id="b%(n)d" data-n="%(n)d" data-time="%(time)s"
  data-title="%(title)s" data-bright="%(bright)s" style="%(style)s">
  <div class="block__bg"><i class="block__swap"></i>%(bgplate)s</div>
  <div class="beat beat--title">
    <div class="beat__in">
%(part)s      <p class="hero__meta"><span class="hero__time">%(time)s</span>%(num)s%(kelvin)s</p>
      <h2 class="hero__title">%(title)s</h2>
      <p class="hero__lead">%(lead)s</p>
    </div>
  </div>
%(body)s
</section>
"""

def main():
    blocks = parse()
    stats = {"games": 0, "missing": set(), "bg_ok": 0, "bg_miss": [], "beats": 0}
    out_blocks, menu = [], []

    for i, b in enumerate(blocks, 1):
        body = build_timer(build_checklist(build_notes(b["body"])))
        beats = build_body(body, stats, i)
        stats["beats"] += len(beats) + 1
        body_html = render_beats(beats)

        bgfile = b["bg"] + ".jpg"
        if has(bgfile):
            style, bgplate = "--bg:url('%s/%s')" % (ASSETS, bgfile), ""
            bright = brightness(bgfile)
            stats["bg_ok"] += 1
        else:
            style = "--bg:none"
            bright = 0.18
            bgplate = ('<div class="plate plate--missing"><p class="plate__title">не хватает файла</p>'
                       '<ul class="plate__list"><li>%s</li><li>промпт готов — раздел «Фоны блоков»</li></ul></div>'
                       % html.escape(bgfile))
            stats["bg_miss"].append(bgfile); stats["missing"].add(b["bg"])

        out_blocks.append(BLOCK % {
            "mod": b["mod"], "n": i, "time": html.escape(b["time"]),
            "title": html.escape(b["title"]), "style": style, "bgplate": bgplate,
            "kelvin": ('<span class="hero__kelvin">%s</span>' % html.escape(b["kelvin"])) if b["kelvin"] else "",
            "part": ('      <p class="hero__part">%s</p>' % html.escape(b["part"])) if b["part"] else "",
            "num": ('<span class="hero__num">Приём %s из 16</span>' % html.escape(b["num"])) if b["num"] else "",
            "lead": html.escape(b["lead"]), "bright": bright, "body": body_html})
        menu.append('<li><a href="#b%d"><span class="menu__time">%s</span>'
                    '<span class="menu__name">%s</span></a></li>'
                    % (i, html.escape(b["time"]), html.escape(b["title"])))

    io.open(OUT, "w", encoding="utf-8").write(
        TPL % {"menu": "\n    ".join(menu), "blocks": "\n".join(out_blocks), "games": stats["games"]})

    print("блоков: %d, кадров: %d, тренажёров: %d" % (len(blocks), stats["beats"], stats["games"]))
    print("фоны: %d на месте, %d не хватает" % (stats["bg_ok"], len(stats["bg_miss"])))
    for f in stats["bg_miss"]: print("   ✗ %s" % f)
    other = sorted(x for x in stats["missing"] if not x.startswith("bg-"))
    if other: print("не хватает предметов: %s" % ", ".join(other))
    print("→ %s" % OUT)

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
