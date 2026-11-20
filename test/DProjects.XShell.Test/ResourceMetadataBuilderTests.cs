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
        public async Task MissingMetadataAndOrdinaryFiles_RemainSmallAndOptional() {
            using var files = new TemporaryDirectory();
            files.Write("pages/plain.js", "export default { state: {} };");
            files.Write("images/logo.svg", "<svg></svg>");
            var builder = new ResourceMetadataBuilder();

            var page = await builder.BuildAsync(files.Root, "/pages/plain.js", TestContext.Current.CancellationToken);
            var ordinary = await builder.BuildAsync(files.Root, "/images/logo.svg", TestContext.Current.CancellationToken);

            AssertMetadata(page, "page");
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
