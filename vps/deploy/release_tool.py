#!/usr/bin/env python3
"""Validate a deployment before root extraction: no secrets, traversal or links."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tarfile

SHA = re.compile(r"[a-f0-9]{40}\Z")


def allowed(name):
    path = PurePosixPath(name)
    if (not name or name.startswith("/") or "\\" in name or ".." in path.parts
            or str(path) != name.rstrip("/") or any(ord(c) < 32 for c in name)):
        return False
    for part in path.parts:
        low = part.lower()
        if (low == ".env" or low.startswith(".env.") or low in {".ssh", ".git", "node_modules"}
                or low.startswith(("id_rsa", "id_ed25519")) or low.endswith((".pem", ".key", ".pfx", ".p12"))):
            return False
    if str(path) in {"release.json", "vps/docker-compose.yml", "vps/apache/seo-routes.conf"}:
        return True
    if path.parts[0] == "dist":
        return True
    if path.parts[:2] == ("vps", "server"):
        tail = path.parts[2:]
        return not tail or tail[0] in {"src", "test", "package.json", "package-lock.json", "tsconfig.json", "Dockerfile", ".dockerignore"}
    return str(path) in {"vps", "vps/apache"}


def extract(archive, destination, commit):
    if not SHA.fullmatch(commit):
        raise ValueError("Invalid release commit")
    target = Path(destination)
    if target.is_symlink() or not target.is_dir() or any(target.iterdir()):
        raise ValueError("Extraction needs an empty real directory")
    with tarfile.open(archive, "r:gz") as source:
        members, seen, size = source.getmembers(), set(), 0
        for member in members:
            name = member.name.rstrip("/")
            if not allowed(member.name) or name in seen or not (member.isfile() or member.isdir()):
                raise ValueError(f"Unsafe or duplicate archive entry: {member.name!r}")
            seen.add(name)
            size += member.size
            if size > 2 * 1024**3 or len(seen) > 30000:
                raise ValueError("Release archive exceeds limits")
        required = {"release.json", "dist/index.html", "vps/server/Dockerfile", "vps/server/package.json", "vps/server/package-lock.json", "vps/server/tsconfig.json", "vps/docker-compose.yml", "vps/apache/seo-routes.conf"}
        if not required <= seen or not any(p.startswith("dist/assets/") for p in seen) or not any(p.startswith("dist/_seo/") for p in seen):
            raise ValueError("Incomplete release package")
        info = json.load(source.extractfile("release.json"))
        if info.get("format") != 1 or info.get("commit") != commit:
            raise ValueError("Release manifest does not match the requested commit")
        # Only ordinary, validated files and directories; ignore archive owners,
        # permissions, devices and link targets. Never use extractall as root.
        for member in members:
            output = target / member.name
            if member.isdir():
                output.mkdir(parents=True, exist_ok=True)
            else:
                output.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as data, output.open("xb") as dest:
                    while block := data.read(1024 * 1024):
                        dest.write(block)
                output.chmod(0o600)
        return info


def verify_checksum(archive, checksum):
    expected = Path(checksum).read_text(encoding="ascii").split()
    if len(expected) != 2 or not re.fullmatch(r"[a-f0-9]{64}", expected[0]) or expected[1] != Path(archive).name:
        raise ValueError("Invalid release checksum file")
    with open(archive, "rb") as source:
        actual = hashlib.file_digest(source, "sha256").hexdigest()
    if actual != expected[0]:
        raise ValueError("Release checksum mismatch")


def verify_compose(value):
    services = value["services"]
    for service, target, published in [("api", 3000, "3101"), ("postgres", 5432, "5432"), ("redis", 6379, "6379")]:
        ports = services[service]["ports"]
        if len(ports) != 1 or ports[0].get("host_ip") != "127.0.0.1" or int(ports[0]["target"]) != target or str(ports[0]["published"]) != published:
            raise ValueError(f"Unsafe published port for {service}")
    if services["postgres"]["image"] != "postgres:16-alpine" or services["redis"]["image"] != "redis:7-alpine":
        raise ValueError("A major database version change requires a separate migration")


if __name__ == "__main__":
    import sys
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["extract", "compose"])
    parser.add_argument("arguments", nargs="*")
    args = parser.parse_args()
    try:
        if args.operation == "compose":
            verify_compose(json.load(sys.stdin))
            print("Compose ports and database major versions verified")
        else:
            archive, checksum, destination, commit = args.arguments
            verify_checksum(archive, checksum)
            extract(archive, destination, commit)
            print(f"Release {commit} verified and extracted without secrets or links")
    except (ValueError, KeyError, OSError, tarfile.TarError) as error:
        parser.exit(1, f"Release validation failed: {error}\n")
