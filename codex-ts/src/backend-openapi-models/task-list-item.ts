import type { ExternalPullRequestResponse } from "./external-pull-request-response.js";

/**
 * Task list item
 * Generated from OpenAPI schema
 */
export interface TaskListItem {
  id: string;
  title: string;
  has_generated_title?: boolean;
  updated_at?: number;
  created_at?: number;
  task_status_display?: Record<string, unknown>;
  archived: boolean;
  has_unread_turn: boolean;
  pull_requests?: ExternalPullRequestResponse[];
}
