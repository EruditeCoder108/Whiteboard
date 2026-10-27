# Open-source publication review

Reviewed **2026-10-27**. This review prepares local source and documentation; it does not push a
commit, change GitHub visibility or rewrite history.

## Findings

The GitHub API reports `EruditeCoder108/Whiteboard` is already **public**. Its four public commits
matched the four locally reachable commits, with HEAD `5cb4c02fb920bdb4fea511056a1fdf51913ac062`
at review time. A public repository and an open-source licence are separate things: the prior
package metadata was `UNLICENSED` and there was no root licence file.

The owner selected **GPLv3**. The root `LICENSE` now contains the GNU GPL version 3 text, and
`package.json` plus the lockfile identify this project's own code as `GPL-3.0-only`. Dependency
licences remain separate; [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) indexes their retained
licence text and source locations. In particular, Mediabunny is MPL-2.0, not MIT. Future packaging
includes these notices; old preview executables were not silently relicensed or rebuilt.

The package's `private: true` flag remains to prevent accidental npm publication of this desktop app;
it does not make the GitHub repository private or change the source licence.

## What was checked

- Current tracked, staged and untracked non-ignored project files, plus text files in all four
  reachable commits; the initial inventory contained 275 publishable files.
- Patterns for provider/GitHub/cloud credentials, private-key blocks, credential-bearing URLs,
  literal secrets, personal email addresses and machine-specific paths. Matches were classified
  without printing potential secret values.
- Commit author metadata. The author name and GitHub handle are visible; the email uses GitHub's
  `users.noreply.github.com` format, not a private mailbox.
- A contact-sheet review of the 132 existing image assets, plus full-resolution inspection of
  new README captures. Existing QA imagery includes synthetic boards, grid captures, Miro
  comparisons and some desktop-input test frames. No live teaching-board content or credentials
  were identified. Older desktop test images do show ordinary taskbar/system chrome.
- New README media: synthetic example objects and native lab scenes in a disposable profile,
  external renderer requests blocked, no capture of the user's live board or desktop.

No genuine credentials, private email addresses, live board documents or real lesson recordings
were identified in the scanned publication scope. The credential-URL matches were deliberate
test fixtures. This is a bounded pattern and visual review, not a guarantee against every possible
secret or tiny piece of private image content. No dedicated secret-scanner service was installed.

## Cleanup performed

- Replaced machine-specific workspace paths in the current QA/handoff documents with portable
  repository-relative wording.
- Ignored `docs/showcase-qa/live-data-check.json`, a local QA record containing private profile
  paths and file hashes. Kept the actual local evidence file intact and removed its public-doc link.
- Added ignores for root-level board/profile files, damaged/backup boards and private signing files.
  Existing `.work/`, `dist/`, `.env` and connection/recording ignores remain.
- Retained author attribution and stable app identifiers intentionally; these identify the creator
  and application and are not authentication secrets.

The current ignore rule is effective because the local hash report was not tracked. Ignore rules
do not erase tracked content or prior commits. Historical documentation still contains the old
workspace directory wording, and commit author names remain public. No history rewrite was needed
to remediate an identified credential, and none was attempted. If the owner later wants to remove
all historical identifying metadata, treat that as a separate coordinated history-cleanup task.

## Publication checklist

1. Review the final staged diff, including the existing science work, before committing. Publishing
   only the new README while omitting its media and current source would leave an incomplete update.
2. Confirm that private profile/evidence files remain ignored. Use synthetic examples in new issues,
   screenshots and recordings. Publish a Git source tree, not a ZIP of the entire working folder.
3. Commit the licence, notices and documentation together with the intended source revision.
4. For binary distribution, supply corresponding source for that exact build and preserve required
   dependency notices/source availability. Trusted Windows signing remains a separate release task.

See [SECURITY.md](../SECURITY.md) for private reporting and exposed-credential handling.
