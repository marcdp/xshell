using System.Collections;
using System.Collections.Specialized;
using System.Reflection.Metadata.Ecma335;

using DProjects.Commands;
using DProjects.Commands.Attributes;
using DProjects.Factories;
using DProjects.Fs;
using DProjects.Fs.Http;
using DProjects.XShell.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;


namespace DProjects.XShell.Commands {

    [Description("Launch a web server")]
    [Example("DProjects.XShell server --app-base-path /prefix --app-module \"module:x-demo:0.9.0\" --param a=123 --param b=456 --source /prefix/_resources/DProjects.XShell/{module}/index.json", "")]
    public class Server() : ICommand {


        // Arguments
        [Flag('a', "App base path", "")]
        public string AppBasePath { get; init; } = "";
        [Flag('c', "App module", "")]
        public string AppModule { get; init; } = "";
        [Flag('e', "Environment", "")]
        public string Environment { get; init; } = "";
        [Flag('p', "Parameter", "")]
        public Dictionary<string, string> Param { get; init; } = new();
        [Flag('s', "Source", "/_resources/DProjects.XShell/{module}/index.json")]
        public string[] Source { get; init; } = [];
        [Flag('s', "Share connection string", "")]
        public string[] Share { get; init; } = Array.Empty<string>();


        //methods
        public async Task<int> ExecuteAsync(CancellationToken cancellationToken) {

            // builder
            var builder = WebApplication.CreateBuilder();
            builder.Services.AddAuthorization();
            builder.Services.AddFactoryByUrl<IFilesystem>(config => {
                config.AddFactoriesFromAssembly<DProjects.Fs.Assembly>();
            });

            // build app
            var app = builder.Build();

            // use XShell
            app.UseXShell(BuildConfiguration());

            // run app
            await app.RunAsync();

            // return
            return 0;
        }
        internal Extensions.Configuration BuildConfiguration() {

            // derive every resource route from the same selected resource-set name
            return new Extensions.Configuration {
                App = new Extensions.AppConfig {
                    BasePath = AppBasePath,
                    Module = AppModule,
                    Params = Param
                },
                Temp = new Extensions.TempConfig {
                    Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), AppModule.Replace(":","-").Replace("*", "-"), "temp"),
                    BasePath = AppBasePath + "/temp",
                    ExpirationTime = TimeSpan.FromHours(1)
                },
                Sources = Source,
                //XShell = new Extensions.XShellConfig {
                //    BasePath = AppBasePath + "/_resources/" + ResourcesName + "/xshell"
                //},
                Server = new Extensions.ServerConfig {
                    Environment = Environment
                },
                Shares = new Extensions.SharesConfig {
                    BasePath = AppBasePath + "/shares",
                    Shares = Share.Select((connectionString) =>  {
                        var options = DProjects.Utils.StringUtils.DeserializeConnectionString<FilesystemHttpMiddleware.Options>(connectionString);
                        return options;
                    }).ToArray()
                }
            };
        }
    }
}
