import Utils from "./utils.js";

// const
const MENU_MAIN = "main";

// class
export default class Menus {

    // vars
    _bus = null;
    _config = null;
    _navigation = null;
    _modules = null;
    // sources of menu items registered by modules
    _sources = {};
    // computed menus
    _menus = {};

    // ctor
    constructor( { bus, config, modules, navigation } ) {
        this._bus = bus;
        this._config = config;
        this._modules = modules;
        this._navigation = navigation;
        // listen for navigation end event, to refresh menus
        this._bus.addEventListener("xshell:navigation:end", () => this._refresh());
    }

    // method
    init() {
        this._refresh();
    }
    get(name) {
        return this._menus[name];
    }
    getMainMenu() {
        debugger;
        return this._menus[MENU_MAIN];
    }
    registerSource(name, source) {
        // register a menu source, which can provide menu items dynamically, and recompute them on events it depends on
        this._sources[name] = source;
        for(let event of source.dependsOn || []) {
            this._bus.addEventListener(event, () => this._refresh() );
        }        
    }


    // private methods
    _refresh() {
        let page = this._navigation.getPage(); 
        let src = page ? page.src : "";
        if (page.srcPage) src = page.srcPage;
        if (src.indexOf("#")!=-1) src = src.substr(0, src.indexOf("#"));        
        // build menus from config and from dinamic sources
        let cache = {};
        for(let key in this._config.config) {
            if (key.startsWith("modules.") && key.indexOf(".menus.") != -1) {
                const keyParts = key.split(".");
                const moduleName = keyParts[1];
                const menuName = keyParts[3];
                const menuArea = keyParts[4] || (menuName == MENU_MAIN ? "main" : "");
                const menuItems = this._config.config[key];
                if (!cache[menuName]) cache[menuName] = [];
                for(let menuitem of menuItems.map(item => this._cloneMenuitemRecursive(item, moduleName, menuArea, "", src))){
                    cache[menuName].push(menuitem);
                }
            }
        }
        // get active area for main menu
        let area = null;
        for(let name in cache) {
            if (name == MENU_MAIN) {
                // for main menu, merge all areas into one menu
                const menu = cache[name];
                let menuitems = Utils.findObjectsPath(menu, 'href', src);
                if (menuitems && menuitems.length > 0) {
                    area = menuitems[0].area;
                }
                // remove menus from other areas
                for(let i = menu.length - 1; i >= 0; i--) {
                    let menuArea = menu[i].area || "";
                    if (area != menuArea) {
                        cache[name].splice(i, 1);
                    }
                }
            }
        }
        // for each menu, merge menuitems
        // TODO ...
        // if changed, apply changes
        if (JSON.stringify(this._menus) != JSON.stringify(cache)) {
            // assign new value
            this._menus = cache;
            // emit event
            this._bus.emit("xshell:menus:changed", { } );
        }
    }
    _evaluateMenuitemSource(sourceName, moduleName, areaName, src) {
        // evaluate a menu source
        let source = this._sources[sourceName];
        if (source) {
            let modulePath = this._modules.getModule(moduleName).path;
            let menuitems = source.resolve();
            return menuitems.map( menuitem => this._cloneMenuitemRecursive(menuitem, moduleName, areaName, modulePath, src) );
        }
    }
    _cloneMenuitemRecursive(menuitem, moduleName, areaName, hrefPrefix, src) {
        // clone menu item recursively
        let href = (menuitem.href ? (hrefPrefix + menuitem.href) : null);
        let selected = (src == (href && href.indexOf("#")!=-1 ? href.substring(0, href.indexOf("#")) : href));        
        let result = {
            label: menuitem.label,
            href: href,
            icon: menuitem.icon || null,
            module: moduleName,
            area: areaName,
            selected: selected,
            children: (menuitem.children ? 
                menuitem.children.map( child => this._cloneMenuitemRecursive(child, moduleName, areaName, hrefPrefix, src) ) : 
                (menuitem.childrenSource ? this._evaluateMenuitemSource(menuitem.childrenSource, moduleName, areaName, hrefPrefix, src)  : []) 
            )
        }
        return Object.freeze(result);
    } 
}
