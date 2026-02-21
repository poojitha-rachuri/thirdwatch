/**
 * Fixture: TypeScript app with multiple SDK integrations.
 * Used to test JS/TS detection in a multi-app monorepo context.
 */
import Anthropic from "@anthropic-ai/sdk";
import { WebClient as SlackClient } from "@slack/web-api";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Anthropic — AI
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function generateReply(message: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: message }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

// Slack — team notifications
const slack = new SlackClient(process.env.SLACK_BOT_TOKEN!);

export async function notifySlack(channel: string, text: string): Promise<void> {
  await slack.chat.postMessage({ channel, text });
}

// Supabase — database
const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function fetchUser(id: string) {
  const { data } = await supabase.from("users").select("*").eq("id", id).single();
  return data;
}

// Resend — transactional email
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: "hello@example.com",
    to,
    subject: `Welcome, ${name}!`,
    text: `Hi ${name}, thanks for signing up.`,
  });
}
