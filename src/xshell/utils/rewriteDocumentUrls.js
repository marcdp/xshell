// rules
let rules = [
    // navigation
    { selector: "a", attr: "href", type:"navigation"},
    { selector: "area", attr: "href", type:"navigation"},
    { selector: "form", attr: "action", type:"navigation"},
    { selector: "button[formaction]", attr: "formaction", type:"navigation"},
    // resources
    { selector: "img", attr: "src", type:"resource" },
    { selector: "img", attr: "srcset", type:"resource" },
    { selector: "source", attr: "src", type:"resource" },
    { selector: "source", attr: "srcset", type:"resource" },
    { selector: "link", attr: "href", type:"resource" },
    { selector: "script", attr: "src", type:"resource" },
    { selector: "iframe", attr: "src", type:"resource" },
    { selector: "video", attr: "poster", type:"resource" },
    { selector: "audio", attr: "src", type:"resource" },
    { selector: "embed", attr: "src", type:"resource" },
    { selector: "object", attr: "data", type:"resource" },
    { selector: "object", attr: "archive", type:"resource" },
    { selector: "input[type=image]", attr: "src", type:"resource" },
    { selector: "track", attr: "src", type:"resource" },
];

// add a rewrite rule
export function addRewriteRule(selector, attr, type) {
    rules.push({ selector, attr, type });
}

// export
export function normalizeModuleResourceUrl(url, modulePath, resourcePath) {
    if (url.indexOf(":") != -1) {
        return url;
    } else if (url.startsWith("xshell/")) {
        return url;
    } else if (url.startsWith("/")) {
        return modulePath + url;
    } else {
        return combineUrls(resourcePath, url);
    }    
}

// rewrite document resource URLs
export function rewriteDocumentUrls(doc, rewriteFn) {
    // simple attribute rewrites
    for (const { selector, attr, type } of rules) {
        doc.querySelectorAll(selector).forEach(el => {
            const oldUrl = el.getAttribute(attr);
            if (!oldUrl) return;
            const newUrl = rewriteFn(el.localName, attr, type, oldUrl);
            if (newUrl !== oldUrl) el.setAttribute(attr, newUrl);
        });
    }
    // inline css styles
    doc.querySelectorAll("[style]").forEach(el => {
        const oldStyle = el.getAttribute("style");
        if (!oldStyle) return;
        const newStyle = oldStyle.replace(/url\(([^)]+)\)/g, (match, url) => {
            // strip quotes
            const clean = url.trim().replace(/^['"]|['"]$/g, "");
            return `url("${rewriteFn(el.localName, "style", "", clean)}")`;
        });
        el.setAttribute("style", newStyle);
    });
    // CSS inside <style> tags
    doc.querySelectorAll("style").forEach(style => {
        let css = style.textContent;
        css = css.replace(/url\(([^)]+)\)/g, (match, url) => {
            const clean = url.trim().replace(/^['"]|['"]$/g, "");
            return `url("${rewriteFn("style", "textContent", "", clean)}")`;
        });
        style.textContent = css;
    });
    // scripts imports
    const scripts = doc.querySelectorAll('script[type="module"]');
    for (const script of scripts) {
        if (!script.src) {
            const original = script.textContent;
            // regex to detect static imports
            const rewritten = original.replace(
                /import\s+([^'"]*)['"]([^'"]+)['"]/g,
                (match, bindings, importPath) => {
                    // resolve url
                    return `import ${bindings}"${rewriteFn("script", "textContent", "",  importPath)}"`;
                }
            );
            // create a new script because textContent would reset execution
            const newScript = document.createElement('script');
            newScript.type = 'module';
            newScript.textContent = rewritten;
            // replace content
            script.replaceWith(newScript);
        }
    }
    // return
    return doc;
}


