export default class LoggerConsole {

    log(level, category, ...args) {
        // Use a fixed format so the category's own format characters remain literal.
        if (category === null) console[level](...args);
        else console[level]("[%s]", category, ...args);
    }
}
