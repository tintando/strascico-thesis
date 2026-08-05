# Night Feed element library

The deck's Telegram device vocabulary, one file per element, verified against
the real Telegram Desktop sources (the pins and what was read out of each are
in the verification table below). `deck.css` `@import`s every file; the modules
are also usable standalone.

## Integration

1. Import `tokens.css` **first**, then any element files you need (or just the
   ones you use; they are independent):

   ```css
   @import url("elements/tokens.css");
   @import url("elements/bubble.css");
   ```

2. Copy the HTML snippet from the header comment of the element's file.
3. Theming: tdesktop's four embedded themes, by settings-card name. Tinted
   (Night Feed, the deck default) needs no attribute; set
   `data-theme="classic" | "day" | "night"` on `<html>` for the others
   (Classic = the default light palette with green own bubbles, Day =
   day-blue, Night = night-green). **All colors for all four themes live in
   `tokens.css`**: customize there, never in an element file. The overrides
   hold in print too; the deck's own PDF stays Tinted because its `?print`
   path drops the attribute unless an explicit `?theme=` asks otherwise.
4. Fonts: the tokens expect Inter (400/600) and JetBrains Mono (400/500);
   the deck self-hosts them in `slides/fonts/` via `@font-face` in `deck.css`.
   Standalone users must provide their own `@font-face` (the stacks fall back
   to Segoe UI / Consolas).
5. Sizes assume the deck's 26px body on a fixed 1280×720 slide (≈ 2× real
   Telegram's 13px chat font). Scale the whole slide, not the elements.
6. The library ships **no one-shot animations**: a narrative beat (arrive /
   edit / delete) is staged as consecutive near-duplicate slides.
   The only animations are perpetual ambient loops,
   the typing indicator's blink and the `.pre.loop` log cycle. They run in the
   live viewer only, and hold still (fully visible) in every export path:
   reduced motion, the on-screen `?print` view, and print itself.
   Every file is viewer-independent.

## Verification table

Verified against **tdesktop v6.9.3**, the author's own flatpak client: the
theme zips (night, day-blue, night-green), chat styles, paint code and strings,
and **lib_ui @ 742640cb**, its exact submodule pin (`ui/colors.palette` = the
Classic palette). Status: **exact** = matches the real client; **deviation** =
differs on purpose, with the reason in the file header.

| Element | File | Real Telegram source | Status |
|---|---|---|---|
| Incoming bubble | `bubble.css` | `msgInBg`, `msgInDateFg`, radii `bubbleRadiusLarge` 16px / small 6px; protruding tail = `bubble_tail` icon 6×10 @1x on the last message of a same-sender run (`countMessageRounding`) | exact (day hairline: deviation; real day uses `msgInShadow`; tail outlined with the same hairline) |
| Own bubble | `bubble.css` | `msgOutBg`, `msgOutDateFg`, text `historyTextOutFg`, mirrored tail | exact |
| Ghost bubble | `bubble.css` | none: the thesis's one invented device | deviation (by design) |
| `edited` tag | `bubble.css` | `lng_edited`: lowercase, before timestamp, date color | exact |
| Edit diff `.del`/`.ins` | `bubble.css` | none (diff view) | deviation (deck legend colors) |
| Sender name `.sender` | `bubble.css` | `msgNameFont` = `semiboldFont` at body size, one line, no gap; `historyPeer1..8NameFg` via `id % 7` (v6.9.3 generalizes to 64 server-assigned slots, but un-recolored peers still use these 7); incoming only, never on own bubbles | exact (deck assigns the color per voice, not by `id % 7`) |
| Video / photo attachment `.vid` | `video.css` | `history_view_gif.cpp`: 44px circle on `msgDateImgBg`, icon `historyFileThumbIconFg`, infinite radial at `msgFileRadialLine` 3px, duration label TOP-LEFT (`msgDateImgDelta`/`msgDateImgPadding`) | exact chrome (scene is a stylized stand-in; metrics 2×; arc loop is perpetual-ambient) |
| Content stand-in `.stub` | `stub.css` | none: invented (like the ghost bubble): placeholder text rows + picture glyph for content the deck won't reproduce, drawn straight on the bubble | deviation (by design) |
| Comments footer `.comments` | `comments.css` | `Message::paintCommentsButton` (`history_view_message.cpp:2270-2393`): 40px strip off the bubble bottom (`historyCommentsButtonHeight`, `chat.style:708-715`), separator = 1px `msgDateFg` @ 0.3, up to 3 recent-commenter userpics 25px / 2px stroke / 19px advance (`kMaxRecentRepliers`), label `semiboldFont` in `msgFileThumbLinkInFg`, `history_comments_open` chevron, `mediaUnreadSize` 7px dot in `msgFileInBg`; strings `lng_comments_open_none` / `lng_comments_open_count` | exact anatomy (metrics 2×; icons are glyph stand-ins; hover ripple omitted, since slides don't hover) |
| Forwarded-from | `fwd.css` | `msgInServiceFg` + `lng_forwarded` | exact |
| Reply quote | `replyq.css` | `msgInReplyBarColor` (night `#429BDB`, day = `activeLineFg` `#37A1DE`) | exact |
| Blockquote `.bq` | `blockquote.css` | `messageEntityBlockquote` via the shared quote paint path: colors `EnsureBlockquoteCache`/`SimpleColorIndexValues` (`chat_style.cpp:34-45,116-136,756-765`: bar/icon = `msgReplyBarColor`, bg @ `kDefaultBgOpacity` 0.12, bar @ 0.9), geometry `historyTextStyle.blockquote` (`chat_helpers.style:1198-1214`: padding 10/2/20/2, outline 3px, radius 5px, `chat/mini_quote` icon top-right) | exact anatomy (metrics ~2×; glyph stands in for the icon; peer-colored quotes and the expand chevron omitted; header) |
| Code block `.pre` | `pre.css` | pre/blockquote share one paint path: `ValidateQuotePaintCache`/`FillQuotePaint` (lib_ui `ui/text/text.cpp`), style `historyQuoteStyle` (`chat_helpers.style`): rounded tinted rect, 3px left bar, mono text, copy icon top-right, header row only when a language is tagged; colors derive from `msgInMonoFg`/`msgOutMonoFg` (`EnsurePreCache`, `chat_style.cpp:47-67`; bar @ 90%, icon @ 60%, bg @ 12%, except dark themes: bg flat `#000000` @ 75%, `chat_style.cpp:767-769`) | exact anatomy (metrics 2×; 20px mono, not the client's message-size mono, since 26px does not fit slide 5's thread; untagged ⇒ headerless, faithful; `.loop` variant is a deck perpetual ambient) |
| Reactions | `reactions.css` | `history_view_reactions.cpp`: unchosen `msgFileInBg` @ 0.12, label `msgInServiceFg`; chosen solid `msgFileInBg`, label `historyFileInIconFg` (v6.9.3 has no bare `msgFileBg` key) | exact |
| Poll | `poll.css` | `history_view_poll.cpp` `paintFilling` (bar fill = `msgFileInBg`) + `chat.style`; strings `lng_polls_anonymous`, `lng_polls_votes_count` | exact (metrics scaled 2×) |
| Venue / location `.loc` | `location.css` | `history_view_location.cpp` venue draw, v6.9.3 order: map thumbnail first (top corners bubble-rounded, bottom squared), then title + address in one `historyTextFg` pen, time as normal date-style info in the text area (`InfoDisplayType::Default`; the `msgDateImgBg` capsule is bare-location only); `mapPointDrop`/`mapPointDot` pin | exact anatomy; map tile is a stylized stand-in, letterboxed to fit (header) |
| Channel card | `chcard.css` | profile-page composition on `msgInBg` | deviation (card layout is the deck's) |
| Channel info sidebar | `profile.css` | third-column info panel (Info::Profile): avatar header, Description field, shared-media count rows (`lng_profile_photos` and siblings) on `windowBg` | deviation (accent-tinted icons = deck legend; real icons are muted gray) |
| Folder tabs | `folders.css` | chat folders; active accent | deviation (hero blue instead of in-app accent) |
| Interstitial | `interstitial.css` | server `restrictionReason`, shown verbatim (`data_peer.cpp` pass-through) | exact wording; amber styling is the deck legend |
| Pinned bar | `pinned.css` | `pinned_bar.cpp`/`message_bar.cpp`: full width flush under the header, `historyReplyHeight` 49px, `historyPinnedBg`, accent `msgReplyBarSize` 2×36 in `msgInReplyBarColor`, semibold `lng_pinned_message` title in `windowActiveTextFg`, preview in `windowFg`, close button, no pin glyph | exact (single-pin form; the real accent segments when several messages are pinned; `.two` is a deck-only variant letting the preview wrap to two lines, where Telegram always elides to one) |
| Unread divider `.divider` | `divider.css` | `historyUnreadBarBg/Fg/Border`, `historyUnreadBarFont` semibold, full width | exact |
| Service line `.caveat` | `service.css` | `msgServiceBg`, `msgServiceFg`, `msgServiceFont` semibold, centered pill | palette exact; set to 26px, the deck's author size, a projector value; `.who`/`.act` (join pills on the cover) is a deviation: the client renders name and action in one white, the deck greys the action to 72% so the name reads first |
| Typing indicator | `typing.css` | three-dot typing animation, drawn in an incoming bubble | deviation (real client shows it in the header/chat list, not as a bubble) |
| Big stat | `stat.css` | none: deck data voice | deviation (by design) |
| Figure slot | `figslot.css` | none: full-width chart container, the last resort; figures prefer the attachment-in-bubble carrier (snippet in `bubble.css`) | deviation (by design) |
| Tokens | `tokens.css` | night theme + day palette, key-by-key (comments cite each) | exact, incl. `#0E1621` = the night wallpaper's literal 1×1 px |

Token values and their palette sources (night / day):

| Token | Night | Day | Palette key |
|---|---|---|---|
| `--poll-bar` | `#3F96D0` | `#40A7E3` | `msgFileInBg` (day = `windowBgActive`) |
| `--service-in` | `#71BAFA` | `#168ACD` | `msgInServiceFg` |
| `--ink-out` | `#E4ECF2` | `#000000` | `historyTextOutFg` |
| `--service-bg` | `#213040D5` | `#517C417F` | `msgServiceBg` |
| `--service-ink` | `#FFFFFF` | `#FFFFFF` | `msgServiceFg` = `windowFgActive` |
| `--unread-bg` | `#182433` | `#FCFBFA` | `historyUnreadBarBg` |
| `--unread-ink` | `#FFFFFF` | `#538BB4` | `historyUnreadBarFg` |
| `--pinned-bg` | `#1B2734` | `#FFFFFF` | `historyPinnedBg` |
| `--replybar` | `#429BDB` | `#37A1DE` | `msgInReplyBarColor` |
| `--comments-link` | `#6AB2F2` | `#168ACD` | `msgFileThumbLinkInFg` → `lightButtonFg` (day = `windowActiveTextFg`) |
| `--mono-in` | `#5A8CB7` | `#4E7391` | `msgInMonoFg` |
| `--mono-out` | `#AED1F3` | `#459866` | `msgOutMonoFg` |
| `--pre-bg-in` / `--pre-bg-out` | `#000000` @ 75% (both sides) | monoFg @ 12% per side | derived (`EnsurePreCache`, `chat_style.cpp:767-769`) |
| `--active-text` | `#6AB3F3` | `#168ACD` | `windowActiveTextFg` (pinned-bar title) |
| `--media-capsule-bg` | `#00000054` | `#00000054` | `msgDateImgBg` |
| `--media-icon` | `#EFEFEF` | `#FFFFFF` | `historyFileThumbIconFg` |
| `--map-pin` | `#FD4444` | `#FD4444` | `mapPointDrop` (dot: `mapPointDot` `#FFFFFF`) |
| `--peer1`…`--peer8` | see `tokens.css` | see `tokens.css` | `historyPeer1..8NameFg` (client uses 7 slots; yellow `peer3` never) |

(The full token set, including the base surfaces and semantic accents, lives
in `tokens.css` with a palette-key comment on every line.)
