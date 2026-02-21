/**
 * SDK instantiation — fixture for Thirdwatch scanner tests.
 * Tests: new SDK(), createClient(), AWS SDK clients.
 */

import { OpenAI } from "openai";
import Stripe from "stripe";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Client as PgClient } from "pg";
import { createClient as createRedisClient } from "redis";
import twilio from "twilio";

// OpenAI SDK
const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

// Stripe SDK
const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

// AWS SDK clients
const s3 = new S3Client({ region: "us-east-1" });
const sqs = new SQSClient({ region: "us-east-1" });

// Postgres
const pg = new PgClient({ connectionString: process.env["DATABASE_URL"] });

// Redis
const redis = createRedisClient({ url: process.env["REDIS_URL"] ?? "redis://localhost:6379" });

// Twilio
const twilioClient = twilio(
  process.env["TWILIO_ACCOUNT_SID"],
  process.env["TWILIO_AUTH_TOKEN"],
);

export async function uploadFile(bucket: string, key: string, body: Buffer) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
}

export async function sendQueueMessage(queueUrl: string, message: string) {
  await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: message }));
}

export { openai, stripe, pg, redis, twilioClient };
