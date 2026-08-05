"""Shared helpers for the TGDataset2 analysis notebooks.

Every notebook imports from here: the database connection, the query helper, the
paths to the shipped CSVs and figures, and the matplotlib styling that makes a
regenerated figure match the one in the thesis.

The database is not shipped with this repository. Set ``TGDATASET2_DB_URL`` to a
Postgres instance carrying the TGDataset2 schema (see ``docs/schema.md``) before
running any cell that calls :func:`q`. Sections that read a CSV from ``data/``
run without one.
"""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA = PROJECT_ROOT / "data"
FIGURES = PROJECT_ROOT / "figures"

# Placeholder: point TGDATASET2_DB_URL at your own instance. Nothing here carries
# a real credential.
DEFAULT_DB_URL = "postgresql+psycopg://USER:PASSWORD@localhost:5432/tgdataset2"
DB_URL = os.environ.get("TGDATASET2_DB_URL", DEFAULT_DB_URL)

# The wartime chapter (notebook 05) queries two companion catalogs in the same
# Postgres instance: same host, port and credentials, only the database name
# differs. There is no cross-database join; the cohorts are reconciled in pandas.
ISRAEL_DB = "tgdataset_israel"
IRAN_DB = "tgdataset_iran"

_engines: dict[str, object] = {}


def _resolve_url(db: str | None) -> str:
    """Return the connection URL for database name ``db``, or DB_URL if None.

    Only the database component is swapped, so a companion catalog inherits
    whatever host/port/credentials DB_URL points at.
    """
    from sqlalchemy.engine import make_url

    if db is None:
        return DB_URL
    return make_url(DB_URL).set(database=db).render_as_string(hide_password=False)


def engine(db: str | None = None):
    """Lazy SQLAlchemy engine, cached per resolved URL.

    Set ``TGDATASET2_WORK_MEM`` (e.g. ``1GB``) to raise ``work_mem`` for these
    connections only; several of the aggregates below sort large intermediate
    results and a larger work_mem keeps them out of temp files.
    """
    from sqlalchemy import create_engine

    url = _resolve_url(db)
    if url not in _engines:
        connect_args = {}
        work_mem = os.environ.get("TGDATASET2_WORK_MEM")
        if work_mem:
            connect_args["options"] = f"-c work_mem={work_mem}"
        _engines[url] = create_engine(url, future=True, connect_args=connect_args)
    return _engines[url]


def q(sql: str, db: str | None = None, **params) -> pd.DataFrame:
    """Run SQL against the corpus database and return a DataFrame.

    Named parameters use SQLAlchemy's ``:name`` placeholders::

        q("SELECT count(*) FROM messages WHERE date > :d", d="2026-01-01")

    Pass ``db="tgdataset_israel"`` to run against a companion catalog instead.
    Raises if ``TGDATASET2_DB_URL`` is unset or unreachable; that is the intended
    behaviour, since the corpus is not redistributable and these queries are the
    record of how each result was computed.
    """
    from sqlalchemy import text

    with engine(db).connect() as conn:
        return pd.read_sql(text(sql), conn, params=params)


def csv(name: str, **kwargs) -> pd.DataFrame:
    """Read one of the shipped result CSVs from ``data/``.

    This is the offline path: where a figure's inputs were small enough to ship,
    its section reads them here instead of hitting the database, so the figure
    can be regenerated with no corpus at hand.
    """
    return pd.read_csv(DATA / name, **kwargs)


def setup_plots() -> None:
    """Apply the thesis figure styling.

    Figures are authored at a width of 5.48 in (396 pt, the thesis textwidth) and
    included at ``width=\\textwidth``, so they render at scale ~1: the point sizes
    set here are the point sizes on the printed page. The band sits just below the
    11 pt body text.

    Also registers a script-by-script font fallback, because matplotlib's default
    DejaVu Sans has no glyphs for the Arabic, Hebrew and CJK channel titles that
    appear on some axes (they render as tofu boxes otherwise). Everything here is
    best-effort: a missing font degrades the labels, never the run.
    """
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
    import seaborn as sns

    sns.set_theme(style="whitegrid", context="notebook")

    families = ["DejaVu Sans", "Noto Sans Arabic", "Noto Sans Hebrew"]
    have = {f.name for f in fm.fontManager.ttflist}
    # Plain-TrueType faces matplotlib's bundled FreeType can actually load; the
    # system CJK font is a variable .ttc it cannot, and the color emoji font is
    # COLRv1, which it also cannot rasterise.
    extra = [
        ("Droid Sans Fallback",
         "/usr/share/fonts/google-droid-sans-fonts/DroidSansFallbackFull.ttf"),
        ("Noto Emoji",
         "/usr/share/fonts/google-noto-emoji-fonts/NotoEmoji-Regular.ttf"),
    ]
    for name, path in extra:
        if name not in have and os.path.exists(path):
            try:
                fm.fontManager.addfont(path)
                have.add(name)
            except Exception:
                pass
        if name in have:
            families.append(name)

    plt.rcParams["font.family"] = families
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.dpi"] = 110
    plt.rcParams.update({
        "font.size": 7.5,
        "axes.titlesize": 8.5,
        "axes.labelsize": 7.5,
        "xtick.labelsize": 7.5,
        "ytick.labelsize": 7.5,
        "legend.fontsize": 7,
        "figure.titlesize": 9,
    })


def shape(s) -> str:
    """Reshape and bidi-order a label so RTL scripts render correctly.

    Matplotlib has no text shaping of its own, so Arabic, Persian and Hebrew
    titles come out disjoint and left-to-right without this. It is a no-op for
    LTR text, so it is safe to wrap any channel-title label. Requires
    ``arabic-reshaper`` and ``python-bidi``; falls back to the raw string if
    neither is installed.
    """
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
    except ImportError:
        return str(s)
    return get_display(arabic_reshaper.reshape(str(s)))
