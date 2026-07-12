import json
import os
import re
from typing import Any

from dotenv import load_dotenv

load_dotenv()


class LLMResponseError(ValueError):
    pass


def extract_json(raw_text: str) -> dict[str, Any]:
    cleaned = re.sub(r"<think>.*?(?:</think>|$)", "", raw_text, flags=re.DOTALL).strip()
    cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise LLMResponseError("LLM returned invalid JSON.")

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise LLMResponseError("LLM returned invalid JSON.") from exc


class LLMClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
        self.mock_mode = not self.api_key
        self._client = None

        if not self.mock_mode:
            try:
                from openai import OpenAI

                self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
            except Exception:
                self.mock_mode = True

    def complete(self, prompt: str, json_mode: bool = True) -> str:
        if self.mock_mode or self._client is None:
            return "{}"

        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You explain lab reports in simple educational language. "
                        "Never diagnose, prescribe, recommend dosing, or tell users to start or stop medicine."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = self._client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""
