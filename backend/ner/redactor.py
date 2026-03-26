import sys
import json
import re
import spacy

nlp = spacy.load("en_core_web_sm")

REGEX_PATTERNS = {
    "AADHAAR": r"\b\d{4}\s?\d{4}\s?\d{4}\b",
    "PAN": r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",
    "PHONE": r"(\+91[\-\s]?)?[6-9]\d{4}[\s\-]?\d{5}\b",
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
}

SPACY_LABEL_MAP = {
    "PERSON": "PERSON",
    "ORG": "ORG",
    "GPE": "LOCATION",
    "LOC": "LOCATION",
    "DATE": "DATE",
}

ROLE_PREFIXES_STRIP = {
    "patient",
    "dr",
    "dr.",
    "mr",
    "mr.",
    "mrs",
    "mrs.",
    "ms",
    "ms.",
    "prof",
    "prof.",
    "doctor",
    "nurse",
    "officer",
    "inspector",
    "constable",
    "advocate",
    "client",
    "customer",
    "employee",
    "worker",
    "user",
}

# Suppress these from ALL spaCy entity types (PERSON and ORG)
SPACY_SUPPRESS = {
    "aadhaar",
    "pan",
    "phone",
    "email",
    "mobile",
    "cc",
    "bcc",
    "fyi",
    "re",
    "fw",
    "fwd",
    "type",
    "diagnosis",
    "contact",
    "name",
}

# If spaCy tags something as PERSON but it ends in one of these — reclassify as ORG
ORG_SUFFIXES = {
    "hospital",
    "clinic",
    "healthcare",
    "health",
    "pharma",
    "labs",
    "lab",
    "institute",
    "college",
    "university",
    "school",
    "centre",
    "center",
    "trust",
    "foundation",
    "corp",
    "corporation",
    "ltd",
    "limited",
    "pvt",
    "inc",
    "llp",
    "associates",
    "group",
    "services",
    "solutions",
}

_role_list = [
    "patient",
    "dr",
    "dr.",
    "mr",
    "mr.",
    "mrs",
    "mrs.",
    "ms",
    "ms.",
    "prof",
    "prof.",
    "doctor",
    "nurse",
    "officer",
    "inspector",
    "constable",
    "advocate",
    "client",
    "customer",
    "employee",
    "worker",
    "user",
]

ruler = nlp.add_pipe("entity_ruler", before="ner")
ruler.add_patterns(
    [
        {
            "label": "PERSON",
            "pattern": [
                {"LOWER": {"IN": _role_list}},
                {"IS_TITLE": True},
                {"IS_TITLE": True, "OP": "?"},
            ],
        },
        {
            "label": "PERSON",
            "pattern": [
                {"LOWER": {"IN": _role_list}},
                {"IS_UPPER": True},
                {"IS_UPPER": True, "OP": "?"},
            ],
        },
    ]
)


def strip_role_prefix(text):
    tokens = text.split()
    while tokens and tokens[0].lower().rstrip(".") in ROLE_PREFIXES_STRIP:
        tokens = tokens[1:]
    return " ".join(tokens)


def normalise_name(text):
    return text.title() if text.isupper() else text


def strip_possessive(text):
    if text.endswith("'s") or text.endswith("\u2019s"):
        return text[:-2]
    return text


def is_org_text(text):
    """True if text looks like an org name based on its last word."""
    last = text.strip().split()[-1].lower().rstrip(".")
    return last in ORG_SUFFIXES


def redact(text, session_id):
    entities = []
    value_to_token = {}
    type_counters = {}

    def next_token(entity_type):
        type_counters[entity_type] = type_counters.get(entity_type, 0) + 1
        return f"[{entity_type}_{type_counters[entity_type]}]"

    def add_entity(start, end, entity_type, real_value):
        real_value = real_value.strip()
        real_value = strip_possessive(real_value)
        prefix_offset = 0
        if entity_type == "PERSON":
            stripped = strip_role_prefix(real_value)
            if stripped != real_value and stripped:
                prefix_offset = real_value.index(stripped)
            real_value = stripped
            real_value = normalise_name(real_value)
        if not real_value:
            return
        if real_value in value_to_token:
            token = value_to_token[real_value]
        else:
            token = next_token(entity_type)
            value_to_token[real_value] = token
        entities.append(
            {
                "start": start + prefix_offset,
                "end": end,
                "entityType": entity_type,
                "realValue": real_value,
                "token": token,
            }
        )

    # ── Layer 1: Regex ────────────────────────────────────────────────────────
    regex_spans = set()
    for entity_type, pattern in REGEX_PATTERNS.items():
        for match in re.finditer(pattern, text):
            add_entity(match.start(), match.end(), entity_type, match.group())
            for i in range(match.start(), match.end()):
                regex_spans.add(i)

    # ── Layer 2: spaCy NER + EntityRuler ─────────────────────────────────────
    doc = nlp(text)
    spacy_ents = list(doc.ents)

    # Merge adjacent PERSON ents separated only by whitespace
    # Also handles "Ramesh Kumar's" — strip possessive on the merged span
    merged_ents = []
    i = 0
    while i < len(spacy_ents):
        ent = spacy_ents[i]
        # Try to extend: look back in text before this ent for an uncovered title-case word
        # that spaCy missed (e.g. "Ramesh" before "Kumar")
        if ent.label_ == "PERSON":
            # Check if the word immediately before this ent is title-case and uncovered
            before = text[: ent.start_char].rstrip()
            m = re.search(r"\b([A-Z][a-z]+)$", before)
            if m and not any(k in regex_spans for k in range(m.start(), m.end())):
                # Extend start back to include the missed first name
                class ExtendedEnt:
                    def __init__(self, label, start_char, end_char, full_text):
                        self.label_ = label
                        self.start_char = start_char
                        self.end_char = end_char
                        self.text = full_text

                merged_ents.append(
                    ExtendedEnt(
                        "PERSON",
                        m.start(),
                        ent.end_char,
                        text[m.start() : ent.end_char],
                    )
                )
                i += 1
                continue
        merged_ents.append(ent)
        i += 1

    for ent in merged_ents:
        mapped = SPACY_LABEL_MAP.get(ent.label_)
        if not mapped:
            continue
        # Suppress known noise words from any entity type
        if ent.text.lower().strip() in SPACY_SUPPRESS:
            continue
        if any(i in regex_spans for i in range(ent.start_char, ent.end_char)):
            continue
        # Reclassify: spaCy says PERSON but it's clearly an org
        if mapped == "PERSON" and is_org_text(ent.text):
            mapped = "ORG"
        add_entity(ent.start_char, ent.end_char, mapped, ent.text)

    # ── Layer 3: All-caps multi-word names missed by spaCy ───────────────────
    covered = set()
    for e in entities:
        for i in range(e["start"], e["end"]):
            covered.add(i)

    for match in re.finditer(r"\b([A-Z]{2,}(?:\s+[A-Z]{2,})+)\b", text):
        if any(i in covered for i in range(match.start(), match.end())):
            continue
        if any(i in regex_spans for i in range(match.start(), match.end())):
            continue
        words = match.group().split()
        if all(len(w) <= 2 for w in words):
            continue
        if is_org_text(match.group()):
            continue
        add_entity(match.start(), match.end(), "PERSON", match.group())

    # ── Layer 4: Role-keyword + lowercase name fallback ──────────────────────
    covered2 = set()
    for e in entities:
        for i in range(e["start"], e["end"]):
            covered2.add(i)

    role_name_re = re.compile(
        r"\b(" + "|".join(re.escape(r) for r in _role_list) + r")"
        r"\s+([a-z][a-z]+(?:\s+[a-z][a-z]+)?)",
        re.IGNORECASE,
    )
    for match in role_name_re.finditer(text):
        name_start = match.start(2)
        name_end = match.end(2)
        if any(i in covered2 for i in range(name_start, name_end)):
            continue
        name = match.group(2).strip()
        if name.lower() in SPACY_SUPPRESS | {
            "the",
            "a",
            "an",
            "my",
            "his",
            "her",
            "pan",
            "id",
            "no",
            "number",
        }:
            continue
        add_entity(name_start, name_end, "PERSON", name.title())

    # ── Sort + remove overlaps ────────────────────────────────────────────────
    entities.sort(key=lambda e: (e["start"], -(e["end"] - e["start"])))
    filtered = []
    last_end = -1
    for e in entities:
        if e["start"] >= last_end:
            filtered.append(e)
            last_end = e["end"]

    # ── Build redacted text ───────────────────────────────────────────────────
    redacted = ""
    cursor = 0
    for e in filtered:
        redacted += text[cursor : e["start"]]
        redacted += e["token"]
        cursor = e["end"]
    redacted += text[cursor:]

    output_entities = [
        {
            "token": e["token"],
            "entityType": e["entityType"],
            "realValue": e["realValue"],
            "start": e["start"],
            "end": e["end"],
        }
        for e in filtered
    ]

    return {"redactedText": redacted, "entities": output_entities}


if __name__ == "__main__":
    raw = sys.stdin.read()
    payload = json.loads(raw)
    result = redact(payload["text"], payload["sessionId"])
    print(json.dumps(result))
    sys.stdout.flush()
