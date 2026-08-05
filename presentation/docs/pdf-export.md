# PDF export

The PDF is the submission copy and the emergency deck. A lecture hall that refuses the laptop, the browser, or the network still has a projector that prints, and 16 pages on a USB stick are the last thing left that works.

## From the viewer

Every sidebar row carries a tick box. The footer's `all` and `none` buttons set them in bulk, and **⎙ export PDF** prints exactly the ticked slides through the browser's print dialog: choose PDF as the destination, the page size is already preset. The selection persists across reloads, so a partial re-export after fixing one slide does not mean re-ticking fifteen boxes.

## From the shell

`slides/export-pdf.sh` takes the same selection as an argument and drives headless Chrome. It boots the dev server on a throwaway port, prints `/?print`, and shuts the server down, because the fragments load over HTTP and `file://` would not resolve them.

```
./export-pdf.sh                                  # deck.pdf: Tinted, 16:9
./export-pdf.sh 1,4-6                            # a subset, same syntax as ?slides=
THEME=day RATIO=4:3 OUT=/tmp/day43.pdf ./export-pdf.sh
./export-pdf.sh --all                            # the whole matrix, below
```

`THEME=`, `RATIO=` and `OUT=` pick which deck it renders where. A persisted theme never reaches a PDF: only an explicit one does, so a plain run stays Tinted whatever the browser last displayed.

## The matrix

`./slides/export-pdf.sh --all` fills `portable/` with every format combination: a directory per aspect ratio, a file per theme.

```
portable/  16-9/  deck-tinted.pdf  deck-classic.pdf  deck-day.pdf  deck-night.pdf
           4-3/   deck-tinted.pdf  deck-classic.pdf  deck-day.pdf  deck-night.pdf
```

Each is 16 pages, sized 1280x720 (960x720 in 4:3), backgrounds and all. There is no `:` in any name, so the stick survives a Windows machine and a FAT32 filesystem. Which theme the room wants is not knowable in advance: a hall with the blinds up eats the dark deck, and a hall at night eats the light one.

`slides/deck.pdf` stays what it was, the Tinted 16:9 submission copy, and ships at `/deck.pdf` on the published site when it has been exported.
