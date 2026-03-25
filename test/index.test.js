import { describe, expect, test } from "bun:test";
import {
  buildCustomChangeEvent,
  buildPullRequestChangeEvent,
  buildPushChangeEvent,
  selectChangeEvent,
} from "../src/index.js";

describe("selectChangeEvent", () => {
  test("custom event takes precedence over push", () => {
    const event = selectChangeEvent({
      env: {
        INPUT_INTEGRATION_KEY: "rk",
        INPUT_CUSTOM_EVENT: "Deployment succeeded",
        GITHUB_EVENT_NAME: "push",
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_RUN_ID: "42",
      },
      payload: {
        ref: "refs/heads/main",
      },
      now: new Date("2026-03-25T00:00:00.000Z"),
    });

    expect(event).toEqual(
      buildCustomChangeEvent(
        "Deployment succeeded",
        "rk",
        {
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_RUN_ID: "42",
        },
        new Date("2026-03-25T00:00:00.000Z"),
      ),
    );
  });

  test("returns null for unsupported events", () => {
    const event = selectChangeEvent({
      env: {
        INPUT_INTEGRATION_KEY: "rk",
        INPUT_CUSTOM_EVENT: "",
        GITHUB_EVENT_NAME: "workflow_dispatch",
      },
      payload: {},
    });

    expect(event).toBeNull();
  });
});

describe("payload builders", () => {
  test("builds push payload", () => {
    const event = buildPushChangeEvent(
      {
        ref: "refs/heads/main",
        compare: "https://github.com/owner/repo/compare/a...b",
        repository: {
          full_name: "owner/repo",
          html_url: "https://github.com/owner/repo",
        },
        sender: {
          login: "alice",
          html_url: "https://github.com/alice",
        },
      },
      "rk",
      new Date("2026-03-25T00:00:00.000Z"),
    );

    expect(event.payload.summary).toBe("alice pushed branch main from owner/repo");
    expect(event.payload.timestamp).toBe("2026-03-25T00:00:00.000Z");
    expect(event.links).toEqual([
      { href: "https://github.com/owner/repo/compare/a...b", text: "View on GitHub" },
      { href: "https://github.com/owner/repo", text: "Repo" },
      { href: "https://github.com/alice", text: "Sender - alice" },
    ]);
  });

  test("builds merged pull request payload", () => {
    const event = buildPullRequestChangeEvent(
      {
        action: "closed",
        repository: {
          full_name: "owner/repo",
        },
        pull_request: {
          title: "Ship feature",
          body: "details",
          commits: 3,
          additions: 10,
          deletions: 2,
          changed_files: 4,
          review_comments: 1,
          merged_at: "2026-03-24T12:34:56.000Z",
          html_url: "https://github.com/owner/repo/pull/1",
          user: {
            login: "author",
            html_url: "https://github.com/author",
          },
          merged_by: {
            login: "merger",
            html_url: "https://github.com/merger",
          },
        },
      },
      "rk",
    );

    expect(event.payload.summary).toBe("[PR Merged - owner/repo] Ship feature");
    expect(event.payload.timestamp).toBe("2026-03-24T12:34:56.000Z");
    expect(event.payload.custom_details).toEqual({
      body: "details",
      repo: "owner/repo",
      commits: 3,
      review_comments: 1,
      additions: 10,
      deletions: 2,
      changed_files: 4,
    });
    expect(event.links).toEqual([
      { href: "https://github.com/owner/repo/pull/1", text: "View on GitHub" },
      { href: "https://github.com/merger", text: "Merged by - merger" },
      { href: "https://github.com/author", text: "Opened by - author" },
    ]);
  });
});
