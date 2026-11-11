import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const documentationRoot = path.join(repositoryRoot, "src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages");

function markdownFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return markdownFiles(fullPath);
        return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
    });
}

function withoutFencedCode(markdown) {
    let fenced = false;
    return markdown.split(/\r?\n/).map(line => {
        if (/^\s*(```|~~~)/.test(line)) {
            fenced = !fenced;
            return "";
        }
        return fenced ? "" : line;
    }).join("\n");
}

function linkTargets(markdown) {
    return [...withoutFencedCode(markdown).matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+["'][^)]*["'])?\)/g)].map(match => match[1]);
}

function anchorSlug(heading) {
    return heading
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/[`*_~]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-");
}

function anchors(markdown) {
    const result = new Set();
    const occurrences = new Map();
    for (const line of withoutFencedCode(markdown).split(/\r?\n/)) {
        const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
        if (!match) continue;
        const base = anchorSlug(match[2]);
        const count = occurrences.get(base) ?? 0;
        occurrences.set(base, count + 1);
        result.add(count === 0 ? base : `${base}-${count}`);
    }
    return result;
}

function resolveMarkdownTarget(source, rawTarget) {
    const [rawPath, rawAnchor] = rawTarget.split("#", 2);
    const decodedPath = decodeURIComponent(rawPath.split("?", 1)[0]);
    let target = decodedPath ? path.resolve(path.dirname(source), decodedPath) : source;
    if (existsSync(target) && statSync(target).isDirectory()) target = path.join(target, "index.md");
    return { target, anchor: rawAnchor ? decodeURIComponent(rawAnchor).toLowerCase() : "" };
}

test("repository guidance and canonical documentation have valid relative Markdown targets and local anchors", () => {
    const failures = [];
    const sources = [path.join(repositoryRoot, "AGENTS.md"), path.join(repositoryRoot, "README.md"), ...markdownFiles(documentationRoot)];
    for (const source of sources) {
        for (const rawTarget of linkTargets(readFileSync(source, "utf8"))) {
            if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget) || rawTarget.startsWith("/")) continue;
            const { target, anchor } = resolveMarkdownTarget(source, rawTarget);
            if (!existsSync(target) || !statSync(target).isFile()) {
                failures.push(`${path.relative(repositoryRoot, source)} -> ${rawTarget}`);
                continue;
            }
            if (anchor && target.endsWith(".md") && !anchors(readFileSync(target, "utf8")).has(anchor)) {
                failures.push(`${path.relative(repositoryRoot, source)} -> missing anchor ${rawTarget}`);
            }
        }
    }
    assert.deepEqual(failures, []);
});

test("each documentation section index links every sibling document", () => {
    const failures = [];
    for (const indexPath of markdownFiles(documentationRoot).filter(file => path.basename(file) === "index.md")) {
        const directory = path.dirname(indexPath);
        const linkedFiles = new Set(linkTargets(readFileSync(indexPath, "utf8")).map(target => {
            if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/") || target.startsWith("#")) return null;
            return path.normalize(target.split(/[?#]/, 1)[0]);
        }).filter(Boolean));
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "index.md") continue;
            if (!linkedFiles.has(entry.name)) failures.push(`${path.relative(repositoryRoot, indexPath)} does not link ${entry.name}`);
        }
    }
    assert.deepEqual(failures, []);
});

test("documented contract schemas and validation implementations exist", () => {
    const references = [
        "src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json",
        "src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/component.schema.json",
        "src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/page.schema.json",
        "src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts.js",
        "src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/component-js.js",
        "src/DProjects.XShell/Resources/DProjects.XShell/xshell/loaders/page-js.js",
        "src/DProjects.XShell/Resources/DProjects.XShell/xshell/xshell.js"
    ];
    assert.deepEqual(references.filter(reference => !existsSync(path.join(repositoryRoot, reference))), []);
});
