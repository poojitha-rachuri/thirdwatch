// action/src/github.ts — PR comment utilities (upsert pattern)

import type { GitHub } from "@actions/github/lib/utils.js";
import type { Context } from "@actions/github/lib/context.js";

type Octokit = InstanceType<typeof GitHub>;

const COMMENT_MARKER = "<!-- thirdwatch-dependency-report -->";

// ---------------------------------------------------------------------------
// Post or update a PR comment with the Thirdwatch dependency report
// ---------------------------------------------------------------------------

export async function postPRComment(
  octokit: Octokit,
  context: Context,
  body: string,
): Promise<void> {
  const prNumber = context.payload.pull_request?.number;
  if (!prNumber) {
    return;
  }

  const { owner, repo } = context.repo;
  const markedBody = `${COMMENT_MARKER}\n${body}`;

  // Look for an existing Thirdwatch comment to update
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const existing = comments.find(
    (c) => c.body?.includes(COMMENT_MARKER),
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: markedBody,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: markedBody,
    });
  }
}
