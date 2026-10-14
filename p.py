#!/usr/bin/env python3
from dprojectstools.commands import command, CommandsManager
from dprojectstools.git import GitManager
import sys
import subprocess
from pathlib import Path    

# **************
# ** Package  **
# **************
@command()
def test():
    # execute "dotnet test"
    test_dotnet()
    test_node()

@command()
def test_dotnet():
    # execute "dotnet test"
    print("Running dotnet tests...")
    subprocess.run(["dotnet", "test"])

@command()
def test_node():
    # execute "node --test --test-concurrency=1 --test-reporter=spec .\test\DProjects.XShell.Client.Test\*.test.mjs"
    print("Running node tests...")
    repo_root = Path(__file__).parent
    repo_root = Path(repo_root).resolve()
    test_directory = repo_root / "test" / "DProjects.XShell.Client.Test"
    test_files = sorted(test_directory.glob("*.test.mjs"))
    failed_files: list[Path] = []

    for test_file in test_files:
        print(f"\n=== {test_file.name} ===", flush=True)
        result = subprocess.run(
            [
                "node",
                "--test",
                "--test-reporter=spec",
                str(test_file),
            ],
            check=False,
        )

        if result.returncode != 0:
            failed_files.append(test_file)

    if failed_files:
        print("\nFailed test files:")
        for test_file in failed_files:
            print(f"  - {test_file.name}")
        return 1

    print(f"\nAll {len(test_files)} test files passed.")
    

# ***************
# **  Execute  **
# ***************
commandsManager = CommandsManager()
commandsManager.register()
commandsManager.register(GitManager())
commandsManager.execute(sys.argv)
