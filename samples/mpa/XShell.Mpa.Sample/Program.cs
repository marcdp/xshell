using Microsoft.Extensions.FileProviders;

using XShell.Mpa;
using XShell.Mpa.Sample.Module1;

namespace XShell.Mpa.Sample { 

    public class Program {

        // main
        public static async Task Main(string[] args) {

            // Add services to the container.
            var builder = WebApplication.CreateBuilder(args);
            builder.Services.AddRazorComponents();
            //builder.Services.AddRazorPages();// to allow razor pages (.cshtml) to be served
            builder.Services.AddControllers();

            //builder.Services.AddModuleA();
            //var assembly = typeof(Module1Extensions).Assembly;
            //builder.Services.AddControllersWithViews().AddApplicationPart(assembly);


            // Build app
            var app = builder.Build();
            if (!app.Environment.IsDevelopment()) {
                app.UseExceptionHandler("/Error");
                app.UseHsts();
            }
            app.UseHttpsRedirection();
            app.UseStaticFiles();
            app.MapControllers();
            app.UseAntiforgery();
            app.MapRazorComponents<App>().AddAdditionalAssemblies(
                typeof(XShell.Mpa.Sample.Module1.Module1Extensions).Assembly,
                typeof(XShell.Mpa.Sample.Module2.Module2Extensions).Assembly
            );
            //app.MapRazorPages();

            // Run
            await app.RunAsync();
        }

    }
}
