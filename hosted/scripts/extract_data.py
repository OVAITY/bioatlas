import json
import re
from pathlib import Path

import openpyxl

SCRIPT_DIR = Path(__file__).resolve().parent
SRC = SCRIPT_DIR.parent.parent / "OVAITY_Life_Science_Glossary.xlsx"
OUT = SCRIPT_DIR.parent / "public" / "data" / "data.js"


def rows(ws):
    return list(ws.iter_rows(values_only=True))


def to_records(ws):
    r = rows(ws)
    header = [h.strip() if isinstance(h, str) else h for h in r[0]]
    out = []
    for row in r[1:]:
        if row[0] is None and all(v is None for v in row):
            continue
        out.append({header[i]: row[i] for i in range(len(header))})
    return out


def normalize_methodologies(records):
    """Repair rows where an acronym was inserted without an Acronym header."""
    levels = {"Foundation", "Core", "Advanced"}
    priorities = {"Essential", "Core", "Optional"}
    for record in records:
        if (
            record.get("Purpose") in levels
            and str(record.get("Priority") or "").startswith("Stage ")
            and record.get("Source URL") in priorities
        ):
            record["Acronym"] = record.get("Category")
            for target, source in (
                ("Category", "Level"),
                ("Level", "Purpose"),
                ("Purpose", "Typical inputs"),
                ("Typical inputs", "Simplified workflow"),
                ("Simplified workflow", "Typical outputs"),
                ("Typical outputs", "Strengths"),
                ("Strengths", "Limitations / risks"),
                ("Limitations / risks", "Key QC checks"),
                ("Key QC checks", "Common tools / platforms"),
                ("Common tools / platforms", "When to learn"),
                ("When to learn", "Priority"),
                ("Priority", "Source URL"),
            ):
                record[target] = record.get(source)
            record["Source URL"] = None
    return records


def split_list(s):
    if not s:
        return []
    return [p.strip() for p in re.split(r",|;", s) if p.strip()]


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)

    glossary = to_records(wb["Glossary"])
    methodologies = normalize_methodologies(to_records(wb["Methodologies"]))
    learning_path = to_records(wb["Learning Path"])
    sources = to_records(wb["Sources"])

    term_names = {g["Term"].strip().lower(): g["Term"] for g in glossary if g.get("Term")}

    for stage in learning_path:
        concepts = split_list(stage.get("Core concepts to master"))
        matched_terms = [term_names[c.lower()] for c in concepts if c.lower() in term_names]
        stage["matched_terms"] = matched_terms
        stage_label = f"Stage {stage['Stage']}"
        stage["matched_methodologies"] = [
            m["Methodology"] for m in methodologies if m.get("When to learn") == stage_label
        ]

    data = {
        "glossary": glossary,
        "methodologies": methodologies,
        "learningPath": learning_path,
        "sources": sources,
        "meta": {
            "glossaryCount": len(glossary),
            "methodologyCount": len(methodologies),
            "stageCount": len(learning_path),
        },
    }

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.DATA = ")
        json.dump(data, f, indent=0, ensure_ascii=False)
        f.write(";\n")

    print(f"Wrote {OUT}: {len(glossary)} glossary terms, {len(methodologies)} methodologies, {len(learning_path)} stages")


if __name__ == "__main__":
    main()
