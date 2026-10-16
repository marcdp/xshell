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
    dotnet_result = test_dotnet()
    node_result = test_node()
    return 0 if dotnet_result == 0 and node_result == 0 else 1

@command()
def test_dotnet():
    # execute "dotnet test"
    print("Running dotnet tests...")
    try:
        result = subprocess.run(["dotnet", "test"], check=False)
    except OSError as error:
        print(f"Unable to run dotnet tests: {error}", file=sys.stderr)
        return 1

    return result.returncode

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
        try:
            result = subprocess.run(
                [
                    "node",
                    "--test",
                    "--test-reporter=spec",
                    str(test_file),
                ],
                check=False,
            )
        except OSError as error:
            print(f"Unable to run node tests: {error}", file=sys.stderr)
            return 1

        if result.returncode != 0:
            failed_files.append(test_file)

    if failed_files:
        print("\nFailed test files:")
        for test_file in failed_files:
            print(f"  - {test_file.name}")
        return 1

    print(f"\nAll {len(test_files)} test files passed.")
    return 0
    

# ***************
# **  Execute  **
# ***************
if __name__ == "__main__":
    commandsManager = CommandsManager()
    commandsManager.register()
    commandsManager.register(GitManager())
    sys.exit(commandsManager.execute(sys.argv))
