import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Verify the real document and shared stylesheets against the browser cascade and Shadow DOM boundary.
function verifySharedStyles(indexCss, sharedCss) {
    const documentSheet = new CSSStyleSheet();
    documentSheet.replaceSync(":root {color-scheme:light!important} h2 {font-size:40px}");

    const sharedSheet = new CSSStyleSheet();
    sharedSheet.replaceSync(sharedCss);
    const indexSheet = new CSSStyleSheet();
    indexSheet.replaceSync(indexCss);
    document.adoptedStyleSheets = [documentSheet, sharedSheet, indexSheet];
    const localSheet = new CSSStyleSheet();
    localSheet.replaceSync("h1 {font-size:30px} button {font-family:inherit; font-size:17px}");

    const documentHeading = document.body.appendChild(document.createElement("h1"));
    documentHeading.textContent = "Document heading";
    const documentButton = document.body.appendChild(document.createElement("button"));
    documentButton.textContent = "Document control";

    const sharedHost = document.body.appendChild(document.createElement("section"));
    const sharedRoot = sharedHost.attachShadow({ mode: "open" });
    sharedRoot.adoptedStyleSheets = [sharedSheet];
    sharedRoot.innerHTML = "<h1>Shared heading</h1><h2>Boundary probe</h2><p>Variable probe</p><button>Unnormalized control</button>";

    const localHost = document.body.appendChild(document.createElement("section"));
    const localRoot = localHost.attachShadow({ mode: "open" });
    localRoot.adoptedStyleSheets = [sharedSheet, localSheet];
    localRoot.innerHTML = "<h1>Local heading</h1><button>Component control</button>";

    const values = {
        documentHeading: getComputedStyle(documentHeading).fontSize,
        sharedHeading: getComputedStyle(sharedRoot.querySelector("h1")).fontSize,
        documentSelectorBoundary: getComputedStyle(sharedRoot.querySelector("h2")).fontSize,
        inheritedVariable: getComputedStyle(sharedRoot.querySelector("p")).color,
        localOverride: getComputedStyle(localRoot.querySelector("h1")).fontSize,
        documentControl: getComputedStyle(documentButton).fontSize,
        componentControl: getComputedStyle(localRoot.querySelector("button")).fontSize,
        sharedIdentity: document.adoptedStyleSheets[1] === sharedRoot.adoptedStyleSheets[0]
    };
    const expected = {
        documentHeading: "24px", sharedHeading: "24px", documentSelectorBoundary: "18px",
        inheritedVariable: "rgb(96, 96, 96)", localOverride: "30px", documentControl: "14px",
        componentControl: "17px", sharedIdentity: true
    };
    if (JSON.stringify(values) !== JSON.stringify(expected)) throw new Error(`Unexpected computed styles: ${JSON.stringify(values)}`);
}

const browser = process.env.XSHELL_TEST_BROWSER;
test("X module keeps normalization in its document-only stylesheet", () => {
    const stylesRoot = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/styles/", import.meta.url);
    const indexCss = readFileSync(fileURLToPath(new URL("index.css", stylesRoot)), "utf8");
    const sharedCss = readFileSync(fileURLToPath(new URL("shared.css", stylesRoot)), "utf8");

    assert.match(indexCss, /@layer reset/);
    assert.match(indexCss, /normalize\.css v8\.0\.1/);
    assert.match(indexCss, /button,input,optgroup,select,textarea\{font-family:inherit/);
    assert.doesNotMatch(indexCss, /\nh1 \{/);
    assert.doesNotMatch(indexCss, /\nfieldset \{/);
    assert.doesNotMatch(sharedCss, /@layer reset|normalize\.css|:host|box-sizing|-webkit-appearance/);
    assert.match(sharedCss, /\nh1 \{font-size:var\(--x-font-size-title\)/);
    assert.match(sharedCss, /\nfieldset \{border:var\(--x-card-border\)/);
});

test("shared module styles obey the real document and Shadow DOM cascade", { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" }, () => {
    const temp = mkdtempSync(join(tmpdir(), "xshell-shared-shadow-"));
    try {
        const stylesRoot = new URL("../../src/DProjects.XShell/Resources/DProjects.XShell/x/styles/", import.meta.url);
        const indexCss = readFileSync(fileURLToPath(new URL("index.css", stylesRoot)), "utf8");
        const sharedCss = readFileSync(fileURLToPath(new URL("shared.css", stylesRoot)), "utf8");
        const file = join(temp, "shared-shadow.html");
        writeFileSync(file, `<!doctype html><meta charset="utf-8"><body data-result="pending"><script>
            Promise.resolve().then(() => (${verifySharedStyles})(${JSON.stringify(indexCss)}, ${JSON.stringify(sharedCss)})).then(
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
