using System.Text.RegularExpressions;

namespace DProjects.XShell.Services {
    internal static class ModuleIds {
        private static readonly Regex Pattern = new(@"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        internal static bool IsValid(string id) => Pattern.IsMatch(id);
    }
}
