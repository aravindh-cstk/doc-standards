'use strict';

/**
 * One definition of "what anchor does this heading get".
 *
 * There were two, and they disagreed on 180 of the 3,314 headings in this
 * corpus. Both bugs were in the same place, how separator runs are handled:
 *
 *   heading         "Step 7: Save + preview (30 sec)"
 *   parse-markdown  step-7-save-preview-30-sec      (wrong)
 *   repair-anchors  step-7-save--preview-30-sec     (right)
 *
 * GitHub's slugger, which the docs site follows, lowercases the text, drops
 * every character that is not a word character, whitespace or a hyphen, and
 * then replaces each remaining whitespace character with one hyphen. It does
 * NOT collapse the result. So "Save + preview" loses the "+" and keeps the two
 * spaces around it as two hyphens.
 *
 * parse-markdown used `\s+` where GitHub uses `\s`, which collapsed those runs
 * and produced an anchor no heading actually has. It also stripped decoration
 * with the same catch-all character class rather than unwrapping it first,
 * which turns "[Templates](../31-templates/overview.md)" in a heading into
 * "templates31-templatesoverviewmd" instead of "templates".
 *
 * The implementation below is the one validated against real anchors in this
 * repo, including the double-hyphen cases. Order matters: decoration is
 * unwrapped so its text survives, and only then is the leftover punctuation
 * dropped.
 */
function slugify(text) {
  return (
    String(text)
      .trim()
      .toLowerCase()
      // Unwrap decoration, keeping the words inside it.
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\*\*([^*]*)\*\*/g, '$1')
      .replace(/\*([^*]*)\*/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Drop what is left that GitHub does not keep.
      .replace(/[^\w\s-]/g, '')
      // One hyphen per whitespace character, deliberately not collapsed.
      .replace(/\s/g, '-')
  );
}

/**
 * The same, but with `&`, `<` and `>` turned into entities first.
 *
 * The corpus links to `...-prop-on-ltstudiocomponent-gt`, whose heading is
 *
 *   ## Part 2: Runtime Component Default Data (the `data` prop on `<StudioComponent />`)
 *
 * The "lt" and "gt" in that anchor can only come from the angle brackets having
 * been escaped to `&lt;` and `&gt;` before the slug was computed, which is what
 * happens when a renderer escapes the heading to HTML and the slugger then
 * reads the escaped text rather than the decoded text.
 *
 * Which of the two forms a given page uses is not something two samples can
 * settle, and guessing wrong makes a link checker report a live anchor as dead.
 * So both are computed and a checker accepts either.
 */
function slugifyEscaped(text) {
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // An apostrophe becomes &#39;, whose digits survive into the slug. That is
    // where the "39" comes from in
    //   #typeerror-cannot-read-properties-of-null-reading-39hasownproperty39-...
    // which the corpus links to and which no unescaped form can produce.
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
  return slugify(escaped);
}

/**
 * Every anchor form a heading might legitimately have, for a tolerant read.
 *
 * Canonical on write, tolerant on read: `slugify` is what to generate, and this
 * is what to accept. A checker that only accepted the canonical form would
 * report the angle-bracket anchors already in the corpus as broken, and
 * "fixing" them would break the live links.
 */
function slugifyVariants(text) {
  return [...new Set([slugify(text), slugifyEscaped(text)])];
}

module.exports = { slugify, slugifyEscaped, slugifyVariants };
