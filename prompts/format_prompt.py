from dataclasses import dataclass


@dataclass
class FormatOptions:
    enable_bold: bool = True
    enable_italics: bool = True
    enable_h1: bool = True
    enable_h2: bool = True
    enable_h3: bool = True
    bullets_mode: str = "auto"
    pull_quotes_mode: str = "auto"
    numbered_steps_mode: str = "auto"
    section_summaries_mode: str = "auto"
    tables_mode: str = "off"
    callouts_mode: str = "off"


MODE_GUIDANCE = {
    "strict": (
        "Preserve the original wording as much as possible. "
        "Only fix obvious structure issues and basic markdown organization."
    ),
    "balanced": (
        "Fix spelling, punctuation, and small grammar issues while preserving tone and meaning."
    ),
    "aggressive": (
        "Improve grammar, clarity, and flow more substantially while preserving the original intent."
    ),
}


def _markdown_constraints(options: FormatOptions) -> str:
    rules = []
    if not options.enable_bold:
        rules.append("Do not use bold markdown (`**text**`).")
    if not options.enable_italics:
        rules.append("Do not use italic markdown (`*text*` or `_text_`).")
    if not options.enable_h1:
        rules.append("Do not use H1 headings (`# Heading`).")
    if not options.enable_h2:
        rules.append("Do not use H2 headings (`## Heading`).")
    if not options.enable_h3:
        rules.append("Do not use H3 headings (`### Heading`).")

    if not rules:
        return "All markdown styles are allowed."
    return " ".join(rules)


def _style_rule(name: str, mode: str, guidance: str) -> str:
    normalized = (mode or "auto").strip().lower()
    if normalized == "off":
        return f"{name}: do not use."
    if normalized == "prefer":
        return f"{name}: prefer using when it improves readability. {guidance}"
    return f"{name}: use only when naturally helpful. {guidance}"


def _structure_style_instructions(options: FormatOptions) -> str:
    rules = [
        _style_rule(
            "Bulleted or numbered lists",
            options.bullets_mode,
            "Use only for parallel items; keep list length concise.",
        ),
        _style_rule(
            "Pull quotes (markdown blockquotes)",
            options.pull_quotes_mode,
            "Use at most 1-2 and only for key phrases already present in the source text.",
        ),
        _style_rule(
            "Numbered steps",
            options.numbered_steps_mode,
            "Use for procedural or sequential content only.",
        ),
        _style_rule(
            "Section summaries",
            options.section_summaries_mode,
            "Use short recap bullets only for longer sections.",
        ),
        _style_rule(
            "Markdown tables",
            options.tables_mode,
            "Use only for structured comparisons or data-like values.",
        ),
        _style_rule(
            "Callouts (e.g., Note/Warning)",
            options.callouts_mode,
            "Use sparingly and only when the content clearly warrants emphasis.",
        ),
        "Do not over-format. Avoid decorative structure that hurts readability.",
        "Never invent quotes, facts, or citations.",
    ]
    return " ".join(rules)


def build_messages(text: str, mode: str, options: FormatOptions) -> list[dict[str, str]]:
    selected_mode = mode if mode in MODE_GUIDANCE else "balanced"
    system_content = (
        "You are a professional editor that returns markdown only. "
        "Keep facts unchanged and never invent new information. "
        f"Editing mode: {selected_mode}. {MODE_GUIDANCE[selected_mode]} "
        f"Markdown constraints: {_markdown_constraints(options)} "
        f"Structure and style rules: {_structure_style_instructions(options)}"
    )

    user_content = (
        "Format the following text according to the mode and markdown rules. "
        "Return only the final formatted markdown.\n\n"
        f"{text}"
    )

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]
