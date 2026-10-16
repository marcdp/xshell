import importlib.util
import io
import subprocess
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
P_PATH = REPO_ROOT / "p.py"


def load_p_module():
    spec = importlib.util.spec_from_file_location("xshell_p", P_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


p = load_p_module()


class TestDotnetCommand(unittest.TestCase):
    def test_all_dotnet_tests_pass(self):
        with patch.object(p.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)):
            self.assertEqual(0, p.test_dotnet())

    def test_dotnet_test_failure_is_returned(self):
        with patch.object(p.subprocess, "run", return_value=subprocess.CompletedProcess([], 7)):
            self.assertEqual(7, p.test_dotnet())

    def test_dotnet_executable_cannot_start(self):
        stderr = io.StringIO()
        with patch.object(p.subprocess, "run", side_effect=FileNotFoundError("dotnet not found")):
            with redirect_stderr(stderr):
                self.assertNotEqual(0, p.test_dotnet())
        self.assertIn("Unable to run dotnet tests", stderr.getvalue())


class TestNodeCommand(unittest.TestCase):
    @staticmethod
    def node_test_files():
        return sorted((REPO_ROOT / "test" / "DProjects.XShell.Client.Test").glob("*.test.mjs"))

    def run_with_failed_files(self, failed_names):
        failed_names = set(failed_names)

        def fake_run(command, check):
            return subprocess.CompletedProcess(command, 1 if Path(command[-1]).name in failed_names else 0)

        stdout = io.StringIO()
        with patch.object(p.subprocess, "run", side_effect=fake_run):
            with redirect_stdout(stdout):
                result = p.test_node()
        return result, stdout.getvalue()

    def test_all_node_tests_pass(self):
        result, output = self.run_with_failed_files([])
        self.assertEqual(0, result)
        self.assertIn(f"All {len(self.node_test_files())} test files passed.", output)

    def test_one_node_test_file_fails(self):
        failed_file = self.node_test_files()[0]
        result, output = self.run_with_failed_files([failed_file.name])
        self.assertNotEqual(0, result)
        self.assertIn("Failed test files:", output)
        self.assertIn(failed_file.name, output)

    def test_multiple_node_test_files_fail(self):
        failed_files = self.node_test_files()[:2]
        result, output = self.run_with_failed_files(file.name for file in failed_files)
        self.assertNotEqual(0, result)
        for failed_file in failed_files:
            self.assertIn(failed_file.name, output)

    def test_node_executable_cannot_start(self):
        stderr = io.StringIO()
        with patch.object(p.subprocess, "run", side_effect=FileNotFoundError("node not found")):
            with redirect_stderr(stderr):
                self.assertNotEqual(0, p.test_node())
        self.assertIn("Unable to run node tests", stderr.getvalue())


class TestAggregateCommand(unittest.TestCase):
    def assert_aggregate_result(self, dotnet_result, node_result, expected_result):
        with patch.object(p, "test_dotnet", return_value=dotnet_result) as dotnet_mock:
            with patch.object(p, "test_node", return_value=node_result) as node_mock:
                self.assertEqual(expected_result, p.test())
        dotnet_mock.assert_called_once_with()
        node_mock.assert_called_once_with()

    def test_both_suites_pass(self):
        self.assert_aggregate_result(0, 0, 0)

    def test_dotnet_suite_fails(self):
        self.assert_aggregate_result(1, 0, 1)

    def test_node_suite_fails(self):
        self.assert_aggregate_result(0, 1, 1)

    def test_both_suites_fail(self):
        self.assert_aggregate_result(1, 1, 1)


class TestCommandFrameworkIntegration(unittest.TestCase):
    def test_command_manager_return_value_becomes_process_exit_code(self):
        test_script = """
import runpy
from unittest.mock import patch
from dprojectstools.commands import CommandsManager

patcher = patch.object(CommandsManager, "execute", return_value=7)
patcher.start()
runpy.run_path({p_path!r}, run_name="__main__")
""".format(p_path=str(P_PATH))
        result = subprocess.run([sys.executable, "-c", test_script], check=False)
        self.assertEqual(7, result.returncode)


if __name__ == "__main__":
    unittest.main()
