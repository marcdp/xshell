import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import tabs from "../../src/DProjects.XShell/Resources/DProjects.XShell/x/components/x-tabs.js";

async function verifyTabs({ template, style, controller: createController }) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const frame = document.body.appendChild(document.createElement("div"));
    frame.style.width = "900px";
    frame.innerHTML = '<x-tabs><x-tab label="Overview" hash="overview">Overview</x-tab>'
        + '<x-tab label="Details" hash="details">Details</x-tab></x-tabs>';
    const host = frame.firstElementChild;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = template;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style);
    root.adoptedStyleSheets = [sheet];
    const nav = root.querySelector("nav");
    const slot = root.querySelector("slot");
    const [overview, details] = host.children;
    for (const panel of host.children) panel.hash = panel.getAttribute("hash");
    const selections = [];
    host.addEventListener("tabchange", event => selections.push(event.detail.selectedIndex));

    // Bind the fixture's state and template events to the real controller.
    const listeners = new Map();
    const state = new Proxy({ selectedIndex: 0, selectedHash: "", useHash: true, tabs: [] }, {
        set(values, key, value) {
            if (values[key] === value) return true;
            values[key] = value;
            if (key === "tabs") {
                nav.replaceChildren(...value.map((tab, index) => {
                    const anchor = document.createElement("a");
                    anchor.textContent = tab.label;
                    anchor.tabIndex = index + 1;
                    anchor.classList.toggle("selected", index === values.selectedIndex);
                    anchor.addEventListener("click", event => controller.click({ event }));
                    anchor.addEventListener("keydown", event => {
                        if (event.key === "Enter") controller.click({ event });
                    });
                    return anchor;
                }));
            }
            listeners.get("change:" + key)?.({ newValue: value });
            return true;
        }
    });
    const page = { src: "/test#details", replaceHash(hash) { this.src = "/test#" + hash; } };
    const controller = createController({ state, host, getPage: () => page, events: {
        on(_, type, handler) { listeners.set(type, handler); }
    } });
    slot.addEventListener("slotchange", () => controller.refresh());
    controller.load();
    controller.mount();

    const box = element => element.getBoundingClientRect();
    const display = element => getComputedStyle(element).display;
    const selected = panel => check([...host.children].every(child => (display(child) !== "none") === (child === panel)),
        "Exactly the selected panel should be visible");
    selected(details);
    check(getComputedStyle(nav).flexDirection === "row" && box(details).top >= box(nav).bottom, "Default tabs should be horizontal");

    host.classList.add("sidebar");
    selected(details);
    check(getComputedStyle(nav).flexDirection === "column", "Wide sidebar headers should be vertical");
    check(box(details).left > box(nav).right && box(details).top === box(nav).top && box(details).right === box(host).right,
        "The selected slotted panel should occupy the remaining column");
    nav.children[0].click();
    selected(overview);
    check(page.src === "/test#overview", "Clicking a heading should update the Page hash");
    nav.children[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    selected(details);
    state.selectedIndex = 0;
    selected(overview);
    state.selectedHash = "details";
    selected(details);
    nav.children[1].click();
    check(selections.join() === "0,1", "Only changes made through the tab bar should emit tabchange");

    // Let actual slotchange events refresh the tab list around the current selection.
    const extra = document.createElement("x-tab");
    extra.setAttribute("label", "A".repeat(100));
    const changed = () => new Promise(resolve => slot.addEventListener("slotchange", resolve, { once: true }));
    let update = changed();
    host.append(extra);
    await update;
    const label = document.createRange();
    label.selectNodeContents(nav.children[2]);
    check(nav.children.length === 3 && label.getClientRects().length > 1, "Inserted long sidebar labels should wrap");
    selected(details);
    host.classList.remove("sidebar");
    frame.style.width = "360px";
    check(getComputedStyle(nav).flexDirection === "row" && box(details).top >= box(nav).bottom, "Narrow tabs should stack");
    check(host.scrollWidth === host.clientWidth && box(nav).right <= box(host).right, "Narrow tabs should stay within the container");
    update = changed();
    extra.remove();
    await update;
    check(nav.children.length === 2, "Removed tabs should disappear from the headers");
    selected(details);

    frame.style.width = "900px";
    host.classList.add("sidebar", "no-header");
    check(display(nav) === "none" && box(details).width === box(host).width, "Sidebar no-header should give the panel full width");
    host.classList.remove("sidebar", "no-header");
    check(getComputedStyle(nav).flexDirection === "row", "Removing sidebar should restore the default layout");
    selected(details);
}

const browser = process.env.XSHELL_TEST_BROWSER;
test("x-tabs sidebar lays out slotted panels and shares the ordinary selection behavior",
    { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" }, () => {
        const temp = mkdtempSync(join(tmpdir(), "xshell-tabs-"));
        try {
            const file = join(temp, "tabs.html");
            const definition = JSON.stringify({ template: tabs.template, style: tabs.style });
            writeFileSync(file, `<!doctype html><meta charset="utf-8"><body data-result="pending"><script>
                const definition = Object.assign(${definition}, { ${tabs.controller} });
                (${verifyTabs})(definition).then(
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
            assert.equal(status, "passed", failure || "Browser did not complete the tab checks");
        } finally {
            rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
        }
    });
