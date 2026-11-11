$ErrorActionPreference = 'Stop'
$repositoryRoot = (& git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
$buildDirectory = Join-Path $repositoryRoot 'temp/xvault-vendor'
New-Item -ItemType Directory -Force -Path $buildDirectory | Out-Null
& npm install --prefix $buildDirectory --no-audit --no-fund --ignore-scripts --save-exact '@noble/hashes@2.4.0' 'yaml@2.8.1' 'json5@2.2.3' 'esbuild@0.25.12'
if ($LASTEXITCODE -ne 0) { throw 'Unable to install pinned vendor build dependencies.' }
Push-Location $buildDirectory
try {
    @'
const { build } = require('./node_modules/esbuild');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/vendor');
(async () => {
    for (const [file, contents] of Object.entries({
        'argon2.js': 'export { argon2idAsync } from "@noble/hashes/argon2.js";',
        'yaml.js': 'export { parseDocument, isMap, isScalar } from "yaml";',
        'json5.js': 'export { default } from "json5";'
    })) {
        await build({ stdin: { contents, resolveDir: process.cwd() }, bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
            outfile: path.join(out, file), legalComments: 'inline' });
    }
    for (const [pkg, license, name] of [['@noble/hashes', 'LICENSE', 'noble-hashes'], ['yaml', 'LICENSE', 'yaml'], ['json5', 'LICENSE.md', 'json5']]) {
        fs.copyFileSync(`node_modules/${pkg}/${license}`, path.join(out, `${name}.LICENSE`));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
'@ | & node
    if ($LASTEXITCODE -ne 0) { throw 'Unable to bundle vendor assets.' }
} finally {
    Pop-Location
}
