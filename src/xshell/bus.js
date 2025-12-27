
// class
class Bus {


    //vars
    _events = {};

    //ctor
    constructor() {
    }

    //methods
    addEventListener(event, listener) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(listener);
    }
    removeEventListener(event, listener) {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(l => l !== listener);
    }
    async emit(event, detail) {
        let data = {
            type: event,
            ts: Date.now(),
            detail: detail
        }
        //console.log(`bus: emit event: '${JSON.stringify(data)}' ...`);
        // invoke
        if (this._events[event]) {
            for(let listener of this._events[event]){
                listener(data);
            }
        };
        // broadcast
        if (this._events["*"]) {
            for(let listener of this._events["*"]){
                listener(data);
            }
        }
    }

};


//export
export default new Bus();