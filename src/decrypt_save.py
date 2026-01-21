#!/usr/bin/env python3
"""
Encrypt/decrypt exported save data (src/plugins/crypto.js).

Usage:
  python src/decrypt_save.py decrypt [path/to/save.json] [output.json]
  python src/decrypt_save.py encrypt [path/to/decrypted.json] [output.json]

If no args are provided, the newest .json file in this script's directory
is decrypted to <name>.decrypted.json.
"""

import json
import sys
from base64 import b64decode, b64encode
from hashlib import md5
from pathlib import Path
from secrets import token_bytes

try:
    from Crypto.Cipher import AES
except ImportError as exc:
    raise SystemExit(
        "Missing dependency: pycryptodome. Install with:\n"
        "  pip install pycryptodome\n"
    ) from exc


KEY_STR = "YourEncryptionKe"
KEY = KEY_STR.encode("utf-8")
IV = KEY


def pkcs7_unpad(data: bytes) -> bytes:
    if not data:
        raise ValueError("Empty decrypted payload")
    pad_len = data[-1]
    if pad_len < 1 or pad_len > AES.block_size:
        raise ValueError("Invalid PKCS7 padding length")
    if data[-pad_len:] != bytes([pad_len]) * pad_len:
        raise ValueError("Invalid PKCS7 padding bytes")
    return data[:-pad_len]


def decrypt_payload(payload_b64) -> dict:
    if isinstance(payload_b64, dict):
        return payload_b64
    raw = b64decode(payload_b64)
    if raw.startswith(b"Salted__") and len(raw) >= 16:
        salt = raw[8:16]
        ciphertext = raw[16:]
        key, iv = evp_bytes_to_key(KEY, salt, 32, 16)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(ciphertext)
    else:
        cipher = AES.new(KEY, AES.MODE_CBC, IV)
        decrypted = cipher.decrypt(raw)
    decrypted = pkcs7_unpad(decrypted).decode("utf-8")
    return json.loads(decrypted)


def pkcs7_pad(data: bytes, block_size: int) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len]) * pad_len


def encrypt_payload(payload_obj: dict) -> str:
    plaintext = json.dumps(payload_obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    salt = token_bytes(8)
    key, iv = evp_bytes_to_key(KEY, salt, 32, 16)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    ciphertext = cipher.encrypt(pkcs7_pad(plaintext, AES.block_size))
    out = b"Salted__" + salt + ciphertext
    return b64encode(out).decode("utf-8")


def evp_bytes_to_key(password: bytes, salt: bytes, key_len: int, iv_len: int):
    derived = b""
    prev = b""
    while len(derived) < key_len + iv_len:
        prev = md5(prev + password + salt).digest()
        derived += prev
    return derived[:key_len], derived[key_len : key_len + iv_len]


def find_latest_json(base_dir: Path) -> Path:
    candidates = list(base_dir.glob("*.json"))
    if not candidates:
        raise FileNotFoundError("No .json files found in script directory.")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def main() -> int:
    args = sys.argv[1:]
    base_dir = Path(__file__).resolve().parent

    if not args:
        choice = input("Select mode: 1) decrypt  2) encrypt\nEnter 1 or 2: ").strip()
        if choice == "2":
            mode = "encrypt"
        else:
            mode = "decrypt"
        path = find_latest_json(base_dir)
        output = path.with_name(
            f"{path.stem}.{ 'decrypted' if mode == 'decrypt' else 'encrypted'}.json"
        )
    else:
        mode = args[0].lower()
        if mode not in {"decrypt", "encrypt"}:
            raise SystemExit("Mode must be 'decrypt' or 'encrypt'.")
        path = Path(args[1]) if len(args) >= 2 else find_latest_json(base_dir)
        output = Path(args[2]) if len(args) >= 3 else path.with_name(
            f"{path.stem}.{ 'decrypted' if mode == 'decrypt' else 'encrypted'}.json"
        )

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if mode == "decrypt":
        transformed = {
            "boss": decrypt_payload(data["boss"]),
            "player": decrypt_payload(data["player"]),
        }
    else:
        transformed = {
            "boss": encrypt_payload(data["boss"]),
            "player": encrypt_payload(data["player"]),
        }

    with open(output, "w", encoding="utf-8") as f:
        json.dump(transformed, f, ensure_ascii=False, indent=2)
    print(str(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
