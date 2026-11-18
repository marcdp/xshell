import assert from "node:assert/strict";
import test from "node:test";

import ConfigSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/config.schema.json" with { type: "json" };
import { Validator } from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/vendor/json-schema/4.1.1/json-schema.js";

const validator = new Validator(ConfigSchema.$defs.resolverEntry, "2020-12");
const configValidator = new Validator(ConfigSchema, "2020-12");

function effectiveConfig() {
    return {
        app: { id: "test", label: "Test", version: "1.0.0", copyright: "", icon: "", basePath: "/", baseUrl: "https://example.test/", params: {} },
        modules: {},
        xshell: {
            version: "1.0.0",
            assets: { basePath: "/_assets", path: "/_assets/xshell", url: "https://example.test/xshell/" },
            areas: { default: null, global: [], definitions: {} },
            resolver: {},
            services: {
                navigation: { contract: "navigation", implementation: "/services/navigation.js", options: { mode: "path" } },
                secrets: { contract: "secrets", implementation: "/services/secrets.js", options: { rememberMinutes: 15, maxRememberMinutes: 60 } }
            },
            ui: { layout: {}, component: {} },
            i18n: { lang: "en", langs: [{ id: "en", label: "English", main: true }], datetime: { options: {}, formats: {} }, strings: {} },
            configUrl: "https://example.test/xshell/manifest.json",
            serviceWorker: { mappings: [] },
            files: []
        }
    };
}

test("resolver schema accepts the supported cache modes", () => {
    const defaultResult = validator.validate({ src: "/resource", loader: "test", cache: true });
    assert.equal(defaultResult.valid, true, JSON.stringify(defaultResult.errors));
    for (const cacheMode of ["full", "path"]) {
        const result = validator.validate({ src: "/resource", loader: "test", cache: true, cacheMode });
        assert.equal(result.valid, true, JSON.stringify(result.errors));
    }
});

test("resolver schema rejects unsupported cache modes", () => {
    const result = validator.validate({ src: "/resource", loader: "test", cache: true, cacheMode: "whatever" });

    assert.equal(result.valid, false);
    assert.match(JSON.stringify(result.errors), /cacheMode|whatever|enum/);
});

test("resolver schema requires src and rejects the former url field", () => {
    const valid = validator.validate({ src: "/_assets/x/file.js", loader: "test", cache: true });
    const invalid = validator.validate({ url: "/_assets/x/file.js", loader: "test", cache: true });

    assert.equal(valid.valid, true, JSON.stringify(valid.errors));
    assert.equal(invalid.valid, false);
});

test("effective configuration treats Secrets options like other service options", () => {
    const config = effectiveConfig();
    assert.equal(configValidator.validate(config).valid, true, JSON.stringify(configValidator.validate(config).errors));

    config.xshell.secrets = config.xshell.services.secrets.options;
    assert.equal(configValidator.validate(config).valid, false);
});
