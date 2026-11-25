# YOUTOPIA review labeling and NLP

For Korean Steam review labeling, NLP training, model comparison, or review insights:

1. Read `ml/reviews/labeling/SOURCE.json`, `ml/reviews/labeling/GUIDELINES_v1.3.0_KO.md`, and `ml/reviews/TARGET_MIGRATION_KO.md` before changing the pipeline.
2. The integrated dictionary is taxonomy **v0.6**, guideline **v1.3.0**, pinned to the source commit recorded there. It has 73 leaf IDs and independent positive/negative outputs. Mixed is derived within a leaf, never a third training polarity or a collapsed parent label. Archived v0.5 definitions remain available.
3. Preserve body, Unicode evidence offsets, target, scope, strength, source opinion links, exclusions and HOLD. Do not infer missing subaspects or transfer another game's/platform's opinion.
4. All 100 guideline pilot reviews, revisions and copied reference bodies are excluded from training, validation and final testing. Original review acceptance does not approve new AI leaf labels. Metadata-assisted sentiment is preserved but excluded from text-only targets.
5. Keep real reviews, pilot IDs, approval ledgers, credentials and operational SQL out of this branch. Import/audit data in a private directory outside the repository.
6. Keep taxonomy, label mapping, policy, model, snapshot and review revision identities bound. Retrain the classifier for a new label schema; do not relabel an old checkpoint.
7. Verify with `python -m unittest discover -s ml/reviews/tests -v` in the documented CPU environment. Synthetic regression, actual gold accuracy, GPU execution and service deployment are separate claims.
8. The web analysis candidate is currently a separate YouTube contract. Do not pretend Steam leaf outputs are already connected to it or to RAG/DB transfer.
9. Four local conditions are TF-IDF/LR, TextCNN-rand, frozen KcELECTRA with a trained head, and full fine-tuning. OpenAI and Gemini each have baseline and project-guided prompt conditions on identical text/output contracts. Gemini tuning is not part of these conditions.
10. Difficulty is subjective and audience dependent. Retain observation scope, source-attributed conditions, denominators and explicit unknowns. Never infer skill from playtime or absolute difficulty rankings from sentiment.
11. Importing labels creates pending approval candidates, never human approvals. Keys/live paid calls, GPU setup/training and production operations remain paused; offline tests do not lift that pause.

Follow the user's authorized branch and operating scope. A source branch used for reference is not authorization to merge it, republish its raw pilots, deploy or change operating resources.
