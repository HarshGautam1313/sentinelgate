import sys
import json
import re
import spacy

nlp = spacy.load("en_core_web_sm")

REGEX_PATTERNS = {
    "AADHAAR": r"\b\d{4}\s?\d{4}\s?\d{4}\b",
    "PAN": r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",
    "PHONE": r"\b(\+91[\-\s]?)?[6-9]\d{9}\b",
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
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

SPACY_SUPPRESS = {"aadhaar", "pan", "phone", "email", "mobile"}

ROLE_TRIGGERS = {
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


def find_role_triggered_names(text, already_covered):
    found = []
    tokens = list(re.finditer(r"\b\w[\w.]*\b", text))
    i = 0
    while i < len(tokens):
        word = tokens[i].group().lower()
        if word in ROLE_TRIGGERS:
            name_tokens = []
            j = i + 1
            while j < len(tokens) and j <= i + 3:
                w = tokens[j].group()
                if w[0].isupper():
                    name_tokens.append(tokens[j])
                    j += 1
                else:
                    break
            if name_tokens:
                start = name_tokens[0].start()
                end = name_tokens[-1].end()
                if not any(k in already_covered for k in range(start, end)):
                    found.append((start, end, text[start:end]))
        i += 1
    return found


# EntityRuler for role-prefixed names (runs before NER)
ruler = nlp.add_pipe("entity_ruler", before="ner")
ruler.add_patterns(
    [
        {
            "label": "PERSON",
            "pattern": [
                {
                    "LOWER": {
                        "IN": [
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
                    }
                },
                {"IS_TITLE": True},
                {"IS_TITLE": True, "OP": "?"},
            ],
        }
    ]
)

REGEX_PATTERNS = {
    "AADHAAR": r"\b\d{4}\s?\d{4}\s?\d{4}\b",
    "PAN": r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",
    "PHONE": r"\b(\+91[\-\s]?)?[6-9]\d{9}\b",
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
}

SPACY_LABEL_MAP = {
    "PERSON": "PERSON",
    "ORG": "ORG",
    "GPE": "LOCATION",
    "LOC": "LOCATION",
    "DATE": "DATE",
}

# Words spaCy commonly misclassifies — suppress these from NER output
SPACY_SUPPRESS = {"aadhaar", "pan", "phone", "email", "mobile"}


def strip_role_prefix(text):
    """Remove leading role/title words from a person entity span."""
    tokens = text.split()
    while tokens and tokens[0].lower().rstrip(".") in ROLE_PREFIXES_STRIP:
        tokens = tokens[1:]
    return " ".join(tokens)


def redact(text, session_id):
    entities = []
    value_to_token = {}
    type_counters = {}

    def next_token(entity_type):
        type_counters[entity_type] = type_counters.get(entity_type, 0) + 1
        return f"[{entity_type}_{type_counters[entity_type]}]"

    def add_entity(start, end, entity_type, real_value):
        real_value = real_value.strip()
        prefix_offset = 0
        if entity_type == "PERSON":
            stripped = strip_role_prefix(real_value)
            if stripped != real_value and stripped:
                # Find where the actual name starts within the raw span text,
                # accounting for any whitespace between prefix and name.
                prefix_offset = real_value.index(stripped)
            real_value = stripped
        if not real_value:
            return
        if real_value in value_to_token:
            token = value_to_token[real_value]
        else:
            token = next_token(entity_type)
            value_to_token[real_value] = token
        entities.append(
            {
                "start": start + prefix_offset,  # skip the role prefix in the span
                "end": end,
                "entityType": entity_type,
                "realValue": real_value,
                "token": token,
            }
        )

    # Layer 1: Regex
    regex_spans = set()
    for entity_type, pattern in REGEX_PATTERNS.items():
        for match in re.finditer(pattern, text):
            add_entity(match.start(), match.end(), entity_type, match.group())
            for i in range(match.start(), match.end()):
                regex_spans.add(i)

    # Layer 2: spaCy NER + EntityRuler (skip overlaps + suppress false positives)
    doc = nlp(text)
    for ent in doc.ents:
        mapped = SPACY_LABEL_MAP.get(ent.label_)
        if not mapped:
            continue
        if ent.text.lower().strip() in SPACY_SUPPRESS:
            continue
        if any(i in regex_spans for i in range(ent.start_char, ent.end_char)):
            continue
        add_entity(ent.start_char, ent.end_char, mapped, ent.text)

    # Sort + remove overlapping spans (keep first)
    entities.sort(key=lambda e: e["start"])
    filtered = []
    last_end = -1
    for e in entities:
        if e["start"] >= last_end:
            filtered.append(e)
            last_end = e["end"]

    # Build redacted text
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
