export default class {

    // ctor
    constructor({ moduleConfig }) {
        this.id = moduleConfig.id;
        this.label = moduleConfig.label;
        this.menuSource = moduleConfig.menus.navigation;
        this.pageCount = 0;
        this.files = moduleConfig.files || [];
        this.assetsPath = moduleConfig.assets?.path || "";
        this.started = false;
    }

    // start the module
    start() {
        this.pageCount = this.files.filter(file => file.path.startsWith(this.assetsPath + "/pages/") && /\.(js|html)$/.test(file.path)).length;
        this.started = true;
    }

    // get the cookbook summary
    getCookbookSummary() {
        return {
            id: this.id,
            label: this.label,
            menuSource: this.menuSource,
            pageCount: this.pageCount,
            started: this.started
        };
    }
}
