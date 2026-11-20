import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import main from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-main.js";
import stack from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-stack.js";
import dialog from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-dialog.js";
import defaultLayout from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-default.js";
import embed from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/layouts/x-layout-embed.js";

const browser = process.env.XSHELL_TEST_BROWSER;
test("bundled layout classes preserve sizing, fill, and precedence in the browser",
    { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" }, () => {
        const temp = mkdtempSync(join(tmpdir(), "xshell-layout-classes-"));
        try {
            const file = join(temp, "layout-classes.html");
            const layouts = {
                main: [main.style, '<div class="docked-main"><div class="body"><main><div>Page</div></main></div></div>'],
                stack: [stack.style, '<div class="panel expanded"><div class="body">Page</div></div>'],
                dialog: [dialog.style, '<dialog open><div class="container"><div class="body">Page</div></div></dialog>'],
                default: [defaultLayout.style, '<div class="body">Page</div>'],
                embed: [embed.style, '<div class="body">Page</div>']
            };
            const sizes = ["compact", "narrow", "medium", "wide", "full"];
            const expectedWidths = {
                main: ["448px", "672px", "928px", "1200px", "100%"],
                stack: ["352px", "480px", "720px", "900px", "1200px"],
                dialog: ["384px", "544px", "768px", "1024px", "1168px"]
            };
            const cases = {};
            for (const name of Object.keys(layouts)) {
                cases[name] = ["", "layout-fill", name + "-layout-fill"];
                for (const other of Object.keys(expectedWidths)) {
                    if (other !== name) cases[name].push(other + "-size-compact " + other + "-layout-fill");
                }
                if (!expectedWidths[name]) continue;
                for (const size of sizes) {
                    cases[name].push("size-" + size, name + "-size-" + size);
                    for (const common of sizes) cases[name].push(name + "-size-" + size + " size-" + common);
                }
            }
            cases.main.push("main-layout-fill toggled");
            writeFileSync(file, `<!doctype html><meta charset="utf-8"><body data-result="pending"><script>
                try {
                    const layouts = ${JSON.stringify(layouts)};
                    const cases = ${JSON.stringify(cases)};
                    const results = {};
                    for (const viewport of [1200, 700]) {
                        // Isolate viewport media queries and use the layout styles in Shadow DOM.
                        const frame = document.body.appendChild(document.createElement("iframe"));
                        frame.setAttribute("width", viewport);
                        frame.setAttribute("height", 800);
                        const doc = frame.contentDocument;
                        doc.documentElement.style.cssText = "font-size:16px; --x-layout-main-drawer-width:19em;"
                            + "--x-layout-main-page-max-width:75em; --x-layout-stack-width:73vw;"
                            + "--x-layout-stack-border-radius:10px; --x-scrollbar-width:thin;";
                        const style = frame.contentWindow.getComputedStyle;
                        results[viewport] = {};
                        for (const [name, [css, markup]] of Object.entries(layouts)) {
                            const host = doc.body.appendChild(doc.createElement("section"));
                            const root = host.attachShadow({ mode: "open" });
                            root.innerHTML = "<style>" + (css ?? "") + "</style>" + markup;
                            const body = root.querySelector(name === "dialog" ? "dialog" : ".body");
                            const initialClass = body.className;
                            const panel = root.querySelector(".panel");
                            const main = root.querySelector("main");
                            const container = root.querySelector(".container");
                            const snapshots = results[viewport][name] = {};
                            for (const classes of cases[name]) {
                                body.className = [initialClass, classes].filter(Boolean).join(" ");
                                const bodyStyle = style(body);
                                if (main) {
                                    snapshots[classes] = [style(main.firstElementChild).maxWidth, style(main).position, style(main).left];
                                } else if (panel) {
                                    const panelStyle = style(panel);
                                    snapshots[classes] = [panelStyle.width, panelStyle.borderTopLeftRadius, panelStyle.overflow,
                                        panelStyle.scrollbarWidth, bodyStyle.position];
                                } else if (container) {
                                    snapshots[classes] = [bodyStyle.width, bodyStyle.maxWidth, bodyStyle.height,
                                        style(container).display, style(container.firstElementChild).display];
                                } else {
                                    snapshots[classes] = [bodyStyle.maxWidth, bodyStyle.position, bodyStyle.display];
                                }
                            }
                            host.remove();
                        }
                        frame.remove();
                    }
                    document.body.dataset.result = "passed";
                    document.body.append(JSON.stringify(results));
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
            const output = result.stdout.slice(result.stdout.lastIndexOf("</script>") + 9, result.stdout.lastIndexOf("</body>"));
            assert.equal(status, "passed", output || "Browser did not complete the layout checks");
            const results = JSON.parse(output);
            for (const [viewport, layouts] of Object.entries(results)) {
                const desktop = viewport === "1200";
                for (const [name, snapshots] of Object.entries(layouts)) {
                    const label = `${name} at ${viewport}px`;
                    const baseline = snapshots[""];

                    // Compare every size alias, including every pairing with a common size.
                    if (expectedWidths[name]) {
                        for (const [index, size] of sizes.entries()) {
                            const common = snapshots["size-" + size];
                            const prefixed = name + "-size-" + size;
                            if (desktop) assert.equal(common[0], expectedWidths[name][index], `${label}, ${size} width`);
                            else assert.deepEqual(common, baseline, `${label}, ${size} mobile sizing`);
                            assert.deepEqual(snapshots[prefixed], common, `${label}, ${prefixed}`);
                            for (const other of sizes) {
                                assert.deepEqual(snapshots[prefixed + " size-" + other], common, `${label}, ${prefixed} over size-${other}`);
                            }
                        }
                    }

                    // Check fill behavior, including the Main drawer offset and Stack scrollbar.
                    const fill = snapshots["layout-fill"];
                    assert.deepEqual(snapshots[name + "-layout-fill"], fill, `${label}, fill alias`);
                    if (name === "main" && desktop) {
                        assert.deepEqual(fill, ["none", "absolute", "304px"], "open drawer fill");
                        assert.deepEqual(snapshots["main-layout-fill toggled"], ["none", "absolute", "0px"], "closed drawer fill");
                    } else if (name === "stack") {
                        assert.deepEqual(fill.slice(2), ["hidden", "none", "absolute"], `${label}, panel overflow and body fill`);
                        assert.equal(baseline[0], desktop ? "876px" : "700px", `${label}, default panel width`);
                    } else if (name === "dialog" && desktop) {
                        assert.deepEqual(fill.slice(3), ["flex", "flex"], "container and body fill");
                        assert.notEqual(fill[2], baseline[2], "Dialog fill changes its height");
                    } else {
                        assert.deepEqual(fill, baseline, `${label}, fill at this viewport`);
                    }
                    for (const other of Object.keys(expectedWidths)) {
                        if (other === name) continue;
                        assert.deepEqual(snapshots[other + "-size-compact " + other + "-layout-fill"], baseline, `${label}, foreign classes from ${other}`);
                    }
                }
            }
        } finally {
            rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
        }
    });
