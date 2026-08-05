# Analysis

The code behind the results chapter of the thesis. Five notebooks, one per narrative arc, producing the 28 result figures and the tables that go with them.

```
notebooks/   the analysis, one notebook per thesis arc
data/        result CSVs small enough to ship, so many sections run offline
figures/     the 28 figures as PNG + PDF, exactly as they appear in the thesis
docs/        schema.md, the per-table reference for the corpus database
```

## Notebooks

| Notebook | Thesis section | What it covers |
|---|---|---|
| `01_corpus_and_coverage.ipynb` | 4.1, 4.2, 4.5 | scale, depth, the like-for-like comparison, volume decomposition, the crawl frontier |
| `02_interaction_layers.ipynb` | 4.3 | comments, reactions, polls, service actions, language and topic |
| `03_edits_and_deletions.ipynb` | 4.4 | what the edit flag really counts, the edit taxonomy, deletion by role and cause |
| `04_restrictions.ipynb` | 4.4 | Telegram's own per-item restriction record |
| `05_wartime_official_channels.ipynb` | 4.4 | the 2026 war as a method showcase, on fixed official cohorts |

## Figure inventory

Every figure in the thesis results chapter, and where it comes from. Filenames are the stems in `figures/` (each ships as `.png` and `.pdf`); the thesis embeds them as `figures/res_<name>.pdf`.

| Figure | Notebook | Runs offline? |
|---|---|---|
| `channel_message_dist` | 01 | database |
| `daily_messages_normalised` | 01 | offline (`daily_volume_normalised.csv`) |
| `activity_heatmap` | 01 | database (no CSV kept) |
| `frontier_link_types` | 01 | offline (`frontier_link_types.csv`) |
| `anchoring_rate_dist` | 02 | offline (`comment_anchoring_per_group.csv`) |
| `post_toggle_per_channel` | 02 | offline (`post_toggle_per_channel.csv`) |
| `thread_depth_dist` | 02 | database (no CSV kept) |
| `reaction_negativity_flag_rates` | 02 | offline (`reaction_negativity_deciles.csv`) |
| `poll_turnout` | 02 | database (per-poll frame not shipped) |
| `service_actions` | 02 | offline (`service_actions.csv`) |
| `language_distribution` | 02 | offline (`language_distribution.csv`) |
| `topic_shares` | 02 | offline (`topic_benchmark_table.csv`) |
| `edit_automatic_vs_genuine` | 03 | offline (`edit_automatic_vs_genuine.csv`) |
| `fig_5_8_edit_taxonomy` | 03 | database + local labelling run |
| `deletion_rates_by_role` | 03 | offline (`deletion_rates_by_role.csv`) |
| `deleted_comment_root_status` | 03 | offline (`deleted_comment_root_status.csv`) |
| `fig_6_11_moderation_vs_purge` | 03 | summary offline, distribution panel needs re-scoring |
| `restriction_reasons_by_reason` | 04 | offline (`restriction_reasons.csv`) |
| `restriction_reasons_by_platform` | 04 | offline (`signalB_by_platform.csv`) |
| `restriction_cooccurrence` | 04 | offline (`restriction_reason_cooccurrence.csv`) |
| `restricted_lang_topic_raw` | 04 | offline (`restriction_by_language.csv`) |
| `restricted_lang_topic_rate` | 04 | offline (`restriction_rate_by_language.csv`) |
| `official_volume_index` | 05 | table offline, curve needs the companion DBs |
| `per_channel_lift` | 05 | summary offline, box needs the companion DBs |
| `institution_arms` | 05 | offline (`institution_arms.csv`) |
| `homefront_clock` | 05 | needs the companion DBs |
| `framing_convergence` | 05 | offline (`framing_convergence.csv`) |
| `toxicity_by_side` | 05 | offline (`toxicity_by_side.csv`, `toxicity_by_lang.csv`) |

## What was left out

The working analysis was much larger than this. What was cut, and why:

- **Anything containing user message text.** Restricted-content samples, top-reacted messages, deleted-content topic assignments, and the per-channel raw message exports are excluded on privacy grounds. None backs a thesis figure.
- **Profile-picture contact sheets.** Two montages of real profile pictures, and the notebook that produced them: a privacy and licensing problem independent of size.
- **Caches and heavy intermediates.** Query caches, parquet artefacts, embeddings and the CUDA virtual environment. All regenerable, none load-bearing.
- **Large CSVs.**