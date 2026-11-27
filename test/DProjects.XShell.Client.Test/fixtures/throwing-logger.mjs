import Logger from "../../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/logger.js";

export async function createThrowingLogger(t) {
    // Record each level at the provider boundary before throwing synchronously.
    const calls = Object.fromEntries(["trace", "debug", "info", "warn", "error"].map(level => [
        level, t.mock.fn(() => { throw new Error("Logging failed."); })
    ]));
    class ThrowingProvider {
        log(level, ...args) { calls[level](...args); }
    }
    const logger = new Logger({loader: {async load() { return ThrowingProvider; }}}, {
        provider: "test", providers: {test: {implementation: "test-logger.js"}}
    });
    await logger.init();
    return {logger, calls};
}
