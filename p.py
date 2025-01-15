#!/usr/bin/env python3
from dprojectstools.commands import command, CommandsManager
from dprojectstools.secrets import SecretsManager
from dprojectstools.git import GitManager
import sys

# ***************
# **  Secrets  **
# ***************
secrets = SecretsManager("cett")

# ***************
# **  Execute  **
# ***************
commandsManager = CommandsManager()
commandsManager.register(GitManager())
commandsManager.execute(sys.argv)
