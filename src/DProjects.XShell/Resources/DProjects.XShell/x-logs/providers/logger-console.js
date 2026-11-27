export default class LoggerConsole {

    log(level, ...args) {
        // Forward the original arguments to the native console method for this level.
        console[level](...args);
    }
}
