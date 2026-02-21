"""Stripe payment client — fixture for Thirdwatch scanner tests."""

import stripe
import os

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

STRIPE_API_BASE = "https://api.stripe.com"


def create_charge(amount: int, currency: str, source: str) -> dict:
    """Create a Stripe charge."""
    charge = stripe.Charge.create(
        amount=amount,
        currency=currency,
        source=source,
        description="Thirdwatch fixture charge",
    )
    return charge


def create_payment_intent(amount: int, currency: str) -> dict:
    """Create a Stripe PaymentIntent."""
    intent = stripe.PaymentIntent.create(
        amount=amount,
        currency=currency,
    )
    return intent


def list_customers() -> list:
    """List all Stripe customers."""
    import requests

    response = requests.get(
        f"{STRIPE_API_BASE}/v1/customers",
        headers={"Authorization": f"Bearer {stripe.api_key}"},
    )
    return response.json().get("data", [])


def webhook_endpoint_url() -> str:
    """Return the webhook endpoint URL registered with Stripe."""
    return "https://app.mycompany.com/webhooks/stripe"
