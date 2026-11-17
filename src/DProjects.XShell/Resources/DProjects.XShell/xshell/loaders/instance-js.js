import xshell from "../xshell.js";

//export
export default class LoaderInstanceJs {
    async load(src, context) {
        // Import the provider factory through its resolved physical module URL.
        const module = await import(src);
        if (typeof module.default?.create !== "function") throw new TypeError(`Instance provider '${context.resource}' must expose static create().`);

        // Resolve services lazily through the canonical runtime registry.
        const services = new Proxy({}, {
            get(target, property) {
                if (typeof property !== "string") return undefined;
                return xshell.services.resolve(property);
            }
        });

        // Pass one extensible factory context instead of positional arguments.
        const url = context.resource.substring(context.resource.indexOf(":") + 1);
        return module.default.create({ url, services });
    }
};
