import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../db.js";

const GITHUB_CLIENT_ID = process.env["GITHUB_CLIENT_ID"] ?? "";
const GITHUB_CLIENT_SECRET = process.env["GITHUB_CLIENT_SECRET"] ?? "";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { code: string; state: string } }>(
    "/api/v1/auth/github",
    async (req, reply) => {
      const { code } = req.body;
      if (!code) {
        return reply.status(400).send({ error: "missing_code" });
      }

      const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
          }),
        },
      );
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
      };
      if (!tokenData.access_token) {
        return reply.status(401).send({ error: "github_auth_failed" });
      }

      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
        },
      });
      const githubUser = (await userRes.json()) as {
        id: number;
        login: string;
        avatar_url: string;
      };

      let user = await db.getUserByGithubId(githubUser.id);
      if (!user) {
        const org = await db.createOrg(githubUser.login, githubUser.login);
        user = await db.createUser(
          org.id,
          githubUser.login,
          githubUser.id,
          githubUser.avatar_url,
          "admin",
        );
      }

      const rawKey = `tw_live_${randomBytes(24).toString("hex")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.slice(0, 15) + "...";
      await db.createApiKey(
        user.org_id,
        keyHash,
        keyPrefix,
        `oauth-${githubUser.login}`,
      );

      const org = await db.getOrg(user.org_id);

      return reply.send({
        token: rawKey,
        org: { id: org.id, name: org.name, plan: org.plan },
        user: {
          id: user.id,
          login: githubUser.login,
          avatar_url: githubUser.avatar_url,
        },
      });
    },
  );
}
