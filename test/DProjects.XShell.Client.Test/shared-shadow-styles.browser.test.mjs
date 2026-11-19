import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Verify the real shared stylesheet against the browser cascade and Shadow DOM boundary.
function verifySharedStyles(sharedCss) {
    const documentSheet = new CSSStyleSheet();
    documentSheet.replaceSync(`:root {--x-font-family:Arial; --x-font-size:14px; --x-font-size-title:24px; --x-font-size-subtitle:18px;
        --x-color-text:rgb(10, 10, 10); --x-color-gray:rgb(1, 2, 3)} h2 {font-size:40px}`);
    document.adoptedStyleSheets = [documentSheet];

    const sharedSheet = new CSSStyleSheet();
    sharedSheet.replaceSync(sharedCss);
    const localSheet = new CSSStyleSheet();
    localSheet.replaceSync("h1 {font-size:30px}");

    const sharedHost = document.body.appendChild(document.createElement("section"));
    const sharedRoot = sharedHost.attachShadow({ mode: "open" });
    sharedRoot.adoptedStyleSheets = [sharedSheet];
    sharedRoot.innerHTML = "<h1>Shared heading</h1><h2>Boundary probe</h2><p>Variable probe</p>";

    const localHost = document.body.appendChild(document.createElement("section"));
    const localRoot = localHost.attachShadow({ mode: "open" });
    localRoot.adoptedStyleSheets = [sharedSheet, localSheet];
    localRoot.innerHTML = "<h1>Local heading</h1>";

    const values = {
        sharedHeading: getComputedStyle(sharedRoot.querySelector("h1")).fontSize,
        documentSelectorBoundary: getComputedStyle(sharedRoot.querySelector("h2")).fontSize,
        inheritedVariable: getComputedStyle(sharedRoot.querySelector("p")).color,
        localOverride: getComputedStyle(localRoot.querySelector("h1")).fontSize
    };
    const expected = { sharedHeading: "24px", documentSelectorBoundary: "18px", inheritedVariable: "rgb(1, 2, 3)", localOverride: "30px" };
    if (JSON.stringify(values) !== JSON.stringify(expected)) throw new Error(`Unexpected computed styles: ${JSON.stringify(values)}`);
}

const browser = process.env.XSHELL_TEST_BROWSER;
test("shared module styles obey the real Shadow DOM cascade", { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" }, () => {
    const temp = mkdtempSync(join(tmpdir(), "xshell-shared-shadow-"));
    try {
        const shadowCssPath = fileURLToPath(new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/styles/shadow.css", import.meta.url));
        const sharedCss = readFileSync(shadowCssPath, "utf8");
        const file = join(temp, "shared-shadow.html");
        writeFileSync(file, `<!doctype html><meta charset="utf-8"><body data-result="pending"><script>
            Promise.resolve().then(() => (${verifySharedStyles})(${JSON.stringify(sharedCss)})).then(
                () => document.body.dataset.result = "passed",
                error => { document.body.dataset.result = "failed"; document.body.append(error.stack); }
            );
        </script>`);
        const result = spawnSync(browser, [
            "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run",
            `--user-data-dir=${join(temp, "profile")}`, "--virtual-time-budget=1000", "--dump-dom", pathToFileURL(file).href
        ], { encoding: "utf8", timeout: 30_000 });
        if (result.error) throw result.error;
        assert.equal(result.status, 0, result.stderr);
        const status = result.stdout.match(/<body[^>]*data-result="([^"]+)"/)?.[1];
        const failure = result.stdout.slice(result.stdout.lastIndexOf("</script>") + 9, result.stdout.lastIndexOf("</body>"));
        assert.equal(status, "passed", failure || "Browser did not complete the computed-style checks");
    } finally {
        rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
    }
});
