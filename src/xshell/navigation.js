// class
export default class Navigation {

    //var
    _mode = "hash"; //hash|path
    _assetsPrefix = "/assets";
    _routerPrefix = "/";
    
    //ctor
    constructor() {
    }

    //props
    get mode() { return this._mode; }
    get assetsPrefix() { return this._assetsPrefix; }
    get routerPrefix() { return this._routerPrefix; }
    
}
