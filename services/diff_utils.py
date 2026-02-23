from difflib import SequenceMatcher


def compute_diff(raw_text: str, formatted_text: str) -> dict:
    source = raw_text or ""
    target = formatted_text or ""
    matcher = SequenceMatcher(a=source.split(), b=target.split())

    tokens = []
    words_added = 0
    words_removed = 0
    words_changed = 0

    for opcode, i1, i2, j1, j2 in matcher.get_opcodes():
        old_chunk = source.split()[i1:i2]
        new_chunk = target.split()[j1:j2]

        if opcode == "equal":
            tokens.append({"type": "equal", "value": " ".join(new_chunk)})
        elif opcode == "insert":
            words_added += len(new_chunk)
            tokens.append({"type": "insert", "value": " ".join(new_chunk)})
        elif opcode == "delete":
            words_removed += len(old_chunk)
            tokens.append({"type": "delete", "value": " ".join(old_chunk)})
        else:
            words_changed += max(len(old_chunk), len(new_chunk))
            if old_chunk:
                tokens.append({"type": "delete", "value": " ".join(old_chunk)})
            if new_chunk:
                tokens.append({"type": "insert", "value": " ".join(new_chunk)})

    original_words = len(source.split())
    total_changed = words_added + words_removed + words_changed
    change_percent = round((total_changed / max(original_words, 1)) * 100, 1)

    return {
        "tokens": tokens,
        "stats": {
            "words_added": words_added,
            "words_removed": words_removed,
            "words_changed": words_changed,
            "change_percent": change_percent,
        },
    }
