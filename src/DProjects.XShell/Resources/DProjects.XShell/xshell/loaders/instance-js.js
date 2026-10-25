//export 
export default class LoaderModuleJs {
    async load(src, context) {
        // dynamic import of a module factory, and create an instance from it
        const module = await import(src);
        const url = context.resource.substring(context.resource.indexOf(":") + 1) ;
        return module.default.create(url);
    }
};