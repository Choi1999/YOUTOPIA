# YOUTOPIA review labeling and NLP

For Korean Steam review labeling, NLP training, model comparison, or review insights:

1. Read `ml/reviews/labeling/SOURCE.json`, `ml/reviews/labeling/GUIDELINES_v1.2.0_KO.md`, and `ml/reviews/TARGET_MIGRATION_KO.md` before changing the pipeline.
2. The integrated dictionary is taxonomy **v0.5**, guideline **v1.2.0**, pinned to the source commit recorded there. It has 71 leaf IDs and independent positive/negative outputs. Mixed is derived within a leaf, never a third training polarity or a collapsed parent label.
3. Preserve body, Unicode evidence offsets, target, scope, strength, source opinion links, exclusions and HOLD. Do not infer missing subaspects or transfer another game's/platform's opinion.
4. The 70 guideline reviews are excluded from training and final testing, including edited revisions. Original review acceptance does not approve new AI leaf labels.
5. Keep real reviews, pilot IDs, approval ledgers, credentials and operational SQL out of this branch. Import/audit data in a private directory outside the repository.
6. Keep taxonomy, label mapping, policy, model, snapshot and review revision identities bound. Retrain the classifier for a new label schema; do not relabel an old checkpoint.
7. Verify with `python -m unittest discover -s ml/reviews/tests -v` in the documented CPU environment. Synthetic regression, actual gold accuracy, GPU execution and service deployment are separate claims.
8. The web analysis candidate is currently a separate YouTube contract. Do not pretend Steam leaf outputs are already connected to it or to RAG/DB transfer.

Follow the user's authorized branch and operating scope. A source branch used for reference is not authorization to merge it, republish its raw pilots, deploy or change operating resources.
