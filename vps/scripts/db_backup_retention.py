#!/usr/bin/env python3
"""Prune only verified daily DB backup triplets, after verifying the new dump."""
import argparse
import hashlib
import json
import re
from pathlib import Path

NAME = re.compile(r"kreator-ai-db-\d{8}T\d{6}Z\.dump\Z")


def regular(path):
    return not path.is_symlink() and path.is_file()


def record(root, dump):
    if not NAME.fullmatch(dump.name) or not regular(dump):
        return None
    meta = root / (dump.name + ".json")
    checksum = root / (dump.name + ".sha256")
    if not regular(meta) or not regular(checksum):
        return None
    try:
        value = json.loads(meta.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            return None
        digest = value.get("sha256", "")
        if (value.get("status") != "restore_verified" or value.get("dump") != dump.name
                or not re.fullmatch(r"[a-f0-9]{64}", digest)
                or value.get("bytes") != dump.stat().st_size
                or checksum.read_text(encoding="ascii").strip() != f"{digest}  {dump.name}"):
            return None
        return value
    except (OSError, ValueError, TypeError):
        return None


def prune(directory, latest, keep=14):
    supplied = Path(directory)
    if not supplied.is_absolute() or supplied.is_symlink():
        raise ValueError("Backup root must be an absolute real directory")
    root = supplied.resolve(strict=True)
    if root != supplied or not root.is_dir() or root == Path(root.anchor):
        raise ValueError("Invalid backup root")
    if keep < 1 or not NAME.fullmatch(latest):
        raise ValueError("Invalid retention or latest filename")
    newest = root / latest
    value = record(root, newest)
    if value is None:
        raise ValueError("No verified new backup; retention refused")
    with newest.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if digest != value["sha256"]:
        raise ValueError("New backup checksum failed; retention refused")
    managed = sorted((p for p in root.iterdir() if record(root, p)), key=lambda p: p.name, reverse=True)
    if not managed or managed[0].name != latest:
        raise ValueError("New backup is not the latest; retention refused")
    removed = []
    for dump in managed[keep:]:
        # Exact regular files only. Never recurse, follow symlinks or touch historical folders.
        paths = [dump, root / (dump.name + ".sha256"), root / (dump.name + ".json")]
        if not all(p.parent == root and regular(p) for p in paths):
            raise ValueError("Backup triplet changed during retention")
        for path in paths:
            path.unlink()
        removed.append(dump.name)
    return {"kept": min(len(managed), keep), "removed": removed, "latest": latest}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory")
    parser.add_argument("latest")
    parser.add_argument("--keep", type=int, default=14)
    args = parser.parse_args()
    print(json.dumps(prune(args.directory, args.latest, args.keep)))
