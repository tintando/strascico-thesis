# strascico: thesis, analysis, and defense deck

Bachelor thesis in Applied Computer Science and Artificial Intelligence, Sapienza University of Rome, A.Y. 2025/2026.

**Edits, Deletions, and Restrictions: Making Telegram's Content Dynamics Observable at Scale** ([`thesis/thesis.pdf`](thesis/thesis.pdf))

Public Telegram research corpora are snapshots: they record each channel once and miss everything that happens afterwards, the edits, the deletions, the metadata changes, the moderation decisions. strascico is a corpus built by repeatedly revisiting public channels, so those layers exist and can be measured. This repository holds the thesis that reports it, the analysis behind its results and the defense deck; the scraper itself is the **strascico** repository. The thesis and the deck call the corpus TGDataset2, the name it carried when the thesis was submitted.

## The defense deck

[`presentation/`](presentation/README.md) is the ten-minute defense, and the part of this repository worth opening first: a static web presentation built as a Telegram chat thread, because that is the medium the thesis studies. Every slide is a channel view, every claim is a message in a bubble, and a deleted message is a ghost bubble, the one device the real client lacks. Hand-written HTML, CSS and JavaScript, no slide framework, the four themes' palettes read out of Telegram Desktop's own theme files rather than approximated by eye.

```
cd presentation && docker compose up      # → http://localhost:8080
```

It builds either to a static site behind a Cloudflare tunnel or to one self-contained HTML file that opens from a USB stick with no network and no Node. Screenshots and the full account: [`presentation/README.md`](presentation/README.md).

## The corpus

| Quantity | Value |
|---|---|
| Messages | 474.9M: 141.8M broadcast, 333.2M linked-group comments |
| Channels | 12,065 crawled for messages, of 456,554 registered including the discovery frontier |
| Span | Sep 2015 to Jun 2026 |
| The additive layers | 37,669 metadata snapshots, 36,016 archived edits carrying before-and-after text, 2.42M detected deletions |

Deep rather than wide: fewer channels than the predecessor corpus, roughly an order of magnitude more messages in each, plus layers no general-purpose Telegram corpus had collected.

## What the thesis found

- **Telegram's edit flag over-counts human editing by roughly an order of magnitude.** Most of what `edit_date` marks is Telegram finalising media and link previews within seconds of posting. The before/after archive supplies the corrected picture, and shows that substantive edits churn facts rather than tone.
- **Comment deletion is mostly thread-wide, not individual.** Most deleted comments went down with their thread rather than being moderated one by one, and the independently removed ones are markedly more toxic.
- **Telegram publishes a per-item moderation record that no prior corpora had made explicit.** `restriction_reason` names the platform and the reason for every restricted item. It turns out to be overwhelmingly app-store compliance rather than Telegram's own moderation.
- **A method showcase on the 2026 US/Israel-Iran war**, run on hand-seeded official channel cohorts rather than language-defined ones, because the language-defined version produced a sampling artefact. Each state escalates its international-language arm hardest.

Every rate in the thesis is a within-corpus rate over a Russophone-heavy, snowball-discovered slice of Telegram, not a platform-wide prevalence estimate.

## The other two parts

**`thesis/`** is the document; `make bib && make` rebuilds `thesis.pdf` against a TeX Live installation with `pdflatex` and `bibtex`, the Sapienza class vendored. **`analysis/`** is the code behind chapter 4: five notebooks, one per narrative arc, carrying the SQL and the plotting code for every figure the thesis prints. The corpus database is **not** shipped (60GB pg dump); many sections read a shipped CSV instead, and all 28 figures ship as reference output, so the results are legible without running anything.

## Acknowledgements

The corpus is seeded from the channel list of the original [TGDataset](https://zenodo.org/records/7640712) by La Morgia, Mei and Mongardini, and the comparison in chapter 4 is against their published figures.

## Licenses

Two, because the parts are different kinds of work:

- **Code**, everything under `analysis/` and `presentation/`: MIT, [`LICENSE`](LICENSE).
- **The thesis text and its figures**, everything under `thesis/`: Creative Commons Attribution 4.0 International, [`LICENSE-thesis`](LICENSE-thesis).

The presentation bundles third-party fonts and reproduces Telegram Desktop's theme palettes; those carry their own terms, recorded in [`presentation/ATTRIBUTION.md`](presentation/ATTRIBUTION.md).
