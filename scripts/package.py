import json5
import json
import os
import re
import zipfile
import tempfile
import hashlib
import shutil
from typing import List

# utils
def get_manifest_path(path:str):
    # get manifest path
    filenames = [
        "index.json", "index.jsonc",
        "app.json", "app.jsonc",
        "module.json", "module.jsonc",
        "xshell.json", "xshell.jsonc"
    ]
    for name in filenames:
        full_path = os.path.join(path, name)
        if os.path.isfile(full_path):
            return full_path
    return None
def load_manifest(path:str):
    with open(path, "r", encoding="utf-8-sig") as f:
        return json5.load(f)
def save_manifest(manifest:dict, path:str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
def create_temp_filename(suffix="", prefix="tmp", dir=None, delete=False):
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, prefix=prefix, dir=dir, delete=delete)
    return tmp.name    
def compute_file_hash(file_path, algorithm='sha256', chunk_size=8192):
    hash_func = getattr(hashlib, algorithm)()
    with open(file_path, 'rb') as f:
        while chunk := f.read(chunk_size):
            hash_func.update(chunk)

    return hash_func.hexdigest()
def zip_directory(folder_path, output_zip_path, exclude_patterns: List[str] = None):
    if exclude_patterns is None:
        exclude_patterns = []
    with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(folder_path):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, folder_path)
                # Exclude files matching any pattern
                if any(p in rel_path for p in exclude_patterns):
                    continue
                zipf.write(full_path, arcname=rel_path)
def archive(archive_method:str, src:str, dst:str, exclude_patterns:List[str]):
    if archive_method == "zip":
        zip_directory(
            folder_path=src,
            output_zip_path=dst,
            exclude_patterns=exclude_patterns
        )

# main methods
def package_module(src:str, dst:str = "./docs/cdn", archive_method: str = "zip"):
    print("Packaging module: ", src)
    # load manifest
    manifest_path = get_manifest_path(src)
    manifest = load_manifest(manifest_path)
    # meta
    name = manifest.get("name")
    version = manifest.get("version")
    # creates temp dir
    temp_zip_filename = create_temp_filename()
    # create a zip
    archive(archive_method, src, temp_zip_filename, [])
    # hash
    hash = compute_file_hash(temp_zip_filename)[:8]
    # dst 
    dst_path = dst + "/modules/" + name + "/" + version + "+" + hash
    # mkdir
    os.makedirs(dst_path, exist_ok=True)
    # edit manifest
    manifest["bundle.type"] = "zip"
    manifest["bundle.src"] =  "/module.zip"
    manifest["bundle.hash"] = hash
    # save
    save_manifest(manifest, dst_path + "/module.json")
    shutil.move(temp_zip_filename, dst_path + "/module.zip")


def package_xshell(src:str, dst:str = "./docs/cdn", archive_method: str = "zip"):
    print("Packaging xshell: ", src)
    # load manifest
    manifest_path = get_manifest_path(src)
    manifest = load_manifest(manifest_path)
    # meta
    version = manifest.get("xshell.version")
    # creates temp dir
    temp_zip_filename = create_temp_filename()
    # create a zip
    archive(archive_method, src, temp_zip_filename, [])
    # hash
    hash = compute_file_hash(temp_zip_filename)[:8]
    # dst 
    dst_path = dst + "/xshell/" + version + "+" + hash
    # mkdir
    os.makedirs(dst_path, exist_ok=True)
    # edit manifest
    manifest["bundle.type"] = "zip"
    manifest["bundle.src"] =  "/xshell.zip"
    manifest["bundle.hash"] = hash
    # save
    save_manifest(manifest, dst_path + "/xshell.json")
    shutil.move(temp_zip_filename, dst_path + "/xshell.zip")
    # files to extract
    for filename in ["/bootstrap.js", "/sw.js"]:
        shutil.copy(src + filename, dst_path + filename)


def package_app(src:str, dst:str = "./docs/cdn", archive_method: str = "zip"):
    print("Packaging app: ", src)
    # load manifest
    manifest_path = get_manifest_path(src)
    manifest = load_manifest(manifest_path)
    # meta
    version = manifest.get("xshell.version")
    # creates temp dir
    #temp_zip_filename = create_temp_filename()
    ## create a zip
    #archive(archive_method, src, temp_zip_filename, [])
    ## hash
    #hash = compute_file_hash(temp_zip_filename)[:8]
    ## dst 
    #dst_path = dst + "/xshell/" + version + "+" + hash
    ## mkdir
    #os.makedirs(dst_path, exist_ok=True)
    ## edit manifest
    #manifest["bundle.type"] = "zip"
    #manifest["bundle.src"] =  "/xshell.zip"
    #manifest["bundle.hash"] = hash
    ## save
    #save_manifest(manifest, dst_path + "/xshell.json")
    #shutil.move(temp_zip_filename, dst_path + "/xshell.zip")
    ## files to extract