"""Infrastructure connections — fixture for Thirdwatch scanner tests."""

import os
import boto3
import redis
import psycopg2

# AWS S3
s3_client = boto3.client("s3", region_name="us-east-1")
sqs_client = boto3.client("sqs", region_name="us-east-1")
dynamodb = boto3.resource("dynamodb")

# Redis cache
cache = redis.Redis(host="cache.internal", port=6379, db=0)

# Also test env-var-based connection
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")


def get_db_connection():
    """Connect to PostgreSQL."""
    return psycopg2.connect(os.environ["DATABASE_URL"])


def upload_to_s3(bucket: str, key: str, data: bytes) -> None:
    s3_client.put_object(Bucket=bucket, Key=key, Body=data)


def send_sqs_message(queue_url: str, body: str) -> None:
    sqs_client.send_message(QueueUrl=queue_url, MessageBody=body)
