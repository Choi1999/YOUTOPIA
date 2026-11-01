"""Shared deployment image identity; reading it never starts a container."""
from pathlib import Path
import re

def image_from_compose(path):
    matches = re.findall(r'^\s+image:\s+(\S+)\s*$', Path(path).read_text(), re.M)
    if len(matches) != 1 or not re.fullmatch(r'[^\s@]+/redis:[0-9]+\.[0-9]+\.[0-9]+-[A-Za-z0-9_.-]+@sha256:[0-9a-f]{64}', matches[0]):
        raise ValueError('Exactly one explicit Redis version and sha256 digest required')
    return matches[0]

def image_version(image):
    return re.search(r'/redis:([0-9]+\.[0-9]+\.[0-9]+)-', image).group(1)

def deployment_image():
    return image_from_compose(Path(__file__).with_name('compose.yaml'))
