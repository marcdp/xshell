
// class
class Logger  {

    //vars
    _config = {
        debug:true,
    }

    //props
    get config() {return this._config;}

    //methods
    async init(config) {
        this._config = config;
    }

    //methods
    log(message, ...args) {
        if (this._config.debug) {
            console.log(this.getTime() + "[XShell] " + message, ...args);
        }
    }
    warn(message, ...args) {
        console.warn(this.getTime() + "[XShell] " + message, ...args);
    };
    error(message, ...args) {
        console.error(this.getTime() + "[XShell] " + message, ...args);
    };

    //private
    getTime() {
        var date = new Date();
        return date.toTimeString().slice(0, 8) + "." + date.getMilliseconds() + " ";
    };
};


//export
export default new Logger();