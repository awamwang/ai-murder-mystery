from typing import Optional

from seedream_client import generate_image, suggest_size_for_aspect


class CoverGenerator:
    def generate_script_cover(self, script_title: str, script_description: str) -> Optional[str]:
        """
        根据剧本标题和描述生成电影写真风格的封面

        Args:
            script_title: 剧本标题
            script_description: 剧本描述

        Returns:
            base64编码的图片数据，如果失败返回None
        """
        # 构建详细的prompt
        prompt = f"""
电影海报风格封面，{script_title}，{script_description}。
4:3横版构图（撑满画面），电影级别的视觉设计，悬疑氛围，戏剧性光影效果，
高清细腻，电影海报质感，专业摄影，深度刻画氛围。
悬疑推理题材，电影宣传海报风格，高品质，细节丰富。
营造神秘悬疑氛围，很有画面感。
        """.strip()

        print(f"🎬 为剧本 {script_title} 生成封面")
        print(f"📝 生成提示词: {prompt}")

        try:
            base64_image = generate_image(
                prompt=prompt,
                size=suggest_size_for_aspect("4:3"),
            )
            if base64_image:
                print(f"✅ 剧本 {script_title} 封面生成成功")
            else:
                print(f"❌ 剧本 {script_title} 封面生成失败")
            return base64_image
        except Exception as e:
            print(f"❌ 剧本 {script_title} 封面生成异常: {str(e)}")
            return None


# 全局实例
cover_generator = CoverGenerator()


def generate_cover_for_script(script_title: str, script_description: str) -> Optional[str]:
    """
    为剧本生成封面的便捷函数

    Returns:
        base64编码的图片数据，如果失败返回None
    """
    return cover_generator.generate_script_cover(script_title, script_description)
