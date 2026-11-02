namespace DProjects.XShell.Services.XTemplate {

    internal static class XTemplateElementNames {

        // consts
        private static readonly HashSet<string> VoidElements = new(StringComparer.OrdinalIgnoreCase) {
            "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
        };

        // methods
        public static bool IsVoid(string name) => VoidElements.Contains(name);
        public static string Resolve(object? value, string fallback, int offset) {
            if (value == null) return fallback;
            if (value is not string name) throw new XTemplateException("x-is requires a string or null element name", offset);
            if (!IsValid(name)) throw new XTemplateException($"Invalid x-is element name '{name}'", offset);
            var normalized = name.ToLowerInvariant();
            if (IsVoid(normalized)) throw new XTemplateException($"x-is cannot resolve to void element <{normalized}>", offset);
            if (normalized is "script" or "style") throw new XTemplateException($"x-is cannot resolve to prohibited element <{normalized}>", offset);
            if (normalized == "slot" && fallback != "slot") throw new XTemplateException("x-is cannot create an undeclared slot element", offset);
            return normalized;
        }
        public static bool IsValid(string value) => value.Length > 0 && char.IsAsciiLetter(value[0]) && value.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_' or ':');
    }
}
