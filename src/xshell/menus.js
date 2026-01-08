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

    _sources = {};

    _computed = {};

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
    get(name){
        return this._computed[name];
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
        // build from config and from dinamic sources
        let cache = {};
        for(let key in this._config.config) {
            if (key.startsWith("modules.") && key.indexOf(".menus.") != -1) {
                let moduleName = key.substring(key.indexOf(".") + 1, key.indexOf(".menus."));
                let menuName = key.substring(key.lastIndexOf(".") + 1);
                let menu = this._cloneMenuitemRecursive(this._config.config[key], moduleName, "", src);
                if (!cache[menuName]) cache[menuName] = [];
                cache[menuName].push(menu);
            }
        }
        // get active group
        let group = "";
        for(let menuName in cache) {
            let menus = cache[menuName];
            let menuitems = Utils.findObjectsPath(menus, 'href', src);
            if (menuitems && menuitems.length > 0) {
                group = menuitems[0].group || "";
            }
        }
        // remove menus from other groups
        for(let menuName in cache) {
            let menus = cache[menuName];
            for(let i = menus.length - 1; i >= 0; i--) {
                let menu = menus[i];
                let menuGroup = menu.group || "";
                if (group != menuGroup) {
                    menus.splice(i, 1);
                }
            }
            cache[menuName] = menus;
        }
        // for each menu, merge menuitems
        for(let menuName in cache) {
            let menus = cache[menuName];
            // TODO ...
        }
        // convert each menu to a rooted menu
        for(let menuName in cache) {
            let menus = cache[menuName];
            let menu = menus[0];
            if (menus.length > 1) {
                menu = {
                    label: "",
                    children: menus
                }
            }            
            cache[menuName] = menu;
        }
        // if changed, apply changes
        if (JSON.stringify(this._computed) != JSON.stringify(cache)) {
            // assign new value
            this._computed = cache;
            // emit event
            this._bus.emit("xshell:menus:changed", { } );
        }
    }
    _evaluateMenuitemSource(sourceName, moduleName, src) {
        // evaluate a menu source
        let source = this._sources[sourceName];
        if (source) {
            let modulePath = this._modules.getModule(moduleName).path;
            let menuitems = source.resolve();
            return menuitems.map( menuitem => this._cloneMenuitemRecursive(menuitem, moduleName, modulePath, src) );
        }
    }
    _cloneMenuitemRecursive(menuitem, moduleName, hrefPrefix="", src) {
        // clone menu item recursively
        let href = (menuitem.href ? (hrefPrefix + menuitem.href) : null);
        let selected = (src == (href && href.indexOf("#")!=-1 ? href.substring(0, href.indexOf("#")) : href));        
        let result ={
            label: menuitem.label,
            href: href,
            icon: menuitem.icon || null,
            group: menuitem.group || "",
            selected: selected,
            children: (menuitem.children ? 
                menuitem.children.map( child => this._cloneMenuitemRecursive(child, moduleName, hrefPrefix, src) ) : 
                (menuitem.childrenSource ? this._evaluateMenuitemSource(menuitem.childrenSource, moduleName, src)  : []) 
            )
        }
        return Object.freeze(result);
    } 
}
