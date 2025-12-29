// class
export default class PageRegistry {

    // vars
    _pages = new Map();

    // methods
    registerPage(page) {
        let resolve;
        let resolved = false;
        const ready = new Promise(r => {
            resolve = () => {
                if (!resolved) {
                    resolved = true;
                    r();
                }
            };
        });
        // add ready promise
        this._pages.set(page.id, {page, resolve, ready});
    }
    unregisterPage(page) {
        this._pages.delete(page.id);
    }

    // methods
    async waitForPageReady(pageId) {
        const slot = this._pages.get(pageId);
        if (slot) {
            await slot.ready;
        }
    }
    setPageReady(pageId) {
        const slot = this._pages.get(pageId);
        if (slot) {
            slot.resolve();
        }
    }
    getPage(pageId) {
        const slot = this._pages.get(pageId);
        return slot ? slot.page : null;
    }
    hasPage(pageId) {
        return this._pages.has(pageId);
    }

}

