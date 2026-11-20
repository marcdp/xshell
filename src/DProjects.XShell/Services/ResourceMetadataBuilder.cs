using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

using DProjects.XShell.Services.XTemplate;

namespace DProjects.XShell.Services {

    internal sealed record EnrichedFileIndexItem(FileIndexItem File, JsonObject? Resource);

    internal sealed partial class ResourceMetadataBuilder {

        // methods
        public async Task<IReadOnlyList<EnrichedFileIndexItem>> EnrichAsync(string moduleRoot, IEnumerable<FileIndexItem> files,
            CancellationToken cancellationToken) {
            ArgumentException.ThrowIfNullOrWhiteSpace(moduleRoot);
            ArgumentNullException.ThrowIfNull(files);

            // preserve the physical inventory order while attaching independently generated metadata
            var result = new List<EnrichedFileIndexItem>();
            foreach (var file in files) {
                cancellationToken.ThrowIfCancellationRequested();
                result.Add(new EnrichedFileIndexItem(file, await BuildAsync(moduleRoot, file.Path, cancellationToken)));
            }
            return result;
        }
        public async Task<JsonObject?> BuildAsync(string moduleRoot, string packageRelativePath, CancellationToken cancellationToken) {
            ArgumentException.ThrowIfNullOrWhiteSpace(moduleRoot);
            ArgumentException.ThrowIfNullOrWhiteSpace(packageRelativePath);

            // classify only resources recognized by the existing package directory conventions
            var normalizedPath = "/" + packageRelativePath.TrimStart('/', '\\').Replace('\\', '/');
            var extension = Path.GetExtension(normalizedPath);
            var type = Classify(normalizedPath, extension);
            if (type == null) return null;

            // resolve the inventoried file without permitting a path to escape the module root
            var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(moduleRoot));
            var sourcePath = Path.GetFullPath(Path.Combine(root, normalizedPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
            if (!IsSameOrInside(sourcePath, root)) throw new InvalidOperationException($"Resource path '{normalizedPath}' escapes module root '{root}'.");

            try {
                return type switch {
                    "page" when extension.Equals(".md", StringComparison.OrdinalIgnoreCase) =>
                        await BuildMarkdownPageAsync(sourcePath, cancellationToken),
                    "contract" => await BuildJsonAsync(sourcePath, "contract", ["label", "description", "icon"], cancellationToken),
                    "schema" => await BuildJsonAsync(sourcePath, "schema", ["$id", "title", "description"], cancellationToken),
                    _ => await BuildJavaScriptAsync(sourcePath, normalizedPath, type, extension, cancellationToken)
                };
            } catch (Exception exception) when (exception is not OperationCanceledException && exception is not InvalidOperationException) {
                throw new InvalidOperationException($"Failed to extract resource metadata from '{normalizedPath}': {exception.Message}", exception);
            } catch (InvalidOperationException exception) when (!exception.Message.Contains(normalizedPath, StringComparison.Ordinal)) {
                throw new InvalidOperationException($"Failed to extract resource metadata from '{normalizedPath}': {exception.Message}", exception);
            }
        }

        // private methods
        private static string? Classify(string path, string extension) {
            if (path.StartsWith("/pages/", StringComparison.Ordinal) && (extension.Equals(".js", StringComparison.OrdinalIgnoreCase) ||
                extension.Equals(".html", StringComparison.OrdinalIgnoreCase) || extension.Equals(".md", StringComparison.OrdinalIgnoreCase))) return "page";
            if (path.StartsWith("/components/", StringComparison.Ordinal) &&
                (extension.Equals(".js", StringComparison.OrdinalIgnoreCase) || extension.Equals(".html", StringComparison.OrdinalIgnoreCase))) return "component";
            if (path.StartsWith("/commands/", StringComparison.Ordinal) && extension.Equals(".js", StringComparison.OrdinalIgnoreCase)) return "command";
            if (path.StartsWith("/contracts/", StringComparison.Ordinal) && extension.Equals(".json", StringComparison.OrdinalIgnoreCase)) return "contract";
            if (path.StartsWith("/schemas/", StringComparison.Ordinal) && path.EndsWith(".schema.json", StringComparison.OrdinalIgnoreCase)) return "schema";
            return null;
        }
        private static async Task<JsonObject> BuildJavaScriptAsync(string sourcePath, string displayPath, string type, string extension,
            CancellationToken cancellationToken) {
            // read HTML definitions through the existing SFC section parser and JavaScript definitions directly
            var source = await File.ReadAllTextAsync(sourcePath, cancellationToken);
            if (extension.Equals(".html", StringComparison.OrdinalIgnoreCase)) source = new ModuleFileCompilerHtmlSfc().ExtractDefinitionSource(source);
            var definition = JavaScriptSource.Parse(source).FindDefaultExportObject();
            var resource = new JsonObject { ["type"] = type };
            if (definition == null) return resource;

            // extract the small type-specific surface without copying the complete definition contract
            if (type == "page") {
                var meta = ReadStaticObject(definition, "meta", displayPath);
                AddStaticString(resource, "title", meta, "title", displayPath, "meta.title");
                AddStaticString(resource, "description", meta, "description", displayPath, "meta.description");
                AddStaticString(resource, "icon", meta, "icon", displayPath, "meta.icon");
            } else if (type == "component") {
                var meta = ReadStaticObject(definition, "meta", displayPath);
                var contract = ReadStaticObject(definition, "contract", displayPath);
                AddPreferredStaticString(resource, "label", meta, "title", contract, "label", displayPath, "meta.title", "contract.label");
                AddPreferredStaticString(resource, "description", meta, "description", contract, "description", displayPath,
                    "meta.description", "contract.description");
                AddPreferredStaticString(resource, "icon", meta, "icon", contract, "icon", displayPath, "meta.icon", "contract.icon");
            } else if (type == "command") {
                var contract = ReadStaticObject(definition, "contract", displayPath);
                AddStaticString(resource, "label", contract, "label", displayPath, "contract.label");
                AddStaticString(resource, "description", contract, "description", displayPath, "contract.description");
                AddStaticString(resource, "icon", contract, "icon", displayPath, "contract.icon");
            }
            return resource;
        }
        private static JavaScriptSource.JavaScriptObject? ReadStaticObject(JavaScriptSource.JavaScriptObject definition, string propertyName,
            string displayPath) {
            var property = definition.FindProperty(propertyName);
            if (property == null) return null;
            return property.Value.AsObject() ?? throw new InvalidOperationException(
                $"Resource metadata '{propertyName}' in '{displayPath}' must be a static object literal.");
        }
        private static void AddPreferredStaticString(JsonObject resource, string targetName, JavaScriptSource.JavaScriptObject? preferred,
            string preferredName, JavaScriptSource.JavaScriptObject? fallback, string fallbackName, string displayPath, string preferredDisplayName,
            string fallbackDisplayName) {
            // honor Component meta precedence without requiring duplicate contract metadata
            if (preferred?.FindProperty(preferredName) != null) {
                AddStaticString(resource, targetName, preferred, preferredName, displayPath, preferredDisplayName);
            } else {
                AddStaticString(resource, targetName, fallback, fallbackName, displayPath, fallbackDisplayName);
            }
        }
        private static void AddStaticString(JsonObject resource, string targetName, JavaScriptSource.JavaScriptObject? source, string sourceName,
            string displayPath, string propertyPath) {
            var property = source?.FindProperty(sourceName);
            if (property == null) return;
            var value = property.Value.GetStaticString() ?? throw new InvalidOperationException(
                $"Resource metadata '{propertyPath}' in '{displayPath}' must be a static string literal.");
            resource[targetName] = value;
        }
        private static async Task<JsonObject> BuildJsonAsync(string sourcePath, string type, IReadOnlyList<string> properties,
            CancellationToken cancellationToken) {
            // parse ordinary JSON resources and retain only the supported descriptive strings
            var source = await File.ReadAllTextAsync(sourcePath, cancellationToken);
            var document = JsonNode.Parse(source) as JsonObject ?? throw new InvalidOperationException("Resource must contain a JSON object.");
            var resource = new JsonObject { ["type"] = type };
            foreach (var propertyName in properties) {
                if (!document.TryGetPropertyValue(propertyName, out var node)) continue;
                if (node is not JsonValue value || !value.TryGetValue<string>(out var text)) {
                    throw new InvalidOperationException($"Resource metadata '{propertyName}' must be a string.");
                }
                resource[propertyName == "$id" ? "id" : propertyName] = text;
            }
            return resource;
        }
        private static async Task<JsonObject> BuildMarkdownPageAsync(string sourcePath, CancellationToken cancellationToken) {
            // use the first ATX heading outside a fenced block as optional lightweight Page metadata
            var source = await File.ReadAllTextAsync(sourcePath, cancellationToken);
            var resource = new JsonObject { ["type"] = "page" };
            var fenced = false;
            char fenceCharacter = '\0';
            foreach (var line in source.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)) {
                var trimmed = line.TrimStart();
                if (trimmed.StartsWith("```", StringComparison.Ordinal) || trimmed.StartsWith("~~~", StringComparison.Ordinal)) {
                    if (!fenced) { fenced = true; fenceCharacter = trimmed[0]; }
                    else if (trimmed[0] == fenceCharacter) fenced = false;
                    continue;
                }
                if (fenced) continue;
                var match = MarkdownHeading().Match(trimmed);
                if (!match.Success) continue;
                resource["title"] = match.Groups[1].Value.TrimEnd().TrimEnd('#').TrimEnd();
                break;
            }
            return resource;
        }
        private static bool IsSameOrInside(string path, string root) {
            var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
            return path.Equals(root, comparison) || path.StartsWith(root + Path.DirectorySeparatorChar, comparison);
        }

        [GeneratedRegex("^#{1,6}\\s+(.+?)\\s*$", RegexOptions.CultureInvariant)]
        private static partial Regex MarkdownHeading();
    }
}
