import pg from "pg";

const { Pool } = pg;

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://thirdwatch:thirdwatch@localhost:5432/thirdwatch_dev";

export const pool = new Pool({ connectionString: DATABASE_URL });

export const workerDb = {
  async getWatchedDependenciesToCheck(limit: number) {
    const result = await pool.query(
      `SELECT wd.*, o.plan FROM watched_dependencies wd
       JOIN organizations o ON o.id = wd.org_id
       ORDER BY wd.last_checked_at ASC NULLS FIRST LIMIT $1`,
      [limit],
    );
    return result.rows;
  },

  async updateWatchedDependency(
    id: string,
    updates: {
      lastSeenVersion?: string;
      latestVersion?: string;
      lastCheckedAt?: Date;
      etag?: string;
      lastModified?: string;
    },
  ) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (updates.lastSeenVersion !== undefined) {
      sets.push(`last_seen_version = $${idx++}`);
      values.push(updates.lastSeenVersion);
    }
    if (updates.latestVersion !== undefined) {
      sets.push(`latest_version = $${idx++}`);
      values.push(updates.latestVersion);
    }
    if (updates.lastCheckedAt !== undefined) {
      sets.push(`last_checked_at = $${idx++}`);
      values.push(updates.lastCheckedAt);
    }
    if (updates.etag !== undefined) {
      sets.push(`etag = $${idx++}`);
      values.push(updates.etag);
    }
    if (updates.lastModified !== undefined) {
      sets.push(`last_modified = $${idx++}`);
      values.push(updates.lastModified);
    }
    if (sets.length === 0) return;
    values.push(id);
    await pool.query(
      `UPDATE watched_dependencies SET ${sets.join(", ")} WHERE id = $${idx}`,
      values,
    );
  },

  async createChangeEvent(data: {
    dependencyId: string;
    orgId: string;
    changeType: string;
    previousVersion?: string;
    newVersion?: string;
    title: string;
    body?: string;
    url?: string;
    rawData?: unknown;
  }) {
    const result = await pool.query(
      `INSERT INTO change_events (dependency_id, org_id, change_type, previous_version, new_version, title, body, url, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.dependencyId,
        data.orgId,
        data.changeType,
        data.previousVersion ?? null,
        data.newVersion ?? null,
        data.title,
        data.body ?? null,
        data.url ?? null,
        data.rawData ? JSON.stringify(data.rawData) : null,
      ],
    );
    return result.rows[0];
  },

  async updateChangeEvent(id: string, updates: Record<string, unknown>) {
    const columnMap: Record<string, string> = {
      changeType: "change_type",
      classificationConfidence: "classification_confidence",
      classifierUsed: "classifier_used",
      classificationReasoning: "classification_reasoning",
      priority: "priority",
      impactScore: "impact_score",
      affectedFiles: "affected_files",
      affectedUsages: "affected_usages",
      humanSummary: "human_summary",
      notified: "notified",
      notifiedAt: "notified_at",
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(updates)) {
      const col = columnMap[key] ?? key;
      sets.push(`${col} = $${idx++}`);
      values.push(val);
    }
    if (sets.length === 0) return;
    values.push(id);
    await pool.query(
      `UPDATE change_events SET ${sets.join(", ")} WHERE id = $${idx}`,
      values,
    );
  },

  async getLatestTDM(orgId: string, repository: string) {
    const result = await pool.query(
      `SELECT * FROM tdm_uploads WHERE org_id = $1 AND repository = $2 AND is_baseline = true ORDER BY uploaded_at DESC LIMIT 1`,
      [orgId, repository],
    );
    return result.rows[0] ?? null;
  },

  async insertAffectedLocations(
    changeEventId: string,
    locations: Array<{
      file: string;
      line: number;
      context?: string;
      usageType?: string;
    }>,
  ) {
    for (const loc of locations) {
      await pool.query(
        `INSERT INTO affected_locations (change_event_id, file, line, context, usage_type) VALUES ($1, $2, $3, $4, $5)`,
        [
          changeEventId,
          loc.file,
          loc.line,
          loc.context ?? null,
          loc.usageType ?? null,
        ],
      );
    }
  },

  async insertRemediation(
    changeEventId: string,
    rem: {
      suggestionType: string;
      description: string;
      suggestedDiff?: string;
      migrationGuideUrl?: string;
      isAiGenerated?: boolean;
    },
  ) {
    await pool.query(
      `INSERT INTO remediation_suggestions (change_event_id, suggestion_type, description, suggested_diff, migration_guide_url, is_ai_generated)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        changeEventId,
        rem.suggestionType,
        rem.description,
        rem.suggestedDiff ?? null,
        rem.migrationGuideUrl ?? null,
        rem.isAiGenerated ?? false,
      ],
    );
  },

  async getRoutingRules(orgId: string) {
    const result = await pool.query(
      `SELECT rr.*, nc.type as channel_type, nc.name as channel_name, nc.config as channel_config, nc.enabled as channel_enabled
       FROM routing_rules rr
       JOIN notification_channels nc ON nc.id = rr.channel_id
       WHERE rr.org_id = $1 AND nc.enabled = true`,
      [orgId],
    );
    return result.rows;
  },

  async insertNotificationLog(data: {
    orgId: string;
    changeEventId: string;
    channelId: string;
    channelType: string;
    status: string;
    error?: string;
  }) {
    await pool.query(
      `INSERT INTO notification_log (change_event_id, channel_id, channel_type, success, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.changeEventId,
        data.channelId,
        data.channelType,
        data.status === "sent",
        data.error ?? null,
      ],
    );
  },

  async getOrg(orgId: string) {
    const result = await pool.query(
      `SELECT * FROM organizations WHERE id = $1`,
      [orgId],
    );
    return result.rows[0] ?? null;
  },
};
