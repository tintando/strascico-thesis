# URL flags

The viewer reads its state from the URL before it reads it from storage. This is what makes the deck scriptable: `export-pdf.sh` and `deploy/build.mjs` both drive it by URL rather than by any private API.

| Flag | Effect |
|---|---|
| `#N` | opens slide N |
| `?theme=classic\|day\|night` | previews a theme without persisting it (no value: Tinted) |
| `?ratio=4:3` | previews the narrow stage the same way |
| `?notes` | opens the speaker-notes panel without persisting it |
| `?print` | stacks every slide on one scrolling page for printing |
| `?print&slides=1,4-6` | prints only those slides (1-based, filename order) |
| `?pdf` | with `?print`, auto-opens the browser's print dialog |
| `?nolive` | disables live reload |

## Why the preview flags do not persist

A link that permanently changed someone's theme would be a trap: open a colleague's `?theme=day` link once and every later visit is in Day. So the query string wins for the life of the page and is then forgotten. Persisted choices come only from the rail switcher and the `T` / `R` keys, where the user's intent to change a setting is explicit.

## Print behaviour

`?print` ignores the persisted theme and stays Tinted. A PDF exported on a machine that happened to be left in Day would otherwise not be the deck anyone approved. An explicit `?theme=` is honoured, and that is exactly how `export-pdf.sh` renders the same deck in all four themes.

`?ratio=4:3` is honoured in print too, and sizes the PDF page to 960x720 to match.

## Why `?nolive` exists

The dev server holds an SSE stream open for live reload. Headless Chrome's `--virtual-time-budget` waits for the page to go idle, and an open stream never does, so a screenshot run would hang until the budget expired. `deploy/build.mjs` appends `?nolive` when it renders `og.png` for link previews.
