import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputPath = path.join(import.meta.dirname, "gallery.html");
const iconPaths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src/DProjects.XShell/**/icons/*.svg"], { cwd: repositoryRoot, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const manualReview = new Map([["x-empty.svg", "Intentionally blank placeholder; unchanged to preserve its no-icon behavior."]]);
const escapeHtml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const groups = new Map();
for (const iconPath of iconPaths) {
    const parts = iconPath.split("/");
    const moduleName = parts.at(-3);
    const name = parts.at(-1);
    let original;
    try { original = execFileSync("git", ["show", `main:${iconPath}`], { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
    catch { original = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12h16" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/></svg>'; }
    const modern = fs.readFileSync(path.join(repositoryRoot, iconPath), "utf8");
    if (!groups.has(moduleName)) groups.set(moduleName, []);
    groups.get(moduleName).push({ name, original, modern, review: manualReview.get(name) });
}

const preview = (label, svg) => `<div class="version"><h3>${label}</h3><div class="backgrounds"><div class="background light">${[16, 20, 24, 32].map(size => `<span class="sample"><span style="width:${size}px;height:${size}px">${svg}</span><small>${size}</small></span>`).join("")}</div><div class="background dark">${[16, 20, 24, 32].map(size => `<span class="sample"><span style="width:${size}px;height:${size}px">${svg}</span><small>${size}</small></span>`).join("")}</div></div></div>`;
const sections = [...groups].map(([moduleName, icons]) => `<section><h2>${escapeHtml(moduleName)} <span>${icons.length} icons</span></h2><div class="grid">${icons.map(icon => `<article${icon.review ? ' class="review"' : ""}><header><strong>${escapeHtml(icon.name)}</strong>${icon.review ? `<em>Manual review</em>` : ""}</header>${icon.review ? `<p>${escapeHtml(icon.review)}</p>` : ""}<div class="comparison">${preview("Original", icon.original)}${preview("Modernized", icon.modern)}</div></article>`).join("")}</div></section>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>XShell icon modernization gallery</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif;background:#f4f6f8;color:#18202a}*{box-sizing:border-box}body{margin:0;padding:32px}main{max-width:1600px;margin:auto}h1{margin:0}main>p{color:#52606d;margin:8px 0 32px}section{margin:32px 0}h2{display:flex;align-items:baseline;gap:10px}h2 span{font-size:14px;font-weight:500;color:#687787}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}article{background:white;border:1px solid #d8dee6;border-radius:12px;padding:16px;box-shadow:0 2px 8px #18202a0d}article.review{border-color:#c67a00;background:#fffaf0}header{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}header em{font-size:12px;color:#925d00}article p{font-size:13px;color:#71521d}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:12px}.version h3{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#687787;margin:0 0 6px}.backgrounds{display:grid;gap:6px}.background{display:flex;align-items:end;justify-content:space-around;gap:6px;padding:10px;border-radius:8px}.light{background:#f8fafc;color:#17202b;border:1px solid #e4e9ef}.dark{background:#17202b;color:#f1f5f9;border:1px solid #17202b}.sample{display:grid;justify-items:center;gap:4px;min-width:34px}.sample>span{display:block}.sample svg{display:block;width:100%;height:100%}.sample small{font-size:10px;opacity:.65}@media(max-width:700px){body{padding:16px}.grid{grid-template-columns:1fr}.comparison{grid-template-columns:1fr}}
</style>
</head>
<body><main><h1>XShell SVG icon modernization</h1><p>${iconPaths.length} tracked module icons, grouped by module. Every icon is shown at 16, 20, 24, and 32 pixels on light and dark backgrounds.</p>${sections}</main></body>
</html>
`;

fs.writeFileSync(outputPath, html, "utf8");
console.log(`Generated ${path.relative(repositoryRoot, outputPath)} with ${iconPaths.length} icon comparisons.`);
