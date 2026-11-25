# YOUTOPIA AI review labeling

For Korean Steam review labeling, NLP training, model comparison, or review insight work:

1. Read `ai/review_labeling/CURRENT.json` first, then the referenced `CODEX_HANDOFF.md` and `GUIDELINES_KO.md`.
2. The current taxonomy is **v0.5**, guideline **v1.2.0**. Do not fall back to v0.2/v0.3 or collapse music, dubbing, and effects into one sound label.
3. Review text, evidence, context, exclusions, and unresolved decisions must survive any import. A user's Steam recommendation is not the answer for every aspect.
4. This branch contains a labeling contract and a 70-review guideline pilot. It does not contain a completed training run or a deployed NLP service.
5. Validate with `python3 ai/review_labeling/v0.5/validate.py`. Keep pilot review keys out of training and final test, including other revisions of the same review.
6. Run old and new taxonomies as separate versions. Never overwrite the label mapping in an old checkpoint and claim it was migrated.
7. Do not merge or push to `main`. Integrate through the project's working branch workflow; preserve unrelated changes and existing deployment settings.

When integrating this directory into another branch, merge these pointers into its existing AGENTS.md rather than replacing unrelated project instructions.
