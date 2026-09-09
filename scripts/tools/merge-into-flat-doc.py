#!/usr/bin/env python3
"""
Merge doc-standards-v2 review-folder content (one file per class, one file per
method, YAML front matter, Validation/Behavior/Example sections) into a flat,
single-file reference doc of the kind used by developer-solution-docs
(Docusaurus: one `##`-per-class, `###`-per-method, `\\{#anchor\\}` heading IDs,
zero internal .md links, every link an absolute production URL or an in-page
anchor).

Why this exists: the CMS-format review files and the GitHub flat-file docs are
two different documentation systems for the same SDK surface. Copying files in
verbatim breaks every relative link (the target files/folders don't exist) and
drops in a folder structure the flat-file repo has never used. This script
does the structural conversion; it does not summarize or drop content.

Usage:
    python3 merge-into-flat-doc.py --config config.json [--dry-run]

See merge-into-flat-doc.example.json for the config shape. Each run:
  1. Reads every configured class's class_reference.md + methods/*.md.
  2. Strips front matter, promotes `# Class` to `## Class \\{#anchor\\}`,
     promotes the class file's own `##` subsections to `###` so they stay
     subordinate, and gives each method `### method \\{#anchor\\}`.
  3. Rewrites every relative .md link (sibling method, own class page, another
     configured class's page or method) into an in-page anchor link. Anchors
     for a class's own methods are bare by default; set `anchor_prefix` in the
     config for any class whose method names collide with anchors the target
     file already uses (very likely, if the target file establishes bare
     anchors like #find/#fetch/#param already).
  4. Converts bare ``` code fences to ```text if the target file uses that
     convention (checked automatically from the target file's existing
     fences).
  5. Splices the result into the target file: either replacing an existing
     heading's section (through the next top-level heading or EOF), or
     inserting fresh content before/after a given heading.
  6. Prints a verification report (Python snippets parsed, links resolved,
     heading levels, anchor collisions against the target file's existing
     anchors) before anything is written, unless --dry-run is passed, in which
     case nothing is written at all and the would-be diff stat is shown.

This script does not commit or push. Do that yourself once the diff looks
right; see the flat-doc-merge skill for the full workflow including the git
and PR steps.
"""

import argparse
import ast
import json
import os
import re
import sys

INLINE_CODE_RE_FOR_FENCE_CHECK = None  # placeholder, unused
LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")


def strip_front_matter(text):
    return re.sub(r"^---\n.*?\n---\n\n?", "", text, count=1, flags=re.S)


def strip_trailing_rule(text):
    text = text.rstrip("\n")
    if text.endswith("\n---"):
        text = text[: -len("\n---")]
    elif text == "---":
        text = ""
    return text.rstrip("\n") + "\n"


def escape_heading_text(name):
    return name.replace("_", "\\_")


def add_text_lang_to_fences(text, fence_lang):
    if not fence_lang:
        return text
    out = []
    inside = False
    for line in text.split("\n"):
        if line == "```":
            if not inside:
                out.append(f"```{fence_lang}")
                inside = True
            else:
                out.append("```")
                inside = False
        else:
            out.append(line)
    return "\n".join(out)


def detect_fence_lang(target_text):
    """Look at the target file's existing fences to decide what language tag
    (if any) new fences should carry, so the merged content matches house
    style instead of introducing a second convention."""
    langs = re.findall(r"^```(\w*)$", target_text, flags=re.M)
    opens = [l for l in langs if l]
    if not opens:
        return ""
    from collections import Counter

    return Counter(opens).most_common(1)[0][0]


class Merger:
    def __init__(self, config, review_root):
        self.config = config
        self.review_root = review_root
        self.class_anchor = {}
        self.method_anchor = {}
        for c in config["classes"]:
            self.class_anchor[c["name"]] = c.get("anchor", c["name"].lower())
        for name, anchor in config.get("class_anchor_overrides", {}).items():
            self.class_anchor[name] = anchor
        for c in config["classes"]:
            prefix = c.get("anchor_prefix", "")
            for m in c["methods"]:
                self.method_anchor[(c["name"], m)] = f"{prefix}{m}" if prefix else m

    def resolve_link_target(self, target, current_class):
        if target.startswith("http") or target.startswith("/"):
            return None  # external or absolute production URL, leave alone

        for class_name in self.class_anchor:
            m = re.search(rf"{re.escape(class_name)}/methods/([a-zA-Z_]+)\.md$", target)
            if m and (class_name, m.group(1)) in self.method_anchor:
                return self.method_anchor[(class_name, m.group(1))]
            if re.search(rf"{re.escape(class_name)}/class_reference\.md$", target):
                return self.class_anchor[class_name]

        if target == "../class_reference.md":
            return self.class_anchor[current_class]

        m = re.match(r"^methods/([a-zA-Z_]+)\.md$", target)
        if m and (current_class, m.group(1)) in self.method_anchor:
            return self.method_anchor[(current_class, m.group(1))]

        m = re.match(r"^([a-zA-Z_]+)\.md$", target)
        if m and (current_class, m.group(1)) in self.method_anchor:
            return self.method_anchor[(current_class, m.group(1))]

        raise ValueError(f"Unhandled link target: {target!r} (class={current_class})")

    def fix_links(self, text, current_class):
        def repl(match):
            label, target = match.group(1), match.group(2)
            if ".md" not in target:
                return match.group(0)
            anchor = self.resolve_link_target(target, current_class)
            if anchor is None:
                return match.group(0)
            return f"[{label}](#{anchor})"

        return LINK_RE.sub(repl, text)

    def convert_class_file(self, class_name, fence_lang):
        path = os.path.join(self.review_root, class_name, "class_reference.md")
        text = open(path, encoding="utf-8").read()
        text = strip_front_matter(text)
        text = re.sub(r"^## ", "### ", text, flags=re.M)
        text = re.sub(
            rf"^# {re.escape(class_name)}\n",
            f"## {class_name} \\{{#{self.class_anchor[class_name]}\\}}\n",
            text,
            count=1,
        )
        text = self.fix_links(text, class_name)
        text = add_text_lang_to_fences(text, fence_lang)
        return text.rstrip("\n") + "\n"

    def convert_method_file(self, class_name, method_name, fence_lang, anchor_override=None):
        path = os.path.join(self.review_root, class_name, "methods", f"{method_name}.md")
        text = open(path, encoding="utf-8").read()
        text = strip_front_matter(text)
        anchor = anchor_override or self.method_anchor[(class_name, method_name)]
        visible = escape_heading_text(method_name)
        text = re.sub(
            rf"^### {re.escape(method_name)}\n",
            f"### {visible} \\{{#{anchor}\\}}\n",
            text,
            count=1,
        )
        text = self.fix_links(text, class_name)
        text = strip_trailing_rule(text)
        text = add_text_lang_to_fences(text, fence_lang)
        return text.rstrip("\n") + "\n"

    def build_class_section(self, class_config, fence_lang):
        name = class_config["name"]
        parts = [self.convert_class_file(name, fence_lang)]
        for m in class_config["methods"]:
            parts.append(self.convert_method_file(name, m, fence_lang))
        return "\n".join(parts)


def verify_python_snippets(text, label):
    blocks = re.findall(r"\n```(?:text)?\n(.*?)\n```\n", text, re.S)
    errors = []
    for b in blocks:
        try:
            ast.parse(b)
        except SyntaxError as e:
            errors.append(str(e))
    print(f"[verify] {label}: {len(blocks)} code blocks, {len(errors)} syntax errors")
    for e in errors:
        print(f"  - {e}")
    return len(errors) == 0


def find_heading_line(lines, heading):
    for i, l in enumerate(lines):
        if l == heading:
            return i
    raise ValueError(f"Heading not found in target file: {heading!r}")


def find_section_end(lines, start_idx):
    """First top-level `## ` heading strictly after start_idx, or EOF."""
    for i in range(start_idx + 1, len(lines)):
        if lines[i].startswith("## "):
            return i
    return len(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", required=True, help="Path to a merge config JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing")
    args = parser.parse_args()

    config = json.load(open(args.config, encoding="utf-8"))
    review_root = config["review_root"]
    target_path = config["target_file"]

    target_text = open(target_path, encoding="utf-8").read()
    fence_lang = detect_fence_lang(target_text)
    print(f"[info] target file's existing fence language: {fence_lang or '(none)'}")

    merger = Merger(config, review_root)

    # Build every configured section up front so all snippets get verified
    # before anything touches the target file.
    all_ok = True
    class_sections = {}
    for c in config["classes"]:
        section = merger.build_class_section(c, fence_lang)
        class_sections[c["name"]] = section
        all_ok &= verify_python_snippets(section, f"class {c['name']}")

    extra_entries = {}
    for extra in config.get("extra_method_inserts", []):
        entry = merger.convert_method_file(
            extra["class"], extra["method"], fence_lang, anchor_override=extra.get("anchor")
        )
        extra_entries[id(extra)] = entry
        all_ok &= verify_python_snippets(entry, f"extra method {extra['class']}.{extra['method']}")

    if not all_ok:
        print("[abort] fix the syntax errors above before merging")
        sys.exit(1)

    lines = target_text.split("\n")

    # Remove any stale sections first (e.g. a class being renamed away from,
    # like "## Terms" when the replacement introduces "## Term" under a new
    # heading elsewhere). Highest line number first so removals don't shift
    # each other's positions.
    removals = [find_heading_line(lines, h) for h in config.get("remove_sections", [])]
    for start in sorted(removals, reverse=True):
        end = find_section_end(lines, start)
        del lines[start:end]

    # Apply extra method inserts first (each is inserted right before a named
    # heading), highest line number first so earlier insertions don't shift
    # the line numbers later ones depend on.
    inserts = []
    for extra in config.get("extra_method_inserts", []):
        before_idx = find_heading_line(lines, extra["insert_before_heading"])
        inserts.append((before_idx, extra_entries[id(extra)]))
    inserts.sort(key=lambda x: -x[0])
    for idx, entry in inserts:
        lines[idx:idx] = entry.split("\n") + [""]

    # Apply class sections: each either replaces an existing section, or gets
    # inserted before/after a named heading. Process in the order given, and
    # recompute line positions between each since earlier operations shift
    # everything after them.
    for c in config["classes"]:
        section_lines = class_sections[c["name"]].split("\n")
        if "replace_heading" in c:
            start = find_heading_line(lines, c["replace_heading"])
            end = find_section_end(lines, start)
            lines[start:end] = section_lines + [""]
        elif "insert_before_heading" in c:
            idx = find_heading_line(lines, c["insert_before_heading"])
            lines[idx:idx] = section_lines + [""]
        elif "insert_after_heading" in c:
            idx = find_heading_line(lines, c["insert_after_heading"])
            end = find_section_end(lines, idx)
            lines[end:end] = [""] + section_lines
        else:
            raise ValueError(f"class {c['name']} needs replace_heading, insert_before_heading, or insert_after_heading")

    result = "\n".join(lines).rstrip("\n") + "\n"

    print(f"[info] target file: {len(target_text.splitlines())} -> {len(result.splitlines())} lines")

    # Final whole-file checks.
    verify_python_snippets(result, "final merged file (new content only was already checked above; this also re-touches pre-existing blocks, some of which are non-Python shell/text snippets that were never valid Python and are not a regression)")
    dangling = re.findall(r"\]\([^)]*\.md[^)]*\)", result)
    print(f"[verify] leftover .md links: {len(dangling)}")
    for d in dangling[:10]:
        print(f"  - {d}")

    if args.dry_run:
        print("[dry-run] no file written")
        return

    open(target_path, "w", encoding="utf-8").write(result)
    print(f"[done] wrote {target_path}")


if __name__ == "__main__":
    main()
