import Page from "../page.js"

//export 
export default class LoaderPageJs {
    async load(src) {
        const module = await import(src);
        const definition = module.default;
        // document fragment
        const documentFragment = document.createDocumentFragment()
        documentFragment.innerHTML = definition.template;
        debugger;
        // create class for that page
        const pageClass = class extends Page {
            async init(host) {
                super.init(host);
            }
            async load() {
                super.load();
            }
            async mount() {
                super.mount();
                this._host
                debugger;
            }
            async unmount() {
                super.unmount();
                debugger;
            }
            async unload() {
                super.unload();
                debugger;
            }
        }
        // should return a class that extends base class Page
        return pageClass;
    }
};