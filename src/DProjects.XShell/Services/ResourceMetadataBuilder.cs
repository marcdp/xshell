using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

using DProjects.XShell.Services.XTemplate;

namespace DProjects.XShell.Services {

    internal sealed record EnrichedFileIndexItem(FileIndexItem File, JsonObject? Resource);

    internal sealed partial class ResourceMetadataBuilder {

        // vars
        private static readonly Regex TagPattern = new("^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant);

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
                    "contract" => await BuildJsonAsync(sourcePath, "contract", ["label", "description", "icon"], cancellationToken, normalizedPath),
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
            if (type == "command" && definition == null) throw new InvalidOperationException(
                $"Command resource '{displayPath}' must default-export a static definition object.");
            if (definition == null) return resource;

            // extract the small type-specific surface without copying the complete definition contract
            if (type == "page") {
                var meta = ReadStaticObject(definition, "meta", displayPath);
                // Preserve existing Page metadata extraction for nonliteral contracts; only inline contract tags are discoverable statically.
                var contract = definition.FindProperty("contract")?.Value.AsObject();
                AddStaticString(resource, "title", meta, "title", displayPath, "meta.title");
                AddStaticString(resource, "description", meta, "description", displayPath, "meta.description");
                AddStaticString(resource, "icon", meta, "icon", displayPath, "meta.icon");
                AddStaticTags(resource, contract, displayPath);
            } else if (type == "component") {
                var meta = ReadStaticObject(definition, "meta", displayPath);
                var contract = ReadStaticObject(definition, "contract", displayPath);
                AddPreferredStaticString(resource, "label", meta, "title", contract, "label", displayPath, "meta.title", "contract.label");
                AddPreferredStaticString(resource, "description", meta, "description", contract, "description", displayPath,
                    "meta.description", "contract.description");
                AddPreferredStaticString(resource, "icon", meta, "icon", contract, "icon", displayPath, "meta.icon", "contract.icon");
                AddStaticTags(resource, contract, displayPath);
            } else if (type == "command") {
                var contract = RequireStaticObject(definition, "contract", displayPath, "Command resource");
                RequireStaticObject(contract, "execute", displayPath, "Command contract");
                AddStaticString(resource, "label", contract, "label", displayPath, "contract.label");
                AddStaticString(resource, "description", contract, "description", displayPath, "contract.description");
                AddStaticString(resource, "icon", contract, "icon", displayPath, "contract.icon");
                AddStaticTags(resource, contract, displayPath);
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
        private static JavaScriptSource.JavaScriptObject RequireStaticObject(JavaScriptSource.JavaScriptObject definition, string propertyName,
            string displayPath, string owner) {
            // Require the statically inspectable command shape used by the runtime contract loader.
            var property = definition.FindProperty(propertyName) ?? throw new InvalidOperationException(
                $"{owner} in '{displayPath}' must declare a static '{propertyName}' object.");
            return property.Value.AsObject() ?? throw new InvalidOperationException(
                $"{owner} '{propertyName}' in '{displayPath}' must be a static object literal.");
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
        private static void AddStaticTags(JsonObject resource, JavaScriptSource.JavaScriptObject? contract, string displayPath) {
            // Copy only explicitly authored contract tags after applying the same lexical and uniqueness rules as the schemas.
            var property = contract?.FindProperty("tags");
            if (property == null) return;
            IReadOnlyList<string>? tags;
            try {
                tags = property.Value.GetStaticStringArray();
            } catch (InvalidOperationException exception) {
                throw new InvalidOperationException($"Resource metadata 'contract.tags' in '{displayPath}' is invalid: {exception.Message}", exception);
            }
            if (tags == null) throw new InvalidOperationException(
                $"Resource metadata 'contract.tags' in '{displayPath}' must be a static array of string literals.");
            ValidateTags(tags, displayPath, "contract.tags");
            resource["tags"] = new JsonArray(tags.Select(tag => JsonValue.Create(tag)).ToArray());
        }
        private static void ValidateTags(IEnumerable<string> tags, string displayPath, string propertyPath) {
            // Reject invalid or duplicate identifiers without normalizing authored order or values.
            var unique = new HashSet<string>(StringComparer.Ordinal);
            foreach (var tag in tags) {
                if (!TagPattern.IsMatch(tag)) throw new InvalidOperationException(
                    $"Resource metadata '{propertyPath}' in '{displayPath}' contains invalid tag '{tag}'. Tags must use lowercase kebab-case.");
                if (!unique.Add(tag)) throw new InvalidOperationException(
                    $"Resource metadata '{propertyPath}' in '{displayPath}' contains duplicate tag '{tag}'.");
            }
        }
        private static async Task<JsonObject> BuildJsonAsync(string sourcePath, string type, IReadOnlyList<string> properties,
            CancellationToken cancellationToken, string? contractDisplayPath = null) {
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
            if (contractDisplayPath == null) return resource;

            // Extend standalone contract metadata with validated authored tags.
            if (!document.TryGetPropertyValue("tags", out var tagsNode)) return resource;
            if (tagsNode is not JsonArray array || array.Any(item => item is not JsonValue value || !value.TryGetValue<string>(out _))) {
                throw new InvalidOperationException($"Resource metadata 'contract.tags' in '{contractDisplayPath}' must be an array of strings.");
            }
            var tags = array.Select(item => item!.GetValue<string>()).ToArray();
            ValidateTags(tags, contractDisplayPath, "contract.tags");
            resource["tags"] = new JsonArray(tags.Select(tag => JsonValue.Create(tag)).ToArray());
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
