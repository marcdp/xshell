#!/usr/bin/env python3
from dprojectstools.commands import command, CommandsManager
from dprojectstools.git import GitManager
from scripts.package import package_xshell, package_module, package_app
from scripts.webserver_dev import webserver_dev
import sys



# **************
# ** Pacakge   **
# **************
@command("Webserver", index=10)
def webserver():
    webserver_dev()
    

# **************
# ** Package  **
# **************
@command("Package all", index=20)
def package():
    package_xshell("./src/xshell")
    package_module("./src/modules/x")
    package_module("./src/modules/x-man")
    package_module("./samples/sample1/modules/module1")
    package_module("./samples/sample1/modules/module2")
    package_app("./samples/sample1")

# ***************
# **  Execute  **
# ***************
commandsManager = CommandsManager()
commandsManager.register()
commandsManager.register(GitManager())
commandsManager.execute(sys.argv)
