"""Put the repository root on sys.path so `pipeline.voice` imports under any pytest invocation."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
