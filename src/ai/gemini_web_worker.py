import asyncio
import json
import os
import sys
from typing import Any


def emit(message: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


async def main() -> None:
    if not os.environ.get("GEMINI_COOKIE_1PSID"):
        env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
        if os.path.exists(env_file):
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            k, v = line.split("=", 1)
                            k, v = k.strip(), v.strip().strip("'\"")
                            if k not in os.environ:
                                os.environ[k] = v
            except Exception:
                pass

    cookie = os.environ.get("GEMINI_COOKIE_1PSID", "").strip()
    if not cookie:
        emit({"type": "ready", "ok": False, "error": "GEMINI_COOKIE_1PSID is not set."})
        return

    try:
        from gemini_webapi import GeminiClient
    except ImportError:
        emit(
            {
                "type": "ready",
                "ok": False,
                "error": "gemini_webapi is not installed. Install it with: python3 -m pip install -U gemini_webapi",
            }
        )
        return

    try:
        client = GeminiClient(cookie, os.environ.get("GEMINI_COOKIE_1PSIDTS") or None)
        await client.init(timeout=60, auto_close=False, auto_refresh=True)
        chat = client.start_chat()
    except Exception as error:
        emit(
            {
                "type": "ready",
                "ok": False,
                "error": f"Gemini initialization failed ({type(error).__name__}). Check the configured session cookies.",
            }
        )
        return

    emit({"type": "ready", "ok": True})

    while line := await asyncio.to_thread(sys.stdin.readline):
        request: Any = None
        try:
            request = json.loads(line)
            if not isinstance(request, dict):
                emit({"id": None, "error": "Invalid Gemini worker request."})
                continue
            request_id = request.get("id")
            if not isinstance(request_id, int):
                emit({"id": None, "error": "Missing or invalid request id."})
                continue

            action = request.get("action")

            # 1. Action: List recent chats from Gemini Web
            if action == "list_chats":
                try:
                    await client._fetch_recent_chats()
                except Exception:
                    pass
                chats = client.list_chats() or []
                chat_list = [
                    {
                        "cid": c.cid,
                        "title": c.title or "Untitled Conversation",
                        "timestamp": c.timestamp,
                    }
                    for c in chats
                ]
                emit({"id": request_id, "ok": True, "chats": chat_list})
                continue

            # 2. Action: Select / Continue existing chat
            if action == "select_chat":
                cid = request.get("cid", "")
                metadata = request.get("metadata")
                if metadata and isinstance(metadata, list):
                    chat = client.start_chat(metadata=metadata)
                elif cid:
                    chat = client.start_chat(cid=cid, metadata=[cid, "", ""])
                else:
                    chat = client.start_chat()
                emit({"id": request_id, "ok": True, "cid": getattr(chat, "cid", cid)})
                continue

            # 3. Action: Start fresh new chat
            if action == "new_chat":
                chat = client.start_chat()
                emit({"id": request_id, "ok": True, "cid": getattr(chat, "cid", "")})
                continue

            # 4. Action: Read previous chat turns
            if action == "read_chat":
                cid = request.get("cid", "")
                turns_data = []
                if cid:
                    try:
                        history = await client.read_chat(cid)
                        if history and history.turns:
                            turns_data = [
                                {"role": t.role, "text": t.text}
                                for t in reversed(history.turns)
                                if getattr(t, "text", None)
                            ]
                    except Exception as err:
                        emit({"id": request_id, "ok": False, "error": f"Failed to read chat: {err}"})
                        continue
                emit({"id": request_id, "ok": True, "turns": turns_data})
                continue

            # 5. Default: Send message / prompt
            prompt = request.get("prompt")
            if not isinstance(prompt, str) or not prompt.strip():
                emit({"id": request_id, "error": "Invalid or empty prompt."})
                continue

            response = await chat.send_message(prompt, temporary=False)
            text = response.text
            if not isinstance(text, str) or not text.strip():
                emit({"id": request_id, "error": "Gemini returned no text."})
            else:
                emit(
                    {
                        "id": request_id,
                        "text": text.strip(),
                        "cid": getattr(chat, "cid", ""),
                        "metadata": getattr(chat, "metadata", None),
                    }
                )
        except Exception as error:
            request_id = request.get("id") if isinstance(request, dict) else None
            emit(
                {
                    "id": request_id,
                    "error": f"Gemini request failed ({type(error).__name__}: {error}).",
                }
            )


if __name__ == "__main__":
    asyncio.run(main())
