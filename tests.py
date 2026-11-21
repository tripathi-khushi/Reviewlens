import json
import unittest

import server


class CleaningTests(unittest.TestCase):
    def test_clean_csv_handles_empty_duplicates_and_invalid_ratings(self):
        csv_text = """review_id,product,rating,date,review_text
R1,Test,5,2026-10-01,"Good product"
R2,Test,2,2026-10-02,""
R3,Test,five,2026-10-03,"Good product"
R4,Test,,2026-10-04,"Terrible quality"
"""
        cleaned, stats = server.clean_csv(csv_text)
        self.assertEqual(len(cleaned), 2)
        self.assertIsNone(cleaned[1]["rating"])
        self.assertEqual(stats["skipped_empty"], 1)
        self.assertEqual(stats["duplicates_removed"], 1)


class SchemaTests(unittest.TestCase):
    def test_valid_schema(self):
        payload = {"results": [{
            "sentiment": "negative",
            "topics": ["quality", "support"],
            "summary": "The product broke and support did not help.",
            "needs_reply": True,
        }]}
        result = server.validate_batch_response(payload, 1)
        self.assertEqual(result[0]["sentiment"], "negative")

    def test_invalid_topic_rejected(self):
        payload = {"results": [{
            "sentiment": "positive",
            "topics": ["performance"],
            "summary": "Works well.",
            "needs_reply": False,
        }]}
        with self.assertRaises(ValueError):
            server.validate_batch_response(payload, 1)


class HashTests(unittest.TestCase):
    def test_same_normalized_text_has_same_hash(self):
        first = server.text_hash("  Good product  ")
        second = server.text_hash("good product")
        self.assertEqual(first, second)


class RetryTests(unittest.TestCase):
    def test_failed_provider_batch_is_reported_without_cache(self):
        reviews = [{"review_text": "bad"}]
        original = server.call_gemini
        calls = {"count": 0}

        def always_fail(batch):
            calls["count"] += 1
            raise RuntimeError("invalid response")

        server.call_gemini = always_fail
        try:
            provider_calls, analysed = server.analyze_review_batch(reviews)
            self.assertEqual(provider_calls, 1)
            self.assertTrue(analysed[0][1]["analysis_failed"])
            self.assertEqual(calls["count"], 1)
        finally:
            server.call_gemini = original


if __name__ == "__main__":
    unittest.main()
