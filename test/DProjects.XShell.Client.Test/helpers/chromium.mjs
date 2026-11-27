import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const browser = process.env.XSHELL_TEST_BROWSER;
export const chromiumOnly = { skip: !browser && "Set XSHELL_TEST_BROWSER to a Chromium executable" };

export async function runInChromium(verify, scenarios, {realTime = false} = {}) {
    // Serve the actual runtime modules to an isolated Chromium profile for each scenario.
    const root = new URL("../../../src/DProjects.XShell/Resources/DProjects.XShell/", import.meta.url);
    let ready;
    const html = `<!doctype html><body data-result="pending">${realTime ? '<img hidden src="/app/ready">' : ""}<script type="module">
        try {
            await (${verify})();
            document.body.dataset.result = "passed";
        } catch (error) {
            document.body.dataset.result = "failed";
            document.body.prepend(error.stack);
        }
        ${realTime ? 'await fetch("/app/ready", {method: "POST"});' : ""}
    </script>`;
    const server = createServer(async (request, response) => {
        const path = new URL(request.url, "http://localhost").pathname;
        if (path === "/app/test") {
            response.writeHead(200, { "Content-Type": "text/html" }).end(html);
        } else if (realTime && path === "/app/ready") {
            // Keep the document load pending while native asynchronous APIs run in real time.
            if (request.method === "POST") ready.resolve();
            else await ready.promise;
            response.writeHead(204).end();
        } else if (/^\/resources\/[\w./-]+\.(?:js|jsonc)$/.test(path)) {
            try {
                const script = await readFile(new URL("./" + path.slice(11), root));
                response.writeHead(200, { "Content-Type": path.endsWith(".js") ? "text/javascript" : "application/json" }).end(script);
            } catch {
                response.writeHead(404).end();
            }
        } else {
            response.writeHead(404).end();
        }
    });
    const temp = await mkdtemp(join(tmpdir(), "xshell-browser-"));
    try {
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
        for (const [index, params] of scenarios.entries()) {
            if (realTime) ready = Promise.withResolvers();
            const url = `http://127.0.0.1:${server.address().port}/app/test?${params}`;
            const { stdout } = await promisify(execFile)(browser, [
                "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run",
                `--user-data-dir=${join(temp, "profile-" + index)}`,
                realTime ? "--timeout=15000" : "--virtual-time-budget=1500", "--dump-dom", url
            ], { timeout: 30_000 });
            const status = stdout.match(/<body[^>]*data-result="([^"]+)"/)?.[1];
            const failure = stdout.match(/<body[^>]*>([\s\S]*?)<script/)?.[1];
            assert.equal(status, "passed", params + " " + (failure || "Browser did not complete checks"));
        }
    } finally {
        ready?.resolve();
        server.close();
        await rm(temp, { recursive: true, force: true, maxRetries: 3 });
    }
}
