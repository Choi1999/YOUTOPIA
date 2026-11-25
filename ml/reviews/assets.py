"""Explicit, pinned KcELECTRA import. Training/prediction themselves stay offline."""
import shutil
from pathlib import Path
from .common import file_hash, seal, verify

REPO = 'beomi/KcELECTRA-base'
REVISION = '4cf9eb1dfeec0a672afe73059882fc998a299ceb'
BIN_SHA256 = '3460bb4187cdda4fbc6c8d7dfb97779e43660a86091dc9d1f01810eb5264fe53'
PINNED_FILES = {
    'config.json': 'c3d48da6aaea31eb6c52fe32edcabc3f62c92dd732c9ca7a0eb6271045ea52e7',
    'special_tokens_map.json': 'b3383b8739ae890383a6ed9ad871e592cc14d5b0c36ffdb9d3be6e416256640a',
    'tokenizer_config.json': 'b770f7717e85783b4dfaa813290901d35adf9babcbfe425f9b5ffff9973de99f',
    'vocab.txt': 'e58e7e071b2b7225c5682767b3ae0968cac65ca52262b0e0f957b07828c086ce',
}


def import_base(source, destination):
    """Accept only the original pinned .bin hash; output uses safetensors exclusively.

    This explicit operator command is never invoked during training or startup.
    Requires patched PyTorch; never loads an arbitrary pickle received from users.
    """
    import torch
    from packaging.version import Version
    from transformers import AutoModel, AutoTokenizer
    if Version(torch.__version__.split('+')[0]) < Version('2.15.0'):
        raise ValueError('PATCHED_TORCH_2_15_REQUIRED_FOR_LEGACY_IMPORT')
    source = Path(source)
    for name, expected in PINNED_FILES.items():
        if file_hash(source / name) != expected:
            raise ValueError('PINNED_BASE_CONFIG_OR_TOKENIZER_HASH_MISMATCH')
    if any((source / name).exists() for name in ('tokenizer.json', 'added_tokens.json')):
        raise ValueError('UNPINNED_TOKENIZER_OVERRIDE')
    if file_hash(source / 'pytorch_model.bin') != BIN_SHA256:
        raise ValueError('PINNED_BASE_WEIGHT_HASH_MISMATCH')
    # Never copy/execute repository Python code. Config is constrained to ELECTRA.
    from .common import read
    config = read(source / 'config.json')
    if config.get('model_type') != 'electra' or config.get('auto_map'):
        raise ValueError('UNSUPPORTED_BASE_CONFIG')
    tokenizer = AutoTokenizer.from_pretrained(source, local_files_only=True, trust_remote_code=False)
    model = AutoModel.from_pretrained(source, local_files_only=True, trust_remote_code=False,
                                     use_safetensors=False, weights_only=True)
    target = Path(destination)
    target.mkdir(parents=True, exist_ok=False)
    model.save_pretrained(target, safe_serialization=True)
    tokenizer.save_pretrained(target)
    if (source / 'LICENSE').is_file():
        shutil.copyfile(source / 'LICENSE', target / 'LICENSE')
    seal(target, {'repo': REPO, 'revision': REVISION, 'source_weight_sha256': BIN_SHA256,
                  'source_config_tokenizer_sha256': PINNED_FILES,
                  'synthetic': False, 'import_torch': torch.__version__})
    verify(target)
