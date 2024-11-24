using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.FileProviders;

namespace XShell.Mpa { 

    public static class XShellExtensions {
        public static IApplicationBuilder UseXShell(this IApplicationBuilder app) {
            
            // add middleware to acces src folder
            app.UseStaticFiles(new StaticFileOptions() {
                FileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "src")),
                RequestPath = "/src"
            });

            // return
            return app;
        }

    }
}