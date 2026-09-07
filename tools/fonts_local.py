# -*- coding: utf-8 -*-
"""
Забирает шрифты Google Fonts к себе, чтобы курс не зависел от интернета.

    python tools/fonts_local.py

Скачивает только кириллицу и латиницу (остальные подмножества выбрасывает),
кладёт файлы в vendor/fonts/ и собирает vendor/fonts/fonts.css с локальными путями.
"""
import io, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(HERE, "vendor", "fonts")
SRC = os.path.join(DIR, "_src.css")
KEEP = ("cyrillic", "cyrillic-ext", "latin", "latin-ext")

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    css = io.open(SRC, encoding="utf-8").read()
    blocks = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S)
    out, saved, skipped = [], 0, 0
    for subset, block in blocks:
        if subset not in KEEP:
            skipped += 1
            continue
        m = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        if not m:
            continue
        url = m.group(1)
        fam = re.search(r"font-family:\s*'([^']+)'", block).group(1)
        wght = re.search(r"font-weight:\s*(\d+)", block)
        name = "%s-%s-%s.woff2" % (fam.replace(" ", ""), wght.group(1) if wght else "400", subset)
        path = os.path.join(DIR, name)
        if not os.path.exists(path):
            urllib.request.urlretrieve(url, path)
        saved += 1
        out.append(block.replace(url, name))
    io.open(os.path.join(DIR, "fonts.css"), "w", encoding="utf-8").write(
        "/* Локальные шрифты курса. Пересобрать: python tools/fonts_local.py */\n\n"
        + "\n\n".join(out) + "\n")
    total = sum(os.path.getsize(os.path.join(DIR, f))
                for f in os.listdir(DIR) if f.endswith(".woff2"))
    print("сохранено начертаний: %d, пропущено чужих подмножеств: %d" % (saved, skipped))
    print("вес шрифтов: %.0f КБ" % (total / 1024))

if __name__ == "__main__":
    main()
