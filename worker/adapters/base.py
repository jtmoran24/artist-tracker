from dataclasses import dataclass
from typing import Optional


@dataclass
class CheckResult:
    success: bool
    content_hash: Optional[str] = None
    raw_snapshot: Optional[str] = None
    error_message: Optional[str] = None
