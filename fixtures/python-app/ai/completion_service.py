"""OpenAI completion service — fixture for Thirdwatch scanner tests."""

import os
import requests
import httpx
from openai import OpenAI

OPENAI_URL = "https://api.openai.com/v1/chat/completions"

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def complete_with_sdk(prompt: str) -> str:
    """Call OpenAI via the official SDK."""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


def complete_with_requests(prompt: str) -> str:
    """Call OpenAI directly with requests."""
    response = requests.post(
        OPENAI_URL,
        headers={
            "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": prompt}],
        },
    )
    return response.json()["choices"][0]["message"]["content"]


async def complete_async(prompt: str) -> str:
    """Call OpenAI with httpx async client."""
    async with httpx.AsyncClient() as http_client:
        response = await http_client.post(
            OPENAI_URL,
            headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
            json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}]},
        )
    return response.json()["choices"][0]["message"]["content"]
