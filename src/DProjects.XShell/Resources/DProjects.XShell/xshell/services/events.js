
// class
export default class Events {

    // Options schema for the Events class
    static optionsSchema = {
        type: "object",
        properties: {},
        additionalProperties: false
    }

    //vars
    _handler = null;
    _eventListeners =  [];

    //Ctor
    constructor(dependencies = {}, options = {}) {
        // preserve supported direct construction while accepting standard Services dependencies
        this._handler = typeof dependencies === "function" ? dependencies : dependencies.scopeContext?.invokeController ?? null;
    }   
    dispose(){
        for (const { element, event, listener } of this._eventListeners) {
            element.removeEventListener(event, listener);
        }
        this._eventListeners = [];
        this._handler = null;
    }

    //methods
    on(element, event, listener) {
        if (typeof(listener) == "string") {
            if (typeof this._handler !== "function") throw new Error("Events string listeners require a Services scope controller context.");
            const command = listener;
            listener = () => {this._handler(command);}
        }
        if (typeof(event) == "string") {
            event = [event];
        }
        for (let ev of event) {
            element.addEventListener(ev, listener);
            this._eventListeners.push({ element, event: ev, listener });
        }   
    }
    
}
