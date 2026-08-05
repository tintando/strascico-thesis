# Driving the viewer

Everything the presenter touches during a talk, and what the deck remembers afterwards.

## Keys

| Key | Effect |
|---|---|
| `←` `→` `↑` `↓`, scroll | previous / next slide |
| `S` | show or hide the sidebar rail |
| `T` | cycle the four themes |
| `R` | toggle 16:9 and 4:3 |
| `N` | open the speaker-notes panel |
| `F` | fullscreen |

On a touch screen: swipe to move, pinch or double-tap to zoom into a slide, drag to pan it. Below 900px the rail collapses into a drawer, opened by the hamburger and closed by a tap on the backdrop, with the slide's `‹` `›` buttons moved into the HUD.

## What persists, and where

Last-viewed slide, theme and aspect ratio persist in `localStorage`, so a refresh mid-talk returns to the slide that was on screen. The notes panel persists per window instead. That split is the presenting setup: a laptop window with notes open and a projector window without, both remembering the right thing. Two windows of the same browser also follow each other's navigation through the `storage` event, so advancing a slide on the laptop advances the projector.

## Speaker notes

The notes panel sits above the stage and shows the current slide's verbatim script. The script lives in the fragment's own `<aside class="notes">`, which is where it is edited and the only place it exists. The viewer never writes, which is why the published deck needs no write endpoint, no shared secret and no server-side state.

The consequence is that the notes are public. `N` shows them to anyone who loads the deck, with no password. They are a spoken script about a public dataset, so this was cheaper than building an authentication path that the lectern would have to log into.

Sized for the lectern you read from: `A-` and `A+` set the script's type size, and the handle on the panel's bottom edge drags its height (double-click resets it). Both persist per machine, and the slide refits under whatever height is left.

## Themes

Telegram Desktop's four embedded settings cards, switchable from the rail footer or with `T`:

- **Classic**: light, green own bubbles, the doodle wallpaper.
- **Day**: light, blue own bubbles on the blue wallpaper.
- **Tinted**: the deck's default, the palette the design was drawn against.
- **Night**: dark, teal accents.

None of the four is a fallback. Their palettes are read out of the client's own theme files rather than approximated, because the deck's argument is that it looks like Telegram, and a hand-mixed palette would undercut it in front of an audience that uses the app daily.

## Aspect ratio

16:9 (1280x720) is the authoring default. 4:3 (960x720) is there for a lecture-hall projector that turns out to be older than the talk. The switch keeps the slide height, so the type scale is unchanged and the thread reflows into the narrower column rather than shrinking.

## Without Docker

`node slides/server/server.js` serves the same deck on port 8080. The server is 117 lines and has no dependencies, so this needs nothing but Node 20 or later.
