import pg from "pg";

const { Pool } = pg;

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://thirdwatch:thirdwatch@localhost:5432/thirdwatch_dev";

export const pool = new Pool({ connectionString: DATABASE_URL });

const COLUMN_MAP: Record<string, string> = {
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
  lastSeenVersion: "last_seen_version",
  latestVersion: "latest_version",
  lastCheckedAt: "last_checked_at",
  etag: "etag",
  lastModified: "last_modified",
};

function toColumn(key: string): string {
  return COLUMN_MAP[key] ?? key;
}

export const db = {
  async getOrgByApiKeyHash(keyHash: string) {
    await pool.query(
      `UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1`,
      [keyHash],
    );
    const result = await pool.query(
      `SELECT ak.org_id, ak.permissions, o.plan
       FROM api_keys ak
       JOIN organizations o ON o.id = ak.org_id
       WHERE ak.key_hash = $1`,
      [keyHash],
    );
    return result.rows[0] ?? null;
  },

  async getOrg(orgId: string) {
    const result = await pool.query(
      `SELECT * FROM organizations WHERE id = $1`,
      [orgId],
    );
    return result.rows[0] ?? null;
  },

  async createOrg(name: string, githubOrg: string | null, plan = "free") {
    const result = await pool.query(
      `INSERT INTO organizations (name, github_org, plan) VALUES ($1, $2, $3) RETURNING *`,
      [name, githubOrg, plan],
    );
    return result.rows[0];
  },

  async updateOrgPlan(orgId: string, plan: string) {
    await pool.query(`UPDATE organizations SET plan = $1 WHERE id = $2`, [
      plan,
      orgId,
    ]);
  },

  async downgradeOrg(orgId: string, plan: string) {
    await pool.query(`UPDATE organizations SET plan = $1 WHERE id = $2`, [
      plan,
      orgId,
    ]);
  },

  async deleteOrg(orgId: string) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM routing_rules WHERE org_id = $1`,
        [orgId],
      );
      await client.query(
        `DELETE FROM notification_channels WHERE org_id = $1`,
        [orgId],
      );
      await client.query(
        `DELETE FROM notification_log WHERE change_event_id IN (SELECT id FROM change_events WHERE org_id = $1)`,
        [orgId],
      );
      await client.query(
        `DELETE FROM remediation_suggestions WHERE change_event_id IN (SELECT id FROM change_events WHERE org_id = $1)`,
        [orgId],
      );
      await client.query(
        `DELETE FROM affected_locations WHERE change_event_id IN (SELECT id FROM change_events WHERE org_id = $1)`,
        [orgId],
      );
      await client.query(
        `DELETE FROM change_events WHERE org_id = $1`,
        [orgId],
      );
      await client.query(
        `DELETE FROM watched_dependencies WHERE org_id = $1`,
        [orgId],
      );
      await client.query(
        `DELETE FROM tdm_uploads WHERE org_id = $1`,
        [orgId],
      );
      await client.query(`DELETE FROM api_keys WHERE org_id = $1`, [orgId]);
      await client.query(`DELETE FROM users WHERE org_id = $1`, [orgId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async createUser(
    orgId: string,
    githubLogin: string,
    githubId: number,
    avatarUrl: string | null,
    role = "member",
  ) {
    const result = await pool.query(
      `INSERT INTO users (org_id, github_login, github_id, avatar_url, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (github_id) DO UPDATE SET avatar_url = $4
       RETURNING *`,
      [orgId, githubLogin, githubId, avatarUrl, role],
    );
    return result.rows[0];
  },

  async getUserByGithubId(githubId: number) {
    const result = await pool.query(
      `SELECT * FROM users WHERE github_id = $1`,
      [githubId],
    );
    return result.rows[0] ?? null;
  },

  async createApiKey(
    orgId: string,
    keyHash: string,
    keyPrefix: string,
    name: string | null,
  ) {
    const result = await pool.query(
      `INSERT INTO api_keys (org_id, key_hash, key_prefix, name) VALUES ($1, $2, $3, $4) RETURNING id, key_prefix, name, permissions, created_at`,
      [orgId, keyHash, keyPrefix, name],
    );
    return result.rows[0];
  },

  async listApiKeys(orgId: string) {
    const result = await pool.query(
      `SELECT id, key_prefix, name, permissions, last_used_at, created_at FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return result.rows;
  },

  async deleteApiKey(keyId: string, orgId: string) {
    await pool.query(
      `DELETE FROM api_keys WHERE id = $1 AND org_id = $2`,
      [keyId, orgId],
    );
  },

  async insertTdmUpload(
    orgId: string,
    repository: string,
    scannerVersion: string | null,
    languages: string[],
    dependencyCount: number,
    tdm: unknown,
    isBaseline: boolean,
  ) {
    if (isBaseline) {
      await pool.query(
        `UPDATE tdm_uploads SET is_baseline = false WHERE org_id = $1 AND repository = $2 AND is_baseline = true`,
        [orgId, repository],
      );
    }
    const result = await pool.query(
      `INSERT INTO tdm_uploads (org_id, repository, scanner_version, languages, dependency_count, tdm, is_baseline)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, repository, scannerVersion, languages, dependencyCount, JSON.stringify(tdm), isBaseline],
    );
    return result.rows[0];
  },

  async getLatestTDM(orgId: string, repository: string) {
    const result = await pool.query(
      `SELECT * FROM tdm_uploads WHERE org_id = $1 AND repository = $2 AND is_baseline = true ORDER BY uploaded_at DESC LIMIT 1`,
      [orgId, repository],
    );
    return result.rows[0] ?? null;
  },

  async countDistinctRepos(orgId: string) {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT repository) as count FROM tdm_uploads WHERE org_id = $1`,
      [orgId],
    );
    return Number(result.rows[0]?.count ?? 0);
  },

  async upsertWatchedDependency(
    orgId: string,
    dep: {
      identifier: string;
      kind: string;
      ecosystem?: string;
      provider?: string;
      currentVersion?: string;
      githubRepo?: string;
      repositories?: string[];
      totalUsages?: number;
      totalFiles?: number;
    },
  ) {
    const result = await pool.query(
      `INSERT INTO watched_dependencies (org_id, identifier, kind, ecosystem, provider, current_version, github_repo, repositories, total_usages, total_files)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (org_id, identifier) DO UPDATE SET
         current_version = COALESCE(EXCLUDED.current_version, watched_dependencies.current_version),
         provider = COALESCE(EXCLUDED.provider, watched_dependencies.provider),
         repositories = EXCLUDED.repositories,
         total_usages = COALESCE(EXCLUDED.total_usages, watched_dependencies.total_usages),
         total_files = COALESCE(EXCLUDED.total_files, watched_dependencies.total_files)
       RETURNING *`,
      [
        orgId,
        dep.identifier,
        dep.kind,
        dep.ecosystem ?? null,
        dep.provider ?? null,
        dep.currentVersion ?? null,
        dep.githubRepo ?? null,
        dep.repositories ?? [],
        dep.totalUsages ?? 0,
        dep.totalFiles ?? 0,
      ],
    );
    return result.rows[0];
  },

  async listWatchedDependencies(orgId: string) {
    const result = await pool.query(
      `SELECT * FROM watched_dependencies WHERE org_id = $1 ORDER BY identifier`,
      [orgId],
    );
    return result.rows;
  },

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
    updates: Partial<{
      lastSeenVersion: string;
      latestVersion: string;
      lastCheckedAt: Date;
      etag: string;
      lastModified: string;
    }>,
  ) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        sets.push(`${toColumn(key)} = $${idx++}`);
        values.push(val);
      }
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
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        sets.push(`${toColumn(key)} = $${idx++}`);
        values.push(val);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    await pool.query(
      `UPDATE change_events SET ${sets.join(", ")} WHERE id = $${idx}`,
      values,
    );
  },

  async listChangeEvents(
    orgId: string,
    opts: {
      since?: string;
      priority?: string;
      dependency?: string;
      repository?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const conditions = ["ce.org_id = $1"];
    const values: unknown[] = [orgId];
    let idx = 2;

    if (opts.since) {
      conditions.push(`ce.detected_at >= $${idx++}`);
      values.push(opts.since);
    }
    if (opts.priority) {
      const priorities = opts.priority.split(",");
      conditions.push(`ce.priority = ANY($${idx++})`);
      values.push(priorities);
    }
    if (opts.dependency) {
      conditions.push(`wd.identifier ILIKE $${idx++}`);
      values.push(`%${opts.dependency}%`);
    }
    if (opts.repository) {
      conditions.push(`$${idx++} = ANY(wd.repositories)`);
      values.push(opts.repository);
    }

    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    values.push(limit, offset);

    const result = await pool.query(
      `SELECT ce.*, wd.identifier as dep_identifier, wd.kind as dep_kind, wd.ecosystem as dep_ecosystem, wd.provider as dep_provider
       FROM change_events ce
       LEFT JOIN watched_dependencies wd ON wd.id = ce.dependency_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ce.detected_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      values,
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM change_events ce
       LEFT JOIN watched_dependencies wd ON wd.id = ce.dependency_id
       WHERE ${conditions.join(" AND ")}`,
      values.slice(0, -2),
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    return {
      changes: result.rows,
      total,
      hasMore: offset + limit < total,
    };
  },

  async getChangeEvent(id: string, orgId: string) {
    const result = await pool.query(
      `SELECT ce.*, wd.identifier as dep_identifier, wd.kind as dep_kind, wd.ecosystem as dep_ecosystem, wd.provider as dep_provider
       FROM change_events ce
       LEFT JOIN watched_dependencies wd ON wd.id = ce.dependency_id
       WHERE ce.id = $1 AND ce.org_id = $2`,
      [id, orgId],
    );
    const change = result.rows[0];
    if (!change) return null;

    const locations = await pool.query(
      `SELECT * FROM affected_locations WHERE change_event_id = $1`,
      [id],
    );
    const remediations = await pool.query(
      `SELECT * FROM remediation_suggestions WHERE change_event_id = $1`,
      [id],
    );

    return {
      ...change,
      affectedLocations: locations.rows,
      remediations: remediations.rows,
    };
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
        [changeEventId, loc.file, loc.line, loc.context ?? null, loc.usageType ?? null],
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

  async createNotificationChannel(
    orgId: string,
    type: string,
    name: string,
    config: unknown,
  ) {
    const result = await pool.query(
      `INSERT INTO notification_channels (org_id, type, name, config) VALUES ($1, $2, $3, $4) RETURNING *`,
      [orgId, type, name, JSON.stringify(config)],
    );
    return result.rows[0];
  },

  async listNotificationChannels(orgId: string) {
    const result = await pool.query(
      `SELECT * FROM notification_channels WHERE org_id = $1 ORDER BY created_at`,
      [orgId],
    );
    return result.rows;
  },

  async updateNotificationChannel(
    id: string,
    orgId: string,
    updates: { name?: string; config?: unknown; enabled?: boolean },
  ) {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (updates.name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.config !== undefined) {
      sets.push(`config = $${idx++}`);
      values.push(JSON.stringify(updates.config));
    }
    if (updates.enabled !== undefined) {
      sets.push(`enabled = $${idx++}`);
      values.push(updates.enabled);
    }
    if (sets.length === 0) return null;
    values.push(id, orgId);
    const result = await pool.query(
      `UPDATE notification_channels SET ${sets.join(", ")} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  },

  async deleteNotificationChannel(id: string, orgId: string) {
    await pool.query(
      `DELETE FROM routing_rules WHERE channel_id = $1 AND org_id = $2`,
      [id, orgId],
    );
    await pool.query(
      `DELETE FROM notification_channels WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
  },

  async createRoutingRule(
    orgId: string,
    channelId: string,
    rule: {
      priority?: string[];
      changeCategory?: string[];
      repositories?: string[];
      schedule?: string;
    },
  ) {
    const result = await pool.query(
      `INSERT INTO routing_rules (org_id, channel_id, priority, change_category, repositories, schedule)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        orgId,
        channelId,
        rule.priority ?? [],
        rule.changeCategory ?? [],
        rule.repositories ?? [],
        rule.schedule ?? "immediate",
      ],
    );
    return result.rows[0];
  },

  async listRoutingRules(orgId: string) {
    const result = await pool.query(
      `SELECT rr.*, nc.type as channel_type, nc.name as channel_name
       FROM routing_rules rr
       JOIN notification_channels nc ON nc.id = rr.channel_id
       WHERE rr.org_id = $1 ORDER BY rr.created_at`,
      [orgId],
    );
    return result.rows;
  },

  async deleteRoutingRule(id: string, orgId: string) {
    await pool.query(
      `DELETE FROM routing_rules WHERE id = $1 AND org_id = $2`,
      [id, orgId],
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
    channel: string;
    status: string;
    externalId?: string;
    externalUrl?: string;
    error?: string;
  }) {
    await pool.query(
      `INSERT INTO notification_log (change_event_id, channel_id, channel_type, success, external_id, url, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.changeEventId,
        data.channel,
        data.channel,
        data.status === "sent",
        data.externalId ?? null,
        data.externalUrl ?? null,
        data.error ?? null,
      ],
    );
  },

  async getOrgUsage(orgId: string) {
    const org = await pool.query(
      `SELECT plan FROM organizations WHERE id = $1`,
      [orgId],
    );
    const repos = await pool.query(
      `SELECT COUNT(DISTINCT repository) as count FROM tdm_uploads WHERE org_id = $1`,
      [orgId],
    );
    const deps = await pool.query(
      `SELECT COUNT(*) as count FROM watched_dependencies WHERE org_id = $1`,
      [orgId],
    );
    const changes = await pool.query(
      `SELECT COUNT(*) as count FROM change_events WHERE org_id = $1 AND detected_at >= now() - interval '30 days'`,
      [orgId],
    );
    const notifSent = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE success = true) as sent, COUNT(*) FILTER (WHERE success = false) as failed
       FROM notification_log WHERE change_event_id IN (SELECT id FROM change_events WHERE org_id = $1)`,
      [orgId],
    );

    const plan = org.rows[0]?.plan ?? "free";
    const PLAN_LIMITS: Record<string, number | null> = {
      free: 3,
      team: null,
      enterprise: null,
    };

    return {
      plan,
      repositories: {
        used: Number(repos.rows[0]?.count ?? 0),
        limit: PLAN_LIMITS[plan] ?? null,
      },
      dependencies: { monitored: Number(deps.rows[0]?.count ?? 0) },
      changes: { last30Days: Number(changes.rows[0]?.count ?? 0) },
      notifications: {
        sent: Number(notifSent.rows[0]?.sent ?? 0),
        failed: Number(notifSent.rows[0]?.failed ?? 0),
      },
    };
  },

  async exportOrgData(orgId: string) {
    const org = await pool.query(
      `SELECT id, name, github_org, plan, created_at FROM organizations WHERE id = $1`,
      [orgId],
    );
    const users = await pool.query(
      `SELECT id, github_login, github_id, avatar_url, role, created_at FROM users WHERE org_id = $1`,
      [orgId],
    );
    const keys = await pool.query(
      `SELECT id, key_prefix, name, permissions, created_at FROM api_keys WHERE org_id = $1`,
      [orgId],
    );
    const tdms = await pool.query(
      `SELECT id, repository, scanner_version, languages, dependency_count, uploaded_at, is_baseline FROM tdm_uploads WHERE org_id = $1`,
      [orgId],
    );
    const deps = await pool.query(
      `SELECT * FROM watched_dependencies WHERE org_id = $1`,
      [orgId],
    );
    const changes = await pool.query(
      `SELECT * FROM change_events WHERE org_id = $1`,
      [orgId],
    );
    const channels = await pool.query(
      `SELECT * FROM notification_channels WHERE org_id = $1`,
      [orgId],
    );
    const rules = await pool.query(
      `SELECT * FROM routing_rules WHERE org_id = $1`,
      [orgId],
    );

    return {
      organization: org.rows[0],
      users: users.rows,
      apiKeys: keys.rows,
      tdmUploads: tdms.rows,
      dependencies: deps.rows,
      changeEvents: changes.rows,
      notificationChannels: channels.rows,
      routingRules: rules.rows,
    };
  },
};
