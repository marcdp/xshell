using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.Extensions.DependencyInjection;

namespace XShell.Mpa.Sample.Module1
{
    public static class Module1Extensions
    {
        public static void AddModuleA(this IServiceCollection services)
        {
            //services.AddScoped<IModuleAService, ModuleAService>();

            var assembly = typeof(Module1Extensions).Assembly;
            // This creates an AssemblyPart, but does not create any related parts for items such as views.
            var part = new AssemblyPart(assembly);
            //services.AddControllersWithViews().ConfigureApplicationPartManager(apm => apm.ApplicationParts.Add(part));
            services.AddControllersWithViews().AddApplicationPart(assembly);
        }
    }
}
