import pageRegistry from "./page-registry.js";
export default {
    async controller(type, controller, pageIdInjected = "PAGE_ID") {
        let page = pageRegistry.getPage(pageIdInjected);
        if (!page) throw new Error(`PageContext.define(): page '${pageIdInjected}' not found in registry`);
        await page.setController(type, controller);
        await pageRegistry.setPageReady(pageIdInjected);
    }
};
