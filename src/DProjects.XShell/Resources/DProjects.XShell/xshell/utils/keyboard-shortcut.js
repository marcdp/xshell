const modifiers = { ctrl: "Ctrl", shift: "Shift", alt: "Alt", meta: "Meta" };
const namedKeys = ("Enter Escape Tab Backspace Delete Insert Home End PageUp PageDown ArrowUp ArrowDown ArrowLeft ArrowRight " +
    "Space Plus").split(" ");
const keys = new Map(namedKeys.map(key => [key.toLowerCase(), key]));

export function parseShortcut(value) {
    // Accept one logical key after one or more distinct explicit modifiers.
    if (typeof value !== "string") return null;
    const parts = value.toLowerCase().split("+").map(part => part.trim());
    const key = parts.pop();
    if (!parts.length || new Set(parts).size !== parts.length || parts.some(part => !Object.hasOwn(modifiers, part))) return null;
    const logicalKey = keys.get(key) || (/^(?:[!-~]|f(?:[1-9]|1[0-9]|2[0-4]))$/.test(key) ? key.toUpperCase() : null);
    return logicalKey ? [...Object.keys(modifiers).filter(modifier => parts.includes(modifier)).map(modifier => modifiers[modifier]), logicalKey].join("+") : null;
}

export function getEventShortcut(event) {
    // Ignore modifier-only presses and AltGraph input, which can look like Ctrl+Alt.
    const parts = Object.keys(modifiers).filter(modifier => event[modifier + "Key"]);
    if (!parts.length || event.getModifierState?.("AltGraph")) return null;
    const key = event.key === " " ? "Space" : event.key === "+" ? "Plus" : event.key;
    return parseShortcut([...parts, key].join("+"));
}
