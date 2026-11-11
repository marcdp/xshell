"""Read-only interoperability oracle using an explicitly supplied Python XVault checkout."""
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
root = Path(os.environ["XVAULT_PYTHON_REPO"]).resolve()
sys.path.insert(0, str(root / "src"))

from xvault.crypto.v1 import CryptoV1
from xvault.crypto.v2 import CryptoV2
from xvault.meta import XVaultMeta
from xvault.handlers import HandlerEnv, HandlerJson, HandlerJsonc, HandlerYaml, HandlerMd, HandlerOvpn

handlers = {"env": HandlerEnv, "json": HandlerJson, "jsonc": HandlerJsonc, "yaml": HandlerYaml, "markdown": HandlerMd, "ovpn": HandlerOvpn}


def tokens(handler, text, transform):
    values = []

    def replace(value):
        wrapped = value.startswith("${") and value.endswith("}")
        value = value[6:-1] if wrapped else value[4:]
        transformed = transform(value)
        values.append(transformed)
        # avoid interpreting replacement contents again during the handler's second pass
        return f"__processed_{len(values) - 1}__"

    marked = handler.replace_enc_tokens(text, replace)
    return marked, values


request = json.load(sys.stdin)
results = []
for record in request:
    handler = handlers[record["format"]]()
    if record["operation"] == "encrypt":
        version = record["version"]
        meta = XVaultMeta(1, version, "00112233445566778899aabbccddeeff", metadata_present=False)
        cipher = (CryptoV1 if version == 1 else CryptoV2)(meta, password=record["password"])
        if version == 1:
            meta.check = cipher.encrypt("xvault")
        cipher.get_cacheable_key()
        marked, values = tokens(handler, record["text"], cipher.encrypt)
        original = []
        handler.replace_enc_tokens(record["text"], lambda value: original.append(value) or f"__processed_{len(original) - 1}__")
        for index, value in enumerate(values):
            value = "enc:" + value
            if original[index].startswith("${"):
                value = "${" + value + "}"
            marked = marked.replace(f"__processed_{index}__", value)
        results.append(handler.stringify(meta, marked))
    else:
        meta, text = handler.parse(record["text"])
        cipher = (CryptoV1 if meta.crypto_version == 1 else CryptoV2)(meta, password=record["password"])
        cipher.validate_password()
        _, values = tokens(handler, text, cipher.decrypt)
        results.append({"metadata": meta.to_dict(), "values": values})
json.dump(results, sys.stdout, ensure_ascii=True)
