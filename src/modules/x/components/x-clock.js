
class XClock extends HTMLElement {

    //fields
    _timerId = 0;
    
    //ctor
    constructor() {
        super();
        var shadow = this.attachShadow({ mode: "open" });
        shadow.innerHTML = "<slot></slot>";
    }

    //events
    connectedCallback() {
        this.render();
        this._timerId = setInterval(()=>{
            this.render();
        }, 1000);
    }
    disconnectedCallback() {
        clearInterval(this._timerId);
    }
    render() {
        this.innerHTML = new Date().toLocaleTimeString();
    }

}

export default XClock;
customElements.define('x-clock', XClock);