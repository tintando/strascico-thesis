# Third-party attribution

The deck's own code and content are MIT licensed (`../LICENSE`). The following bundled or derived material is not, and carries its upstream terms.

## Bundled fonts

`slides/fonts/` ships four woff2 subsets, unmodified apart from the Latin subsetting done upstream by the Fontsource project:

| File | Family | License |
|---|---|---|
| `inter-latin-400-normal.woff2` | Inter, by Rasmus Andersson | SIL Open Font License 1.1 |
| `inter-latin-600-normal.woff2` | Inter, by Rasmus Andersson | SIL Open Font License 1.1 |
| `jetbrains-mono-latin-400-normal.woff2` | JetBrains Mono, by JetBrains | SIL Open Font License 1.1 |
| `jetbrains-mono-latin-500-normal.woff2` | JetBrains Mono, by JetBrains | SIL Open Font License 1.1 |

The OFL permits bundling and redistribution with the reserved-name and same-license conditions; neither font is renamed or sold on its own here. Full text: <https://openfontlicense.org>.

## Telegram Desktop derived assets

The four themes reproduce the palettes embedded in **Telegram Desktop** (`telegramdesktop/tdesktop`, tag v6.9.3), which is licensed **GPL-3.0 with the OpenSSL linking exception**. Derived from it:

- the color values in `slides/assets/elements/tokens.css`, read out of `Telegram/Resources/night.tdesktop-theme`, `day-blue.tdesktop-theme` and `night-green.tdesktop-theme`, and out of `window_themes_embedded.cpp` for the settings-card preview swatches;
- `slides/assets/wallpaper/classic.webp`, a reconstruction of the Classic theme's doodle wallpaper;
- the verbatim restriction-notice strings in the `.interstitial` device, which are Telegram's own client strings.

The device CSS in `slides/assets/elements/` is an independent reimplementation written against those sources, not a copy of tdesktop code; each file names the upstream source it was checked against. Anyone redistributing the palettes and wallpaper should treat them as GPL-3.0 material. The upstream clones used for that verification are not committed here.

Telegram is a trademark of Telegram Messenger Inc. This deck is an academic presentation about a Telegram dataset and is not affiliated with or endorsed by Telegram.
