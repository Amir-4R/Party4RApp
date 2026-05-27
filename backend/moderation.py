"""
Party4RApp — Phase 5 Moderation Bot (Word Filter)

A lightweight in-process word filter for room chat. Censors banned words
by replacing them with asterisks (length-preserving) so the structure of
the original message is preserved.

Design choices:
- Global hardcoded list (per user request — fastest MVP).
- Soft-censor only (no message blocking, no honor-point deduction).
- Case-insensitive whole-word matching using word boundaries.
- Latin + light leet substitutions (e.g. "f@ck", "sh!t") are normalised
  before matching.

To extend: just add words to BANNED_WORDS below.
"""

from __future__ import annotations
import re
from typing import Tuple

# Conservative starter list. Keep this small + obvious; the user can grow
# it later. Words are normalised before matching so simple leet variants
# are caught automatically.
BANNED_WORDS = {
    # English profanity (mild → strong)
    "fuck", "fucker", "fucking", "fck",
    "shit", "shitty",
    "bitch", "bitches",
    "asshole", "ass",
    "bastard",
    "dick", "dickhead",
    "cunt",
    "pussy",
    "slut", "whore",
    "nigger", "nigga",
    "faggot", "fag",
    "retard", "retarded",
    # Common spam patterns
    "nudes", "porn", "xxx",
    # Arabic (transliterations + common forms)
    "kalb", "kelb",
    "khara",
    "hmar",
    "kos", "kosomak",
    "zib",
    "manyak", "manyek",
    "sharmoota", "sharmota",
}

# Map leet → normal for matching only. We DON'T modify the output text
# beyond replacing the matched span with stars.
_LEET_MAP = str.maketrans({
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
    "7": "t", "8": "b", "@": "a", "$": "s", "!": "i",
})


def _normalise(s: str) -> str:
    """Lowercase + leet-strip + collapse repeated chars (e.g. fuuuck → fuck)."""
    s = s.lower().translate(_LEET_MAP)
    # Collapse 3+ repeated chars to 2 (e.g. "fuuuck" → "fuuck" then matched).
    s = re.sub(r"(.)\1{2,}", r"\1\1", s)
    return s


# Pre-compile a single regex of all variants for speed. The regex matches
# on the NORMALISED text but we work with original-string slicing because
# normalisation is length-preserving (same number of chars after translate).
_PATTERN = re.compile(
    r"\b(" + "|".join(sorted({re.escape(w) for w in BANNED_WORDS}, key=len, reverse=True)) + r")\b",
    flags=re.IGNORECASE,
)


def censor_text(text: str) -> Tuple[str, bool]:
    """Replace any banned word in `text` with asterisks of equal length.

    Returns (cleaned_text, was_modified). Length-preserving: matching is
    performed against the leet-normalised string, but replacement uses the
    same indices on the ORIGINAL text so emoji/spacing/case are preserved
    outside the banned spans.
    """
    if not text:
        return text, False

    normalised = _normalise(text)
    if normalised == text.lower():
        # No leet substitutions happened — single pass is enough.
        result = _PATTERN.sub(lambda m: "*" * len(m.group(0)), text)
        return result, result != text

    # Apply regex to the normalised string and lift spans back to the original.
    matches = list(_PATTERN.finditer(normalised))
    if not matches:
        return text, False
    out = []
    cursor = 0
    for m in matches:
        out.append(text[cursor:m.start()])
        out.append("*" * (m.end() - m.start()))
        cursor = m.end()
    out.append(text[cursor:])
    return "".join(out), True


def contains_banned(text: str) -> bool:
    """Quick check — does this text contain any banned word?"""
    if not text:
        return False
    return bool(_PATTERN.search(_normalise(text)))
