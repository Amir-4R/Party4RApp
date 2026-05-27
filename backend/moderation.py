"""
Party4RApp — Phase 5 Moderation Bot (Word Filter)

Soft-censor only: replace banned words with asterisks of equal length so the
message structure is preserved. Room chat only (DMs not filtered per user
choice).

Design:
- Global hardcoded BANNED_WORDS list — easy to extend.
- For each banned word we build a regex that:
    * Accepts each letter as a character class including common LEET
      substitutions (e.g. "f@ck", "sh!t", "n!gger").
    * Accepts character repetition with `+` (so "fuuuck" still matches).
    * Uses lookaround word boundaries that ignore non-letter symbols, so
      "f@ck" is still treated as a single word even though "@" is non-word.
- Match runs against the ORIGINAL text (no normalisation pre-pass), so the
  matched span is always length-correct for the asterisk replacement.

Public API:
    censor_text(text)  -> (cleaned, was_modified)
    contains_banned(text) -> bool
"""

from __future__ import annotations
import re
from typing import Tuple

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
    # Arabic transliterations / common forms
    "kalb", "kelb",
    "khara",
    "hmar",
    "kos", "kosomak",
    "zib",
    "manyak", "manyek",
    "sharmoota", "sharmota",
}

# Per-letter leet alternative table. Case-insensitive matching is handled
# by the regex flag, so we only list lowercase variants in the char classes.
_LEET = {
    "a": "a@4",
    "b": "b8",
    "c": "c(",
    "d": "d",
    "e": "e3",
    "f": "f",
    "g": "g9",
    "h": "h",
    "i": "i1!|",
    "j": "j",
    "k": "k",
    "l": "l1|",
    "m": "m",
    "n": "n",
    "o": "o0",
    "p": "p",
    "q": "q",
    "r": "r",
    "s": "s$5",
    "t": "t7+",
    "u": "u@",   # Common: "f@ck" — '@' often substitutes for 'u'.
    "v": "v",
    "w": "w",
    "x": "x",
    "y": "y",
    "z": "z2",
}


def _word_to_pattern(word: str) -> str:
    """Compile one banned word into a tolerant regex fragment.

    For each char we emit `[alts]+` (so repeated chars like "fuuuuck" still
    match). We surround the whole thing with lookarounds that treat any
    non-alphanumeric char (including space, punctuation, emoji) as a boundary
    — `\\b` alone won't work because some leet substitutions like "@" are
    themselves non-word characters.
    """
    chunks = []
    for ch in word.lower():
        alts = _LEET.get(ch, ch)
        # Use re.escape on each alt char individually (handles `|`, `+`, `(`).
        cls = "".join(re.escape(c) for c in alts)
        chunks.append(f"[{cls}]+")
    body = "".join(chunks)
    return rf"(?<![A-Za-z0-9]){body}(?![A-Za-z0-9])"


_PATTERN = re.compile(
    "(?:" + "|".join(
        _word_to_pattern(w) for w in sorted(BANNED_WORDS, key=len, reverse=True)
    ) + ")",
    flags=re.IGNORECASE,
)


def censor_text(text: str) -> Tuple[str, bool]:
    """Replace any banned word in `text` with asterisks of equal length.

    Returns (cleaned_text, was_modified).
    """
    if not text:
        return text, False
    cleaned = _PATTERN.sub(lambda m: "*" * len(m.group(0)), text)
    return cleaned, cleaned != text


def contains_banned(text: str) -> bool:
    """Quick check — does this text contain any banned word?"""
    if not text:
        return False
    return bool(_PATTERN.search(text))
