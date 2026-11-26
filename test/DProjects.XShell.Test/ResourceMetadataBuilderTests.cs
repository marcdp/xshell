using System.Text.Json.Nodes;

using DProjects.XShell.Services;

namespace DProjects.XShell.Test {

    public sealed class ResourceMetadataBuilderTests {

        // methods
        [Fact]
        public async Task JavaScriptResources_ExtractStaticMetadataWithComponentPrecedence() {
            using var files = new TemporaryDirectory();
            files.Write("pages/nested/page.js", """
                export default { meta: { title: `Page title`, description: "Line\nTwo", icon: 'x-page' } };
                """);
            files.Write("components/x-card.js", """
                export default {
                    meta: { title: "Meta card", description: "Meta description" },
                    contract: { label: "Contract card", description: "Contract description", icon: "x-card" }
                };
                """);
            files.Write("commands/run.js", """
                export default { contract: { label: "Run", description: `Run now`, icon: "x-run", execute: {} }, controller() {} };
                """);
            var builder = new ResourceMetadataBuilder();

            var page = await builder.BuildAsync(files.Root, "/pages/nested/page.js", TestContext.Current.CancellationToken);
            var component = await builder.BuildAsync(files.Root, "/components/x-card.js", TestContext.Current.CancellationToken);
            var command = await builder.BuildAsync(files.Root, "/commands/run.js", TestContext.Current.CancellationToken);

            AssertMetadata(page, "page", ("title", "Page title"), ("description", "Line\nTwo"), ("icon", "x-page"));
            AssertMetadata(component, "component", ("label", "Meta card"), ("description", "Meta description"), ("icon", "x-card"));
            AssertMetadata(command, "command", ("label", "Run"), ("description", "Run now"), ("icon", "x-run"));
        }
        [Fact]
        public async Task HtmlAndMarkdownPages_UseAuthoredDefinitionsAndHeadings() {
            using var files = new TemporaryDirectory();
            files.Write("pages/page.html", """
                <template><p>Page</p></template>
                <script type="module">export default { meta: { title: "HTML Page", description: "From SFC" } };</script>
                """);
            files.Write("pages/guide.md", """
                ```markdown
                # Ignored
                ```
                ## Guide title ##
                """);
            var builder = new ResourceMetadataBuilder();

            var html = await builder.BuildAsync(files.Root, "/pages/page.html", TestContext.Current.CancellationToken);
            var markdown = await builder.BuildAsync(files.Root, "/pages/guide.md", TestContext.Current.CancellationToken);

            AssertMetadata(html, "page", ("title", "HTML Page"), ("description", "From SFC"));
            AssertMetadata(markdown, "page", ("title", "Guide title"));
        }
        [Fact]
        public async Task JsonResources_ExtractOnlySupportedMetadata() {
            using var files = new TemporaryDirectory();
            files.Write("contracts/example.json", """
                { "label": "Example", "description": "Contract description", "icon": "x-example", "methods": { "run": {} } }
                """);
            files.Write("schemas/example.schema.json", """
                { "$id": "https://example.test/example", "title": "Example schema", "description": "Schema description", "type": "object" }
                """);
            var builder = new ResourceMetadataBuilder();

            var contract = await builder.BuildAsync(files.Root, "/contracts/example.json", TestContext.Current.CancellationToken);
            var schema = await builder.BuildAsync(files.Root, "/schemas/example.schema.json", TestContext.Current.CancellationToken);

            AssertMetadata(contract, "contract", ("label", "Example"), ("description", "Contract description"), ("icon", "x-example"));
            AssertMetadata(schema, "schema", ("id", "https://example.test/example"), ("title", "Example schema"), ("description", "Schema description"));
            Assert.False(contract!.ContainsKey("methods"));
            Assert.False(schema!.ContainsKey("typeBody"));
        }
        [Fact]
        public async Task ContractTags_AreCopiedForJavaScriptAndJsonResourcesInDeclarationOrder() {
            using var files = new TemporaryDirectory();
            files.Write("pages/page.js", "export default { contract: { tags: ['navigation', 'settings'] }, meta: { title: 'Settings' } };");
            files.Write("components/x-chart.js", "export default { contract: { tags: [\"ui\", /* chart */ \"charts\"] } };");
            files.Write("commands/export.js", "export default { contract: { tags: [`data`, 'export'], execute: {} }, controller() {} };");
            files.Write("contracts/navigation.json", "{ \"label\": \"Navigation\", \"tags\": [\"navigation\", \"routing\"] }");
            var builder = new ResourceMetadataBuilder();

            var page = await builder.BuildAsync(files.Root, "/pages/page.js", TestContext.Current.CancellationToken);
            var component = await builder.BuildAsync(files.Root, "/components/x-chart.js", TestContext.Current.CancellationToken);
            var command = await builder.BuildAsync(files.Root, "/commands/export.js", TestContext.Current.CancellationToken);
            var contract = await builder.BuildAsync(files.Root, "/contracts/navigation.json", TestContext.Current.CancellationToken);

            Assert.Equal(["navigation", "settings"], ReadTags(page));
            Assert.Equal(["ui", "charts"], ReadTags(component));
            Assert.Equal(["data", "export"], ReadTags(command));
            Assert.Equal(["navigation", "routing"], ReadTags(contract));
            Assert.Equal("Settings", page!["title"]!.GetValue<string>());
        }
        [Fact]
        public async Task MissingAndEmptyContractTags_RemainDistinct() {
            using var files = new TemporaryDirectory();
            files.Write("components/missing.js", "export default { contract: {} };");
            files.Write("components/empty.js", "export default { contract: { tags: [] } };");
            var builder = new ResourceMetadataBuilder();

            var missing = await builder.BuildAsync(files.Root, "/components/missing.js", TestContext.Current.CancellationToken);
            var empty = await builder.BuildAsync(files.Root, "/components/empty.js", TestContext.Current.CancellationToken);

            Assert.False(missing!.ContainsKey("tags"));
            Assert.Empty(ReadTags(empty));
        }
        [Theory]
        [InlineData("getTags()")]
        [InlineData("DEFAULT_TAGS")]
        [InlineData("[\"ui\", currentTag]")]
        [InlineData("[...sharedTags, \"ui\"]")]
        [InlineData("[`type-${name}`]")]
        [InlineData("[\"ui\" \"data\"]")]
        [InlineData("[\"UI\"]")]
        [InlineData("[\"file management\"]")]
        [InlineData("[\"data\", \"data\"]")]
        [InlineData("[\"\"]")]
        public async Task InvalidContractTags_ProducePathAndPropertyDiagnostics(string expression) {
            using var files = new TemporaryDirectory();
            files.Write("components/invalid.js", $"export default {{ contract: {{ tags: {expression} }} }};");

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                new ResourceMetadataBuilder().BuildAsync(files.Root, "/components/invalid.js", TestContext.Current.CancellationToken));

            Assert.Contains("/components/invalid.js", exception.Message);
            Assert.Contains("contract.tags", exception.Message);
        }
        [Fact]
        public async Task InvalidJsonContractTags_ProducePathAndPropertyDiagnostics() {
            using var files = new TemporaryDirectory();
            files.Write("contracts/invalid.json", "{ \"tags\": [\"storage\", \"storage\"] }");

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                new ResourceMetadataBuilder().BuildAsync(files.Root, "/contracts/invalid.json", TestContext.Current.CancellationToken));

            Assert.Contains("/contracts/invalid.json", exception.Message);
            Assert.Contains("contract.tags", exception.Message);
            Assert.Contains("duplicate", exception.Message, StringComparison.OrdinalIgnoreCase);
        }
        [Fact]
        public async Task RepresentativeResources_ExposeAuthoredTags() {
            var resources = Path.Combine(AppContext.BaseDirectory, "Resources", "DProjects.XShell");
            var builder = new ResourceMetadataBuilder();

            var component = await builder.BuildAsync(Path.Combine(resources, "x"), "/components/x-listview.js", TestContext.Current.CancellationToken);
            var page = await builder.BuildAsync(Path.Combine(resources, "x-home"), "/pages/index.js", TestContext.Current.CancellationToken);
            var command = await builder.BuildAsync(Path.Combine(resources, "x-demo"), "/commands/demo.operation.js", TestContext.Current.CancellationToken);
            var contract = await builder.BuildAsync(Path.Combine(resources, "xshell"), "/contracts/preferences.json", TestContext.Current.CancellationToken);

            Assert.Equal(["data", "collections", "selection", "views"], ReadTags(component));
            Assert.Equal(["home", "navigation"], ReadTags(page));
            Assert.Equal(["demo", "operations"], ReadTags(command));
            Assert.Equal(["preferences", "storage"], ReadTags(contract));
        }
        [Fact]
        public async Task AuthoredComponents_ExposeStaticUniqueTags() {
            // Locate every authored JavaScript Component copied into the test resources.
            var resources = Path.Combine(AppContext.BaseDirectory, "Resources", "DProjects.XShell");
            var componentFiles = Directory.EnumerateFiles(resources, "*.js", SearchOption.AllDirectories)
                .Where(file => string.Equals(Path.GetFileName(Path.GetDirectoryName(file)), "components", StringComparison.Ordinal))
                .OrderBy(file => file, StringComparer.Ordinal)
                .ToArray();
            var builder = new ResourceMetadataBuilder();

            Assert.NotEmpty(componentFiles);
            foreach (var file in componentFiles) {
                // Verify static extraction and the schema's lexical and uniqueness constraints.
                var moduleRoot = Directory.GetParent(Path.GetDirectoryName(file)!)!.FullName;
                var resourcePath = "/" + Path.GetRelativePath(moduleRoot, file).Replace('\\', '/');
                var resource = await builder.BuildAsync(moduleRoot, resourcePath, TestContext.Current.CancellationToken);
                var tags = ReadTags(resource);

                Assert.NotEmpty(tags);
                Assert.Equal(tags.Length, tags.Distinct(StringComparer.Ordinal).Count());
                Assert.All(tags, tag => Assert.Matches("^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$", tag));
            }
        }
        [Fact]
        public async Task MissingMetadataAndOrdinaryFiles_RemainSmallAndOptional() {
            using var files = new TemporaryDirectory();
            files.Write("pages/plain.js", "export default { state: {} };");
            files.Write("pages/dynamic-contract.js", "export default { contract: createContract(), meta: { title: 'Dynamic contract' } };");
            files.Write("images/logo.svg", "<svg></svg>");
            var builder = new ResourceMetadataBuilder();

            var page = await builder.BuildAsync(files.Root, "/pages/plain.js", TestContext.Current.CancellationToken);
            var dynamicContract = await builder.BuildAsync(files.Root, "/pages/dynamic-contract.js", TestContext.Current.CancellationToken);
            var ordinary = await builder.BuildAsync(files.Root, "/images/logo.svg", TestContext.Current.CancellationToken);

            AssertMetadata(page, "page");
            AssertMetadata(dynamicContract, "page", ("title", "Dynamic contract"));
            Assert.Null(ordinary);
        }
        [Theory]
        [InlineData("export default { meta: { title: getTitle() } };", "meta.title")]
        [InlineData("export default { meta: getMeta() };", "meta")]
        [InlineData("export default { meta: { title: `Hello ${name}` } };", "meta.title")]
        public async Task DynamicJavaScriptMetadata_ProducesPathAndPropertyDiagnostic(string source, string property) {
            using var files = new TemporaryDirectory();
            files.Write("pages/dynamic.js", source);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                new ResourceMetadataBuilder().BuildAsync(files.Root, "/pages/dynamic.js", TestContext.Current.CancellationToken));

            Assert.Contains("/pages/dynamic.js", exception.Message);
            Assert.Contains(property, exception.Message);
            Assert.Contains("static", exception.Message, StringComparison.OrdinalIgnoreCase);
        }
        [Theory]
        [InlineData("export default class Run {};", "definition object")]
        [InlineData("export default {};", "contract")]
        [InlineData("export default { contract: createContract() };", "contract")]
        [InlineData("export default { contract: {} };", "execute")]
        [InlineData("export default { contract: { execute: createExecute() } };", "execute")]
        public async Task InvalidCommandDefinitions_ProducePathAndShapeDiagnostics(string source, string expected) {
            using var files = new TemporaryDirectory();
            files.Write("commands/run.js", source);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                new ResourceMetadataBuilder().BuildAsync(files.Root, "/commands/run.js", TestContext.Current.CancellationToken));

            Assert.Contains("/commands/run.js", exception.Message);
            Assert.Contains(expected, exception.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("static", exception.Message, StringComparison.OrdinalIgnoreCase);
        }
        [Fact]
        public async Task QueryResources_AppearInFrameworkAndModuleInventories() {
            using var files = new TemporaryDirectory();
            files.Write("xshell/manifest.jsonc", """{ "xshell": { "version": "1.0.0" } }""");
            files.Write("sample/manifest.jsonc", """{ "modules": { "sample": { "version": "1.0.0" } } }""");
            // The authored module is statically inspected, including when evaluating it would throw.
            const string source = """
                throw new Error("Do not evaluate");
                export default {
                    contract: { label: "Find orders", description: "Finds orders", icon: "x-search", tags: ["sales", "orders"],
                        query: { parameters: [], returns: { type: "array" } } },
                    controller() { return { query() { return []; } }; }
                };
                """;
            files.Write("xshell/queries/runtime.inspect.js", source);
            files.Write("sample/queries/nested/orders.find.js", source);
            files.Write("sample/queries/readme.txt", "Ordinary asset");

            // Generate both descriptor kinds through the same path used by the host.
            var builder = new DescriptorInventory();
            var framework = JsonNode.Parse(await builder.CreateJsonAsync(Path.Combine(files.Root, "xshell", "manifest.jsonc"),
                DescriptorKind.XShell, TestContext.Current.CancellationToken))!;
            var module = JsonNode.Parse(await builder.CreateJsonAsync(Path.Combine(files.Root, "sample", "manifest.jsonc"),
                DescriptorKind.Module, TestContext.Current.CancellationToken))!;
            var entries = new[] {
                framework["xshell"]!["files"]!.AsArray().Single(file => file!["path"]!.GetValue<string>() == "/queries/runtime.inspect.js"),
                module["modules"]!["sample"]!["files"]!.AsArray().Single(file => file!["path"]!.GetValue<string>() == "/queries/nested/orders.find.js")
            };
            foreach (var entry in entries) {
                Assert.True(entry!["size"]!.GetValue<int>() > 0);
                Assert.False(string.IsNullOrEmpty(entry["hash"]!.GetValue<string>()));
                var resource = entry["resource"]!.AsObject();
                Assert.Equal("query", resource["type"]!.GetValue<string>());
                Assert.Equal("Find orders", resource["label"]!.GetValue<string>());
                Assert.Equal("Finds orders", resource["description"]!.GetValue<string>());
                Assert.Equal("x-search", resource["icon"]!.GetValue<string>());
                Assert.Equal(["sales", "orders"], ReadTags(resource));
                Assert.Equal(5, resource.Count);
            }
            var ordinary = module["modules"]!["sample"]!["files"]!.AsArray()
                .Single(file => file!["path"]!.GetValue<string>() == "/queries/readme.txt");
            Assert.Null(ordinary!["resource"]);
        }
        [Theory]
        [InlineData("export default class Find {};", "definition object")]
        [InlineData("export default {};", "contract")]
        [InlineData("export default { contract: { execute: {} } };", "query")]
        [InlineData("export default { contract: { query: {} } };", "returns")]
        [InlineData("export default { contract: { query: { returns: returnType } } };", "returns")]
        public async Task InvalidQueryDefinitions_ProducePathAndShapeDiagnostics(string source, string expected) {
            using var files = new TemporaryDirectory();
            files.Write("queries/find.js", source);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                new ResourceMetadataBuilder().BuildAsync(files.Root, "/queries/find.js", TestContext.Current.CancellationToken));

            Assert.Contains("/queries/find.js", exception.Message);
            Assert.Contains(expected, exception.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("static", exception.Message, StringComparison.OrdinalIgnoreCase);
        }
        [Fact]
        public async Task InvalidRecognizedResources_ProduceSourceDiagnostics() {
            using var files = new TemporaryDirectory();
            files.Write("contracts/invalid.json", "{ \"label\": 123 }");
            files.Write("pages/invalid.html", "<script type=\"module\">export default {};</script>");
            var builder = new ResourceMetadataBuilder();

            var json = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                builder.BuildAsync(files.Root, "/contracts/invalid.json", TestContext.Current.CancellationToken));
            var html = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                builder.BuildAsync(files.Root, "/pages/invalid.html", TestContext.Current.CancellationToken));

            Assert.Contains("/contracts/invalid.json", json.Message);
            Assert.Contains("label", json.Message);
            Assert.Contains("/pages/invalid.html", html.Message);
            Assert.Contains("template", html.Message, StringComparison.OrdinalIgnoreCase);
        }
        [Fact]
        public async Task Enrichment_PreservesPhysicalValuesAndOrdering() {
            using var files = new TemporaryDirectory();
            files.Write("pages/b.js", "export default { meta: { title: \"B\" } };");
            files.Write("a.txt", "alpha");
            var physical = await new FilesIndexer().CreateAsync(files.Root, TestContext.Current.CancellationToken);

            var enriched = await new ResourceMetadataBuilder().EnrichAsync(files.Root, physical, TestContext.Current.CancellationToken);

            Assert.Equal(physical, enriched.Select(item => item.File));
            Assert.Null(enriched[0].Resource);
            Assert.Equal("B", enriched[1].Resource!["title"]!.GetValue<string>());
        }

        // private methods
        private static void AssertMetadata(JsonObject? actual, string type, params (string Name, string Value)[] properties) {
            Assert.NotNull(actual);
            Assert.Equal(type, actual["type"]!.GetValue<string>());
            Assert.Equal(properties.Length + 1, actual.Count);
            foreach (var property in properties) Assert.Equal(property.Value, actual[property.Name]!.GetValue<string>());
        }
        private static string[] ReadTags(JsonObject? resource) {
            return resource!["tags"]!.AsArray().Select(tag => tag!.GetValue<string>()).ToArray();
        }

        // inner classes
        private sealed class TemporaryDirectory : IDisposable {

            // props
            public string Root { get; } = Path.Combine(Path.GetTempPath(), "DProjects.XShell.Test", Guid.NewGuid().ToString("N"));

            // methods
            public void Write(string path, string content) {
                var target = Path.Combine(Root, path);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                File.WriteAllText(target, content);
            }
            public void Dispose() {
                if (Directory.Exists(Root)) Directory.Delete(Root, recursive: true);
            }
        }
    }
}
