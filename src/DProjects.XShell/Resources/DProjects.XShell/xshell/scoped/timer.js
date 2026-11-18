
// class
export default class Timer {

    // vars
    _handler = null;
    _timeouts = [];
    _intervals = [];

    // ctor
    constructor(handler) {
        this._handler = handler;
    }   
    dispose(){
        for (const { timeout, timeoutId, listener } of this._timeouts) {
            clearTimeout(timeoutId);
        }
        this._timeouts = [];
        for (const { timeout, timeoutId, listener } of this._intervals) {
            clearInterval(timeoutId);
        }
        this._intervals = [];
    }

    // methods
    setTimeout(listener, timeout) {
        if (typeof(listener) == "string") {
            const command = listener;
            listener = () => {this._handler(command);}
        }
        this._timeouts.push({ timeout, timeoutId: setTimeout(()=>{
            // remove the timeout from the list
            this._timeouts = this._timeouts.filter(t => t.timeoutId !== timeoutId);
            //execute
            listener();
        }, timeout), listener });
    }
    setInterval(listener, timeout) {
        if (typeof(listener) == "string") {
            const command = listener;
            listener = () => {this._handler(command);}
        }
        this._intervals.push({ timeout, timeoutId: setInterval(listener, timeout), listener });
    }

    
}
