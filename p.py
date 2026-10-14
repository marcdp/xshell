#!/usr/bin/env python3
from dprojectstools.commands import command, CommandsManager
from dprojectstools.git import GitManager
import sys


# ***************
# **  Execute  **
# ***************
commandsManager = CommandsManager()
commandsManager.register()
commandsManager.register(GitManager())
commandsManager.execute(sys.argv)
