import Page from "../page.js";
import xshell from "../xshell.js";

export default class LoaderPageMd {

    async load(resourceUrl, context) {
        
        // resolve the renderer through the normal component loader
        const componentMarkdown = xshell.config.xshell.ui.component.markdown;
        await xshell.loader.load("component:" + componentMarkdown);

        // return class
        return class extends Page {

            // ctor
            constructor({src: navigationSrc, context}) {
                super({src: navigationSrc, context});
                this._controller = {};
            }

            // methods
            async mount({host}) {
                if (this._unloaded) return;
                // Keep the resolved resource URL separate from the Area-qualified Page source.
                const markdown = document.createElement(componentMarkdown);
                markdown.setAttribute("src", resourceUrl);
                host.replaceChildren(markdown);
                await super.mount({host});
            }

            async unmount() {
                if (this._unloaded) return;
                // detach Page-owned content before releasing the host
                this._host?.replaceChildren();
                await super.unmount();
            }
        };
    }
};
