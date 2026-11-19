const semanticSizes = new Set(["size-compact", "size-narrow", "size-medium", "size-wide", "size-full"]);

export function mergeLayoutClasses(defaults, overrides, reservedClass) {
    // Prefer the first caller size, then the first Page size. Keep other classes in declaration order.
    const pageClasses = defaults?.join(" ").split(/[ \t\n\f\r]+/) ?? [];
    const callerClasses = Array.isArray(overrides) ? overrides.join(" ").split(/[ \t\n\f\r]+/) : [];
    const size = callerClasses.find(name => semanticSizes.has(name)) ?? pageClasses.find(name => semanticSizes.has(name));
    const classes = new Set(size ? [size] : []);
    for (const name of [...pageClasses, ...callerClasses]) {
        if (name && name !== reservedClass && !semanticSizes.has(name)) classes.add(name);
    }
    return [...classes].join(" ");
}
