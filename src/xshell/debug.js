
// class
export default class Debug {


    //vars

    //ctor
    constructor() {
    }

    //methods
    log(message) {
        this.emit("log:info", { message: message });
    }
    warn(message) {
        this.emit("log:warn", { message: message });
    }
    error(message, ...params) {
        this.emit("log:error", { message: message, ...params });
    }
    emit(event, detail) {
    }

};
