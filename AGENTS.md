# YOUTOPIA AI review labeling

For Korean Steam review labeling, NLP training, model comparison, or review insight work:

1. Read `ai/review_labeling/CURRENT.json`, then its CODEX_HANDOFF.md and GUIDELINES_KO.md.
2. Current taxonomy is **v0.6**, guideline **v1.3.1**, pilot **100 reviews**. Preserve the archived v0.5 files.
3. Keep review text, evidence, scope, exclusions, unresolved decisions, provenance, and input requirements.
4. Reviews 71–100 have user-reviewed AI drafts; 1–70 retain their earlier AI leaf-reclassification review state. Do not claim independent blinded gold annotations.
5. Run `python3 ai/review_labeling/v0.6/validate.py`. Exclude all pilot review keys and their revisions from training and final test.
6. Review 92 explicitly uses Steam recommendation metadata to resolve polarity. Separate text-only and metadata-assisted comparison; give every compared model the same permitted input.
7. Difficulty is subjective and player-population dependent. Do not compare raw sentiment rates as absolute difficulty rankings across games.
8. Music, dubbing, effects, and track catalog are distinct. Use `CONTENT.TRACK_CATALOG` for review 95; review 96 preserves separate music and gameplay positives.
9. Keep taxonomy/checkpoint/input versions consistent. No completed training, database deployment, or running service is implied by this contract update.
10. Never merge or push to main. Preserve unrelated changes and deployment settings. Merge these pointers into existing AGENTS.md when integrating this directory into another branch.

11. Read the `scope_policy` in CURRENT.json before labeling. Educational effects are out of scope: preserve the original phrase as excluded text, create no tag/candidate/HOLD for that target, and do not remap it to `USABILITY.LEARNING_GUIDANCE`. That existing leaf remains for in-game tutorials, explanations, and guidance. The archived pilot annotations remain at guideline v1.3.0; this policy update does not relabel them.
