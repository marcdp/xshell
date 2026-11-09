using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

using DProjects.XShell.Middlewares;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;

namespace DProjects.XShell.Test {

    public sealed class ResourcesMiddlewareTests {

        // consts
        private const string ModuleDescriptor = """
            { "modules": { "demo": { "defaults": { "page": { "renderEngine": "x" } } } } }
            """;
        private const string VersionedDescriptor = """
            { "modules": { "demo": { "version": "0.9.0", "defaults": { "page": { "renderEngine": "x" } } } } }
            """;

        // methods
        [Fact]
        public async Task ExistingStaticResource_IsServedWithoutCallingNext() {
            using var workspace = new TemporaryDirectory();
            byte[] contents = [0, 1, 127, 128, 255];
            workspace.Write("resources/module/file.txt", contents);

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/module/file.txt");

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            Assert.Equal(contents, response.Body);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task RequestOutsideResourcePath_FallsThroughOnce() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/module/file.txt", "resource");

            var response = await SendAsync(workspace.PathFor("resources"), "/other/file.txt");

            Assert.Equal(1, response.NextCalls);
            Assert.Equal(StatusCodes.Status204NoContent, response.StatusCode);
            Assert.Empty(response.Body);
            Assert.Null(response.ContentType);
        }
        [Theory]
        [InlineData("manifest.jsonc", "application/json")]
        [InlineData("readme.md", "text/markdown")]
        public async Task XShellStaticExtensions_UseExpectedContentType(string fileName, string contentType) {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/" + fileName, "content");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/" + fileName);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            Assert.StartsWith(contentType, response.ContentType, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task StaticResource_UsesNoCacheHeadersOnlyInDevelopment() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/file.txt", "content");

            var development = await SendAsync(workspace.PathFor("resources"), "/_resources/file.txt", isDevelopment: true);
            var production = await SendAsync(workspace.PathFor("resources"), "/_resources/file.txt");

            Assert.Equal(StatusCodes.Status200OK, development.StatusCode);
            AssertNoCache(development);
            Assert.Equal(StatusCodes.Status200OK, production.StatusCode);
            Assert.False(production.Headers.ContainsKey("Cache-Control"));
            Assert.False(production.Headers.ContainsKey("Pragma"));
            Assert.False(production.Headers.ContainsKey("Expires"));
        }
        [Fact]
        public async Task DevelopmentModuleDescriptor_IsCanonicalJsonWithCurrentLocalInventory() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", """
                // authored configuration
                { "modules": {
                    "dependency": { "configUrl": "url:../dependency/manifest.jsonc" },
                    "demo": { "files": [{ "path": "/stale.js", "size": 1, "hash": "stale" }] }
                } }
                """);
            workspace.Write("resources/demo/a.txt", "alpha");
            workspace.Write("resources/demo/nested/b.txt", "beta");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/manifest.json", isDevelopment: true);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            Assert.StartsWith("application/json", response.ContentType, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(0, response.NextCalls);
            AssertNoCache(response);
            using var descriptor = JsonDocument.Parse(response.Text);
            var actual = ReadInventory(descriptor.RootElement.GetProperty("modules").GetProperty("demo").GetProperty("files"));
            Assert.Equal(["/a.txt", "/nested/b.txt"], actual.Select(file => file.Path));
            Assert.False(descriptor.RootElement.GetProperty("modules").GetProperty("dependency").TryGetProperty("files", out _));
            var a = Assert.Single(actual, file => file.Path == "/a.txt");
            Assert.Equal(Encoding.UTF8.GetByteCount("alpha"), a.Size);
            Assert.Equal(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("alpha"))).ToLowerInvariant(), a.Hash);
        }
        [Fact]
        public async Task DevelopmentModuleManifestJson_IsDiscovered() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.json", ModuleDescriptor);

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/manifest.jsonc", isDevelopment: true);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            using var manifest = JsonDocument.Parse(response.Text);
            Assert.True(manifest.RootElement.GetProperty("modules").TryGetProperty("demo", out _));
        }
        [Fact]
        public async Task LegacyModuleFilename_IsNotDiscoveredForCompilation() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/module.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/component.html", "<template><p>Legacy</p></template>");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/component.js", isDevelopment: true);

            Assert.Equal(StatusCodes.Status204NoContent, response.StatusCode);
            Assert.Equal(1, response.NextCalls);
        }
        [Fact]
        public async Task DevelopmentDescriptor_HeadHasGetHeadersWithoutBody() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/a.txt", "alpha");

            var get = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/manifest.json", isDevelopment: true);
            var head = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/manifest.json", isDevelopment: true, method: HttpMethods.Head);

            Assert.Equal(StatusCodes.Status200OK, head.StatusCode);
            Assert.Empty(head.Body);
            Assert.Equal(get.Body.Length, head.Headers.ContentLength);
            Assert.Equal(get.ContentType, head.ContentType);
            AssertNoCache(head);
            Assert.Equal(0, head.NextCalls);
        }
        [Fact]
        public async Task DevelopmentXShellDescriptor_EmbedsFrameworkInventory() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/xshell/manifest.jsonc", "{ \"xshell\": { \"files\": [{ \"path\": \"/stale.js\" }] } }");
            workspace.Write("resources/xshell/bootstrap.js", "bootstrap");
            workspace.Write("resources/xshell/sw.js", "worker");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/xshell/manifest.jsonc", isDevelopment: true);

            using var descriptor = JsonDocument.Parse(response.Text);
            var files = ReadInventory(descriptor.RootElement.GetProperty("xshell").GetProperty("files"));
            Assert.Equal(["/bootstrap.js", "/sw.js"], files.Select(file => file.Path));
        }
        [Fact]
        public async Task DevelopmentNestedXShellManifest_UsesFrameworkDiscoveryContext() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/DProjects.XShell/xshell/manifest.jsonc", "{ \"xshell\": {} }");
            workspace.Write("resources/DProjects.XShell/xshell/bootstrap.js", "bootstrap");

            var response = await SendAsync(workspace.PathFor("resources"),
                "/_resources/DProjects.XShell/xshell/manifest.json", isDevelopment: true);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            using var descriptor = JsonDocument.Parse(response.Text);
            Assert.True(descriptor.RootElement.TryGetProperty("xshell", out _));
        }
        [Fact]
        public async Task DevelopmentNestedXShellJavaScript_BypassesModuleCompilation() {
            using var workspace = new TemporaryDirectory();
            const string source = "export const framework = true;";
            workspace.Write("resources/DProjects.XShell/xshell/manifest.jsonc", "{ \"xshell\": {} }");
            workspace.Write("resources/DProjects.XShell/xshell/bootstrap.js", source);

            var response = await SendAsync(workspace.PathFor("resources"),
                "/_resources/DProjects.XShell/xshell/bootstrap.js", isDevelopment: true);

            Assert.True(response.StatusCode == StatusCodes.Status200OK, response.Text);
            Assert.Equal(source, response.Text);
        }
        [Fact]
        public async Task DevelopmentDescriptor_AmbiguousSourceRepresentationsAreRejected() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.json", ModuleDescriptor);
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                SendAsync(workspace.PathFor("resources"), "/_resources/demo/manifest.json", isDevelopment: true));

            Assert.Contains("both manifest.json and manifest.jsonc", exception.Message);
        }
        [Fact]
        public async Task DevelopmentModuleDescriptor_RequiresExactlyOneLocalDefinition() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", "{ \"modules\": { \"a\": {}, \"b\": {} } }");

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                SendAsync(workspace.PathFor("resources"), "/_resources/demo/manifest.json", isDevelopment: true));

            Assert.Contains("exactly one local module definition", exception.Message);
        }
        [Fact]
        public async Task DevelopmentHtmlSfc_IsCompiledAtJavaScriptPath() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/pages/page.html", "<template><p>Hello</p></template>");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/pages/page.js", isDevelopment: true);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            Assert.StartsWith("application/javascript", response.ContentType, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("template: `<p>Hello</p>`", response.Text);
            Assert.Contains("templateRenderer:", response.Text);
            AssertNoCache(response);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task DevelopmentRootJavaScript_DoesNotUsePageRenderEngine() {
            using var workspace = new TemporaryDirectory();
            const string source = "export default { value: 1 };";
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/module.js", source);

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/module.js", isDevelopment: true);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            Assert.Equal(source, response.Text);
            AssertNoCache(response);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task DevelopmentHtmlSfc_HeadCompilesAtJavaScriptPathWithoutBody() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/component.html", "<template><p>Héllo</p></template>");

            var root = workspace.PathFor("resources");
            var get = await SendAsync(root, "/_resources/demo/component.js", isDevelopment: true);
            var head = await SendAsync(root, "/_resources/demo/component.js", isDevelopment: true, method: HttpMethods.Head);

            Assert.Equal(StatusCodes.Status200OK, get.StatusCode);
            Assert.Contains("Héllo", get.Text);
            Assert.StartsWith("application/javascript", get.ContentType, StringComparison.OrdinalIgnoreCase);
            AssertCompiledHeadMatchesGet(get, head);
        }
        [Fact]
        public async Task DevelopmentHtmlSfc_IsNotServedAtAuthoredPath() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/component.html", "<template><p>Hello</p></template>");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/component.html", isDevelopment: true);

            Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
            Assert.Empty(response.Body);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task DevelopmentRuntimePathCollision_IsRejected() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/component.js", "export default {};");
            workspace.Write("resources/demo/component.html", "<template><p>Hello</p></template>");

            var root = workspace.PathFor("resources");
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => SendAsync(root, "/_resources/demo/component.js", isDevelopment: true));

            Assert.Contains("component.js", exception.Message);
            Assert.Contains("component.html", exception.Message);
            Assert.Contains("/demo/component.js", exception.Message);
        }
        [Fact]
        public async Task DevelopmentJavaScript_CompilesResourceReferences() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            const string source = "export default { meta: { renderEngine: 'html' }, style: `.card { background: url('./image.png'); }` };";
            workspace.Write("resources/demo/component.js", source);

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/component.js", isDevelopment: true);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            Assert.StartsWith("application/javascript", response.ContentType, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("url('/image.png')", response.Text);
            Assert.DoesNotContain("url('./image.png')", response.Text);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task DevelopmentJavaScript_HeadHasGetHeadersWithoutBody() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/component.js", "export default { meta: { renderEngine: 'html' }, label: 'café' };");

            var root = workspace.PathFor("resources");
            var get = await SendAsync(root, "/_resources/demo/component.js", isDevelopment: true);
            var head = await SendAsync(root, "/_resources/demo/component.js", isDevelopment: true, method: HttpMethods.Head);

            Assert.Equal(StatusCodes.Status200OK, get.StatusCode);
            Assert.Contains("café", get.Text);
            Assert.True(get.Body.Length > get.Text.Length);
            Assert.StartsWith("application/javascript", get.ContentType, StringComparison.OrdinalIgnoreCase);
            AssertCompiledHeadMatchesGet(get, head);
        }
        [Fact]
        public async Task DevelopmentCss_CompilesRelativeResourceUrl() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/styles/site.css", ".card { background: url('../image.png'); }");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/styles/site.css", isDevelopment: true);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            Assert.StartsWith("text/css", response.ContentType, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("url('/image.png')", response.Text);
            AssertNoCache(response);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task DevelopmentCss_HeadHasGetHeadersWithoutBody() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/styles/site.css", ".café { background: url('../image.png'); }");

            var root = workspace.PathFor("resources");
            var get = await SendAsync(root, "/_resources/demo/styles/site.css", isDevelopment: true);
            var head = await SendAsync(root, "/_resources/demo/styles/site.css", isDevelopment: true, method: HttpMethods.Head);

            Assert.Equal(StatusCodes.Status200OK, get.StatusCode);
            Assert.Contains("url('/image.png')", get.Text);
            Assert.StartsWith("text/css", get.ContentType, StringComparison.OrdinalIgnoreCase);
            AssertCompiledHeadMatchesGet(get, head);
        }
        [Theory]
        [InlineData("POST", "/_resources/demo/component.js")]
        [InlineData("PUT", "/_resources/demo/styles/site.css")]
        [InlineData("POST", "/_resources/demo/component.html")]
        public async Task DevelopmentCompiler_OtherMethodsContinueDownstream(string method, string requestPath) {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", ModuleDescriptor);
            workspace.Write("resources/demo/component.js", "export default { label: 'compiled' };");
            workspace.Write("resources/demo/component.html", "<template><p>Source</p></template>");
            workspace.Write("resources/demo/styles/site.css", ".card { color: red; }");

            var response = await SendAsync(workspace.PathFor("resources"), requestPath, isDevelopment: true, method: method);

            Assert.Equal(StatusCodes.Status204NoContent, response.StatusCode);
            Assert.Equal(1, response.NextCalls);
            Assert.Empty(response.Body);
            Assert.Null(response.ContentType);
        }
        [Fact]
        public async Task DevelopmentResourceWithoutModuleDescriptor_UsesStaticFileStage() {
            using var workspace = new TemporaryDirectory();
            const string source = "export default { style: `url('./image.png')` };";
            workspace.Write("resources/orphan.js", source);
            workspace.Write("manifest.jsonc", ModuleDescriptor);

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/orphan.js", isDevelopment: true);

            Assert.Equal(StatusCodes.Status200OK, response.StatusCode);
            Assert.Equal(source, response.Text);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task DevelopmentMissingCompiledResource_Returns404() {
            using var workspace = new TemporaryDirectory();
            Directory.CreateDirectory(workspace.PathFor("resources"));

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/missing.js", isDevelopment: true);

            Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
            Assert.Equal(0, response.NextCalls);
        }
        [Theory]
        [InlineData("../outside.txt")]
        [InlineData("../outside.js")]
        public async Task Traversal_DoesNotServeFileOutsideResourceRoot(string relativePath) {
            using var workspace = new TemporaryDirectory();
            workspace.Write("outside.txt", "outside secret");
            workspace.Write("outside.js", "outside secret");
            Directory.CreateDirectory(workspace.PathFor("resources"));

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/" + relativePath, isDevelopment: true);

            Assert.True(response.StatusCode is StatusCodes.Status404NotFound or StatusCodes.Status204NoContent);
            Assert.DoesNotContain("outside secret", response.Text);
        }
        [Fact]
        public async Task DescriptorTraversal_DoesNotIndexDirectoryOutsideResourceRoot() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("outside/manifest.jsonc", ModuleDescriptor);
            workspace.Write("outside/secret.txt", "outside secret");
            Directory.CreateDirectory(workspace.PathFor("resources"));

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/../outside/manifest.json", isDevelopment: true);

            Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
            Assert.Empty(response.Body);
            Assert.Equal(0, response.NextCalls);
        }
        [Theory]
        [InlineData("demo", "{ \"modules\": { \"demo\": { \"version\": \"0.9.0\", \"dependencies\": { \"xshell\": \"module:xshell:*\" } } } }")]
        [InlineData("xshell", "{ \"xshell\": { \"version\": \"0.9.0\" } }")]
        public async Task DevelopmentModuleIndex_GetAndHeadUseManifest(string moduleId, string manifest) {
            using var workspace = new TemporaryDirectory();
            workspace.Write($"resources/{moduleId}/manifest.jsonc", manifest);
            var root = workspace.PathFor("resources");
            var path = $"/_resources/{moduleId}/index.json";

            var get = await SendAsync(root, path, true);
            var head = await SendAsync(root, path, true, HttpMethods.Head);

            Assert.Equal(200, get.StatusCode);
            Assert.StartsWith("application/json", get.ContentType);
            Assert.Equal(get.Body.Length, get.Headers.ContentLength);
            Assert.Equal(get.Body.Length, head.Headers.ContentLength);
            Assert.Equal(get.ContentType, head.ContentType);
            Assert.Empty(head.Body);
            AssertNoCache(get);
            AssertNoCache(head);
            Assert.Equal(0, get.NextCalls + head.NextCalls);
            using var index = JsonDocument.Parse(get.Text);
            Assert.Equal(moduleId, index.RootElement.GetProperty("module").GetString());
            var generation = index.RootElement.GetProperty("versions").GetProperty("0.9.0");
            Assert.Equal("dev", generation.GetProperty("hash").GetString());
            if (moduleId == "demo") Assert.Equal("module:xshell:*", generation.GetProperty("dependencies").GetProperty("xshell").GetString());
            else Assert.Empty(generation.GetProperty("dependencies").EnumerateObject());
        }
        [Fact]
        public async Task DevelopmentModuleIndex_ReflectsManifestChanges() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", "{ \"modules\": { \"demo\": { \"version\": \"0.9.0\" } } }");
            var root = workspace.PathFor("resources");
            var first = await SendAsync(root, "/_resources/demo/index.json", true);
            workspace.Write("resources/demo/manifest.jsonc", "{ \"modules\": { \"demo\": { \"version\": \"1.0.0\" } } }");
            var second = await SendAsync(root, "/_resources/demo/index.json", true);

            Assert.Contains("0.9.0", first.Text);
            Assert.Contains("1.0.0", second.Text);
            Assert.Equal(0, first.NextCalls + second.NextCalls);
        }
        [Fact]
        public async Task DevelopmentRepositoryIndex_GetAndHeadReflectCurrentModules() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/x-demo/manifest.jsonc", "{ \"modules\": { \"x-demo\": { \"version\": \"1.2.3\" } } }");
            workspace.Write("resources/xshell/manifest.jsonc", "{ \"xshell\": { \"version\": \"0.9.0\" } }");
            var root = workspace.PathFor("resources");

            var get = await SendAsync(root, "/_resources/index.json", true);
            var head = await SendAsync(root, "/_resources/index.json", true, HttpMethods.Head);
            workspace.Write("resources/x-filesystem/manifest.jsonc", "{ \"modules\": { \"x-filesystem\": { \"version\": \"2.1.0\" } } }");
            var updated = await SendAsync(root, "/_resources/index.json", true);
            Directory.Delete(workspace.PathFor("resources/x-filesystem"), recursive: true);
            var removed = await SendAsync(root, "/_resources/index.json", true);

            Assert.Equal(200, get.StatusCode);
            Assert.StartsWith("application/json", get.ContentType);
            Assert.Equal(get.Body.Length, get.Headers.ContentLength);
            Assert.Equal(get.Body.Length, head.Headers.ContentLength);
            Assert.Equal(get.ContentType, head.ContentType);
            Assert.Empty(head.Body);
            AssertNoCache(get);
            AssertNoCache(head);
            using var index = JsonDocument.Parse(get.Text);
            Assert.Equal(["x-demo", "xshell"], index.RootElement.GetProperty("modules").EnumerateObject().Select(item => item.Name));
            Assert.Equal("x-demo/index.json", index.RootElement.GetProperty("modules").GetProperty("x-demo").GetProperty("url").GetString());
            Assert.Contains("x-filesystem", updated.Text);
            Assert.DoesNotContain("x-filesystem", removed.Text);
            Assert.Equal(0, get.NextCalls + head.NextCalls + updated.NextCalls + removed.NextCalls);
        }
        [Fact]
        public async Task DevelopmentRepositoryIndex_HandlesBasePathsAndProductionFallsThrough() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            var root = workspace.PathFor("resources");

            var development = await SendAsync(root, "/prefix/_resources/index.json", true, requestBasePath: "/prefix/_resources");
            var production = await SendAsync(root, "/_resources/index.json");

            Assert.Equal(200, development.StatusCode);
            Assert.Contains("demo", development.Text);
            Assert.Equal(204, production.StatusCode);
            Assert.Equal(1, production.NextCalls);
        }
        [Fact]
        public async Task DevelopmentRepositoryIndex_DoesNotExposeMalformedManifestDetails() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", "{ invalid");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/index.json", true);

            Assert.Equal(StatusCodes.Status500InternalServerError, response.StatusCode);
            Assert.Empty(response.Body);
            Assert.Equal(0, response.NextCalls);
        }
        [Theory]
        [InlineData("/_resources/missing/index.json", 404, 0)]
        [InlineData("/_resources/demo/0.9.0.dev/index.json", 204, 1)]
        [InlineData("/_resources/../index.json", 404, 0)]
        [InlineData("/_resources/bad.id/index.json", 404, 0)]
        [InlineData("/else/demo/index.json", 204, 1)]
        public async Task DevelopmentModuleIndex_RejectsOrFallsThrough(string path, int status, int nextCalls) {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            var response = await SendAsync(workspace.PathFor("resources"), path, true);
            Assert.Equal(status, response.StatusCode);
            Assert.Equal(nextCalls, response.NextCalls);
        }
        [Theory]
        [InlineData("Demo")]
        [InlineData("demo_one")]
        [InlineData("1demo")]
        [InlineData("demo--one")]
        [InlineData("demo.one")]
        public async Task DevelopmentModuleIndex_RejectsNoncanonicalDirectory(string id) {
            using var workspace = new TemporaryDirectory();
            workspace.Write($"resources/{id}/manifest.jsonc", $$"""{ "modules": { "{{id}}": { "version": "0.9.0" } } }""");
            var response = await SendAsync(workspace.PathFor("resources"), $"/_resources/{id}/index.json", true);
            Assert.Equal(404, response.StatusCode);
            Assert.Equal(0, response.NextCalls);
        }
        [Fact]
        public async Task DevelopmentModuleIndex_MissingManifestReturns404_AndProductionDoesNotGenerate() {
            using var workspace = new TemporaryDirectory();
            Directory.CreateDirectory(workspace.PathFor("resources/demo"));
            var root = workspace.PathFor("resources");
            var missing = await SendAsync(root, "/_resources/demo/index.json", true);
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            var production = await SendAsync(root, "/_resources/demo/index.json");

            Assert.Equal(404, missing.StatusCode);
            Assert.Equal(0, missing.NextCalls);
            Assert.Equal(204, production.StatusCode);
            Assert.Equal(1, production.NextCalls);
        }
        [Fact]
        public async Task VersionedResources_UsePhysicalFilesAndExistingCompilationStages() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            workspace.Write("resources/demo/pages/page.html", "<template><p>Versioned</p></template>");
            workspace.Write("resources/demo/styles/site.css", ".card { background: url('../image.png'); }");
            workspace.Write("resources/demo/image.png", new byte[] { 1, 2, 3 });
            var root = workspace.PathFor("resources");

            var descriptor = await SendAsync(root, "/_resources/demo/0.9.0.dev/manifest.json", true);
            var descriptorHead = await SendAsync(root, "/_resources/demo/0.9.0.dev/manifest.json", true, HttpMethods.Head);
            var page = await SendAsync(root, "/_resources/demo/0.9.0.dev/pages/page.js", true);
            var pageHead = await SendAsync(root, "/_resources/demo/0.9.0.dev/pages/page.js", true, HttpMethods.Head);
            var css = await SendAsync(root, "/_resources/demo/0.9.0.dev/styles/site.css", true);
            var image = await SendAsync(root, "/_resources/demo/0.9.0.dev/image.png", true);

            Assert.Equal(200, descriptor.StatusCode);
            using var parsed = JsonDocument.Parse(descriptor.Text);
            Assert.True(parsed.RootElement.GetProperty("modules").GetProperty("demo").TryGetProperty("files", out _));
            AssertNoCache(descriptor);
            AssertCompiledHeadMatchesGet(descriptor, descriptorHead);
            Assert.Equal(200, page.StatusCode);
            Assert.Contains("Versioned", page.Text);
            AssertNoCache(page);
            AssertCompiledHeadMatchesGet(page, pageHead);
            Assert.Equal(200, css.StatusCode);
            Assert.Contains("url('/image.png')", css.Text);
            AssertNoCache(css);
            Assert.Equal(new byte[] { 1, 2, 3 }, image.Body);
            AssertNoCache(image);
            Assert.Equal(0, descriptor.NextCalls + descriptorHead.NextCalls + page.NextCalls + pageHead.NextCalls + css.NextCalls + image.NextCalls);
        }
        [Fact]
        public async Task VersionedFrameworkScripts_AndHeadUsePhysicalFiles() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/xshell/manifest.jsonc", "{ \"xshell\": { \"version\": \"0.9.0\" } }");
            workspace.Write("resources/xshell/bootstrap.js", "bootstrap");
            workspace.Write("resources/xshell/sw.js", "worker");
            var root = workspace.PathFor("resources");

            var bootstrap = await SendAsync(root, "/_resources/xshell/0.9.0.dev/bootstrap.js", true);
            var worker = await SendAsync(root, "/_resources/xshell/0.9.0.dev/sw.js", true);
            var head = await SendAsync(root, "/_resources/xshell/0.9.0.dev/bootstrap.js", true, HttpMethods.Head);

            Assert.Equal("bootstrap", bootstrap.Text);
            Assert.Equal("worker", worker.Text);
            Assert.Equal(200, head.StatusCode);
            Assert.Empty(head.Body);
            Assert.Equal(bootstrap.Body.Length, head.Headers.ContentLength);
            AssertNoCache(head);
        }
        [Theory]
        [InlineData("1.0.0.dev/file.txt")]
        [InlineData("0.9.dev/file.txt")]
        [InlineData("0.9.0.dev/../file.txt")]
        [InlineData("0.9.0.dev/../../outside.txt")]
        [InlineData("0.9.0.dev/%2e%2e/outside.txt")]
        [InlineData("0.9.0.dev/%252e%252e/outside.txt")]
        [InlineData("0.9.0.dev/nested/%2e%2e/file.txt")]
        [InlineData("0.9.0.devx/file.txt")]
        [InlineData("0.9.0.dev")]
        [InlineData("0.9.0.dev/%2foutside.txt")]
        public async Task InvalidVersionedPaths_Return404(string suffix) {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            workspace.Write("resources/demo/file.txt", "inside");
            workspace.Write("outside.txt", "outside secret");

            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/" + suffix, true);

            Assert.Equal(404, response.StatusCode);
            Assert.DoesNotContain("outside secret", response.Text);
        }
        [Fact]
        public async Task VersionedPath_RejectsManifestVersionMismatch() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            workspace.Write("resources/demo/file.txt", "inside");
            var response = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/0.9.1.dev/file.txt", true);
            Assert.Equal(404, response.StatusCode);
        }
        [Theory]
        [InlineData("/_resources/demo/index.json")]
        [InlineData("/_resources/demo/0.9.0.dev/file.txt")]
        [InlineData("/_resources/demo/0.9.0.dev/manifest.json")]
        public async Task UnsupportedMethod_DoesNotServeGeneratedResources(string path) {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            workspace.Write("resources/demo/file.txt", "inside");
            var response = await SendAsync(workspace.PathFor("resources"), path, true, HttpMethods.Post);
            Assert.Equal(204, response.StatusCode);
            Assert.Empty(response.Body);
            Assert.Equal(1, response.NextCalls);
        }
        [Fact]
        public async Task NestedSymbolicLink_OutsideRootIsRejected() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            workspace.Write("outside/secret.txt", "outside secret");
            try {
                Directory.CreateSymbolicLink(workspace.PathFor("resources/demo/nested"), workspace.PathFor("outside"));
            } catch (Exception exception) when (exception is UnauthorizedAccessException or IOException or PlatformNotSupportedException) {
                return;
            }
            foreach (var path in new[] { "/_resources/demo/nested/secret.txt", "/_resources/demo/0.9.0.dev/nested/secret.txt" }) {
                var response = await SendAsync(workspace.PathFor("resources"), path, true);
                Assert.Equal(404, response.StatusCode);
                Assert.DoesNotContain("outside secret", response.Text);
            }
            var descriptor = await SendAsync(workspace.PathFor("resources"), "/_resources/demo/manifest.json", true);
            Assert.Equal(200, descriptor.StatusCode);
            Assert.DoesNotContain("secret.txt", descriptor.Text);
        }
        [Fact]
        public async Task VersionedPath_IsDevelopmentOnly_AndUnversionedStillWorks() {
            using var workspace = new TemporaryDirectory();
            workspace.Write("resources/demo/manifest.jsonc", VersionedDescriptor);
            workspace.Write("resources/demo/file.txt", "source");
            var root = workspace.PathFor("resources");

            var production = await SendAsync(root, "/_resources/demo/0.9.0.dev/file.txt");
            var unversioned = await SendAsync(root, "/_resources/demo/file.txt", true);

            Assert.Equal(204, production.StatusCode);
            Assert.Equal("source", unversioned.Text);
        }

        // methods (private)
        private static async Task<MiddlewareResponse> SendAsync(string resourceRoot, string requestPath, bool isDevelopment = false, string? method = null, string requestBasePath = "/_resources") {
            var serviceCollection = new ServiceCollection().AddLogging();
            serviceCollection.AddSingleton<IWebHostEnvironment>(new TestWebHostEnvironment(resourceRoot, isDevelopment));
            using var services = serviceCollection.BuildServiceProvider();
            var nextCalls = 0;
            RequestDelegate next = context => {
                nextCalls++;
                context.Response.StatusCode = StatusCodes.Status204NoContent;
                return Task.CompletedTask;
            };
            var middleware = new ResourcesMiddleware(next, services, resourceRoot, requestBasePath, isDevelopment);
            var context = new DefaultHttpContext();
            context.Request.Method = method ?? HttpMethods.Get;
            context.Request.Path = requestPath;
            await using var body = new MemoryStream();
            context.Response.Body = body;

            await middleware.InvokeAsync(context);

            return new MiddlewareResponse(context.Response.StatusCode, body.ToArray(), context.Response.ContentType,
                context.Response.Headers, nextCalls);
        }
        private static void AssertNoCache(MiddlewareResponse response) {
            var directives = response.Headers.CacheControl.ToString().Split(',',
                StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            Assert.Contains("no-cache", directives);
            Assert.Contains("no-store", directives);
            Assert.Contains("must-revalidate", directives);
            Assert.Equal("no-cache", response.Headers.Pragma.ToString());
            Assert.Equal("0", response.Headers.Expires.ToString());
        }
        private static void AssertCompiledHeadMatchesGet(MiddlewareResponse get, MiddlewareResponse head) {
            Assert.Equal(get.StatusCode, head.StatusCode);
            Assert.Equal(get.ContentType, head.ContentType);
            Assert.Equal(get.Body.Length, get.Headers.ContentLength);
            Assert.Equal(get.Body.Length, head.Headers.ContentLength);
            Assert.Empty(head.Body);
            AssertNoCache(get);
            AssertNoCache(head);
            Assert.Equal(0, get.NextCalls);
            Assert.Equal(0, head.NextCalls);
        }
        private static InventoryEntry[] ReadInventory(JsonElement inventory) {
            return inventory.EnumerateArray().Select(item => new InventoryEntry(
                item.GetProperty("path").GetString()!, item.GetProperty("size").GetInt64(), item.GetProperty("hash").GetString()!
            )).ToArray();
        }

        // inner classes
        private sealed record InventoryEntry(string Path, long Size, string Hash);
        private sealed record MiddlewareResponse(int StatusCode, byte[] Body, string? ContentType, IHeaderDictionary Headers, int NextCalls) {

            // props
            public string Text => Encoding.UTF8.GetString(Body);
        }
        private sealed class TestWebHostEnvironment : IWebHostEnvironment {

            // props
            public string ApplicationName { get; set; } = "DProjects.XShell.Test";
            public string EnvironmentName { get; set; } = "";
            public string ContentRootPath { get; set; } = "";
            public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
            public string WebRootPath { get; set; } = "";
            public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();

            // ctor
            public TestWebHostEnvironment(string root, bool isDevelopment) {
                EnvironmentName = isDevelopment ? "Development" : "Production";
                ContentRootPath = root;
                WebRootPath = root;
            }
        }
        private sealed class TemporaryDirectory : IDisposable {

            // props
            public string Root { get; } = Path.Combine(Path.GetTempPath(), "DProjects.XShell.Test", Guid.NewGuid().ToString("N"));

            // methods
            public string PathFor(string name) => Path.Combine(Root, name.Replace('/', Path.DirectorySeparatorChar));
            public void Write(string name, string contents) => Write(name, Encoding.UTF8.GetBytes(contents));
            public void Write(string name, byte[] contents) {
                var path = PathFor(name);
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllBytes(path, contents);
            }
            public void Dispose() {
                if (Directory.Exists(Root)) Directory.Delete(Root, recursive: true);
            }
        }
    }
}
