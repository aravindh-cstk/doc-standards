# API reference playbook

`/fix-docs` loads this file for an SDK API reference page: a `usage_guide.md`, a
`class_reference.md`, or any page under a `methods/` folder. `fix-all.js` lints these pages with
`lint-api-ref.js`, never with `lint-doc.js`, which would judge a method page as a conceptual guide.

## The rule files

Read these in full before editing:

1. The template for each shape in the target:
   - `doc-templates/api-ref/api-ref-usage-guide-v2.md`
   - `doc-templates/api-ref/api-ref-class-v2.md`
   - `doc-templates/api-ref/api-ref-method-v2.md`
2. `doc-templates/api-ref/usage-guide-derivation.md`, which records how the usage guide shape was
   derived.
3. `doc-templates/feature-docs/common-rules.md`, for the wording rules that apply unchanged.

The structural rules are `AR-01` to `AR-10` and `UG-01` to `UG-13`, tagged `docTypes: ["api-ref"]`
in `scripts/data/rules-registry.json`.

## Lint the whole class folder

Two checks compare a page against the files beside it:

- A class page's Method Index is compared against the `methods/*.md` files. A method on disk that the
  index does not link is unreachable, reported as `AR-09`.
- A usage guide's Class Overview table is compared against the sibling folders that hold a
  `class_reference.md`.

So run `/fix-docs` on a class folder or the SDK folder, not on one method page. On a single page the
two checks see nothing to compare and report nothing.

**A partial extract reports false `AR-09` findings.** When a folder came across without most of its
method files, the class page's index points at files that are not there, and `AR-09` fires once per
row. That block is the largest in the report and none of it is a real defect. Record it as one
`needs-input` question that asks for the full class folder. Never delete index rows to silence it.

## What does not apply

`lint-api-ref.js` drops the checks that need a doc type this family does not have. Do not bring
their findings back by eye:

- No front matter check for `title`, `description` and `url`. An api-ref page carries exactly three
  keys: `uid`, `seo_title` and `seo_description`.
- No section-order check against `section-order.json`.
- No Next Steps, Quick Reference or Troubleshooting section checks.
- No getting-started or migration checks.

Two shape facts that look like defects:

- A method page has no H1 and no H2. The CMS joins it into the class page, which is also why it ends
  with a horizontal rule and leaves both SEO fields empty.
- A usage guide and a class page are standalone URLs, so they carry real SEO text and must not end
  with a horizontal rule.

## The deduplication ladder

Each fact lives on the page that matches its scope:

| Scope of the fact | Page that owns it | Section |
| --- | --- | --- |
| True of every class in the SDK | `usage_guide.md` | SDK-Wide Notes, SDK Limitations |
| True of every method in one class | `class_reference.md` | Class-Level Notes, Capability Matrix |
| True of one method | the method page | Warnings, Limitations |

The ladder cuts both ways:

- **A fact true of the whole SDK** goes on the usage guide once. Do not repeat it on class pages.
- **A fact confined to one class** stays on that class page. On the usage guide, a reader assumes it
  applies everywhere. A note that needs "except for the Asset class" belongs lower.

When you move a note, delete it from every page it came from in the same edit. Two copies drift
apart.

## AR-10: verify every default

`AR-10` is on every api-ref checklist because no check enforces it. For every parameter table, and
for the "Default when unset" column of a usage guide's SDK-Wide Notes, confirm each value against
the SDK signature in code:

- **Never take a default from an API reference doc or a Postman collection.** Their `Default:` fields
  are sample request values.
- **Spot a value copied from one:** a `skip` parameter with a non-zero default, a `limit` on a
  single-item fetch, or a required parameter with any default.
- **No SDK default:** when the API applies its own, write `API default`, and name the value only when
  it is known, for example `API default (100)`.
- **Required parameter:** write `Not applicable`. A dash breaks `C3-05`, because a table cell is not
  a code block.
- **Never leave the cell blank, and never invent a number.** When the SDK code is not available,
  record `needs-input`.

Two claims must agree:

- The Returns line on a method page and the Returns cell for that method in its class page's Method
  Index use the same sentence.
- The Validation section's error handling matches the first code example on the page. The example
  is what readers copy.

## Technical content

Never change code blocks, method signatures, parameter names, types, error codes, URLs, file paths or
version numbers. On this doc type the technical content is the content.
