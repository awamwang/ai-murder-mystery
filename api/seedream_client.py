"""火山方舟 Agent Plan / Seedream 图片生成客户端。"""

import base64
from typing import Optional

import requests

from settings import API_KEY, IMAGE_MODEL, OPENAI_API_BASE


def _normalize_base_url(base_url: str) -> str:
    return (base_url or "").rstrip("/")


def _images_endpoint() -> str:
    """从 OPENAI_API_BASE 推导 images/generations 地址。"""
    base = _normalize_base_url(OPENAI_API_BASE)
    if not base:
        base = "https://ark.cn-beijing.volces.com/api/plan/v3"
    return f"{base}/images/generations"


def _get_image_model() -> str:
    return IMAGE_MODEL or "doubao-seedream-5-0-lite-260128"


def is_image_api_available() -> bool:
    return bool(API_KEY and _normalize_base_url(OPENAI_API_BASE or ""))


def _download_image_as_base64(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        return base64.b64encode(resp.content).decode("utf-8")
    except Exception as err:
        print(f"❌ 下载生成图片失败: {err}")
        return None


def generate_image(
    prompt: str,
    size: str = "2K",
    watermark: bool = False,
) -> Optional[str]:
    """
    调用 Seedream 文生图，返回 base64 图片数据（不含 data URL 前缀）。

    Args:
        prompt: 图片生成提示词
        size: 分辨率档位（如 1K/2K）或宽高像素（如 1024x1024）
        watermark: 是否添加 AI 水印
    """
    if not API_KEY:
        print("❌ 图片生成失败: 未配置 API_KEY")
        return None

    endpoint = _images_endpoint()
    model = _get_image_model()
    payload = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "response_format": "b64_json",
        "watermark": watermark,
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    print(f"🎨 Seedream 请求: {endpoint}")
    print(f"📦 模型: {model}, size={size}")

    try:
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=180)
        text = resp.text
        if resp.status_code >= 400:
            print(f"❌ Seedream 请求失败 HTTP {resp.status_code}: {text[:800]}")
            return None

        data = resp.json()
        items = data.get("data") or []
        if not items:
            print(f"❌ Seedream 响应无图片数据: {data}")
            return None

        first = items[0]
        b64 = first.get("b64_json")
        if b64:
            # 兼容可能带 data URL 前缀的返回
            if "," in b64 and b64.startswith("data:"):
                b64 = b64.split(",", 1)[1]
            return b64

        url = first.get("url")
        if url:
            print("ℹ️ 响应为 URL，正在下载为 base64")
            return _download_image_as_base64(url)

        print(f"❌ Seedream 响应格式无法解析: {first.keys() if isinstance(first, dict) else type(first)}")
        return None
    except Exception as err:
        print(f"❌ Seedream 图片生成异常: {err}")
        return None


def suggest_size_for_aspect(aspect: str) -> str:
    """
    按场景返回合适的 size 参数。
    Seedream 5.0 lite 支持 2K/3K/4K，宽高比在 prompt 中描述。
    """
    aspect = (aspect or "").lower()
    # lite 最低档为 2K；具体比例由提示词约束
    if aspect in ("1:1", "square", "4:3", "cover", "16:9", "landscape", "background"):
        return "2K"
    return "2K"
