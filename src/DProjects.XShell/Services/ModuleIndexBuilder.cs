using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace DProjects.XShell.Services {
    internal sealed class ModuleIndexBuilder {

        // vars
        private static readonly Regex VersionPattern = new(@"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

        // inner classes
        internal sealed record ManifestInfo(string Module, string Version, Dictionary<string, string> Dependencies);

        // methods
        internal static bool IsValidVersion(string version) => VersionPattern.IsMatch(version);

        public async Task<string> BuildAsync(string manifestPath, CancellationToken cancellationToken = default) {
            // read the authored module identity and dependencies
            var info = await ReadManifestAsync(manifestPath, cancellationToken);

            // serialize the version-specific repository index entry
            var index = new JsonObject {
                ["module"] = info.Module,
                ["versions"] = new JsonObject {
                    [info.Version] = new JsonObject {
                        ["url"] = $"{info.Version}.dev/manifest.json",
                        ["dependencies"] = JsonSerializer.SerializeToNode(info.Dependencies)
                    }
                }
            };
            return index.ToJsonString(JsonOptions);
        }

        // private methods
        internal static string? FindManifest(string directory) {
            var json = Path.Combine(directory, ManifestFileNames.Json);
            var jsonc = Path.Combine(directory, ManifestFileNames.Jsonc);
            if (File.Exists(json) && File.Exists(jsonc)) {
                throw new InvalidOperationException($"Source '{directory}' contains both manifest.json and manifest.jsonc.");
            }
            return File.Exists(json) ? json : File.Exists(jsonc) ? jsonc : null;
        }

        internal static async Task<ManifestInfo> ReadManifestAsync(string manifestPath, CancellationToken cancellationToken = default) {
            var directory = Path.GetDirectoryName(Path.GetFullPath(manifestPath)) ?? throw new InvalidOperationException("Manifest has no containing directory.");
            if (FindManifest(directory) is not string selected || !Path.GetFullPath(selected).Equals(Path.GetFullPath(manifestPath), OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal)) {
                throw new InvalidOperationException($"Manifest '{manifestPath}' is missing or ambiguous.");
            }
            JsonDocument document;
            try {
                document = JsonDocument.Parse(await File.ReadAllTextAsync(manifestPath, cancellationToken), new JsonDocumentOptions {
                    CommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true
                });
            } catch (JsonException exception) {
                throw new InvalidOperationException($"Manifest '{manifestPath}' contains invalid JSON.", exception);
            }
            using (document) {
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object) throw new InvalidOperationException($"Manifest '{manifestPath}' must contain an object.");
                JsonElement definition;
                string module;
                if (DescriptorClassifier.GetKind(manifestPath) == DescriptorKind.XShell) {
                    module = "xshell";
                    if (!root.TryGetProperty("xshell", out definition) || definition.ValueKind != JsonValueKind.Object) {
                        throw new InvalidOperationException($"XShell manifest '{manifestPath}' must contain an xshell object.");
                    }
                } else {
                    if (!root.TryGetProperty("modules", out var modules) || modules.ValueKind != JsonValueKind.Object) {
                        throw new InvalidOperationException($"Module manifest '{manifestPath}' must contain a modules object.");
                    }
                    var locals = new List<JsonProperty>();
                    foreach (var entry in modules.EnumerateObject()) {
                        if (entry.Value.ValueKind != JsonValueKind.Object) throw new InvalidOperationException($"Module '{entry.Name}' must be an object.");
                        if (!entry.Value.TryGetProperty("configUrl", out _)) locals.Add(entry);
                    }
                    if (locals.Count != 1) throw new InvalidOperationException($"Module manifest '{manifestPath}' must contain exactly one local module definition, but found {locals.Count}.");
                    module = locals[0].Name;
                    definition = locals[0].Value;
                    if (module != Path.GetFileName(directory) || !ModuleIds.IsValid(module) || module == "xshell") {
                        throw new InvalidOperationException($"Local module ID '{module}' must match its directory name '{Path.GetFileName(directory)}'.");
                    }
                }
                if (!definition.TryGetProperty("version", out var versionValue) || versionValue.ValueKind != JsonValueKind.String ||
                    versionValue.GetString() is not string version || !VersionPattern.IsMatch(version)) {
                    throw new InvalidOperationException($"Manifest '{manifestPath}' must declare a valid semantic version.");
                }
                var dependencies = new Dictionary<string, string>();
                if (definition.TryGetProperty("dependencies", out var declared)) {
                    if (declared.ValueKind != JsonValueKind.Object) throw new InvalidOperationException($"Manifest '{manifestPath}' dependencies must be an object.");
                    foreach (var dependency in declared.EnumerateObject()) {
                        if (!ModuleIds.IsValid(dependency.Name) || dependency.Value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(dependency.Value.GetString())) {
                            throw new InvalidOperationException($"Manifest '{manifestPath}' contains an invalid dependency '{dependency.Name}'.");
                        }
                        if (!dependencies.TryAdd(dependency.Name, dependency.Value.GetString()!)) throw new InvalidOperationException($"Manifest '{manifestPath}' repeats dependency '{dependency.Name}'.");
                    }
                }
                return new ManifestInfo(module, version, dependencies);
            }
        }
    }
}
