
// class
class Bus {


    //vars
    _events = {};

    //ctor
    constructor() {
    }

    
    //methods
    on(event, listener) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(listener);
    }
    off(event, listener) {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(l => l !== listener);
    }
    // Emit an event asynchronously
    async emit(event, data) {
        if (!this._events[event]) return;
        const promises = this._events[event].map(async (listener) => listener(data));
        await Promise.all(promises);
    }

};


//export
export default new Bus();