from typing import Optional

from seedream_client import generate_image, suggest_size_for_aspect


class EvidenceGenerator:
    def generate_evidence_image(
        self,
        evidence_name: str,
        evidence_description: str,
        style: str = "realistic",
    ) -> Optional[str]:
        """
        根据证物名称和描述生成法证摄影风格的图像

        Args:
            evidence_name: 证物名称
            evidence_description: 证物描述
            style: 图像风格 ('realistic' 或 'detailed_illustration')

        Returns:
            base64编码的图片数据，如果失败返回None
        """
        # 构建详细的prompt，针对证物图像优化
        if style == "detailed_illustration":
            prompt = f"""
{evidence_name}，{evidence_description}。
专业法证插图风格，高清细腻，技术绘图，科学插图风格，
白色背景，单一物品展示，清晰的物理特征描述，
详细的材质纹理，准确的比例和尺寸，专业摄影光影效果。
法医鉴定用图，证据展示图，高品质技术插图。
            """.strip()
        else:
            prompt = f"""
{evidence_name}，{evidence_description}。
专业法证摄影风格，证据照片，高清摄影，白色背景，
单一物品特写，清晰的细节展示，专业摄影光效，
证据收集标准，司法鉴定用图，高分辨率，无阴影干扰。
真实物证照片，法医摄影风格，高品质，细节丰富。
            """.strip()

        print(f"🔍 为证物 {evidence_name} 生成图像")
        print(f"📝 生成提示词: {prompt}")

        try:
            base64_image = generate_image(
                prompt=prompt,
                size=suggest_size_for_aspect("1:1"),
            )
            if base64_image:
                print(f"✅ 证物 {evidence_name} 图像生成成功")
            else:
                print(f"❌ 证物 {evidence_name} 图像生成失败")
            return base64_image
        except Exception as e:
            print(f"❌ 证物 {evidence_name} 图像生成异常: {str(e)}")
            return None


# 全局实例
evidence_generator = EvidenceGenerator()


def generate_evidence_image_for_item(
    evidence_name: str,
    evidence_description: str,
    style: str = "realistic",
) -> Optional[str]:
    """
    为证物生成图像的便捷函数

    Returns:
        base64编码的图片数据，如果失败返回None
    """
    return evidence_generator.generate_evidence_image(evidence_name, evidence_description, style)
