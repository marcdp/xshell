import Page, { pageUnloaded } from "../page.js";

export default class LoaderPageMd {

    async load(resourceUrl, context) {
        
        // resolve the renderer through the normal component loader
        const componentMarkdown = context.services.config.xshell.ui.components.markdown;
        await context.services.loader.load("component:" + componentMarkdown);

        // return class
        return class extends Page {

            // methods
            async mount({host}) {
                if (this[pageUnloaded]) return;
                // Keep the resolved resource URL separate from the Area-qualified Page source.
                const markdown = document.createElement(componentMarkdown);
                markdown.setAttribute("src", resourceUrl);
                host.replaceChildren(markdown);
                await super.mount({host});
            }

            async unmount() {
                if (this[pageUnloaded]) return;
                // detach Page-owned content before releasing the host
                this.host?.replaceChildren();
                await super.unmount();
            }
        };
    }
};
