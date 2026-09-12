#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from invoke_types import Actor
from llm_service import generate_character_background_prompt
from seedream_client import generate_image, is_image_api_available, suggest_size_for_aspect


class BackgroundGenerator:
    def get_preset_background(self, actor: Actor) -> str:
        """
        根据角色特点返回预设背景图片路径
        """
        # 分析角色特点
        bio_lower = actor.bio.lower() if actor.bio else ""
        personality_lower = actor.personality.lower() if actor.personality else ""
        context_lower = actor.context.lower() if actor.context else ""
        all_text = f"{bio_lower} {personality_lower} {context_lower}"

        # 预设背景映射（这些文件需要手动放置在script_scenes目录）
        background_mappings = {
            ("商人", "商会", "贸易"): "preset_merchant_hall.png",
            ("将军", "军官", "士兵"): "preset_military_camp.png",
            ("文人", "学者", "书生"): "preset_study_room.png",
            ("官员", "大人", "知府"): "preset_government_hall.png",
            ("医生", "大夫", "郎中"): "preset_medical_room.png",
            ("侠客", "剑客", "武侠"): "preset_tavern_room.png",
        }

        # 寻找匹配的预设背景
        for keywords, background_file in background_mappings.items():
            if any(keyword in all_text for keyword in keywords):
                return f"script_scenes/{background_file}"

        # 默认背景
        return "script_scenes/preset_default_room.png"

    def generate_character_background(self, actor: Actor) -> str:
        """
        根据角色特点生成聊天背景图片

        Args:
            actor: 角色对象，包含名字、背景、性格等信息

        Returns:
            背景图片路径或base64编码的图片数据，如果失败返回None
        """
        # 如果API不可用，直接返回预设背景
        if not is_image_api_available():
            print(f"🎭 为角色 {actor.name} 使用预设背景")
            preset_path = self.get_preset_background(actor)
            print(f"📁 预设背景路径: {preset_path}")
            return preset_path

        # 生成背景描述提示词
        prompt = generate_character_background_prompt(actor)

        print(f"🎭 为角色 {actor.name} 生成背景图片")
        print(f"📝 生成提示词: {prompt}")

        try:
            base64_image = generate_image(
                prompt=prompt,
                size=suggest_size_for_aspect("16:9"),
            )
            if base64_image:
                print(f"✅ 角色 {actor.name} 背景生成成功")
                return base64_image

            print(f"❌ 角色 {actor.name} 背景生成失败: 请求失败")
            print("🔄 回退使用预设背景")
            return self.get_preset_background(actor)
        except Exception as e:
            print(f"❌ 角色 {actor.name} 背景生成异常: {str(e)}")
            print("🔄 回退使用预设背景")
            return self.get_preset_background(actor)


# 创建全局实例
background_generator = BackgroundGenerator()


def generate_background_for_character(actor: Actor) -> str:
    """
    为角色生成聊天背景图片的便捷函数

    Args:
        actor: 角色对象

    Returns:
        base64编码的图片数据
    """
    return background_generator.generate_character_background(actor)
