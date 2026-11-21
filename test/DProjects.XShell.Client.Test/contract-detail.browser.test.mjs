import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import detail from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/detail/contract-detail.js";

const browser = process.env.XSHELL_TEST_BROWSER;
test("Contract Detail playground uses equal columns and stacks on narrow screens",
    { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" }, () => {
        const temp = mkdtempSync(join(tmpdir(), "xshell-contract-detail-"));
        try {
            const file = join(temp, "contract-detail.html");
            writeFileSync(file, `<!doctype html><meta charset="utf-8"><body data-result="pending"><script>
                try {
                    const css = ${JSON.stringify(detail.style)};
                    const results = {};
                    for (const width of [900, 600]) {
                        const frame = document.body.appendChild(document.createElement("iframe"));
                        frame.setAttribute("width", width);
                        frame.setAttribute("height", 700);
                        const doc = frame.contentDocument;
                        doc.documentElement.style.cssText = "font-size:14px; --x-card-border:1px solid rgb(10, 20, 30);"
                            + "--x-card-border-radius:6px; --x-card-shadow:none; --x-card-padding:12px;";
                        const host = doc.body.appendChild(doc.createElement("main"));
                        const root = host.attachShadow({ mode: "open" });
                        root.innerHTML = "<style>" + css + "</style><section class='playground'><div class='playground-grid'>"
                            + "<section class='playground-panel playground-source'><x-code-editor></x-code-editor></section>"
                            + "<section class='playground-panel'><div class='playground-preview'></div></section></div></section>";
                        const [source, preview] = root.querySelectorAll(".playground-panel");
                        const editor = root.querySelector("x-code-editor");
                        const computed = frame.contentWindow.getComputedStyle;
                        results[width] = {
                            source: source.getBoundingClientRect().toJSON(),
                            preview: preview.getBoundingClientRect().toJSON(),
                            editorHeight: editor.getBoundingClientRect().height,
                            previewBorderLeft: computed(preview).borderLeftWidth,
                            previewBorderTop: computed(preview).borderTopWidth,
                            previewOverflow: computed(root.querySelector(".playground-preview")).overflow
                        };
                        frame.remove();
                    }
                    const wide = results[900], narrow = results[600];
                    if (Math.abs(wide.source.width - wide.preview.width) > 1 || wide.preview.left <= wide.source.right - 1) throw new Error("Wide panels are not equal columns");
                    if (wide.previewBorderLeft !== "1px" || wide.previewBorderTop !== "0px") throw new Error("Wide panel divider is incorrect");
                    if (narrow.preview.top < narrow.source.bottom - 1 || Math.abs(narrow.source.width - narrow.preview.width) > 1) throw new Error("Narrow panels do not stack");
                    if (narrow.previewBorderLeft !== "0px" || narrow.previewBorderTop !== "1px") throw new Error("Narrow panel divider is incorrect");
                    if (wide.editorHeight < 280 || wide.previewOverflow !== "auto") throw new Error("Playground height or scrolling is incorrect");
                    document.body.dataset.result = "passed";
                } catch (error) {
                    document.body.dataset.result = "failed";
                    document.body.append(error.stack);
                }
            </script>`);
            const result = spawnSync(browser, [
                "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run",
                `--user-data-dir=${join(temp, "profile")}`, "--virtual-time-budget=1000", "--dump-dom", pathToFileURL(file).href
            ], { encoding: "utf8", timeout: 30_000 });
            if (result.error) throw result.error;
            assert.equal(result.status, 0, result.stderr);
            const status = result.stdout.match(/<body[^>]*data-result="([^"]+)"/)?.[1];
            const failure = result.stdout.slice(result.stdout.lastIndexOf("</script>") + 9, result.stdout.lastIndexOf("</body>"));
            assert.equal(status, "passed", failure || "Browser did not complete the playground layout checks");
        } finally {
            rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
        }
    });
