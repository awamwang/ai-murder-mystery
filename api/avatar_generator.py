from typing import Optional

from seedream_client import generate_image, suggest_size_for_aspect


class AvatarGenerator:
    def generate_character_avatar(self, character_name: str, character_bio: str) -> Optional[str]:
        """
        根据角色描述生成电影写真风格的头像

        Args:
            character_name: 角色名字
            character_bio: 角色背景

        Returns:
            base64编码的图片数据，如果失败返回None
        """
        # 构建详细的prompt（只使用名称和背景，不包含性格）
        prompt = f"""
电影写真风格肖像照，专业摄影，{character_name}，{character_bio}。
上半身特写，1:1方形构图，电影级别的光影效果，高清细腻，真实感强，
**近景照**，专业人像摄影，电影海报质感，戏剧性光影，深度刻画人物特征。
真实人物肖像，电影剧照风格，高品质，细节丰富。
        """.strip()

        print(f"🎭 为角色 {character_name} 生成头像")
        print(f"📝 生成提示词: {prompt}")

        base64_image = generate_image(
            prompt=prompt,
            size=suggest_size_for_aspect("1:1"),
        )
        if base64_image:
            print(f"✅ 角色 {character_name} 头像生成成功")
        else:
            print(f"❌ 角色 {character_name} 头像生成失败")
        return base64_image


# 全局实例
avatar_generator = AvatarGenerator()


def generate_avatar_for_character(character_name: str, character_bio: str) -> Optional[str]:
    """
    为角色生成头像的便捷函数

    Args:
        character_name: 角色名字
        character_bio: 角色背景（身份、外貌特征等具体描述）

    Returns:
        base64编码的图片数据，如果失败返回None
    """
    return avatar_generator.generate_character_avatar(character_name, character_bio)
