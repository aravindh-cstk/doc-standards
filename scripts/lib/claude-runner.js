'use strict';

/**
 * One place to shell out to the `claude` CLI in headless print mode.
 *
 * Three callers need the same loop: build a prompt, run it, check the reply
 * against a hard constraint, and re-prompt once naming the violation. The two
 * fix scripts each carried their own copy, which is how they drifted (one
 * stripped fences before checking dashes, the other after).
 */

const { execFileSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_ATTEMPTS = 2;

/**
 * Strips what a model wraps around an answer it was told to give bare: a code
 * fence, or a matched pair of surrounding quotes.
 */
function stripReplyWrapping(stdout) {
  let reply = String(stdout || '').trim();
  const fenceMatch = reply.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
  if (fenceMatch) reply = fenceMatch[1].trim();
  if (
    (reply.startsWith('"') && reply.endsWith('"')) ||
    (reply.startsWith("'") && reply.endsWith("'"))
  ) {
    reply = reply.slice(1, -1).trim();
  }
  return reply;
}

/**
 * Runs a prompt until the reply passes `validate`, or the attempts run out.
 *
 * `buildPrompt(priorViolation)` receives the previous failure text on a retry
 * and null on the first attempt, so the caller decides how to name the problem
 * back to the model. `validate(reply)` returns a violation string, or null when
 * the reply is acceptable. Returns the accepted reply, or null when the CLI
 * fails or every attempt violates the constraint.
 */
function askClaude({ buildPrompt, validate, attempts = DEFAULT_ATTEMPTS, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  let priorViolation = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let stdout;
    try {
      stdout = execFileSync('claude', ['-p', buildPrompt(priorViolation)], {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
        // Closes stdin. Without it the child inherits the parent's, and
        // `claude -p` waits on that handle instead of answering. From a
        // terminal the parent's stdin is a tty and the read returns, so the
        // bug is invisible there. Anywhere the parent's stdin is a pipe, which
        // is every CI run and every nested agent, the call hangs until
        // timeoutMs and then reports ETIMEDOUT as a CLI failure.
        input: '',
      });
    } catch (err) {
      console.error(`  claude CLI failed: ${err.message}`);
      return null;
    }

    const reply = stripReplyWrapping(stdout);
    const violation = validate ? validate(reply) : null;
    if (!violation) return reply;
    priorViolation = violation;
  }

  console.log(`  Skipped after ${attempts} attempts: ${priorViolation}`);
  return null;
}

module.exports = { askClaude, stripReplyWrapping, DEFAULT_TIMEOUT_MS, DEFAULT_ATTEMPTS };
