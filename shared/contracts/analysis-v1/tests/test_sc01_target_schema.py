"""SC-01 AnalysisTarget goldens, validated with JSON Schema Draft 2020-12.

This is a schema-only, offline shape check. ACCEPT_FORM_ONLY means neither
YouTube content existence nor access rights nor production authorization.
Requires: python -m pip install "jsonschema>=4.18,<5"
Run: python -m unittest discover -s shared/contracts/analysis-v1/tests -p 'test_sc01_target_schema.py' -v
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator

CONTRACT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((CONTRACT_ROOT / "analysis.schema.json").read_text(encoding="utf-8"))
TARGET_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$defs": {"AnalysisTarget": SCHEMA["$defs"]["AnalysisTarget"]},
    "$ref": "#/$defs/AnalysisTarget",
}
VALIDATOR = Draft202012Validator(TARGET_SCHEMA)


def identity(target_type: str, target_id: str, source: str = "YOUTUBE", **extra: object) -> dict:
    return {"source": source, "targetType": target_type, "targetId": target_id, **extra}


# First 11 entries correspond to Notion SC-01 §4 (shape acceptance only).
# Last two are added cross-validator whitespace regression cases.
VECTORS = [
    ("01_video_id_valid", identity("VIDEO", "Ab0_-123xyz"), True),
    ("02_channel_id_valid", identity("CHANNEL", "UC" + "a" * 22), True),
    ("03_video_id_ten_chars", identity("VIDEO", "Ab0_-123xy"), False),
    ("04_video_id_exclamation", identity("VIDEO", "Ab0_-123xyz!"), False),
    ("05_channel_handle_unresolved", identity("CHANNEL", "@example"), False),
    ("06_channel_with_video_id", identity("CHANNEL", "Ab0_-123xyz"), False),
    ("07_nexus_demo_not_youtube_id", identity("VIDEO", "update-trailer-0318"), False),
    ("08_source_steam", identity("VIDEO", "Ab0_-123xyz", source="STEAM"), False),
    ("09_extra_tab_id", identity("VIDEO", "Ab0_-123xyz", tabId=1), False),
    ("10_surrounding_spaces", identity("VIDEO", " Ab0_-123xyz "), False),
    ("11_well_formed_but_existence_unknown", identity("VIDEO", "Ab0_-123xyz"), True),
    ("12_video_id_trailing_lf", identity("VIDEO", "Ab0_-123xyz\n"), False),
    ("13_channel_id_trailing_lf", identity("CHANNEL", "UC" + "a" * 22 + "\n"), False),
]


class TestSc01TargetSchema(unittest.TestCase):
    def test_full_schema_is_draft_2020_12(self) -> None:
        self.assertEqual(SCHEMA["$schema"], "https://json-schema.org/draft/2020-12/schema")
        Draft202012Validator.check_schema(SCHEMA)
        Draft202012Validator.check_schema(TARGET_SCHEMA)


def _make_vector_test(instance: dict, expected: bool):
    def test_vector(self: TestSc01TargetSchema) -> None:
        self.assertEqual(
            VALIDATOR.is_valid(instance),
            expected,
            msg=f"Unexpected AnalysisTarget validation: {instance!r}",
        )
    return test_vector


for case_name, value, expected_acceptance in VECTORS:
    setattr(TestSc01TargetSchema, "test_" + case_name, _make_vector_test(value, expected_acceptance))


if __name__ == "__main__":
    unittest.main(verbosity=2)
