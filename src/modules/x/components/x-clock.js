import XElement from "../../../x-element.js";

class XClock extends XElement {

    //static
    static definition = {
        template: `
            {{ state.time }}
        `,
        state() {
            return {
                time: new Date().toLocaleTimeString()
            };
        }
    };

    //fields
    _timerId = 0;
    
    //ctor
    constructor() {
        super();
    }

    //events
    onLoad() {
        this._timerId = setInterval(() => {
            this.state.time = new Date().toLocaleTimeString();
        }, 1000);
    }
    onUnload() {
        clearInterval(this._timerId);
    }

}

// define
customElements.define('x-clock', XClock);

// export
export default XClock;
