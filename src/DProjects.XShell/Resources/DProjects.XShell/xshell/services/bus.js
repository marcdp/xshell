
// class
export default class Bus {

    
    // options schema
    static optionsSchema = {
        type: "object",
        properties: {},
        additionalProperties: false
    }


    //vars
    _channel = new MessageChannel();
    #events = {};


    //ctor
    constructor( {}, options) {
        this._channel.port1.onmessage = (e) => {
            this.#processEvent(e.data);
        };
    }

    //methods
    addEventListener(event, listener) {
        if (!this.#events[event]) {
            this.#events[event] = [];
        }
        this.#events[event].push(listener);
    }
    removeEventListener(event, listener) {
        if (!this.#events[event]) return;
        this.#events[event] = this.#events[event].filter(l => l !== listener);
    }
    emit(event, detail) {
        let data = {
            type: event,
            ts: Date.now(),
            detail: detail
        }
        //console.log("Emitting event: ", data);
        this._channel.port2.postMessage(data);
    }


    // private methods
    #processEvent(event) {
        // invoke
        if (this.#events[event.type]) {
            for(let listener of this.#events[event.type]){
                this.#dispatchToListener(listener, event);
            }
        };
        // broadcast
        if (this.#events["*"]) {
            for(let listener of this.#events["*"]){
                this.#dispatchToListener(listener, event);
            }
        }
    }
    // isolate listener failures without waiting for completion
    #dispatchToListener(listener, event) {
        try {
            const result = listener(event);
            if (result && typeof result.then === "function") {
                Promise.resolve(result).catch(error => console.error("Bus listener failed:", error));
            }
        } catch (error) {
            console.error("Bus listener failed:", error);
        }
    }

};

