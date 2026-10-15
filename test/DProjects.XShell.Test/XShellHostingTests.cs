using System.Net;
using System.Collections.Specialized;

using DProjects.XShell.Commands;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;

namespace DProjects.XShell.Test {

    public sealed class XShellHostingTests {

        // methods
        [Fact]
        public void ServerConfiguration_PreservesAlreadyParsedParameterValues() {
            var command = new Server {
                Param = new Dictionary<string,string> {
                    ["mode"] = "a=b",
                    ["tenant"] = "acme"
                }
            };

            var config = command.BuildConfiguration();

            Assert.IsType<Dictionary<string, string>>(config.App.Params);
            Assert.Equal("a=b", config.App.Params["mode"]);
            Assert.Equal("acme", config.App.Params["tenant"]);
        }
        [Fact]
        public async Task AppBasePath_RedirectsToTrailingSlash() {
            await using var host = await HostingApplication.StartAsync();

            using var response = await host.Client.GetAsync("/app", TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
            Assert.Equal("/app/", response.Headers.Location?.OriginalString);
        }
        [Fact]
        public async Task AppBaseRoot_ServesBootstrapHtml() {
            await using var host = await HostingApplication.StartAsync();

            using var response = await host.Client.GetAsync("/app/", TestContext.Current.CancellationToken);

            AssertBootstrap(response, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Fact]
        public async Task ExplicitIndexAndAppBaseRoot_ServeSameBootstrapHtml() {
            await using var host = await HostingApplication.StartAsync();

            using var root = await host.Client.GetAsync("/app/", TestContext.Current.CancellationToken);
            using var index = await host.Client.GetAsync("/app/index.html", TestContext.Current.CancellationToken);
            var rootBody = await root.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            var indexBody = await index.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

            AssertBootstrap(root, rootBody);
            AssertBootstrap(index, indexBody);
            Assert.Equal(rootBody, indexBody);
        }
        [Fact]
        public async Task ClientRoute_WithOrWithoutQuery_FallsBackToIndex() {
            await using var host = await HostingApplication.StartAsync();

            using var index = await host.Client.GetAsync("/app/index.html", TestContext.Current.CancellationToken);
            using var route = await host.Client.GetAsync("/app/customers/42", TestContext.Current.CancellationToken);
            using var queriedRoute = await host.Client.GetAsync("/app/customers/42?tab=details", TestContext.Current.CancellationToken);
            var indexBody = await index.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            var routeBody = await route.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            var queriedBody = await queriedRoute.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

            AssertBootstrap(route, routeBody);
            AssertBootstrap(queriedRoute, queriedBody);
            Assert.Equal(indexBody, routeBody);
            Assert.Equal(routeBody, queriedBody);
        }
        [Theory]
        [InlineData("/app/index.html", "text/html")]
        [InlineData("/app/sw.js", "application/javascript")]
        [InlineData("/app/customers/42", "text/html")]
        public async Task GeneratedResponse_HeadHasGetHeadersWithoutBody(string path, string contentType) {
            await using var host = await HostingApplication.StartAsync();

            using var get = await host.Client.GetAsync(path, TestContext.Current.CancellationToken);
            using var head = await host.Client.SendAsync(new HttpRequestMessage(HttpMethod.Head, path), TestContext.Current.CancellationToken);
            var getBytes = await get.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
            var headBytes = await head.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.OK, get.StatusCode);
            Assert.NotEmpty(getBytes);
            Assert.Equal(contentType, get.Content.Headers.ContentType?.MediaType);
            Assert.Equal(getBytes.Length, get.Content.Headers.ContentLength);
            Assert.Equal(get.StatusCode, head.StatusCode);
            Assert.Equal(get.Content.Headers.ContentType, head.Content.Headers.ContentType);
            Assert.Equal(getBytes.Length, head.Content.Headers.ContentLength);
            Assert.Empty(headBytes);
        }
        [Theory]
        [InlineData("POST", "/app/customers/42")]
        [InlineData("PUT", "/app/customers/42")]
        [InlineData("POST", "/app/index.html")]
        [InlineData("PUT", "/app/sw.js")]
        public async Task NonRetrievalRequests_DoNotReceiveGeneratedContent(string method, string path) {
            await using var host = await HostingApplication.StartAsync();

            using var response = await host.Client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path), TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.DoesNotContain("xshell:app.basePath", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Fact]
        public async Task ServiceWorker_UsesConfiguredXShellBasePath() {
            await using var host = await HostingApplication.StartAsync(xshellBasePath: "/custom/xshell");

            using var response = await host.Client.GetAsync("/app/sw.js", TestContext.Current.CancellationToken);
            var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("application/javascript", response.Content.Headers.ContentType?.MediaType);
            Assert.Contains("importScripts(\"/custom/xshell/sw.js\")", body);
            Assert.DoesNotContain("<!DOCTYPE html>", body, StringComparison.OrdinalIgnoreCase);
        }
        [Theory]
        [InlineData("/_resources/DProjects.XShell")]
        [InlineData("/app/_resources/DProjects.XShell")]
        public async Task ResourceNamespace_ServesResourceWithoutClaimingAppIndex(string resourcesBasePath) {
            await using var host = await HostingApplication.StartAsync(resourcesBasePath: resourcesBasePath);

            using var response = await host.Client.GetAsync(resourcesBasePath + "/xshell/bootstrap.js",
                TestContext.Current.CancellationToken);
            using var index = await host.Client.GetAsync("/app/index.html", TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(response.Content.Headers.ContentType?.MediaType is "text/javascript" or "application/javascript");
            AssertBootstrap(index, await index.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Theory]
        [InlineData("")]
        [InlineData("resources")]
        [InlineData("/")]
        public async Task InvalidResourcesBasePath_IsRejected(string resourcesBasePath) {
            var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
                HostingApplication.StartAsync(resourcesBasePath: resourcesBasePath));

            Assert.Contains("XShell Resources.BasePath must be a non-empty rooted request path starting with '/'.", exception.Message);
        }
        [Fact]
        public async Task TempRequest_IsHandledBeforeAppBaseRedirect() {
            await using var host = await HostingApplication.StartAsync();

            using var response = await host.Client.GetAsync("/temp/missing", TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Null(response.Headers.Location);
        }
        [Fact]
        public async Task RegisteredEndpoint_WinsOverSpaFallback() {
            await using var host = await HostingApplication.StartAsync(configureEndpoints: app => app.MapGet("/app/server", () => "server-response"));

            using var response = await host.Client.GetAsync("/app/server", TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("server-response", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Theory]
        [InlineData("/app/action")]
        [InlineData("/app/index.html")]
        public async Task RegisteredPostEndpoint_ExecutesInsideAppBase(string path) {
            await using var host = await HostingApplication.StartAsync(configureEndpoints: app => app.MapPost(path, () => "posted"));

            using var response = await host.Client.PostAsync(path, null, TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("posted", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            if (path == "/app/index.html") {
                using var get = await host.Client.GetAsync(path, TestContext.Current.CancellationToken);
                AssertBootstrap(get, await get.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            }
        }
        [Fact]
        public async Task RegisteredApiEndpoint_ExecutesUnderUnhandledPrefix() {
            await using var host = await HostingApplication.StartAsync(
                configureEndpoints: app => app.MapGet("/app/api/status", () => "api-response"));

            using var response = await host.Client.GetAsync("/app/api/status", TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("api-response", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Theory]
        [InlineData("/app/api/missing")]
        [InlineData("/app/_internal/missing")]
        public async Task DefaultUnhandledPrefixes_BypassSpaFallback(string path) {
            await using var host = await HostingApplication.StartAsync();

            using var response = await host.Client.GetAsync(path, TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.DoesNotContain("xshell:app.basePath", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Fact]
        public async Task CustomUnhandledPrefix_BypassesSpaFallback() {
            await using var host = await HostingApplication.StartAsync(unhandledPrefixes: ["/server"]);

            using var response = await host.Client.GetAsync("/app/server/missing", TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.DoesNotContain("xshell:app.basePath", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Fact]
        public async Task RequestOutsideAppBase_RedirectsToApp() {
            await using var host = await HostingApplication.StartAsync();

            using var response = await host.Client.GetAsync("/outside", TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
            Assert.Equal("/app/", response.Headers.Location?.OriginalString);
        } 
        [Fact]
        public async Task RootMountedApp_ServesSpaAndPreservesUnhandledPaths() {
            await using var host = await HostingApplication.StartAsync(appBasePath: "");

            using var root = await host.Client.GetAsync("/", TestContext.Current.CancellationToken);
            using var route = await host.Client.GetAsync("/client-route", TestContext.Current.CancellationToken);
            using var api = await host.Client.GetAsync("/api/missing", TestContext.Current.CancellationToken);
            var rootBody = await root.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            var routeBody = await route.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

            AssertBootstrap(root, rootBody);
            AssertBootstrap(route, routeBody);
            Assert.Equal(rootBody, routeBody);
            Assert.Equal(HttpStatusCode.NotFound, api.StatusCode);
            Assert.DoesNotContain("xshell:app.basePath", await api.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Fact]
        public async Task RootMountedApp_PostClientRouteDoesNotReceiveSpaFallback() {
            await using var host = await HostingApplication.StartAsync(appBasePath: "");

            using var response = await host.Client.PostAsync("/client-route", null, TestContext.Current.CancellationToken);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.DoesNotContain("xshell:app.basePath", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        [Fact]
        public async Task Bootstrap_ReflectsHostingConfiguration() {
            await using var host = await HostingApplication.StartAsync(appConfigPath: "/config/root.jsonc", xshellBasePath: "/custom/xshell");

            using var response = await host.Client.GetAsync("/app/index.html", TestContext.Current.CancellationToken);
            var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

            AssertBootstrap(response, body);
            Assert.Matches("name=\"xshell:app.basePath\"\\s+content=\"/app\"", body);
            Assert.Matches("name=\"xshell:app.configPath\"\\s+content=\"/config/root.jsonc\"", body);
            Assert.Matches("name=\"xshell:xshell.environment\"\\s+content=\"Development\"", body);
            Assert.Contains("src=\"/custom/xshell/bootstrap.js\"", body);
        }

        // methods (private)
        private static void AssertBootstrap(HttpResponseMessage response, string body) {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
            Assert.Contains("xshell:app.basePath", body);
            Assert.Contains("/bootstrap.js", body);
        }

        // inner classes
        private sealed class HostingApplication : IAsyncDisposable {

            // vars
            private readonly WebApplication mApp;
            private readonly string mTempPath;

            // props
            public HttpClient Client { get; }

            // ctor
            private HostingApplication(WebApplication app, string tempPath) {
                mApp = app;
                mTempPath = tempPath;
                Client = app.GetTestClient();
            }

            // methods
            public static async Task<HostingApplication> StartAsync(string appBasePath = "/app", string[]? unhandledPrefixes = null, string appConfigPath = "/_resources/DProjects.XShell/x-demo/module.jsonc", string xshellBasePath = "/_resources/DProjects.XShell/xshell", string resourcesBasePath = "/_resources/DProjects.XShell",
                Action<WebApplication>? configureEndpoints = null) {
                var tempPath = Path.Combine(Path.GetTempPath(), "DProjects.XShell.Test", Guid.NewGuid().ToString("N"));
                var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Development" });
                builder.WebHost.UseTestServer();
                var app = builder.Build();
                try {
                    configureEndpoints?.Invoke(app);
                    app.UseXShell(new Extensions.Configuration {
                        
                        App = new Extensions.AppConfig {
                            BasePath = appBasePath,
                            ConfigPath = appConfigPath,
                            Params = new Dictionary<string, string>()
                        },
                        Resources = new Extensions.ResourcesConfig {
                            BasePath = resourcesBasePath,
                            ResourceName = "DProjects.XShell"
                        },
                        Server = new Extensions.ServerConfig {
                            Environment = "Development",
                            UnhandledPrefixes = unhandledPrefixes ?? new Extensions.ServerConfig().UnhandledPrefixes
                        },
                        Temp = new Extensions.TempConfig {
                            Path = tempPath,
                            BasePath = "/temp",
                            ExpirationTime = TimeSpan.FromMinutes(30),
                            FileSizeLimit = 10 * 1024 * 1024
                        },
                        XShell = new Extensions.XShellConfig {
                           BasePath = xshellBasePath
                        },
                    });
                    await app.StartAsync(TestContext.Current.CancellationToken);
                    return new HostingApplication(app, tempPath);
                } catch {
                    await app.DisposeAsync();
                    if (Directory.Exists(tempPath)) Directory.Delete(tempPath, recursive: true);
                    throw;
                }
            }
            public async ValueTask DisposeAsync() {
                Client.Dispose();
                await mApp.DisposeAsync();
                if (Directory.Exists(mTempPath)) Directory.Delete(mTempPath, recursive: true);
            }
        }
    }
}
