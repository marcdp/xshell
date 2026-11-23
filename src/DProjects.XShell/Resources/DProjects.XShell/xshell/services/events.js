
// class
export default class Events {

    // Options schema for the Events class
    static optionsSchema = {
        type: "object",
        properties: {},
        additionalProperties: false
    }

    //vars
    #handler = null;
    #eventListeners =  [];

    //Ctor
    constructor(dependencies = {}, options = {}) {
        // preserve supported direct construction while accepting standard Services dependencies
        this.#handler = typeof dependencies === "function" ? dependencies : dependencies.scopeContext?.invokeController ?? null;
    }   
    dispose(){
        for (const { element, event, listener } of this.#eventListeners) {
            element.removeEventListener(event, listener);
        }
        this.#eventListeners = [];
        this.#handler = null;
    }

    //methods
    on(element, event, listener) {
        if (typeof(listener) == "string") {
            if (typeof this.#handler !== "function") throw new Error("Events string listeners require a Services scope controller context.");
            const command = listener;
            listener = () => {this.#handler(command);}
        }
        if (typeof(event) == "string") {
            event = [event];
        }
        for (let ev of event) {
            element.addEventListener(ev, listener);
            this.#eventListeners.push({ element, event: ev, listener });
        }   
    }
    
}
