"""
Fixture: Python FastAPI app using multiple external SDKs.
Used to test Thirdwatch's multi-provider detection in a mixed-language monorepo.
"""
import os
import stripe
import sentry_sdk
from openai import OpenAI
from twilio.rest import Client as TwilioClient
import boto3

# Sentry — error tracking
sentry_sdk.init(dsn=os.environ["SENTRY_DSN"])

# Stripe — payments
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

def create_checkout_session(amount: int, currency: str = "usd") -> str:
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price_data": {"currency": currency, "unit_amount": amount}, "quantity": 1}],
        mode="payment",
        success_url="https://example.com/success",
        cancel_url="https://example.com/cancel",
    )
    return session.url

# OpenAI — AI completions
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

def summarize(text: str) -> str:
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": f"Summarize: {text}"}],
    )
    return resp.choices[0].message.content

# Twilio — SMS
twilio = TwilioClient(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])

def send_sms(to: str, body: str) -> None:
    twilio.messages.create(to=to, from_="+15005550006", body=body)

# AWS S3 — file storage
s3 = boto3.client("s3", region_name="us-east-1")

def upload_file(bucket: str, key: str, data: bytes) -> None:
    s3.put_object(Bucket=bucket, Key=key, Body=data)
