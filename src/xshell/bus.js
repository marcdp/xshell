
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
    // Emit an event asynchronously
    async emit(event, data) {
        console.log(`bus: emit event'${event}' ...`);
        if (!this._events[event]) return;
        const promises = this._events[event].map(async (listener) => listener(data));
        await Promise.all(promises);
    }

};


//export
export default new Bus();