using DProjects.Factories;

namespace DProjects.XShell {

    public class Assembly : IAssembly {

        // vars
        public static System.Reflection.Assembly Instance = typeof(Assembly).Assembly;
    }

}
