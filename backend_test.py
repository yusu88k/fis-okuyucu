#!/usr/bin/env python3
"""
Backend API Test Suite for Turkish Receipt OCR App
Tests all backend endpoints with real Gemini API calls
"""
import os
import requests
import sys
import time
from pathlib import Path

# Lokal gelistirmede backend 8002'de calisir; platform uzerinde BACKEND_URL ile override edilir
BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8002/api").rstrip("/")
TEST_IMAGES_DIR = Path("/tmp/poc_receipts")

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class BackendTester:
    def __init__(self):
        self.session_id = None
        self.receipt_ids = []
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.critical_failures = []

    def log(self, message, color=Colors.BLUE):
        print(f"{color}{message}{Colors.END}")

    def test(self, name, func):
        """Run a single test"""
        self.tests_run += 1
        self.log(f"\n[{self.tests_run}] Testing: {name}", Colors.BLUE)
        try:
            func()
            self.tests_passed += 1
            self.log(f"✅ PASSED: {name}", Colors.GREEN)
            return True
        except AssertionError as e:
            self.tests_failed += 1
            self.log(f"❌ FAILED: {name}", Colors.RED)
            self.log(f"   Error: {str(e)}", Colors.RED)
            self.critical_failures.append(f"{name}: {str(e)}")
            return False
        except Exception as e:
            self.tests_failed += 1
            self.log(f"❌ ERROR: {name}", Colors.RED)
            self.log(f"   Exception: {str(e)}", Colors.RED)
            self.critical_failures.append(f"{name}: {str(e)}")
            return False

    def test_health(self):
        """Test GET /api/health"""
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('status') == 'ok', f"Expected status 'ok', got {data.get('status')}"
        assert data.get('engine') == 'node-express', f"Expected engine 'node-express', got {data.get('engine')}"
        self.log(f"   Health check OK, model: {data.get('model')}")

    def test_create_session(self):
        """Test POST /api/sessions"""
        resp = requests.post(f"{BASE_URL}/sessions", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'sessionId' in data, "Response missing 'sessionId'"
        self.session_id = data['sessionId']
        self.log(f"   Session created: {self.session_id}")

    def test_upload_receipts(self):
        """Test POST /api/sessions/:id/receipts with 3 test images"""
        assert self.session_id, "No session ID available"
        
        # Upload all 3 test images
        files = []
        for img_name in ['migros_karisik_kdv.png', 'sok_nakit.png', 'a101_tek_kdv.png']:
            img_path = TEST_IMAGES_DIR / img_name
            assert img_path.exists(), f"Test image not found: {img_path}"
            files.append(('receipts', (img_name, open(img_path, 'rb'), 'image/png')))
        
        resp = requests.post(
            f"{BASE_URL}/sessions/{self.session_id}/receipts",
            files=files,
            timeout=30
        )
        
        # Close file handles
        for _, (_, fh, _) in files:
            fh.close()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert 'added' in data, "Response missing 'added'"
        assert len(data['added']) == 3, f"Expected 3 receipts added, got {len(data['added'])}"
        assert data.get('rejected', 0) == 0, f"Expected 0 rejected, got {data.get('rejected')}"
        
        self.receipt_ids = [r['id'] for r in data['added']]
        self.log(f"   Uploaded 3 receipts, IDs: {self.receipt_ids[:2]}...")
        self.log(f"   Summary: {data.get('summary')}")

    def test_polling_and_processing(self):
        """Test GET /api/sessions/:id - poll until processing completes"""
        assert self.session_id, "No session ID available"
        
        self.log("   Polling for processing completion (Gemini API calls ~5-10s per receipt)...")
        max_wait = 120  # 2 minutes max
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            resp = requests.get(f"{BASE_URL}/sessions/{self.session_id}", timeout=10)
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            data = resp.json()
            
            summary = data.get('summary', {})
            bekliyor = summary.get('bekliyor', 0)
            isleniyor = summary.get('isleniyor', 0)
            tamam = summary.get('tamam', 0)
            kontrol = summary.get('kontrolGerekli', 0)
            hata = summary.get('hata', 0)
            
            self.log(f"   Status: bekliyor={bekliyor}, isleniyor={isleniyor}, tamam={tamam}, kontrol={kontrol}, hata={hata}")
            
            if bekliyor == 0 and isleniyor == 0:
                # Processing complete
                assert tamam + kontrol + hata == 3, f"Expected 3 total processed, got {tamam + kontrol + hata}"
                self.log(f"   Processing complete! tamam={tamam}, kontrolGerekli={kontrol}, hata={hata}")
                
                # Store receipts for later tests
                self.receipts_data = data.get('receipts', [])
                return
            
            time.sleep(3)
        
        raise AssertionError(f"Processing did not complete within {max_wait}s")

    def test_duplicate_detection(self):
        """Test duplicate detection by uploading same file twice"""
        assert self.session_id, "No session ID available"
        
        # Upload migros_karisik_kdv.png again
        img_path = TEST_IMAGES_DIR / 'migros_karisik_kdv.png'
        with open(img_path, 'rb') as f:
            files = [('receipts', ('migros_karisik_kdv.png', f, 'image/png'))]
            resp = requests.post(
                f"{BASE_URL}/sessions/{self.session_id}/receipts",
                files=files,
                timeout=30
            )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        # Wait for processing
        time.sleep(12)
        
        # Check session for duplicate flag
        resp = requests.get(f"{BASE_URL}/sessions/{self.session_id}", timeout=10)
        data = resp.json()
        receipts = data.get('receipts', [])
        
        # Find the duplicate
        duplicates = [r for r in receipts if r.get('isDuplicate')]
        assert len(duplicates) > 0, "Expected at least one duplicate receipt"
        self.log(f"   Duplicate detected: {duplicates[0].get('fileName')} (duplicate of {duplicates[0].get('duplicateOf')})")
        
        # Store duplicate ID for cleanup
        self.duplicate_id = duplicates[0]['id']

    def test_inline_edit_triggers_review(self):
        """Test PATCH /api/sessions/:id/receipts/:rid - editing total to 999 should trigger 'kontrol_gerekli'"""
        assert self.session_id, "No session ID available"
        assert len(self.receipt_ids) > 0, "No receipt IDs available"
        
        receipt_id = self.receipt_ids[0]
        
        # Edit total to 999
        resp = requests.patch(
            f"{BASE_URL}/sessions/{self.session_id}/receipts/{receipt_id}",
            json={"toplam": 999},
            timeout=10
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        receipt = data.get('receipt', {})
        
        assert receipt.get('status') == 'kontrol_gerekli', f"Expected status 'kontrol_gerekli', got {receipt.get('status')}"
        assert len(receipt.get('reviewReasons', [])) > 0, "Expected reviewReasons to be populated"
        self.log(f"   Edit triggered review: {receipt.get('reviewReasons')}")
        
        # Edit back to correct value (get original from receipts_data)
        original_receipt = next((r for r in self.receipts_data if r['id'] == receipt_id), None)
        if original_receipt and original_receipt.get('data'):
            original_total = original_receipt['data'].get('toplam')
            if original_total:
                resp = requests.patch(
                    f"{BASE_URL}/sessions/{self.session_id}/receipts/{receipt_id}",
                    json={"toplam": original_total},
                    timeout=10
                )
                assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
                data = resp.json()
                receipt = data.get('receipt', {})
                # Should be 'tamam' now (or still 'kontrol_gerekli' if other issues)
                self.log(f"   After restoring original total: status={receipt.get('status')}")

    def test_approve_receipt(self):
        """Test POST /api/sessions/:id/receipts/:rid/approve"""
        assert self.session_id, "No session ID available"
        assert len(self.receipt_ids) > 0, "No receipt IDs available"
        
        receipt_id = self.receipt_ids[0]
        
        resp = requests.post(
            f"{BASE_URL}/sessions/{self.session_id}/receipts/{receipt_id}/approve",
            timeout=10
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        receipt = data.get('receipt', {})
        
        assert receipt.get('status') == 'tamam', f"Expected status 'tamam', got {receipt.get('status')}"
        assert receipt.get('approved') == True, f"Expected approved=True, got {receipt.get('approved')}"
        assert len(receipt.get('reviewReasons', [])) == 0, f"Expected empty reviewReasons, got {receipt.get('reviewReasons')}"
        self.log(f"   Receipt approved successfully")

    def test_get_receipt_image(self):
        """Test GET /api/sessions/:id/receipts/:rid/image"""
        assert self.session_id, "No session ID available"
        assert len(self.receipt_ids) > 0, "No receipt IDs available"
        
        receipt_id = self.receipt_ids[0]
        
        resp = requests.get(
            f"{BASE_URL}/sessions/{self.session_id}/receipts/{receipt_id}/image",
            timeout=10
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert resp.headers.get('Content-Type') == 'image/jpeg', f"Expected image/jpeg, got {resp.headers.get('Content-Type')}"
        assert len(resp.content) > 1000, f"Expected image data >1KB, got {len(resp.content)} bytes"
        self.log(f"   Receipt image retrieved: {len(resp.content)} bytes")

    def test_export_excel_all(self):
        """Test GET /api/sessions/:id/export - export all receipts"""
        assert self.session_id, "No session ID available"
        
        resp = requests.get(
            f"{BASE_URL}/sessions/{self.session_id}/export",
            timeout=15
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in resp.headers.get('Content-Type', ''), \
            f"Expected xlsx content type, got {resp.headers.get('Content-Type')}"
        assert len(resp.content) > 5000, f"Expected xlsx file >5KB, got {len(resp.content)} bytes"
        self.log(f"   Excel exported (all): {len(resp.content)} bytes")

    def test_export_excel_with_month_filter(self):
        """Test GET /api/sessions/:id/export?month=YYYY-MM"""
        assert self.session_id, "No session ID available"
        
        # Use a month that should exist in test data (e.g., 2025-07, 2025-08, 2025-09)
        resp = requests.get(
            f"{BASE_URL}/sessions/{self.session_id}/export",
            params={"month": "2025-08"},
            timeout=15
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in resp.headers.get('Content-Type', ''), \
            f"Expected xlsx content type, got {resp.headers.get('Content-Type')}"
        self.log(f"   Excel exported (month=2025-08): {len(resp.content)} bytes")

    def test_get_settings(self):
        """Test GET /api/settings"""
        resp = requests.get(f"{BASE_URL}/settings", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        assert 'model' in data, "Response missing 'model'"
        assert 'defaultModel' in data, "Response missing 'defaultModel'"
        assert 'suggestions' in data, "Response missing 'suggestions'"
        assert isinstance(data['suggestions'], list), "Expected 'suggestions' to be a list"
        
        self.log(f"   Current model: {data['model']}")
        self.log(f"   Suggestions: {data['suggestions']}")
        self.original_model = data['model']

    def test_put_settings_valid(self):
        """Test PUT /api/settings with valid model name"""
        resp = requests.put(
            f"{BASE_URL}/settings",
            json={"model": "gemini-2.5-pro"},
            timeout=10
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('model') == 'gemini-2.5-pro', f"Expected model 'gemini-2.5-pro', got {data.get('model')}"
        self.log(f"   Model updated to: {data['model']}")

    def test_put_settings_invalid_empty(self):
        """Test PUT /api/settings with empty model name (should return 400)"""
        resp = requests.put(
            f"{BASE_URL}/settings",
            json={"model": ""},
            timeout=10
        )
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        data = resp.json()
        assert 'error' in data, "Response missing 'error'"
        self.log(f"   Empty model rejected: {data.get('error')}")

    def test_put_settings_invalid_chars(self):
        """Test PUT /api/settings with invalid characters (should return 400)"""
        resp = requests.put(
            f"{BASE_URL}/settings",
            json={"model": "abc$%"},
            timeout=10
        )
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        data = resp.json()
        assert 'error' in data, "Response missing 'error'"
        self.log(f"   Invalid model name rejected: {data.get('error')}")

    def test_restore_original_model(self):
        """Restore original model setting"""
        if hasattr(self, 'original_model'):
            resp = requests.put(
                f"{BASE_URL}/settings",
                json={"model": self.original_model},
                timeout=10
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            self.log(f"   Model restored to: {self.original_model}")

    def test_delete_receipt(self):
        """Test DELETE /api/sessions/:id/receipts/:rid"""
        assert self.session_id, "No session ID available"
        
        # Delete the duplicate receipt
        if hasattr(self, 'duplicate_id'):
            receipt_id = self.duplicate_id
        elif len(self.receipt_ids) > 2:
            receipt_id = self.receipt_ids[2]
        else:
            self.log("   Skipping: no receipt to delete")
            return
        
        resp = requests.delete(
            f"{BASE_URL}/sessions/{self.session_id}/receipts/{receipt_id}",
            timeout=10
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('ok') == True, f"Expected ok=True, got {data.get('ok')}"
        self.log(f"   Receipt deleted: {receipt_id}")

    def test_unsupported_file_extension(self):
        """Test uploading unsupported file extension (.txt)"""
        assert self.session_id, "No session ID available"
        
        # Create a temporary .txt file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is not an image")
            txt_path = f.name
        
        try:
            with open(txt_path, 'rb') as f:
                files = [('receipts', ('test.txt', f, 'text/plain'))]
                resp = requests.post(
                    f"{BASE_URL}/sessions/{self.session_id}/receipts",
                    files=files,
                    timeout=30
                )
            
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            data = resp.json()
            
            # Should be rejected
            assert data.get('rejected', 0) > 0, f"Expected rejected > 0, got {data.get('rejected')}"
            assert len(data.get('added', [])) == 0, f"Expected 0 added, got {len(data.get('added', []))}"
            self.log(f"   Unsupported file rejected: {data.get('rejected')} file(s)")
        finally:
            Path(txt_path).unlink(missing_ok=True)

    def test_delete_session(self):
        """Test DELETE /api/sessions/:id"""
        assert self.session_id, "No session ID available"
        
        resp = requests.delete(
            f"{BASE_URL}/sessions/{self.session_id}",
            timeout=10
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get('ok') == True, f"Expected ok=True, got {data.get('ok')}"
        self.log(f"   Session deleted: {self.session_id}")
        
        # Verify session is gone (should return 404)
        resp = requests.get(f"{BASE_URL}/sessions/{self.session_id}", timeout=10)
        assert resp.status_code == 404, f"Expected 404 after deletion, got {resp.status_code}"
        self.log(f"   Verified session is deleted (404)")

    def run_all_tests(self):
        """Run all backend tests in sequence"""
        self.log("\n" + "="*80, Colors.BLUE)
        self.log("BACKEND API TEST SUITE - Turkish Receipt OCR App", Colors.BLUE)
        self.log("="*80 + "\n", Colors.BLUE)
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health),
            ("Create Session", self.test_create_session),
            ("Upload 3 Receipts", self.test_upload_receipts),
            ("Polling & Processing (Gemini API)", self.test_polling_and_processing),
            ("Duplicate Detection", self.test_duplicate_detection),
            ("Inline Edit Triggers Review", self.test_inline_edit_triggers_review),
            ("Approve Receipt", self.test_approve_receipt),
            ("Get Receipt Image", self.test_get_receipt_image),
            ("Export Excel (All)", self.test_export_excel_all),
            ("Export Excel (Month Filter)", self.test_export_excel_with_month_filter),
            ("Get Settings", self.test_get_settings),
            ("Put Settings (Valid)", self.test_put_settings_valid),
            ("Put Settings (Invalid Empty)", self.test_put_settings_invalid_empty),
            ("Put Settings (Invalid Chars)", self.test_put_settings_invalid_chars),
            ("Restore Original Model", self.test_restore_original_model),
            ("Unsupported File Extension", self.test_unsupported_file_extension),
            ("Delete Receipt", self.test_delete_receipt),
            ("Delete Session", self.test_delete_session),
        ]
        
        for name, func in tests:
            self.test(name, func)
        
        # Summary
        self.log("\n" + "="*80, Colors.BLUE)
        self.log("TEST SUMMARY", Colors.BLUE)
        self.log("="*80, Colors.BLUE)
        self.log(f"Total Tests: {self.tests_run}", Colors.BLUE)
        self.log(f"Passed: {self.tests_passed}", Colors.GREEN)
        self.log(f"Failed: {self.tests_failed}", Colors.RED if self.tests_failed > 0 else Colors.GREEN)
        
        if self.tests_failed > 0:
            self.log("\nFailed Tests:", Colors.RED)
            for failure in self.critical_failures:
                self.log(f"  - {failure}", Colors.RED)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"\nSuccess Rate: {success_rate:.1f}%", Colors.GREEN if success_rate >= 80 else Colors.YELLOW)
        
        return 0 if self.tests_failed == 0 else 1

def main():
    tester = BackendTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
