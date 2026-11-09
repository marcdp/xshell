using System.Text.Json;
using System.Text.Json.Nodes;

namespace DProjects.XShell.Services {

    internal sealed class RepositoryIndexBuilder {

        // vars
        private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

        // inner classes
        internal sealed record ModuleInfo(string Id, string Version);

        // methods
        public async Task<string> BuildAsync(string repositoryPath, CancellationToken cancellationToken = default) {
            ArgumentException.ThrowIfNullOrWhiteSpace(repositoryPath);

            // discover modules with valid repository descriptors
            var modules = new List<ModuleInfo>();
            foreach (var directory in Directory.EnumerateDirectories(repositoryPath)) {
                cancellationToken.ThrowIfCancellationRequested();

                var directoryName = Path.GetFileName(directory);
                if (!ModuleIds.IsValid(directoryName)) continue;

                var manifest = ModuleIndexBuilder.FindManifest(directory);
                if (manifest == null) continue;

                var info = await ModuleIndexBuilder.ReadManifestAsync(manifest, cancellationToken);
                modules.Add(new ModuleInfo(info.Module, info.Version));
            }

            return CreateJson(modules);
        }

        internal static string CreateJson(IEnumerable<ModuleInfo> modules) {
            ArgumentNullException.ThrowIfNull(modules);

            // select the latest stable version for every module identifier
            var entries = modules
                .GroupBy(module => module.Id, StringComparer.Ordinal)
                .Select(group => new ModuleInfo(group.Key, GetLatestStableVersion(group.Select(module => module.Version))))
                .OrderBy(module => module.Id, StringComparer.Ordinal)
                .ToArray();
            var index = new JsonObject {
                ["modules"] = new JsonObject(entries.Select(module => new KeyValuePair<string, JsonNode?>(module.Id,
                    CreateModuleEntry(module))))
            };
            return index.ToJsonString(JsonOptions);
        }

        // private methods
        private static JsonObject CreateModuleEntry(ModuleInfo module) {
            // expose the descriptor URL and optional stable release version
            var entry = new JsonObject {
                ["url"] = $"{module.Id}/index.json"
            };
            if (module.Version.Length > 0) entry["latest"] = module.Version;
            return entry;
        }

        private static string GetLatestStableVersion(IEnumerable<string> versions) {
            // ignore prereleases when selecting the catalog default
            var stableVersions = versions.Where(version => !IsPrerelease(version)).ToArray();
            return stableVersions.Length == 0 ? "" : stableVersions.Aggregate((latest, candidate) =>
                CompareStableVersions(candidate, latest) > 0 ? candidate : latest);
        }
        private static int CompareStableVersions(string left, string right) {
            // compare semantic-version numeric identifiers without integer overflow
            var leftCore = WithoutBuildMetadata(left);
            var rightCore = WithoutBuildMetadata(right);
            var leftParts = leftCore.Split('.');
            var rightParts = rightCore.Split('.');
            for (var index = 0; index < 3; index++) {
                var comparison = CompareNumericIdentifiers(leftParts[index], rightParts[index]);
                if (comparison != 0) return comparison;
            }
            return string.CompareOrdinal(left, right);
        }
        private static string WithoutBuildMetadata(string version) {
            var buildSeparator = version.IndexOf('+');
            return buildSeparator < 0 ? version : version[..buildSeparator];
        }
        private static int CompareNumericIdentifiers(string left, string right) {
            left = left.TrimStart('0');
            right = right.TrimStart('0');
            if (left.Length != right.Length) return left.Length.CompareTo(right.Length);
            return string.CompareOrdinal(left, right);
        }

        private static bool IsPrerelease(string version) {
            var releaseEnd = version.IndexOfAny(['-', '+']);
            return releaseEnd >= 0 && version[releaseEnd] == '-';
        }
    }
}
