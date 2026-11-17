import assert from "node:assert/strict";
import test from "node:test";

import {combineUrls, indexedDBName, normalizeUrlPrefix} from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/utils/urls.js";

test("URL prefixes normalize and encode with hyphen path separators", () => {
    // Cover root, trailing-slash, nested, escaped, and complete URL inputs with one shared convention.
    for (const value of ["", "/"]) assert.equal(normalizeUrlPrefix(value), "/");
    for (const value of ["/admin", "/admin/"]) assert.equal(normalizeUrlPrefix(value), "/admin/");
    assert.equal(normalizeUrlPrefix("/company/admin/"), "/company/admin/");
    assert.equal(normalizeUrlPrefix("/company%20name/admin%2Ftools"), "/company%20name/admin%2Ftools/");
    assert.equal(normalizeUrlPrefix("https://example.test/projects/?view=all#summary"), "/projects/");
    assert.equal(indexedDBName("preferences", "/"), "xshell-preferences");
    assert.equal(indexedDBName("preferences", "/company/admin"), "company-admin-xshell-preferences");
    assert.equal(indexedDBName("preferences", "/company-admin"), "company%2Dadmin-xshell-preferences");
    assert.equal(indexedDBName("secrets", "/encoded%20path"), "encoded%2520path-xshell-secrets");
    assert.equal(indexedDBName("secrets", "/company//admin"), "company-%2F-admin-xshell-secrets");
    for (const prefix of ["", "/", "/admin/", "/company//admin/"]) {
        const name = indexedDBName("secrets", prefix);
        assert.equal(name.startsWith("-"), false);
        assert.equal(name.includes("--"), false);
    }
});

test("combineUrls preserves URI scheme-qualified targets", () => {
    for (const target of ["https://example.test/foo", "mailto:test@example.com", "data:text/plain,test", "custom:resource"]) {
        assert.equal(combineUrls("/pages/current.js", target), target);
    }
});

test("combineUrls resolves colons in query and fragment references relatively", () => {
    assert.equal(combineUrls("/pages/current.js", "details?time=10:30"), "/pages/details?time=10:30");
    assert.equal(combineUrls("/pages/current.js", "details#section:advanced"), "/pages/details#section:advanced");
});
