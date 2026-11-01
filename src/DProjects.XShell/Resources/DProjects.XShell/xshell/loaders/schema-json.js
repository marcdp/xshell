
export default class LoaderSchemaJson {

    // vars
    _cache = new Map();

    // methods
    async load(src, context) {
        const rootUrl = new URL(src, document.baseURI).href;
        const visited = new Set();
        const schemas = {};

        const visit = async (url, expectedId = null) => {
            url = new URL(url).href;

            if (visited.has(url)) return this._fetch(url);
            visited.add(url);

            const schema = await this._fetch(url);

            const schemaId = schema.$id
                ? new URL(schema.$id, expectedId || url).href
                : (expectedId || url);

            if (expectedId && schemaId !== expectedId) {
                throw new Error(
                    `Schema ID mismatch at '${url}': expected '${expectedId}', got '${schemaId}'.`
                );
            }

            if (url !== rootUrl) {
                schemas[schemaId] = schema;
            }

            const dependencies = new Map();

            const addReference = (ref, base) => {
                // References are logical URIs.
                const logicalUrl = new URL(ref, base);

                // Fragment-only references stay within the current schema.
                if (ref.startsWith("#")) return;

                // Do not fetch arbitrary absolute URLs.
                if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) {
                    throw new Error(
                        `Absolute schema reference is not supported: '${ref}' in '${url}'.`
                    );
                }

                // Locate the physical file relative to the current file.
                const physicalUrl = new URL(ref, url);
                physicalUrl.hash = "";

                const logicalId = logicalUrl.href.split("#")[0];
                dependencies.set(logicalId, physicalUrl.href);
            };

            const walk = (node, base) => {
                if (!node || typeof node !== "object" || Array.isArray(node)) return;

                const currentBase = typeof node.$id === "string"
                    ? new URL(node.$id, base).href
                    : base;

                if (typeof node.$ref === "string") {
                    addReference(node.$ref, currentBase);
                }

                if (typeof node.$dynamicRef === "string") {
                    addReference(node.$dynamicRef, currentBase);
                }

                // Keywords containing a single subschema.
                const single = [
                    "additionalProperties",
                    "unevaluatedProperties",
                    "propertyNames",
                    "items",
                    "contains",
                    "not",
                    "if",
                    "then",
                    "else",
                    "unevaluatedItems",
                    "contentSchema"
                ];

                // Keywords containing maps of subschemas.
                const maps = [
                    "$defs",
                    "definitions",
                    "properties",
                    "patternProperties",
                    "dependentSchemas"
                ];

                // Keywords containing arrays of subschemas.
                const arrays = [
                    "allOf",
                    "anyOf",
                    "oneOf",
                    "prefixItems"
                ];

                for (const key of single) {
                    walk(node[key], currentBase);
                }

                for (const key of maps) {
                    const entries = node[key];

                    if (entries && typeof entries === "object" && !Array.isArray(entries)) {
                        for (const value of Object.values(entries)) {
                            walk(value, currentBase);
                        }
                    }
                }

                for (const key of arrays) {
                    if (Array.isArray(node[key])) {
                        for (const value of node[key]) {
                            walk(value, currentBase);
                        }
                    }
                }
            };

            walk(schema, schemaId);

            // Recursively load referenced schemas.
            for (const [dependencyId, dependencyUrl] of dependencies) {
                await visit(dependencyUrl, dependencyId);
            }

            return schema;
        };

        const schema = await visit(rootUrl);

        // Bundle referenced schemas into the root schema.
        const bundled = structuredClone(schema);

        if (Object.keys(schemas).length) {
            bundled.$defs ??= {};

            for (const [id, dependency] of Object.entries(schemas)) {
                if (Object.hasOwn(bundled.$defs, id)) {
                    throw new Error(`Duplicate schema definition: ${id}`);
                }

                bundled.$defs[id] = structuredClone(dependency);
            }
        }

        return bundled;
    }

    // private
    async _fetch(url) {
        if (!this._cache.has(url)) {
            const promise = fetch(url).then(async response => {
                if (!response.ok) {
                    throw new Error(
                        `Error ${response.status}: ${response.statusText}: ${url}`
                    );
                }
                return response.json();
            });

            this._cache.set(url, promise);
        }

        try {
            return await this._cache.get(url);
        } catch (error) {
            this._cache.delete(url);
            throw error;
        }
    }
}
