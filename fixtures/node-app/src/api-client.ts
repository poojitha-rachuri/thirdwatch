/**
 * External API calls — fixture for Thirdwatch scanner tests.
 * Tests: fetch, axios, template literals, env var resolution.
 */

import axios from "axios";

const PARTNER_API_BASE = process.env["PARTNER_API_BASE"] ?? "https://api.partner.com";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Direct fetch with literal URL
export async function getOpenAICompletion(prompt: string): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["OPENAI_API_KEY"]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}

// Axios with template literal URL
export async function getPartnerOrders(customerId: string) {
  const response = await axios.get(`${PARTNER_API_BASE}/v2/orders`, {
    params: { customer_id: customerId },
    headers: { "X-API-Key": process.env["PARTNER_API_KEY"] },
  });
  return response.data;
}

// Axios with variable URL
export async function postPartnerWebhook(event: object) {
  const webhookUrl = process.env["PARTNER_WEBHOOK_URL"];
  return axios.post(webhookUrl!, event);
}
