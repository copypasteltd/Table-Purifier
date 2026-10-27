"""Explicit offline OCR tool. No business inference or external requests."""
import csv
import hashlib
import io
import json
import pathlib
import re
import subprocess
import sys
from PIL import Image

try:
    request = json.loads(sys.stdin.buffer.read(8193))
    path = pathlib.Path(request["path"])
    language = request["language"]
    if not re.fullmatch(r"(?:chi_sim|chi_tra|eng)(?:\+(?:chi_sim|chi_tra|eng)){0,2}", language):
        raise ValueError()
    Image.MAX_IMAGE_PIXELS = 30_000_000
    with Image.open(path) as image:
        width, height = image.size
        if width * height > 30_000_000 or getattr(image, "n_frames", 1) != 1:
            raise ValueError()
        image.verify()
    # The executable is set by Host; never take an executable/path from customer text.
    command = [request["tesseract"], str(path), "stdout", "-l", language, "tsv"]
    completed = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, timeout=90, check=True)
    if len(completed.stdout) > 5_000_000:
        raise ValueError()
    words = []
    for row in csv.DictReader(io.StringIO(completed.stdout.decode("utf-8")), delimiter="\t"):
        text = row.get("text", "").strip()
        confidence = float(row.get("conf", "-1"))
        if text and confidence >= 0:
            x, y, w, h = (int(row[key]) for key in ("left", "top", "width", "height"))
            if min(x, y, w, h) < 0 or x + w > width or y + h > height:
                raise ValueError()
            words.append({"text": text, "confidence": confidence / 100,
                          "bbox": [x / width, y / height, (x + w) / width, (y + h) / height]})
    text = " ".join(word["text"] for word in words)
    print(json.dumps({"protocol": "P07-OCR-1", "text": text, "words": words,
                      "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                      "confidence": min((w["confidence"] for w in words), default=0)}, ensure_ascii=False))
except Exception:
    print(json.dumps({"error": "OCR_UNAVAILABLE_OR_FAILED"}))
    sys.exit(2)
