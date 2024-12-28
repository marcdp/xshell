
// class
class Binds {

    //vars
    _eventListeners =  [];
    _timeouts = [];
    _intervals = [];

    //Ctor
    constructor() {
    }   

    //methods
    bindEvent(element, event, listener) {
        element.addEventListener(event, listener);
        this._eventListeners.push({ element, event, listener });
    }
    bindTimeout(timeout, listener) {
        this._timeouts.push({ timeout, timeoutId: setTimeout(listener, timeout), listener });
    }
    bindInterval(timeout, listener) {
        this._intervals.push({ timeout, timeoutId: setInterval(listener, timeout), listener });
    }
    clear() {
        for (const { element, event, listener } of this._eventListeners) {
            element.removeEventListener(event, listener);
        }
        this._eventListeners = [];
        for (const { timeout, timeoutId, listener } of this._timeouts) {
            clearTimeout(timeoutId);
        }
        this._timeouts = [];
        for (const { timeout, timeoutId, listener } of this._intervals) {
            clearTimeout(timeoutId);
        }
        this._intervals = [];
    }
}


//export 
export default Binds;