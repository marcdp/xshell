# Python XVault fixtures

`v1.env` and `v2.env` are byte-for-byte copies of `marcdp/xvault/tests/fixtures/` at commit
`e2c6ebf7edd2c72192ca4c8f160ab435b5ba9fd0`. The upstream MIT license is included as `LICENSE`.

- V1 password: `fixture-password`; secret: `fixture-secret`.
- V2 password: `fixture-v2-password`; secret: `fixture-v2-secret`.

These are public test vectors, not credentials. Tests use the real Argon2id cost, without a substitute KDF.
`python-oracle.py` imports the actual Python checkout specified by `XVAULT_PYTHON_REPO`. It exchanges JSON through standard input/output,
never writes vault files or uses a keyring, and disables bytecode writes. `XVAULT_PYTHON` optionally selects a Python executable.

Run from the repository root in PowerShell:

```powershell
$env:XVAULT_PYTHON_REPO = 'D:\Reps\xvault'
node --test --test-concurrency=1 test/DProjects.XShell.Client.Test/xvault*.test.mjs
```

Install the reference repository's Python dependencies in the selected interpreter beforehand. The dedicated XVault CI job checks out the
pinned reference and runs both directions for V1/V2 and all six formats. Without `XVAULT_PYTHON_REPO`, only the live Python oracle test is skipped;
canonical fixture decryption, real cryptography, context validation, handler and contract tests still run in the normal client suite.
