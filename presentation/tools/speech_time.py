#!/usr/bin/env python3
"""Estimate the spoken duration of the deck's .notes scripts.

Each slide's <aside class="notes"> is the verbatim spoken script; square
brackets wrap everything that is not spoken ([stage direction], [Q&A: ...])
and are stripped before counting. Numerals are expanded to spoken words
("474.9 M" -> "four hundred seventy four point nine million"), because
number-heavy academic speech is badly underestimated by raw word counts.

Usage:
  python3 tools/speech_time.py            # timing table
  python3 tools/speech_time.py --script   # clean rehearsal script

Options: --wpm 130 (working assumption; the table also shows 120/140),
--pause 2.0 (per-slide transition seconds), --budget 600, --dir slides/slides.
"""

import argparse
import html
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

# ---------------------------------------------------------------- numbers

ONES = ("zero one two three four five six seven eight nine ten eleven twelve "
        "thirteen fourteen fifteen sixteen seventeen eighteen nineteen").split()
TENS = "? ? twenty thirty forty fifty sixty seventy eighty ninety".split()
SCALES = ((10 ** 12, "trillion"), (10 ** 9, "billion"),
          (10 ** 6, "million"), (10 ** 3, "thousand"))


def int_words(n):
    """1234 -> ['one', 'thousand', 'two', 'hundred', 'thirty', 'four']"""
    if n < 20:
        return [ONES[n]]
    if n < 100:
        return [TENS[n // 10]] + (int_words(n % 10) if n % 10 else [])
    if n < 1000:
        return [ONES[n // 100], "hundred"] + (int_words(n % 100) if n % 100 else [])
    for div, name in SCALES:
        if n >= div:
            rest = int_words(n % div) if n % div else []
            return int_words(n // div) + [name] + rest
    return [str(n)]  # beyond trillions: count as one word


def number_words(tok):
    """'474.9' -> 'four hundred seventy four point nine'."""
    tok = tok.replace(",", "")
    if "." in tok:
        whole, frac = tok.split(".", 1)
        words = int_words(int(whole or 0)) + ["point"] + [ONES[int(d)] for d in frac if d.isdigit()]
    else:
        words = int_words(int(tok))
    return " ".join(words)


# Years like 2026 are read "twenty twenty six", not "two thousand twenty six".
def year_words(tok):
    n = int(tok)
    hi, lo = divmod(n, 100)
    if lo == 0:
        return " ".join(int_words(hi) + ["hundred"])
    return " ".join(int_words(hi) + int_words(lo))


SYMBOLS = {
    "×": " times ",     # ×
    "→": " to ",        # →
    "≤": " at most ",   # ≤
    "≥": " at least ",  # ≥
    "−": " minus ",     # −
    "≈": " about ",     # ≈
    "%": " percent ",
    "–": " to ",        # en dash
}


def expand(text):
    """Rewrite a speech string so every numeral is spoken words."""
    for sym, word in SYMBOLS.items():
        text = text.replace(sym, word)
    text = re.sub(r"\+(?=\s*\d)", " plus ", text)
    text = re.sub(r"(?<![\w.])-(?=\d)", " minus ", text)
    # unit suffixes: 474.9 M / 323 K / 2.9M
    text = re.sub(r"(\d(?:[\d,]*(?:\.\d+)?)?)\s*M\b", r"\1 million", text)
    text = re.sub(r"(\d(?:[\d,]*(?:\.\d+)?)?)\s*K\b", r"\1 thousand", text)
    text = re.sub(r"(\d(?:[\d,]*(?:\.\d+)?)?)\s*B\b", r"\1 billion", text)
    # bare years (not part of a larger number, no decimals/commas)
    text = re.sub(r"(?<![\d,.])((?:1[5-9]|20)\d\d)(?![\d,.])",
                  lambda m: year_words(m.group(1)), text)
    # every remaining numeral
    text = re.sub(r"\d[\d,]*(?:\.\d+)?",
                  lambda m: number_words(m.group(0)), text)
    return text


# ---------------------------------------------------------------- extraction

class FragmentParser(HTMLParser):
    """Pull data-title from <section> and the text of <aside class='notes'>."""

    def __init__(self):
        super().__init__()
        self.title = None
        self._aside_depth = 0
        self._chunks = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "section" and self.title is None:
            self.title = a.get("data-title", "")
        if tag == "aside":
            if self._aside_depth or "notes" in (a.get("class") or "").split():
                self._aside_depth += 1

    def handle_endtag(self, tag):
        if tag == "aside" and self._aside_depth:
            self._aside_depth -= 1

    def handle_data(self, data):
        if self._aside_depth:
            self._chunks.append(data)

    @property
    def notes(self):
        return html.unescape(" ".join(self._chunks))


def spoken_text(raw):
    """Strip [non-spoken spans], collapse whitespace."""
    text = re.sub(r"\[[^\]]*\]", " ", raw)
    return re.sub(r"\s+", " ", text).strip()


def word_count(text):
    return len(re.findall(r"[A-Za-zÀ-ɏ']+", expand(text)))


def mmss(seconds):
    seconds = round(seconds)
    return f"{seconds // 60}:{seconds % 60:02d}"


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dir", default=None, help="slides directory (default: slides/slides next to this repo root)")
    ap.add_argument("--wpm", type=float, default=130, help="working speaking rate (default 130)")
    ap.add_argument("--pause", type=float, default=2.0, help="per-slide transition pause, seconds (default 2)")
    ap.add_argument("--budget", type=float, default=600, help="talk budget, seconds (default 600)")
    ap.add_argument("--long", type=float, default=60, help="flag slides longer than this at --wpm, seconds")
    ap.add_argument("--script", action="store_true", help="print the clean rehearsal script instead of the table")
    args = ap.parse_args()

    slides_dir = Path(args.dir) if args.dir else Path(__file__).resolve().parent.parent / "slides" / "slides"
    fragments = sorted(slides_dir.glob("*.html"))
    if not fragments:
        sys.exit(f"no fragments found in {slides_dir}")

    rates = sorted({120, 140, args.wpm})
    rows = []
    for path in fragments:
        p = FragmentParser()
        p.feed(path.read_text(encoding="utf-8"))
        text = spoken_text(p.notes)
        rows.append((path.stem, p.title or path.stem, text, word_count(text)))

    if args.script:
        for stem, title, text, words in rows:
            secs = words / args.wpm * 60
            print(f"## {stem} · {title}  ({words} spoken words ≈ {mmss(secs)} @ {args.wpm:.0f} wpm)")
            print()
            print(text or "(no spoken script)")
            print()
        total = sum(r[3] for r in rows)
        print(f"total: {total} spoken words ≈ {mmss(total / args.wpm * 60 + args.pause * len(rows))} "
              f"with {args.pause:.0f}s pauses @ {args.wpm:.0f} wpm")
        return

    head = f"{'slide':<26}{'words':>6}" + "".join(f"{f'{r:.0f}wpm':>9}" for r in rates) + f"{'cum':>8}  "
    print(head)
    print("-" * len(head))
    cum = 0.0
    for stem, title, text, words in rows:
        secs = {r: words / r * 60 for r in rates}
        cum += secs[args.wpm] + args.pause
        flag = " ▲ long" if secs[args.wpm] > args.long else ("  empty" if words == 0 else "")
        cells = "".join(f"{s:>8.0f}s" for s in secs.values())
        print(f"{stem:<26}{words:>6}{cells}{mmss(cum):>8}{flag}")
    total_words = sum(r[3] for r in rows)
    pauses = args.pause * len(rows)
    print("-" * len(head))
    for r in rates:
        t = total_words / r * 60 + pauses
        mark = "  ← working rate" if r == args.wpm else ""
        print(f"total @ {r:>3.0f} wpm: {mmss(t)}  (speech {mmss(total_words / r * 60)} + pauses {mmss(pauses)}){mark}")
    t130 = total_words / args.wpm * 60 + pauses
    delta = t130 - args.budget
    verdict = "OVER" if delta > 0 else "under"
    print(f"budget {mmss(args.budget)}: {verdict} by {mmss(abs(delta))} at {args.wpm:.0f} wpm "
          f"(target band 9:15–9:45)")


if __name__ == "__main__":
    main()
