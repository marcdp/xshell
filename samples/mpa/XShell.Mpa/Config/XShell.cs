using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.FileProviders;

namespace XShell.Mpa.Config {

    // App
    public class App {
        public string Name { get; set; } = "";
        public string Title { get; set; } = "";
        public string Version { get; set; } = "";
        public string CopyRight { get; set; } = "";
        public string Logo { get; set; } = "";
    }

    // I18n
    public class I18nLang {
        public string Id { get; set; } = "";
        public string Label { get; set; } = "";
        public bool Main { get; set; } = false;
    }
    public class I18nLangs {
        public I18nLang[] All { get; set; } = [
            new() { Id = "en", Label = "English", Main = true },
            new() { Id = "es", Label = "Spanish" },
            new() { Id = "fr", Label = "French" },
            new() { Id = "de", Label = "German" }
        ];
    }
    public class I18n {
        string Current { get; set; } = "";
        I18nLangs Langs { get; set; } = new();       
    }

    // loader
    public class LoaderDefinitionWith {
        public string Type{ get; set; } = "";
    }
    public class LoaderDefinition {
        public string Resource { get; set; } = "";
        public string Src { get; set; } = "";
        public LoaderDefinitionWith? With { get; set; }
    }
    public class Loader {
        public LoaderDefinition[] Map { get; set; } = [];
    }

    // menuitem
    public class Menuitem {
        public string Label { get; set; } = "";
        public string? Icon { get; set; }
        public string? Href { get; set; }
        public Menuitem[]? Children { get; set; }
    }

    // module
    public class Module {
        string Name { get; set; } = "";
        string Title { get; set; } = "";
        string Version { get; set; } = "";
        string? Url { get; set; }
    }

    // navigator
    public class Navigator {
        public string Base { get; set; } = ".";
        public string Start {get; set;} = "/index.html";
    }

    // settings
    public class Settings {
        public string Prefix { get; set; } = "settings-";
    }

    // user
    public class User {
        public string Id { get; set; } = "";
        public string Username { get; set; } = "";
        public bool Authenticated { get; set; } = false;
        public Dictionary<string,string> Claims { get; set; } = [];
    }

    // xshell
    public class XShell {
        public App App { get; set; } = new();
        public I18n I18n { get; set; } = new();
        public Loader Loader { get; set; } = new();
        public Dictionary<string, Menuitem[]> Menus { get; set; } = new();
        public Module[] Mobules { get; set; } = [];
        public Navigator Navigator { get; set; } = new();
        public Settings Settings { get; set; } = new();
        public User User { get; set; } = new();
    }

}