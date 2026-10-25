//export 
export default class LoaderModuleJs {
    async load(src, context) {
        // dynamic import of a module
        let module = await import(src);
        return module.default;
    }
};