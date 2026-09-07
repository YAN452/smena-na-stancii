# -*- coding: utf-8 -*-
"""
Собирает dist/ — лёгкую версию курса для публикации.

    python tools/pack.py

Берёт только то, что курс реально грузит: index.html, стили, скрипты, шрифты
и ассеты. Исходники, node_modules, брендовые архивы и служебные страницы
остаются дома. Картинки пережимаются под тот размер, в котором их показывают:
предметы и персонажи выводятся мелко, держать их в 1024 px незачем.

Оригиналы не трогаются — всё пишется в dist/.
"""
import io, os, re, shutil, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent.parent
DIST = HERE / "dist"

FILES = ["index.html", "styles.css", "course.js", "game.js", "sound.js", "fx.js"]
DIRS_VENDOR = ["vendor/fonts"]

# предельная сторона по типу ассета: показываем мелко — храним мелко
CAPS = {"obj-": 640, "char-": 900, "sheet-": 1024, "fx-": 1024}
JPEG_W, JPEG_Q = 1920, 82

def used_assets():
    """какие файлы из assets/ реально упоминаются в собранном курсе и коде"""
    txt = ""
    for f in FILES + ["build.py"]:
        p = HERE / f
        if p.exists():
            txt += p.read_text(encoding="utf-8")
    names = set(re.findall(r"assets/([A-Za-z0-9_.\-]+\.(?:png|jpg|jpeg|webp))", txt))
    # имена, которые код склеивает из кусков (obj-ice-1..3, char-you-f-*)
    stems = set(re.findall(r'"(obj-[a-z0-9\-]+|char-[a-z0-9\-]+|scene-[a-z0-9\-]+|sheet-[a-z0-9\-]+|bg-[a-z0-9\-]+)', txt))
    for f in os.listdir(HERE / "assets"):
        stem = os.path.splitext(f)[0]
        if any(stem.startswith(s) or s.startswith(stem) for s in stems):
            names.add(f)
    return names

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    from PIL import Image

    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "assets").mkdir(parents=True)
    (DIST / "vendor" / "fonts").mkdir(parents=True)

    for f in FILES:
        shutil.copy(HERE / f, DIST / f)
    for f in os.listdir(HERE / "vendor" / "fonts"):
        if f.endswith((".woff2", ".css", ".ttf", ".otf")):
            shutil.copy(HERE / "vendor" / "fonts" / f, DIST / "vendor" / "fonts" / f)

    keep = used_assets()
    before = after = 0
    skipped = 0
    for f in sorted(os.listdir(HERE / "assets")):
        src = HERE / "assets" / f
        if f not in keep:
            skipped += 1
            continue
        before += src.stat().st_size
        dst = DIST / "assets" / f
        try:
            im = Image.open(src)
            if f.lower().endswith((".jpg", ".jpeg")):
                if im.width > JPEG_W:
                    im = im.resize((JPEG_W, round(im.height * JPEG_W / im.width)), Image.LANCZOS)
                im.convert("RGB").save(dst, quality=JPEG_Q, optimize=True, progressive=True)
            else:
                cap = next((v for k, v in CAPS.items() if f.startswith(k)), 1024)
                if max(im.size) > cap:
                    im.thumbnail((cap, cap), Image.LANCZOS)
                im.save(dst, optimize=True)
        except Exception:
            shutil.copy(src, dst)
        after += dst.stat().st_size

    total = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    print("ассетов взято: %d, пропущено как неиспользуемые: %d" % (len(keep), skipped))
    print("картинки: %.1f МБ → %.1f МБ (%.0f %% экономии)"
          % (before / 1e6, after / 1e6, 100 * (1 - after / max(before, 1))))
    print("dist целиком: %.1f МБ" % (total / 1e6))
    print("→ %s" % DIST)

if __name__ == "__main__":
    main()
