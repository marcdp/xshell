
using System.Text;

using DProjects.Utils;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

namespace DProjects.XShell.Middlewares {
    internal sealed class ResourcesMiddleware {


        // fields
        private readonly RequestDelegate mPipeline;


        // ctor
        public ResourcesMiddleware(RequestDelegate next, IServiceProvider services, string physicalPath, string requestPath, bool isDevelopment) {
            physicalPath = Path.GetFullPath(physicalPath);
            requestPath = requestPath.TrimEnd('/');
            if (!Directory.Exists(physicalPath)) {
                throw new DirectoryNotFoundException($"Resources directory not found: {physicalPath}");
            }
            var fileProvider = new PhysicalFileProvider(physicalPath);

            // content types
            var contentTypeProvider = new FileExtensionContentTypeProvider();
            contentTypeProvider.Mappings[".jsonc"] = "application/json";
            contentTypeProvider.Mappings[".md"] = "text/markdown";

            // create inner middleware pipeline
            var app = new ApplicationBuilder(services);

            // serve self-contained generated descriptors during development
            if (isDevelopment) {
                app.Use(async (context, nextMiddleware) => {
                    if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)) {
                        await nextMiddleware();
                        return;
                    }
                    if (!context.Request.Path.StartsWithSegments(requestPath, out var remaining)) {
                        await nextMiddleware();
                        return;
                    }
                    var relativePath = remaining.Value ?? "";
                    if (!TryGetDescriptorKind(relativePath, out var descriptorKind)) {
                        await nextMiddleware();
                        return;
                    }

                    // resolve the requested descriptor directory without allowing traversal outside the resource root
                    var relativeFile = relativePath.TrimStart('/');
                    var requestedFile = Path.GetFullPath(Path.Combine(physicalPath, relativeFile.Replace('/', Path.DirectorySeparatorChar)));
                    var directory = Path.GetDirectoryName(requestedFile) ?? "";
                    if (!IsInside(directory, physicalPath)) {
                        context.Response.StatusCode = StatusCodes.Status404NotFound;
                        return;
                    }
                    if (!Directory.Exists(directory)) {
                        context.Response.StatusCode = StatusCodes.Status404NotFound;
                        return;
                    }

                    // use exactly one authored JSON or JSONC representation for either request extension
                    var descriptorPath = FindDescriptor(directory);
                    if (descriptorPath == null) {
                        await nextMiddleware();
                        return;
                    }
                    var json = await new Services.DescriptorInventory().CreateJsonAsync(descriptorPath, descriptorKind, context.RequestAborted);
                    var bytes = Encoding.UTF8.GetBytes(json);

                    // return strict generated JSON for both JSON and JSONC request URLs
                    SetNoCacheHeaders(context.Response);
                    context.Response.ContentType = "application/json";
                    context.Response.ContentLength = bytes.Length;
                    if (!HttpMethods.IsHead(context.Request.Method)) await context.Response.Body.WriteAsync(bytes, context.RequestAborted);
                });
            }

            // compile module resources during development
            if (isDevelopment) {
                app.Use(async (context, nextMiddleware) => {
                    if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)) {
                        await nextMiddleware();
                        return;
                    }
                    if (!context.Request.Path.StartsWithSegments(requestPath, out var remaining)) {
                        await nextMiddleware();
                        return;
                    }
                    var relativePath = remaining.Value ?? "";
                    if (!relativePath.EndsWith(".js", StringComparison.OrdinalIgnoreCase) && 
                        !relativePath.EndsWith(".html", StringComparison.OrdinalIgnoreCase) && 
                        !relativePath.EndsWith(".css", StringComparison.OrdinalIgnoreCase)) {
                        await nextMiddleware();
                        return;
                    }
                    // prepare
                    var relativeFile = relativePath.TrimStart('/');
                    var file = Path.GetFullPath(Path.Combine(physicalPath, relativeFile.Replace('/', Path.DirectorySeparatorChar)));
                    var extension = System.IO.Path.GetExtension(file);
                    // prevent path traversal
                    if (!IsInside(file, physicalPath)) {
                        context.Response.StatusCode = StatusCodes.Status404NotFound;
                        return;
                    }
                    if (extension.Equals(".js")) {
                        var htmlFile = Path.ChangeExtension(file, ".html");
                        var jsExists = File.Exists(file);
                        var htmlExists = File.Exists(htmlFile);
                        if (jsExists && htmlExists) {
                            throw new InvalidOperationException($"Conflicting development resources '{file}' and '{htmlFile}' both resolve to '{relativePath}'.");
                        }
                        if (!jsExists && htmlExists) {
                            file = htmlFile;
                        } else if (!jsExists) {
                            context.Response.StatusCode = StatusCodes.Status404NotFound;
                            return;
                        }
                    } else if (extension.Equals(".html")) {
                        context.Response.StatusCode = StatusCodes.Status404NotFound;
                        return;
                    } else if (!File.Exists(file)) {
                        context.Response.StatusCode = StatusCodes.Status404NotFound;
                        return;
                    }
                    // search manifest.json or manifest.jsonc in the file's directory or its parent directories
                    string directory = Path.GetDirectoryName(file) ?? "";
                    string? moduleJson = null;
                    while (!string.IsNullOrEmpty(directory) && IsInside(directory, physicalPath)) {
                        var moduleJsonPath = Path.Combine(directory, Services.ManifestFileNames.Json);
                        var moduleJsoncPath = Path.Combine(directory, Services.ManifestFileNames.Jsonc);
                        if (File.Exists(moduleJsonPath) && File.Exists(moduleJsoncPath)) {
                            throw new InvalidOperationException($"Source '{directory}' contains both manifest.json and manifest.jsonc.");
                        } else if ((File.Exists(moduleJsonPath) || File.Exists(moduleJsoncPath)) &&
                            string.Equals(Path.GetFileName(Path.TrimEndingDirectorySeparator(directory)), "xshell", StringComparison.OrdinalIgnoreCase)) {
                            // Framework resources use the same manifest filename but are not module resources.
                            break;
                        } else if (File.Exists(moduleJsonPath)) {
                            moduleJson = moduleJsonPath;
                            break;
                        } else if (File.Exists(moduleJsoncPath)) {
                            moduleJson = moduleJsoncPath;
                            break;
                        }
                        directory = Path.GetDirectoryName(directory) ?? "";
                    }
                    if (moduleJson == null) {
                        await nextMiddleware();
                        return;
                    }
                    // compile to js
                    Services.ModuleFileCompiler.FileContent fileContent;
                    try {
                        fileContent = await new Services.ModuleFileCompiler().CompileAsync(moduleJson, file, context.RequestAborted);
                    } catch (Exception ex) when (!context.RequestAborted.IsCancellationRequested) {
                        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                        context.Response.ContentType = "text/plain; charset=utf-8";
                        SetNoCacheHeaders(context.Response);
                        await context.Response.WriteAsync(ex.ToString(), context.RequestAborted);
                        return;
                    }
                    //var fileContent = await new Services.ModuleFileCompiler().CompileAsync(moduleJson, file, context.RequestAborted);
                    // return response
                    var bytes = Encoding.UTF8.GetBytes(fileContent.Content);
                    SetNoCacheHeaders(context.Response);
                    context.Response.ContentType = fileContent.ContentType;
                    context.Response.ContentLength = bytes.Length;
                    if (!HttpMethods.IsHead(context.Request.Method)) await context.Response.Body.WriteAsync(bytes, context.RequestAborted);
                });
            }

            // default files
            app.UseDefaultFiles(new DefaultFilesOptions {
                FileProvider = fileProvider,
                RequestPath = requestPath
            });

            // static files
            app.UseStaticFiles(new StaticFileOptions {
                FileProvider = fileProvider,
                RequestPath = requestPath,
                ContentTypeProvider = contentTypeProvider,
                OnPrepareResponse = context => {
                    if (isDevelopment) {
                        SetNoCacheHeaders(context.Context.Response);
                    }
                }
            });

            // continue with outer application pipeline when not handled
            app.Run(next);

            // build inner pipeline
            mPipeline = app.Build();
        }


        // methods
        public Task InvokeAsync(HttpContext context) {
            return mPipeline(context);
        }
        private static string? FindDescriptor(string directory) {
            // reject ambiguous authored descriptors consistently with Pack
            var json = Path.Combine(directory, Services.ManifestFileNames.Json);
            var jsonc = Path.Combine(directory, Services.ManifestFileNames.Jsonc);
            if (File.Exists(json) && File.Exists(jsonc)) {
                throw new InvalidOperationException($"Source '{directory}' contains both manifest.json and manifest.jsonc.");
            }
            return File.Exists(json) ? json : File.Exists(jsonc) ? jsonc : null;
        }
        private static void SetNoCacheHeaders(HttpResponse response) {
            response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
            response.Headers.Pragma = "no-cache";
            response.Headers.Expires = "0";
        }
        private static bool TryGetDescriptorKind(string relativePath, out Services.DescriptorKind kind) {
            // route all descriptor extensions through one enrichment path
            var fileName = relativePath[(relativePath.LastIndexOf('/') + 1)..];
            if (!fileName.Equals(Services.ManifestFileNames.Json, StringComparison.OrdinalIgnoreCase) &&
                !fileName.Equals(Services.ManifestFileNames.Jsonc, StringComparison.OrdinalIgnoreCase)) {
                kind = default;
                return false;
            }
            var segments = relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            kind = segments.Length >= 2 && string.Equals(segments[^2], "xshell", StringComparison.OrdinalIgnoreCase) ?
                Services.DescriptorKind.XShell : Services.DescriptorKind.Module;
            return true;
        }
        private static bool IsInside(string path, string root) {
            var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
            root = Path.GetFullPath(root) .TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            path = Path.GetFullPath(path) .TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            return path.StartsWith(root, comparison);
        }


        
    }
}
