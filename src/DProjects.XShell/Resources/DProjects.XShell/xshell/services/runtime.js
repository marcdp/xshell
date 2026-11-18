
// class
export default class Runtime {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
        },
        additionalProperties: false
    };

    // vars
    _startTimeMs  = null;
    _startupDurationMs = null;

    // ctor
    constructor( {} ) {
        this._startupDurationMs = performance.now();
        this._startTimeMs  = new Date().getTime();
    }   

    // props
    get startTimeMs() { return this._startTimeMs; }
    get startupDurationMs() { return this._startupDurationMs; }
    get uptimeMs() {  return performance.now() - this._startupDurationMs;}
    
}
