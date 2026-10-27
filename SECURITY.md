# Security and privacy

## Reporting an issue

Do not put credentials, private boards, live session tokens or detailed exploit instructions in a
public issue. If the repository offers **Security → Report a vulnerability**, use that private
reporting flow. Otherwise open a minimal issue requesting a private reporting channel, without
including the vulnerability details or private content. No private contact address is invented here.

## Local data

Board autosave, backups, settings, window state and lesson recordings belong in the user's local
app profile. The portable app also uses local AppData; it does not make the board travel with its EXE.
Normal drawing and science do not require an account or provider. Optional agent/assistant connections
have separate data and endpoint boundaries; see [agent integration](docs/AGENT-INTEGRATION.md).

The MCP service starts disabled, uses loopback and a session token, and validates requested operations.
Review which agent client you enable and which endpoint you configure for an assistant. Remote model
requests can expose the prompt and compact board context to that endpoint when you request them.

## Publishing and distribution

Ignored files are not a secret vault, and ignore rules do not remove files already in Git history.
Review the index, untracked files, commit history and screenshots before publishing. If an actual
credential is exposed, revoke/rotate it before considering history cleanup. Do not rewrite shared
history casually. [GitHub's removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
describes the implications.

Keep signing identities outside the repository. Unsigned preview executables may be blocked by
Windows trust policy; use the configured signed-release workflow for wider distribution.
See [the publication audit](docs/OPEN-SOURCE-READINESS.md) for the scope and limits of the latest review.
