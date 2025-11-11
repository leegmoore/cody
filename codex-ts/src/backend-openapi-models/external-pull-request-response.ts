import type { GitPullRequest } from "./git-pull-request.js";

/**
 * External pull request response
 * Generated from OpenAPI schema
 */
export interface ExternalPullRequestResponse {
  id: string;
  assistant_turn_id: string;
  pull_request: GitPullRequest;
  codex_updated_sha?: string;
}
