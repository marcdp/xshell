export default class {
    constructor({ moduleConfig }) {
        this.label = moduleConfig.label;
        this.started = false;
    }

    start() {
        this.started = true;
    }
}
