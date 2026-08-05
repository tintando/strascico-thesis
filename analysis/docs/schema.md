# Schema Reference

PostgreSQL 16.14. Only `plpgsql` is installed: no `pg_trgm`, no `pg_stat_statements`, no FTS index on text.

---

## `messages`

Primary key: `(channel_id, message_id)`

| Column | Type | Notes |
|---|---|---|
| `channel_id` | `bigint NOT NULL` | FK → `channels.channel_id` |
| `message_id` | `integer NOT NULL` | Telegram message ID, unique within a channel |
| `date` | `timestamptz NOT NULL` | Publication timestamp |
| `edit_date` | `timestamptz` | Telegram's last-edit timestamp; NULL if never edited. **~⅓ of messages carry it, but it is NOT a human-edit signal:** Telegram auto-edits posts within seconds of publishing to finalise media/albums and attach link previews (~20 % of flagged edits land <10 s after `date`, ~74 % of those on media/`webpage`). Treat as an *upper bound* on editing; the human signal is the slower, text-bearing tail. Stored verbatim from Telethon's `message.edit_date`: not a scraper artefact. Quantified in `notebooks/03_edits_and_deletions.ipynb` §1. |
| `text` | `text` | Raw body via `message.message`. NULL for media-only messages. Do not confuse with Telethon's `message.text`, which bakes in markdown. Stored with TOAST EXTENDED (compressed + out-of-line). |
| `author_id` | `bigint` | Extracted from `message.from_id` (PeerUser, PeerChannel, or PeerChat). NULL for anonymous broadcast posts. |
| `post_author` | `text` | Author signature string. NULL when signatures are disabled. |
| `views` | `integer` | View count at collection time |
| `forwards` | `integer` | Forward count at collection time |
| `is_pinned` | `boolean NOT NULL` | |
| `grouped_id` | `bigint` | Album grouping ID: shared across all media in the same album |
| `is_forwarded` | `boolean NOT NULL` | `true` when `message.fwd_from` is not NULL |
| `fwd_from_channel_id` | `bigint` | Source channel of the forward. NULL for user forwards or hidden/deleted sources. Inside a discussion group, rows where this equals the parent broadcast are the **auto-forwarded duplicates** of channel posts: the roots of comment threads (see "Comment mechanism" below). |
| `fwd_from_message_id` | `integer` | Original message ID in the source channel. For an auto-forwarded duplicate, this is the original post's `message_id` in the parent broadcast. |
| `fwd_date` | `timestamptz` | Original posting date of the forwarded message |
| `fwd_from_name` | `text` | Display name when source is a hidden user or deleted channel |
| `reply_to_msg_id` | `integer` | Parent message ID if this is a reply. For a top-level comment, this is the auto-forwarded duplicate's id. |
| `reply_to_top_id` | `integer` | Thread-root message id; NULL for non-threaded replies. In a discussion group this points at the **auto-forwarded duplicate** of the channel post the thread hangs off: i.e. it identifies which post a comment belongs to. |
| `is_comment` | `boolean NOT NULL` | True for a **comment on a channel post**: a reply in a linked discussion group whose direct parent (`reply_to_msg_id`) or thread root (`reply_to_top_id`) is an auto-mirror of a parent-channel post. The scraper writes `false` for every row (`is_comment = False` is hard-coded in `extractors.py`); it is populated post-collection by a backfill pass applying the formalised rule in "Message-role taxonomy in groups" below. **Backfilled 2026-06-25: `true` on 115,246,050 rows (~23.2 % of the corpus) across all 3,799 discussion groups.** Auto-mirrors, free chat, replies-to-chat and forum-topic messages stay `false`. A *lower bound* (uncaptured root mirrors hide their comments). The scraper still writes `false` at ingest, so the backfill must be re-run after new pulls, or, better, the rule applied at ingest in `extractors.py`. |
| `replies_count` | `integer` | Number of replies/comments reported by Telegram |
| `reactions` | `jsonb` | `[{"emoticon":"👍","count":42}, ...]`. Custom emoji entries use `"custom_emoji_id"` instead of `"emoticon"`. |
| `entities` | `jsonb` | URLs, mentions, bold, etc. Stored `type` uses the **short** Telethon class name without the `MessageEntity` prefix: e.g. `Url`, `TextUrl`, `Mention`, `MentionName`, `Bold`, `Hashtag`, `CustomEmoji`. Example: `[{"type":"TextUrl","offset":0,"length":23,"url":"https://..."}]`. Note `Url` entities carry the link inline in `text` (offset/length); only `TextUrl` has a populated `url` field. |
| `restriction_reason` | `jsonb` | Per-platform content-restriction metadata: an array of `{platform, reason, text}`. **Not "usually NULL": ~18.1 M messages carry one.** The message is still *present*, just withheld on the named platforms. See "restriction_reason values" below; census and characterisation in `notebooks/04_restrictions.ipynb`. |
| `has_media` | `boolean NOT NULL` | True when `message.media` is not NULL |
| `media_type` | `media_type_enum` | See enum values below |
| `service_action` | `service_action_enum` | Set for `MessageService` objects. NULL for normal messages. |
| `service_action_data` | `jsonb` | Action-specific payload (group call info, gift details, pinned message ref, …). NULL when no extra fields are useful. |
| `is_deleted` | `boolean NOT NULL` | Set true when deletion detection confirms the message was removed |
| `deleted_at` | `timestamptz` | When deletion was detected |
| `collected_at` | `timestamptz NOT NULL` | When the scraper fetched this message |

**`media_type` enum values:** `photo`, `document`, `webpage`, `geo`, `geo_live`, `contact`, `poll`, `dice`, `venue`, `game`, `invoice`, `story`, `giveaway`, `giveaway_results`, `paid_media`, `todo`, `sticker`, `video`, `video_note`, `voice`, `audio`, `animation`

**`service_action` enum values:** `BoostApply`, `BotAllowed`, `ChangeCreator`, `ChannelCreate`, `ChannelMigrateFrom`, `ChatAddUser`, `ChatCreate`, `ChatDeletePhoto`, `ChatDeleteUser`, `ChatEditPhoto`, `ChatEditTitle`, `ChatJoinedByLink`, `ChatJoinedByRequest`, `ChatMigrateTo`, `ConferenceCall`, `ContactSignUp`, `CustomAction`, `Empty`, `GameScore`, `GeoProximityReached`, `GiftCode`, `GiftPremium`, `GiftStars`, `GiftTon`, `GiveawayLaunch`, `GiveawayResults`, `GroupCall`, `GroupCallScheduled`, `HistoryClear`, `InviteToGroupCall`, `ManagedBotCreated`, `NewCreatorPending`, `NoForwardsRequest`, `NoForwardsToggle`, `PaidMessagesPrice`, `PaidMessagesRefunded`, `PaymentRefunded`, `PaymentSent`, `PaymentSentMe`, `PhoneCall`, `PinMessage`, `PollAppendAnswer`, `PollDeleteAnswer`, `PrizeStars`, `RequestedPeer`, `RequestedPeerSentMe`, `ScreenshotTaken`, `SecureValuesSent`, `SecureValuesSentMe`, `SetChatTheme`, `SetChatWallPaper`, `SetMessagesTTL`, `StarGift`, `StarGiftPurchaseOffer`, `StarGiftPurchaseOfferDeclined`, `StarGiftUnique`, `SuggestBirthday`, `SuggestProfilePhoto`, `SuggestedPostApproval`, `SuggestedPostRefund`, `SuggestedPostSuccess`, `TodoAppendTasks`, `TodoCompletions`, `TopicCreate`, `TopicEdit`, `WebViewDataSent`, `WebViewDataSentMe`

**`restriction_reason` values (observed 2026-06-09).** Array; each element is `{platform, reason, text}`. **Platforms:** `android`, `ios`, `all`. **Reasons:** `androidterms`, `appleviolence`, `appleterms`, `copyright`, `terms`, `porn`, `doxxing`, `sensitive`. The `text` is the per-platform explanatory string shown in place of the message: e.g. *"This message can't be displayed on Telegram apps downloaded from the Google Play Store"* (`android` / `androidterms`), *"…couldn't be displayed on your device because it violates the Telegram Terms of Service"* (`all` / `terms`), *"…due to copyright infringement"* (`copyright`). This is **distinct from Signal A** whole-post obscuring, where the message's own `text` body is *replaced* by a notice. Query with containment, e.g. `WHERE restriction_reason @> '[{"reason":"porn"}]'`.

**Existing indexes:**
```sql
messages_pkey                       btree (channel_id, message_id)            -- PK
idx_messages_channel_date           btree (channel_id, date)
idx_messages_date                   btree (date)
idx_messages_fwd_channel            btree (fwd_from_channel_id)               -- partial: WHERE fwd_from_channel_id IS NOT NULL
idx_messages_collected_at_brin      brin  (collected_at) pages_per_range=32   -- cheap range scans by ingest time
```

### Message-role taxonomy in groups (and the `is_comment` definition)

Telegram comments are **not** a separate object: they are ordinary
`messages` rows in a broadcast channel's *linked discussion group*. The
**same** is true of group chat, replies, and forum-topic messages: every
"role" is encoded in the `is_forwarded`/`fwd_from_*`/`reply_to_*`/
`author_id` columns, not a type tag. This section formalises how to tell
the roles apart. Validated against the live `tgdataset2` DB (2026-06-24,
two linked groups of opposite character) and cross-checked against the
TL schema (`messageReplyHeader`, `messageFwdHeader`) and Telegram's
[discussion](https://core.telegram.org/api/discussion) /
[threads](https://core.telegram.org/api/threads) docs.

**Building blocks (per discussion group `c`).** `parent = c.linked_to_channel_id`
(NULL ⇒ `c` is not a linked group). Two reference sets over `c`'s rows:

- **Auto-mirror set `D(c)`**: the channel-authored duplicates of parent posts:
  `is_forwarded AND fwd_from_channel_id = parent AND author_id = parent`.
  The `author_id = parent` clause is **load-bearing**: Telegram posts the
  duplicate *as the channel itself* (`from_id` = the broadcast), so members
  who manually re-forward the same post (~0.3 % of `fwd_from = parent`
  rows; 6 / 1 964 in the probed group) are correctly excluded. `D`'s
  `fwd_from_message_id` is the original post id in `parent` (from Telethon's
  `fwd_from.channel_post`).
- **Topic-root set `T(c)`**: `service_action = 'TopicCreate'` rows. Non-empty
  only for **forum** (topics-enabled) supergroups; empty for ordinary linked
  comment groups.

**The seven roles.** Classify a message `m` in group `c` in this order:

| # | Role | Rule | `is_comment` |
|---|---|---|:--:|
| 0 | **Service** | `service_action IS NOT NULL` | false |
| 1 | **Auto-mirror** (the post copy) | `message_id ∈ D` | false |
| 2 | **Comment, direct** | `reply_to_msg_id ∈ D` | **true** |
| 5 | **Comment, nested** (reply within a post thread) | `reply_to_top_id ∈ D` (and not #2) | **true** |
| 6 | **Forum-topic message** | `reply_to_top_id ∈ T` | false |
| 3 | **Free-chat, top-level** | `reply_to_msg_id IS NULL` | false |
| 4 | **Reply to free chat** | else (`reply_to_msg_id` set, roots on a non-mirror) | false |

So the flag is exactly:

```
is_comment(m)  ≡  (reply_to_msg_id ∈ D(c))  OR  (reply_to_top_id ∈ D(c))
```

i.e. a comment is a reply whose **direct parent** *or* **thread root** is an
auto-mirror. The auto-mirror itself is the *post*, not a comment, so it is
`false`. Canonical per-group SQL (the whole-corpus backfill applies the same rule):

```sql
WITH d AS (   -- auto-mirror set for this group
  SELECT message_id, fwd_from_message_id AS parent_post_id
  FROM messages
  WHERE channel_id = :chat_id
    AND is_forwarded AND fwd_from_channel_id = :parent_id
    AND author_id = :parent_id
)
SELECT r.message_id AS comment_id, d.parent_post_id, r.text
FROM messages r
JOIN d ON d.message_id IN (r.reply_to_top_id, r.reply_to_msg_id)
WHERE r.channel_id = :chat_id;          -- one row per comment
```

**Why `reply_to_top_id` alone is NOT a comment signal.** In a megagroup
*every* threaded reply carries `reply_to_top_id = thread root`, whether the
thread hangs off a post or off a member's chat message. In the probed
399 K-message group, **105 759** rows over **32 152 distinct** `reply_to_top_id`
values rooted on *ordinary user messages* (native chat reply-chains), versus
only ~1 958 auto-mirrors and ~9 250 actual comments. Counting "any
`reply_to_msg_id`/`reply_to_top_id`" therefore massively over-counts; only
roots that land in `D` are comments. Two worked breakdowns (2026-06-24):

| | chat-dominant grp `1420634070` | post-heavy grp `1258242629` |
|---|--:|--:|
| auto-mirror (1) | 1 958 | 74 851 |
| comment direct (2) | 3 691 | 9 092 |
| comment nested (5) | 5 850 | 3 395 |
| free-chat top (3) | 202 667 | 250 284 |
| free-chat reply (4) | 182 030 | 57 253 |
| service (0) | 2 901 | 3 258 |

**Caveats / known lossiness.**

- **Two fields are discarded by the scraper** (`extractors.py`): the
  `messageReplyHeader.forum_topic` flag and `messageFwdHeader.saved_from_*`.
  Consequence: topic membership must be **reconstructed** from `TopicCreate`
  service rows (set `T`), not read off a flag; `saved_from` is not needed
  because `author_id = parent` already pins the canonical auto-mirror. A
  direct comment may carry `reply_to_top_id = reply_to_msg_id = mirror` **or**
  `reply_to_top_id` NULL: both conventions occur: so always test the
  **union** over {`reply_to_msg_id`, `reply_to_top_id`}.
- **Comment counts are a lower bound.** If a thread's root auto-mirror was
  never scraped (deletion, or outside the crawled range), its comments fall
  out of `D` and look like free-chat replies. In the probed group this did
  *not* happen (all orphan roots were present native messages), but corpus-wide
  treat comments as a floor.
- **Standalone megagroups** (`linked_to_channel_id` NULL) have no `D` ⇒ no
  comments by definition; all content is free chat / topic messages.
  `channels` stores no broadcast-vs-megagroup flag, so a
  broadcast-without-comments and a standalone megagroup are not perfectly
  separable from `channels` alone: use author multiplicity or
  `metadata_snapshots.linked_chat_id` (set on the *broadcast* that owns a
  discussion group) as a heuristic.

---

## `channels`

Primary key: `channel_id`

| Column | Type | Notes |
|---|---|---|
| `channel_id` | `bigint NOT NULL` | Telegram's native signed 64-bit channel ID |
| `creation_date` | `timestamptz NOT NULL` | Channel creation timestamp from `channel.date` |
| `first_seen` | `timestamptz NOT NULL` | When the scraper first encountered this channel |
| `source` | `text` | Discovery method **of whichever code path created the row first: not why the channel was scraped**. The scraper's `upsert_channel` is `INSERT … ON CONFLICT DO NOTHING`, so the label is set once and never updated. Values in current data: `seed_file` (2026-05-31 re-seed relabelled the old `dataset`), `forward`, `linked_group`. Older docs also list `seed`, `mention`, `manual`. **Race gotcha:** a fully-scraped channel can carry `source='forward'` and still be a linked discussion group: while a parent's history is pulled, a message forwarded *from its own comment group* creates the group's row as `forward` minutes before the linked-group registration step would have (`resolution.py` wins over `runner.py`; bit 1477051316 "Miguel Rix comentarios", created 2 min into seed `miguelrix`'s scrape). Identify comment groups by `linked_to_channel_id IS NOT NULL`, never by `source = 'linked_group'`. |
| `is_active` | `boolean NOT NULL` | Circuit breaker: false after repeated scrape failures |
| `initial_pull_complete` | `boolean NOT NULL` | True once the full historical pull has finished |
| `needs_recheck` | `boolean NOT NULL` | Crash-recovery flag: set true before processing, cleared on success |
| `consecutive_errors` | `integer NOT NULL` | Strike counter feeding the `is_active` circuit breaker |
| `linked_to_channel_id` | `bigint` | Self-FK: discussion group / broadcast pair link |

**Indexes:**
```sql
channels_pkey            btree (channel_id)                              -- PK
idx_channels_linked_to   btree (linked_to_channel_id)                    -- partial: WHERE linked_to_channel_id IS NOT NULL
```

---

## `metadata_snapshots`

Primary key: `snapshot_id` (bigserial)

One row per channel per crawl visit. Diff consecutive snapshots to detect name changes, subscriber growth, flag changes, etc. **Pool as of 2026-06-09: 32,986 snapshots / 13,541 channels; 10,352 channels have ≥2 (≥3: 6,432), window 2026-04-09 → 2026-06-09**: enough for corpus-wide change rates, though the ~monthly cadence under-counts fast flips.

| Column | Type | Notes |
|---|---|---|
| `snapshot_id` | `bigserial` | Surrogate PK |
| `channel_id` | `bigint NOT NULL` | FK → `channels` |
| `captured_at` | `timestamptz NOT NULL` | Snapshot timestamp |
| `username` | `text` | Channel @handle; NULL for private/handleless channels |
| `title` | `text` | Display name |
| `description` | `text` | Bio / about text |
| `is_scam` | `boolean NOT NULL` | Telegram scam flag |
| `is_verified` | `boolean NOT NULL` | Telegram verified badge |
| `is_restricted` | `boolean NOT NULL` | Geo-restricted access |
| `is_fake` | `boolean NOT NULL` | Telegram fake flag (distinct from `is_scam`) |
| `is_private` | `boolean NOT NULL` | True when `ChannelPrivateError` was returned; other fields will be NULL |
| `subscriber_count` | `integer` | Subscriber count at snapshot time |
| `photo_id` | `bigint` | `entity.photo.photo_id`: cheap change-detection without downloading |
| `photo_hash` | `text` | FK → `profile_pictures.photo_hash`; NULL if no profile picture |
| `linked_chat_id` | `bigint` | Linked discussion group ID; used for `is_comment` derivation |
| `restriction_reason` | `jsonb` | Details when `is_restricted = true` |

**Indexes:**
```sql
metadata_snapshots_pkey   btree (snapshot_id)                  -- PK
idx_snapshots_channel     btree (channel_id, captured_at)      -- supports lateral-join "latest snapshot per channel"
idx_snapshots_time        btree (captured_at)
```

---

## `message_edits`

Primary key: `edit_id` (bigserial)

Stores previous message versions. The `messages` table always holds the latest version.

**Two edit "universes" (don't conflate).** `messages.edit_date` is Telegram's *ever-edited* flag over the whole corpus (~⅓ of messages); `message_edits` only archives versions the scraper caught changing **between two scrape runs** (~21.8 K rows, all carrying before-text). The two differ by ~7000× *by design*: `message_edits` is the only set where you can diff *what* changed. The diffable set is what `notebooks/03_edits_and_deletions.ipynb` §2 works on.

| Column | Type | Notes |
|---|---|---|
| `edit_id` | `bigserial` | Surrogate PK |
| `channel_id` | `bigint NOT NULL` | Part of FK → `messages` |
| `message_id` | `integer NOT NULL` | Part of FK → `messages` |
| `text` | `text` | Body at this version |
| `edit_date` | `timestamptz` | `edit_date` that was on the message before replacement; NULL = original pre-edit version |
| `has_media` | `boolean NOT NULL` | |
| `media_type` | `media_type_enum` | |
| `entities` | `jsonb` | |
| `captured_at` | `timestamptz NOT NULL` | When this version was archived |

**Indexes:**
```sql
message_edits_pkey   btree (edit_id)                                  -- PK
idx_edits_message    btree (channel_id, message_id, captured_at)      -- per-message history scan
```

**Retrieving full history:** Join `messages` (current version) with `message_edits` ordered by `captured_at`. The original version has `edit_date IS NULL`.

---

## `polls`

Primary key: `(channel_id, message_id)`: one row per poll message.

| Column | Type | Notes |
|---|---|---|
| `channel_id` | `bigint NOT NULL` | Part of FK → `messages` |
| `message_id` | `integer NOT NULL` | Part of FK → `messages` |
| `poll_id` | `bigint NOT NULL` | Telegram poll ID |
| `question` | `text NOT NULL` | Poll question text |
| `question_entities` | `jsonb` | Formatting entities for the question |
| `answers` | `jsonb NOT NULL` | Answer options + vote counts: `[{"text":"…","option":"<bytes>","voters":12,"correct":true,"chosen":false}, …]` |
| `is_closed` | `boolean NOT NULL` | Poll has ended |
| `is_quiz` | `boolean NOT NULL` | Single-correct-answer quiz mode |
| `is_multiple` | `boolean NOT NULL` | Voters can pick multiple answers |
| `is_public_voters` | `boolean NOT NULL` | Voter identities are visible |
| `close_period` | `integer` | Seconds the poll stays open after start |
| `close_date` | `timestamptz` | Explicit close time |
| `total_voters` | `integer` | Total voter count at capture time |
| `solution` | `text` | Quiz mode: explanation shown after answering |
| `solution_entities` | `jsonb` | Formatting entities for the solution |
| `captured_at` | `timestamptz NOT NULL` | When this poll state was recorded |

The corresponding `messages` row has `media_type = 'poll'`. Latest state only: no historical poll snapshots.

---

## `crawl_runs`

One row per scraper run.

| Column | Type | Notes |
|---|---|---|
| `run_id` | `serial` | PK |
| `type` | `text NOT NULL` | `'scrape'` or `'alignment_snapshot'` |
| `started_at` | `timestamptz NOT NULL` | |
| `ended_at` | `timestamptz` | NULL if still running |
| `status` | `text NOT NULL` | `'running'`, `'completed'`, `'interrupted'`, `'failed'` |
| `interrupted_by` | `text` | `'alignment_snapshot'`, `'signal'`, `'crash'`, `'error'` |
| `cutoff_timestamp` | `timestamptz` | Fixed cutoff for alignment snapshots |
| `total_channels` | `integer` | Channels in the scrape list |
| `channels_attempted` | `integer` | Channels tried (success + error) |
| `channels_processed` | `integer` | Channels completed successfully |
| `messages_collected` | `bigint` | Messages collected in this run |
| `config_snapshot` | `jsonb` | Serialized scraper config |

---

## `run_channels`

Per-run worklist: which channels were assigned to a given run and their per-run status.

Primary key: `(run_id, channel_id)`

| Column | Type | Notes |
|---|---|---|
| `run_id` | `integer NOT NULL` | FK → `crawl_runs.run_id` |
| `channel_id` | `bigint NOT NULL` | FK → `channels.channel_id` |
| `position` | `integer NOT NULL` | Order within the run's queue |
| `status` | `text NOT NULL` | Values seen: `pending`, `completed`, `partial`, `error` |

---

## `profile_pictures`

Content-addressable store. Each unique image is stored exactly once.

| Column | Type | Notes |
|---|---|---|
| `photo_hash` | `text` | PK: SHA-256 of raw image bytes |
| `data` | `bytea NOT NULL` | Raw JPEG bytes (typically 640×640) |
| `phash` | `bigint` | 64-bit DCT perceptual hash for near-duplicate detection |
| `dhash` | `bigint` | 64-bit difference hash for near-duplicate detection |
| `first_seen` | `timestamptz NOT NULL` | |

---

## `unresolved_references`

Queue of @mentions and t.me/links awaiting resolution to a channel ID.

| Column | Type | Notes |
|---|---|---|
| `username` | `text` | PK: the @username or t.me slug |
| `first_seen` | `timestamptz NOT NULL` | |
| `resolved_at` | `timestamptz` | NULL if still pending |
| `resolved_channel_id` | `bigint` | FK → `channels`; set once resolved |
| `invalid` | `boolean NOT NULL` | True = permanently invalid, will not retry |
| `last_attempt` | `timestamptz` | Last resolution attempt |
| `attempt_count` | `integer NOT NULL` | Number of attempts so far |

---

## Entity relationships

```
channels ──< messages ──< message_edits
    │           │
    │           └──< polls
    │
    ├──< metadata_snapshots >── profile_pictures
    │
    ├──< unresolved_references (resolved_channel_id)
    │
    └──< run_channels >── crawl_runs

channels.linked_to_channel_id ──→ channels (self-FK, broadcast ↔ discussion group)
```
