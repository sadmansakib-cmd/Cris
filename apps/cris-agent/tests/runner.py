"""
Cris Agent - Universal Test Runner
Executes all test functions in test_*.py files, compatible without needing external pytest.
"""

import importlib
import inspect
import sys
import traceback
from pathlib import Path


def run_all_tests():
    test_dir = Path(__file__).parent.resolve()
    sys.path.insert(0, str(test_dir.parent))
    sys.path.insert(0, str(test_dir))

    test_files = sorted(list(test_dir.glob("test_*.py")))
    passed = 0
    failed = 0
    errors = []

    print("=" * 60)
    print(f"Running Cris Agent Test Suite ({len(test_files)} test modules)")
    print("=" * 60)

    for tf in test_files:
        module_name = tf.stem
        try:
            mod = importlib.import_module(module_name)
        except Exception as e:
            print(f"FAILED to import {module_name}: {e}")
            failed += 1
            errors.append((f"{module_name} (import)", traceback.format_exc()))
            continue

        test_funcs = [
            obj for name, obj in inspect.getmembers(mod)
            if inspect.isfunction(obj) and name.startswith("test_")
        ]

        for func in test_funcs:
            test_id = f"{module_name}.{func.__name__}"
            try:
                func()
                print(f"  [PASS] {test_id}")
                passed += 1
            except Exception as e:
                print(f"  [FAIL] {test_id}: {e}")
                failed += 1
                errors.append((test_id, traceback.format_exc()))

    print("=" * 60)
    print(f"Test Summary: {passed} PASSED, {failed} FAILED")
    print("=" * 60)

    if errors:
        print("\nFailures:")
        for name, tb in errors:
            print(f"\n--- {name} ---\n{tb}")
        sys.exit(1)
    else:
        print("All tests passed successfully!")


if __name__ == "__main__":
    run_all_tests()
