import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  TextInput,
  Textarea,
  Select,
  MultiSelect,
  Modal,
  Alert,
  ActionIcon,
  Badge,
  Image,
  FileInput,
  Grid,
  Tooltip,
  SimpleGrid,
  ScrollArea,
  Box
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconPhoto,
  IconWand,
  IconEye,
  IconAlertCircle,
  IconSearch,
  IconX,
  IconRefresh
} from '@tabler/icons-react';
import { ScriptEvidence, createEvidenceTemplate, Script } from '../../types/script';
import { 
  generateEvidenceImage, 
  getEvidenceImageUrl,
  validateImageFile,
} from '../../api/evidenceImageGenerator';
import { 
  getAllEvidenceIcons, 
  getEvidenceIconInfo, 
  getSmartEvidenceIcon,
  getEvidenceIconsByCategory,
  getEvidenceIconCategories,
} from '../../utils/evidenceIcons';
import { generateEvidence, recommendEvidenceTypes, QualityCheckResult } from '../../api/evidenceGenerator';
import PolishButton from '../PolishButton';
import { forceSyncScriptEvidencesToGame } from '../../utils/evidenceManager';
import { useSessionContext } from '../../providers/sessionContext';
import { saveScriptEvidence, deleteScriptEvidence, getScriptEvidences } from '../../api/scriptEvidenceApi';
import { qualityCheckStream } from '../../api/scriptQualityChecker';

interface EvidenceManagementPanelProps {
  evidences: ScriptEvidence[];
  characters: string[]; // 角色名称列表
  onEvidencesChange: (evidences: ScriptEvidence[]) => void;
  script: Script; // 完整剧本数据，用于智能生成
  onOpenPolish?: (fieldPath: string) => void; // 润色功能回调
  qualityReport?: QualityCheckResult; // 质检报告（可选）
}

const EvidenceManagementPanel: React.FC<EvidenceManagementPanelProps> = ({
  evidences,
  characters,
  onEvidencesChange,
  script,
  onOpenPolish,
  qualityReport
}) => {
  const sessionId = useSessionContext();
  const [editingEvidence, setEditingEvidence] = useState<ScriptEvidence | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // 图标选择相关状态
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [selectedIconCategory, setSelectedIconCategory] = useState<string>('all');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  // 预设图像选择器相关状态
  const [showPresetImageSelector, setShowPresetImageSelector] = useState(false);
  const [presetImageSearchQuery, setPresetImageSearchQuery] = useState('');
  const [availablePresetImages, setAvailablePresetImages] = useState<string[]>([]);
  
  // 智能生成相关状态
  const [isGeneratingEvidence, setIsGeneratingEvidence] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // 质检建议和智能推荐状态
  const [showQualityAdvice, setShowQualityAdvice] = useState(false);
  const [smartRecommendations, setSmartRecommendations] = useState<string[]>([]);
  const [qualityAdvice, setQualityAdvice] = useState<{
    evidenceProblems: string[];
    evidenceRecommendations: string[];
    missingCategories: string[];
    weakConnections: string[];
  } | null>(null);
  
  // 自动质检状态
  const [isAutoQualityChecking, setIsAutoQualityChecking] = useState(false);
  const [lastQualityCheck, setLastQualityCheck] = useState<QualityCheckResult | null>(null);
  
  // 刷新预设证物图像列表的函数
  const refreshPresetImages = useCallback(async () => {
    try {
      // 使用正确的API端点获取证物图像列表
      const response = await fetch('http://localhost:10000/evidence-images');
      
      if (response.ok) {
        const data = await response.json();
        const allImages = data.images || [];
        
        setAvailablePresetImages(allImages);
        console.log('🔄 预设图像列表已刷新:', allImages);
        
        if (allImages.length === 0) {
          console.log('📁 没有找到可用的预设证物图像');
        }
      } else {
        console.error('❌ 无法获取证物图像列表:', response.status);
        // 如果API调用失败，使用已知存在的图像文件作为备用
        const fallbackImages = ['evidence_破碎的白玉发簪_1759126646797.png'];
        setAvailablePresetImages(fallbackImages);
        console.log('使用备用证物图像列表:', fallbackImages);
      }
    } catch (error) {
      console.error('❌ 刷新预设图像失败:', error);
      // 出错时使用备用列表
      const fallbackImages = ['evidence_破碎的白玉发簪_1759126646797.png'];
      setAvailablePresetImages(fallbackImages);
      console.log('使用备用证物图像列表:', fallbackImages);
    }
  }, []);

  // 加载预设证物图像列表
  useEffect(() => {
    refreshPresetImages();
  }, [refreshPresetImages]);

  // 分析质检报告和生成智能推荐
  useEffect(() => {
    // 生成智能推荐
    const recommendations = recommendEvidenceTypes(script);
    setSmartRecommendations(recommendations);
    
    // 分析质检报告
    if (qualityReport) {
      const evidenceProblems: string[] = [];
      const evidenceRecommendations: string[] = [];
      const missingCategories: string[] = [];
      const weakConnections: string[] = [];
      
      // 分析问题
      ((qualityReport?.issues) || []).forEach(issue => {
        if (issue.includes('证物') || issue.includes('证据') || issue.includes('物证')) {
          evidenceProblems.push(issue);
          
          // 分析缺失类型
          if (issue.includes('缺少') || issue.includes('缺乏')) {
            if (issue.includes('物理证物') || issue.includes('实物')) {
              missingCategories.push('物理证物');
            }
            if (issue.includes('文档') || issue.includes('资料')) {
              missingCategories.push('文档资料');
            }
            if (issue.includes('数字') || issue.includes('电子')) {
              missingCategories.push('数字证据');
            }
            if (issue.includes('证词') || issue.includes('口供')) {
              missingCategories.push('证词记录');
            }
          }
          
          // 分析角色关联问题
          if (issue.includes('关联') || issue.includes('联系')) {
            (characters || []).forEach(char => {
              if (issue.includes(char)) {
                weakConnections.push(char);
              }
            });
          }
        }
      });
      
      // 分析建议
      ((qualityReport?.recommendations) || []).forEach(recommendation => {
        if (recommendation.includes('证物') || recommendation.includes('证据') || recommendation.includes('物证')) {
          evidenceRecommendations.push(recommendation);
        }
      });
      
      setQualityAdvice({
        evidenceProblems,
        evidenceRecommendations,
        missingCategories: Array.from(new Set(missingCategories)),
        weakConnections: Array.from(new Set(weakConnections))
      });
      
      // 如果有质检问题，自动显示建议
      if (evidenceProblems.length > 0 || evidenceRecommendations.length > 0) {
        setShowQualityAdvice(true);
      }
    }
  }, [script, qualityReport, characters]);

  // 从数据库重新加载证物
  const handleReloadEvidences = useCallback(async () => {
    try {
      console.log('🔄 从数据库重新加载证物');
      const result = await getScriptEvidences(script.id);
      
      if (result.success) {
        console.log(`✅ 成功加载 ${result.count} 个证物`);
        onEvidencesChange(result.evidences);
        
        // 如果有sessionId，同时同步到游戏数据
        if (sessionId && result.evidences.length > 0) {
          try {
            const updatedScript = { ...script, evidences: result.evidences };
            forceSyncScriptEvidencesToGame(updatedScript, sessionId);
            console.log('✅ 同步到游戏数据完成');
          } catch (syncError) {
            console.warn('⚠️ 同步到游戏数据失败:', syncError);
          }
        }
      } else {
        console.error('❌ 加载证物失败:', result.error);
        
        // 如果是网络错误，提供降级方案
        if (result.error?.includes('Failed to fetch') || result.error?.includes('TypeError')) {
          console.warn('⚠️ 检测到网络连接问题，使用本地证物数据');
          // 不弹出错误提示，静默处理
          return;
        } else {
          alert(`加载证物失败: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('❌ 重新加载证物时发生错误:', error);
      
      // 如果是网络相关错误，使用降级方案
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('⚠️ 网络连接问题，继续使用本地证物数据');
        // 不弹出错误提示，让用户继续使用现有数据
        return;
      }
      
      alert(`重新加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.id, sessionId]);

  // 自动加载证物（当组件挂载或scriptId变化时）
  useEffect(() => {
    const loadEvidencesFromDB = async () => {
      if (!script.id) return;
      
      // 只有当当前证物列表为空时才自动加载
      if (evidences.length === 0) {
        console.log('🔄 自动加载证物数据');
        try {
          const result = await getScriptEvidences(script.id);
          
          if (result.success) {
            console.log(`✅ 成功加载 ${result.count} 个证物`);
            onEvidencesChange(result.evidences);
            
            // 如果有sessionId，同时同步到游戏数据
            if (sessionId && result.evidences.length > 0) {
              try {
                const updatedScript = { ...script, evidences: result.evidences };
                forceSyncScriptEvidencesToGame(updatedScript, sessionId);
                console.log('✅ 同步到游戏数据完成');
              } catch (syncError) {
                console.warn('⚠️ 同步到游戏数据失败:', syncError);
              }
            }
          } else {
            console.error('❌ 加载证物失败:', result.error);
          }
        } catch (error) {
          // 静默处理自动加载失败，不影响用户体验
          console.warn('⚠️ 自动加载证物失败，继续使用现有数据:', error);
        }
      }
    };
    
    loadEvidencesFromDB();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.id, evidences.length]);

  // 分离证物概况和线索的工具函数
  const separateEvidenceContent = (description: string): { overview: string; clues: string } => {
    const cluesMarker = '【关联线索】';
    const cluesIndex = description.indexOf(cluesMarker);
    
    if (cluesIndex === -1) {
      return { overview: description.trim(), clues: '' };
    }
    
    const overview = description.substring(0, cluesIndex).trim();
    const clues = description.substring(cluesIndex + cluesMarker.length).trim();
    
    return { overview, clues };
  };

  // 处理添加新证物
  const handleAddEvidence = () => {
    const newEvidence = createEvidenceTemplate();
    setEditingEvidence(newEvidence);
    setEditingIndex(null); // 新证物没有索引
    setShowEditModal(true);
  };

  // 处理编辑证物
  const handleEditEvidence = (evidence: ScriptEvidence) => {
    // 如果证物有合并的description但缺少分离的字段，需要分离
    let editingData = { ...evidence };
    
    if (evidence.description && (!evidence.overview || !evidence.clues)) {
      const { overview, clues } = separateEvidenceContent(evidence.description);
      editingData = {
        ...evidence,
        overview: evidence.overview || overview,
        clues: evidence.clues || clues
      };
      console.log('🔄 分离证物概况和线索:', { overview, clues });
    }
    
    // 确保所有必需字段都有默认值（修复旧数据的 undefined 问题）
    editingData = {
      ...editingData,
      category: editingData.category || 'physical',
      importance: editingData.importance || 'medium',
      initialState: editingData.initialState || 'surface',
      relatedCharacters: editingData.relatedCharacters || [],
      overview: editingData.overview || '',
      clues: editingData.clues || '',
      description: editingData.description || ''
    };
    
    setEditingEvidence(editingData);
    const index = evidences.findIndex(e => e.id === evidence.id);
    setEditingIndex(index >= 0 ? index : null);
    setShowEditModal(true);
  };

  // 处理删除证物（实时删除）
  const handleDeleteEvidence = async (evidenceId: string) => {
    const evidenceToDelete = evidences.find(e => e.id === evidenceId);
    if (!evidenceToDelete) {
      console.error('❌ 找不到要删除的证物:', evidenceId);
      return;
    }
    
    try {
      console.log('🗑️ 开始实时删除证物:', evidenceToDelete.name);
      
      // 立即从数据库删除
      const deleteResult = await deleteScriptEvidence(evidenceId, script.id);
      
      if (deleteResult.success) {
        // 删除成功后更新本地状态
        const updatedEvidences = evidences.filter(e => e.id !== evidenceId);
        onEvidencesChange(updatedEvidences);
        
        // 自动同步到游戏数据（如果有sessionId）
        if (sessionId) {
          console.log('🔄 自动同步删除操作到游戏数据');
          try {
            forceSyncScriptEvidencesToGame(script, sessionId);
            console.log('✅ 同步完成');
          } catch (syncError) {
            console.warn('⚠️ 同步到游戏数据失败:', syncError);
          }
        }
        
        console.log('✅ 证物删除成功:', evidenceToDelete.name);
      } else {
        console.error('❌ 证物删除失败:', deleteResult.error);
        alert(`删除失败: ${deleteResult.error}`);
      }
    } catch (error) {
      console.error('❌ 删除证物时发生错误:', error);
      alert(`删除证物时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };


  // 处理同步到游戏数据
  const handleSyncToGame = async () => {
    if (!sessionId) {
      alert('无法获取游戏会话ID，请确保在游戏环境中操作');
      return;
    }
    
    try {
      console.log('🔄 手动同步剧本证物到游戏数据');
      forceSyncScriptEvidencesToGame(script, sessionId);
      alert(`成功同步 ${evidences.length} 个证物到游戏数据！\n\n现在游戏界面的证物库应该能显示这些证物了。`);
    } catch (error) {
      console.error('❌ 同步失败:', error);
      alert('同步失败，请检查控制台错误信息');
    }
  };

  // 处理保存证物（实时保存到数据库）
  const handleSaveEvidence = async (evidence: ScriptEvidence) => {
    try {
      // 确保 description 字段正确合并概况和线索（向后兼容）
      const processedEvidence = {
        ...evidence,
        description: evidence.overview && evidence.clues 
          ? `${evidence.overview}\n\n【关联线索】\n${evidence.clues}`
          : evidence.overview || evidence.clues || evidence.description || ''
      };
      
      console.log('💾 开始实时保存证物:', processedEvidence.name);
      
      // 确保剧本已保存到数据库（避免"剧本不存在"错误）
      try {
        const { saveScriptToDB } = await import('../../api/database');
        const scriptSaveResult = await saveScriptToDB(script);
        if (scriptSaveResult.success) {
          console.log('✅ 剧本已确保保存到数据库');
        }
      } catch (scriptError) {
        console.warn('⚠️ 预保存剧本失败，继续尝试保存证物:', scriptError);
      }
      
      // 立即保存到数据库
      const saveResult = await saveScriptEvidence(processedEvidence, script.id);
      
      if (saveResult.success) {
        // 保存成功后更新本地状态
        const existingIndex = evidences.findIndex(e => e.id === evidence.id);
        
        if (existingIndex >= 0) {
          // 更新现有证物
          const updatedEvidences = [...evidences];
          updatedEvidences[existingIndex] = processedEvidence;
          onEvidencesChange(updatedEvidences);
        } else {
          // 添加新证物
          onEvidencesChange([...evidences, processedEvidence]);
        }
        
        // 自动同步到游戏数据（如果有sessionId）
        if (sessionId) {
          console.log('🔄 自动同步证物到游戏数据');
          try {
            forceSyncScriptEvidencesToGame(script, sessionId);
            console.log('✅ 同步完成');
          } catch (syncError) {
            console.warn('⚠️ 同步到游戏数据失败:', syncError);
            // 同步失败不影响保存流程，只是警告
          }
        }
        
        // 显示成功消息
        console.log('✅ 证物保存成功:', processedEvidence.name);
        
        // 清理状态
        setShowEditModal(false);
        setEditingEvidence(null);
        setImageFile(null);
        setImagePreview('');
      } else {
        // 保存失败，显示错误信息
        console.error('❌ 证物保存失败:', saveResult.error);
        alert(`保存失败: ${saveResult.error}`);
      }
    } catch (error) {
      console.error('❌ 保存证物时发生错误:', error);
      alert(`保存证物时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 处理图标选择
  const handleIconSelect = (iconName: string) => {
    if (editingEvidence) {
      setEditingEvidence({ ...editingEvidence, image: iconName });
      setImageFile(null);
      setImagePreview('');
    }
    setShowIconSelector(false);
  };

  // 处理图片文件上传
  const handleImageUpload = (file: File | null) => {
    if (file) {
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImagePreview(dataUrl);
        if (editingEvidence) {
          setEditingEvidence({ ...editingEvidence, image: dataUrl });
        }
      };
      reader.readAsDataURL(file);
      setImageFile(file);
    }
  };

  // 智能匹配图标
  const handleSmartIconMatch = () => {
    if (editingEvidence?.name) {
      const smartIcon = getSmartEvidenceIcon(editingEvidence.name);
      setEditingEvidence({ ...editingEvidence, image: smartIcon });
      setImageFile(null);
      setImagePreview('');
    }
  };

  // 处理预设图像选择
  const handlePresetImageSelect = (imageName: string) => {
    if (editingEvidence) {
      setEditingEvidence({ 
        ...editingEvidence, 
        image: `/evidence_images/${encodeURIComponent(imageName)}` 
      });
      setImageFile(null);
      setImagePreview('');
      setShowPresetImageSelector(false);
    }
  };

  // 打开预设图像选择器
  const handleOpenPresetImageSelector = () => {
    setPresetImageSearchQuery('');
    setShowPresetImageSelector(true);
  };

  // 智能生成证物
  const handleGenerateEvidence = async () => {
    if (!editingEvidence) return;

    // 检查必要条件
    if (!editingEvidence.category || !editingEvidence.importance || 
        !editingEvidence.initialState || (editingEvidence.relatedCharacters || []).length === 0) {
      alert('请先设定证物类别、重要程度、初始状态和相关角色，然后才能进行智能生成');
      return;
    }

    setIsGeneratingEvidence(true);

    try {
      console.log('🎯 开始生成证物，使用质检上下文:', !!qualityReport);
      
      const result = await generateEvidence({
        script,
        category: editingEvidence.category,
        importance: editingEvidence.importance,
        initialState: editingEvidence.initialState,
        relatedCharacters: editingEvidence.relatedCharacters,
        qualityReport // 传递质检报告
      });

      if (result.success && result.evidence) {
        // 自动匹配图标
        const smartIcon = getSmartEvidenceIcon(result.evidence.name);
        
        setEditingEvidence({
          ...editingEvidence,
          name: result.evidence.name,
          description: result.evidence.description,  // 完整描述（向后兼容）
          overview: result.evidence.overview || result.evidence.description,  // 证物概况
          clues: result.evidence.clues || '',                                 // 证物线索
          image: smartIcon
        });
        
        alert('证物生成成功！已自动匹配图标。概况和线索已分别填入对应字段。');
        
        // 生成后自动触发质检验证
        setTimeout(() => {
          handleAutoQualityCheck();
        }, 1000);
        
      } else {
        alert(`证物生成失败: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ 证物生成异常:', error);
      alert('证物生成失败，请重试');
    } finally {
      setIsGeneratingEvidence(false);
    }
  };
  
  // 自动质检验证
  const handleAutoQualityCheck = async () => {
    if (!script || isAutoQualityChecking) return;
    
    console.log('🔍 证物生成后自动质检验证');
    setIsAutoQualityChecking(true);
    
    try {
      let qualityResult = '';
      
      // 使用流式质检
      await new Promise<void>((resolve, reject) => {
        qualityCheckStream(script, {
          onChunk: (chunk: string) => {
            qualityResult += chunk;
          },
          onEnd: () => {
            resolve();
          },
          onError: (error: string) => {
            console.error('质检流式处理错误:', error);
            reject(new Error(error));
          }
        });
      });
      
      // 解析质检结果
      try {
        const parsed = JSON.parse(qualityResult);
        setLastQualityCheck(parsed);
        
        // 更新质检建议显示
        const evidenceScore = parsed.scores?.contentLogic?.details?.evidenceSystemIntegrity;
        if (evidenceScore !== undefined && evidenceScore < 4) {
          console.log(`📊 证物系统得分: ${evidenceScore}/5，建议继续优化`);
          setShowQualityAdvice(true);
        }
        
        console.log('✅ 自动质检完成，总分:', parsed.scores?.totalScore);
      } catch (parseError) {
        console.error('❌ 质检结果解析失败:', parseError);
      }
      
    } catch (error) {
      console.error('❌ 自动质检失败:', error);
    } finally {
      setIsAutoQualityChecking(false);
    }
  };

  // 检查是否可以生成证物
  const canGenerateEvidence = () => {
    return editingEvidence && 
           editingEvidence.category && 
           editingEvidence.importance && 
           editingEvidence.initialState && 
           (editingEvidence.relatedCharacters || []).length > 0;
  };

  // 获取可选择的相关角色（包括搭档、受害人等，仅排除玩家）
  const getSelectableCharacters = useMemo(() => {
    return (script.characters || [])
      .filter(char => !char.isPlayer) // 仅排除玩家，保留搭档、受害人等所有其他角色
      .map(char => char.name);
  }, [script.characters]);

  // 处理生成证物图像
  const handleGenerateImage = async (evidence: ScriptEvidence) => {
    // 检查证物名称和概况（用于图像生成）
    if (!evidence.name || !evidence.overview) {
      alert('请先填写证物名称和证物概况（物理描述）');
      return;
    }

    setIsGeneratingImage(true);
    
    try {
      // 只使用证物名称和概况生成图像，不包含线索
      const response = await generateEvidenceImage({
        evidenceName: evidence.name,
        evidenceDescription: evidence.overview  // 使用 overview 而不是 description
      });

      if (response.success && response.imageUrl) {
        // 使用 imageUrl 而不是 imagePath，确保路径正确
        const updatedEvidence = { ...evidence, image: response.imageUrl };
        if (editingEvidence) {
          setEditingEvidence(updatedEvidence);
          // 清除可能的缓存状态
          setImagePreview('');
          setImageFile(null);
        }
        
        // 刷新预设图像列表，让新生成的图像立即出现在预设库中
        await refreshPresetImages();
        
        alert('图像生成成功！预设库已更新');
      } else {
        alert(`图像生成失败: ${response.error}`);
      }
    } catch (error) {
      console.error('图像生成失败:', error);
      alert('图像生成失败，请稍后重试');
    } finally {
      setIsGeneratingImage(false);
    }
  };


  // 获取类别选项
  const categoryOptions = [
    { value: 'physical', label: '物理证物' },
    { value: 'document', label: '文档资料' },
    { value: 'digital', label: '数字证据' },
    { value: 'testimony', label: '证词记录' },
    { value: 'combination', label: '组合证物' }
  ];

  // 获取重要度选项
  const importanceOptions = [
    { value: 'low', label: '一般' },
    { value: 'medium', label: '重要' },
    { value: 'high', label: '关键' },
    { value: 'critical', label: '决定性' }
  ];

  // 获取初始状态选项
  const stateOptions = [
    { value: 'hidden', label: '隐藏（需要调查发现）' },
    { value: 'surface', label: '基础发现' },
    { value: 'investigated', label: '已调查' }
  ];

  // 获取可用的证物图标
  const availableIcons = useMemo(() => {
    return getAllEvidenceIcons() || [];
  }, []);

  // 获取图标类别选项
  const iconCategoryOptions = useMemo(() => {
    return [
      { value: 'all', label: '全部类别' },
      ...(getEvidenceIconCategories() || [])
    ];
  }, []);

  // 过滤图标列表
  const filteredIcons = useMemo(() => {
    let icons = availableIcons || [];
    
    // 按类别筛选
    if (selectedIconCategory !== 'all') {
      icons = getEvidenceIconsByCategory(selectedIconCategory) || [];
    }
    
    // 按搜索关键词筛选
    if (iconSearchQuery.trim()) {
      const query = iconSearchQuery.toLowerCase().trim();
      icons = icons.filter(icon => 
        icon.label.toLowerCase().includes(query) ||
        icon.value.toLowerCase().includes(query)
      );
    }
    
    return icons;
  }, [availableIcons, selectedIconCategory, iconSearchQuery]);

  // 获取预设图像的显示名称
  const getPresetImageDisplayName = (imageName: string) => {
    // 对于中文文件名，需要特殊处理
    if (imageName.includes('_') && /[\u4e00-\u9fa5]/.test(imageName)) {
      // 包含中文字符的文件名
      const nameWithoutExtension = imageName.replace(/\.[^.]+$/, ''); // 移除扩展名
      const nameWithoutTimestamp = nameWithoutExtension.replace(/_\d{13,}$/, ''); // 移除时间戳
      const nameWithoutPrefix = nameWithoutTimestamp.replace(/^evidence_/, ''); // 移除evidence_前缀
      return nameWithoutPrefix || imageName; // 如果处理后为空，返回原文件名
    }
    
    // 对于英文文件名，使用原来的处理逻辑
    return imageName
      .replace(/^(preset_|evidence_)/, '') // 移除前缀
      .replace(/\.[^.]+$/, '') // 移除扩展名
      .replace(/_\d{13,}$/, '') // 移除长时间戳
      .replace(/_/g, ' ') // 下划线转空格
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // 过滤预设图像列表
  const filteredPresetImages = useMemo(() => {
    const images = availablePresetImages || [];
    
    if (!presetImageSearchQuery.trim()) {
      return images;
    }
    
    const query = presetImageSearchQuery.toLowerCase();
    return images.filter(imageName => {
      // 获取显示名称进行搜索
      const displayName = getPresetImageDisplayName(imageName);
      
      return displayName.toLowerCase().includes(query) ||
             imageName.toLowerCase().includes(query);
    });
  }, [availablePresetImages, presetImageSearchQuery]);

  // 获取证物图标显示
  const getEvidenceIconDisplay = (evidence: ScriptEvidence) => {
    if (!evidence.image) return '📋';
    
    // 如果是图标名称，返回对应的emoji
    const iconInfo = getEvidenceIconInfo(evidence.image);
    if (iconInfo.value !== 'unknown') {
      return iconInfo.emoji;
    }
    
    // 如果是图片路径或data URL，返回默认图标
    return '🖼️';
  };

  return (
    <Stack gap="md">
      {/* 头部操作区域 */}
      <Group justify="space-between">
        <Text size="lg" fw={600} c="#87CEEB">证物管理</Text>
        <Group gap="sm">
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="outline"
            onClick={handleReloadEvidences}
            styles={{
              root: {
                borderColor: '#00C2FF',
                color: '#00C2FF',
                backgroundColor: 'rgba(0, 194, 255, 0.05)',
                fontWeight: '600',
                '&:hover': {
                  backgroundColor: 'rgba(0, 194, 255, 0.15)',
                  borderColor: '#00C2FF',
                  color: '#00C2FF'
                }
              }
            }}
          >
            重新加载
          </Button>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="outline"
            onClick={handleSyncToGame}
            disabled={evidences.length === 0}
            styles={{
              root: {
                borderColor: '#4ECCA3',
                color: '#4ECCA3',
                backgroundColor: 'rgba(78, 204, 163, 0.05)',
                fontWeight: '600',
                '&:hover': {
                  backgroundColor: 'rgba(78, 204, 163, 0.15)',
                  borderColor: '#4ECCA3',
                  color: '#4ECCA3'
                },
                '&:disabled': {
                  borderColor: 'rgba(78, 204, 163, 0.3)',
                  color: 'rgba(78, 204, 163, 0.5)',
                  backgroundColor: 'rgba(78, 204, 163, 0.02)'
                }
              }
            }}
          >
            同步到游戏
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAddEvidence}
            styles={{
              root: {
                background: 'linear-gradient(135deg, #4ECCA3 0%, #00C2FF 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontWeight: '600',
                '&:hover': {
                  background: 'linear-gradient(135deg, #45B993 0%, #0099CC 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 15px rgba(78, 204, 163, 0.3)'
                }
              }
            }}
          >
            添加证物
          </Button>
        </Group>
      </Group>

      {/* 质检建议和智能推荐 */}
      {(qualityAdvice || smartRecommendations.length > 0) && (
        <Card
          style={{
            backgroundColor: 'rgba(135, 206, 235, 0.05)',
            border: '1px solid rgba(135, 206, 235, 0.2)'
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Text size="sm" fw={600} c="#87CEEB">
                  💡 智能建议
                </Text>
                {isAutoQualityChecking && (
                  <Badge size="xs" color="blue" variant="light">
                    质检中...
                  </Badge>
                )}
                {lastQualityCheck && (
                  <Badge size="xs" color="green" variant="light">
                    已质检 {lastQualityCheck.scores?.totalScore}/125
                  </Badge>
                )}
              </Group>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setShowQualityAdvice(!showQualityAdvice)}
                c="#87CEEB"
              >
                {showQualityAdvice ? <IconX size={14} /> : <IconEye size={14} />}
              </ActionIcon>
            </Group>

            {showQualityAdvice && (
              <Stack gap="xs">
                {/* 质检发现的问题 */}
                {qualityAdvice && qualityAdvice.evidenceProblems.length > 0 && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    title="质检发现的证物问题"
                    color="orange"
                    variant="light"
                    styles={{
                      root: { fontSize: '12px' },
                      title: { fontSize: '13px', fontWeight: 600 }
                    }}
                  >
                    <Stack gap={4}>
                      {((qualityAdvice && qualityAdvice.evidenceProblems) || []).map((problem, index) => (
                        <Text key={index} size="xs" c="orange.7">
                          • {problem}
                        </Text>
                      ))}
                    </Stack>
                  </Alert>
                )}

                {/* 质检建议 */}
                {qualityAdvice && qualityAdvice.evidenceRecommendations.length > 0 && (
                  <Alert
                    icon={<IconWand size={16} />}
                    title="质检建议"
                    color="blue"
                    variant="light"
                    styles={{
                      root: { fontSize: '12px' },
                      title: { fontSize: '13px', fontWeight: 600 }
                    }}
                  >
                    <Stack gap={4}>
                      {((qualityAdvice && qualityAdvice.evidenceRecommendations) || []).map((recommendation, index) => (
                        <Text key={index} size="xs" c="blue.7">
                          • {recommendation}
                        </Text>
                      ))}
                    </Stack>
                  </Alert>
                )}

                {/* 缺失的证物类型 */}
                {qualityAdvice && qualityAdvice.missingCategories.length > 0 && (
                  <Group gap="xs">
                    <Text size="xs" c="yellow.7" fw={500}>建议补充类型:</Text>
                    {((qualityAdvice && qualityAdvice.missingCategories) || []).map((category, index) => (
                      <Badge key={index} size="xs" color="yellow" variant="light">
                        {category}
                      </Badge>
                    ))}
                  </Group>
                )}

                {/* 需要加强关联的角色 */}
                {qualityAdvice && qualityAdvice.weakConnections.length > 0 && (
                  <Group gap="xs">
                    <Text size="xs" c="grape.7" fw={500}>需加强关联:</Text>
                    {((qualityAdvice && qualityAdvice.weakConnections) || []).map((character, index) => (
                      <Badge key={index} size="xs" color="grape" variant="light">
                        {character}
                      </Badge>
                    ))}
                  </Group>
                )}

                {/* 智能推荐 */}
                {smartRecommendations.length > 0 && (
                  <Alert
                    icon={<IconSearch size={16} />}
                    title="智能分析推荐"
                    color="teal"
                    variant="light"
                    styles={{
                      root: { fontSize: '12px' },
                      title: { fontSize: '13px', fontWeight: 600 }
                    }}
                  >
                    <Stack gap={4}>
                      {(smartRecommendations || []).map((recommendation, index) => (
                        <Text key={index} size="xs" c="teal.7">
                          • {recommendation}
                        </Text>
                      ))}
                    </Stack>
                  </Alert>
                )}
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      {/* 证物列表 */}
      {evidences.length === 0 ? (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          color="cyan"
          styles={{
            root: {
              backgroundColor: 'rgba(135, 206, 235, 0.1)',
              border: '1px solid rgba(135, 206, 235, 0.3)',
              color: '#E6F3FF'
            },
            icon: {
              color: '#87CEEB'
            }
          }}
        >
          <Text c="#E6F3FF">
            还没有添加任何证物。点击"添加证物"开始创建您的第一个证物。
          </Text>
        </Alert>
      ) : (
        <Grid>
          {(evidences || []).map((evidence) => (
            <Grid.Col key={evidence.id} span={{ base: 12, sm: 6, md: 4 }}>
              <Card 
                withBorder 
                p="md"
                style={{
                  height: '320px', // 固定高度确保一致性
                  backgroundColor: 'rgba(18, 18, 18, 0.8)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                styles={{
                  root: {
                    '&:hover': {
                      borderColor: '#00FFFF',
                      boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
                      transform: 'translateY(-2px)'
                    }
                  }
                }}
              >
                <Stack gap="sm" style={{ height: '100%' }}>
                  {/* 证物图像 */}
                  <div style={{ textAlign: 'center' }}>
                    {evidence.image ? (
                      // 判断是图标还是图片
                      evidence.image.startsWith('data:') || evidence.image.includes('/') ? (
                        <Image
                          src={getEvidenceImageUrl(evidence.image)}
                          alt={evidence.name}
                          height={120}
                          fit="cover"
                          radius="sm"
                          fallbackSrc="/evidence_images/default_evidence.png"
                        />
                      ) : (
                        <div
                          style={{
                            width: 120,
                            height: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 255, 0.05) 100%)',
                            border: '2px solid rgba(0, 255, 255, 0.3)',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <Text size="48px" style={{ lineHeight: 1, filter: 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.5))' }}>
                            {getEvidenceIconDisplay(evidence)}
                          </Text>
                        </div>
                      )
                    ) : (
                      <div
                        style={{
                          width: 120,
                          height: 120,
                          backgroundColor: 'rgba(0, 255, 255, 0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          border: '2px dashed rgba(0, 255, 255, 0.3)'
                        }}
                      >
                        <IconPhoto size={32} color="#00FFFF" style={{ opacity: 0.5 }} />
                      </div>
                    )}
                  </div>

                  {/* 证物信息 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Group justify="space-between" align="flex-start" mb="xs">
                      <Text fw={600} size="sm" c="#00FFFF" style={{ flex: 1 }}>
                        {evidence.name || '未命名证物'}
                      </Text>
                      <Group gap="xs">
                        <Tooltip 
                          label="编辑"
                          styles={{
                            tooltip: {
                              backgroundColor: 'rgba(0, 0, 0, 0.9)',
                              color: '#00FFFF',
                              border: '1px solid #00FFFF'
                            }
                          }}
                        >
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => handleEditEvidence(evidence)}
                            styles={{
                              root: {
                                color: '#00FFFF',
                                '&:hover': {
                                  backgroundColor: 'rgba(0, 255, 255, 0.1)'
                                }
                              }
                            }}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip 
                          label="删除"
                          styles={{
                            tooltip: {
                              backgroundColor: 'rgba(0, 0, 0, 0.9)',
                              color: '#E63946',
                              border: '1px solid #E63946'
                            }
                          }}
                        >
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => handleDeleteEvidence(evidence.id)}
                            styles={{
                              root: {
                                color: '#E63946',
                                '&:hover': {
                                  backgroundColor: 'rgba(230, 57, 70, 0.1)'
                                }
                              }
                            }}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>

                    <Text size="xs" c="#BDBDBD" style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flex: 1,
                      marginBottom: '8px'
                    }}>
                      {evidence.description || '暂无描述'}
                    </Text>

                    <Group gap="xs" mt="auto" mb="xs">
                      <Badge 
                        size="xs" 
                        styles={{
                          root: {
                            backgroundColor: 'rgba(0, 194, 255, 0.2)',
                            color: '#00C2FF',
                            border: '1px solid rgba(0, 194, 255, 0.3)'
                          }
                        }}
                      >
                        {categoryOptions.find(opt => opt.value === evidence.category)?.label}
                      </Badge>
                      <Badge 
                        size="xs" 
                        styles={{
                          root: {
                            backgroundColor: evidence.importance === 'critical' ? 'rgba(230, 57, 70, 0.2)' : 
                                           evidence.importance === 'high' ? 'rgba(255, 183, 77, 0.2)' :
                                           evidence.importance === 'medium' ? 'rgba(255, 235, 59, 0.2)' : 'rgba(189, 189, 189, 0.2)',
                            color: evidence.importance === 'critical' ? '#E63946' : 
                                   evidence.importance === 'high' ? '#FFB74D' :
                                   evidence.importance === 'medium' ? '#FFEB3B' : '#BDBDBD',
                            border: `1px solid ${evidence.importance === 'critical' ? 'rgba(230, 57, 70, 0.3)' : 
                                                evidence.importance === 'high' ? 'rgba(255, 183, 77, 0.3)' :
                                                evidence.importance === 'medium' ? 'rgba(255, 235, 59, 0.3)' : 'rgba(189, 189, 189, 0.3)'}`
                          }
                        }}
                      >
                        {importanceOptions.find(opt => opt.value === evidence.importance)?.label}
                      </Badge>
                    </Group>

                    {(evidence.relatedCharacters || []).length > 0 && (
                      <Text size="xs" c="#4ECCA3" mt="auto">
                        相关角色: {(evidence.relatedCharacters || []).join(', ')}
                      </Text>
                    )}
                  </div>
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      )}

      {/* 编辑证物模态框 - 极光色主题 */}
      <Modal
        opened={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingEvidence(null);
        }}
        title={editingEvidence?.name ? `编辑证物: ${editingEvidence.name}` : '添加新证物'}
        size="lg"
        styles={{
          header: {
            backgroundColor: 'rgba(18, 18, 18, 0.95)',
            borderBottom: '2px solid #00FFFF',
            color: '#00FFFF'
          },
          title: {
            color: '#00FFFF',
            fontWeight: 600,
            fontSize: '18px'
          },
          body: {
            backgroundColor: 'rgba(18, 18, 18, 0.95)',
            color: '#E0E0E0'
          },
          content: {
            backgroundColor: 'rgba(18, 18, 18, 0.95)',
            border: '2px solid #00FFFF',
            borderRadius: '12px',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)'
          },
          close: {
            color: '#00FFFF',
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 255, 0.1)',
              color: '#00FFFF'
            }
          }
        }}
      >
        {editingEvidence && (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" fw={500} c="#00FFFF" mb="xs">证物名称</Text>
                <TextInput
                  placeholder="输入证物名称或使用下方智能生成"
                  value={editingEvidence.name}
                  onChange={(event) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      name: event.currentTarget.value
                    })
                  }
                  required
                  styles={{
                    input: {
                      backgroundColor: 'rgba(0, 255, 255, 0.05)',
                      borderColor: 'rgba(0, 255, 255, 0.3)',
                      color: '#E0E0E0',
                      '&::placeholder': { color: '#00FFFF', opacity: 0.7 },
                      '&:focus': { 
                        borderColor: '#00FFFF',
                        boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                      }
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="证物类别"
                  data={categoryOptions}
                  value={editingEvidence.category}
                  onChange={(value) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      category: value as any
                    })
                  }
                  styles={{
                    label: { color: '#00FFFF', fontWeight: 500 },
                    input: {
                      backgroundColor: 'rgba(0, 255, 255, 0.05)',
                      borderColor: 'rgba(0, 255, 255, 0.3)',
                      color: '#E0E0E0',
                      '&:focus': { 
                        borderColor: '#00FFFF',
                        boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                      }
                    },
                    dropdown: {
                      backgroundColor: 'rgba(18, 18, 18, 0.95)',
                      border: '1px solid #00FFFF',
                      boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)'
                    },
                    option: {
                      color: '#E0E0E0',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                        color: '#00FFFF'
                      }
                    }
                  }}
                />
              </Grid.Col>
            </Grid>

            {/* 证物概况 - 用户可见的物理描述 */}
            <div>
              <Group justify="space-between" align="flex-end" mb="xs">
                <Group gap="xs" align="baseline">
                  <Text size="sm" fw={500} c="#00FFFF">
                    证物概况
                  </Text>
                  <Text size="xs" c="#BDBDBD" style={{ fontWeight: 400 }}>
                    （物理特征、外观、发现地点等，用户可见）
                  </Text>
                </Group>
                {onOpenPolish && editingIndex !== null && (
                  <PolishButton onClick={() => onOpenPolish(`evidences[${editingIndex}].overview`)} />
                )}
              </Group>
              <Textarea
                placeholder="描述证物的外观、材质、尺寸、颜色、发现地点等物理特征，用于图像生成"
                value={editingEvidence.overview || ''}
                onChange={(event) =>
                  setEditingEvidence({
                    ...editingEvidence,
                    overview: event.currentTarget.value
                  })
                }
                minRows={3}
                required
                styles={{
                  input: {
                    backgroundColor: 'rgba(0, 255, 255, 0.05)',
                    borderColor: 'rgba(0, 255, 255, 0.3)',
                    color: '#E0E0E0',
                    '&::placeholder': { color: '#00FFFF', opacity: 0.7 },
                    '&:focus': { 
                      borderColor: '#00FFFF',
                      boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                    }
                  }
                }}
              />
            </div>

            {/* 证物线索 - AI上下文的关联信息 */}
            <div>
              <Group justify="space-between" align="flex-end" mb="xs">
                <Group gap="xs" align="baseline">
                  <Text size="sm" fw={500} c="#4ECCA3">
                    证物线索
                  </Text>
                  <Text size="xs" c="#BDBDBD" style={{ fontWeight: 400 }}>
                    （关联信息、用途推测、案件线索等，AI对话上下文）
                  </Text>
                </Group>
                {onOpenPolish && editingIndex !== null && (
                  <PolishButton onClick={() => onOpenPolish(`evidences[${editingIndex}].clues`)} />
                )}
              </Group>
              <Textarea
                placeholder="描述证物的所有权、用途推测、与案件的关系、涉及的人物关联等线索信息"
                value={editingEvidence.clues || ''}
                onChange={(event) =>
                  setEditingEvidence({
                    ...editingEvidence,
                    clues: event.currentTarget.value
                  })
                }
                minRows={2}
                styles={{
                  input: {
                    backgroundColor: 'rgba(78, 204, 163, 0.05)',
                    borderColor: 'rgba(78, 204, 163, 0.3)',
                    color: '#E0E0E0',
                    '&::placeholder': { color: '#4ECCA3', opacity: 0.7 },
                    '&:focus': { 
                      borderColor: '#4ECCA3',
                      boxShadow: '0 0 10px rgba(78, 204, 163, 0.3)'
                    }
                  }
                }}
              />
            </div>

            <Grid>
              <Grid.Col span={6}>
                <Select
                  label="重要程度"
                  data={importanceOptions}
                  value={editingEvidence.importance}
                  onChange={(value) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      importance: value as any
                    })
                  }
                  styles={{
                    label: { color: '#00FFFF', fontWeight: 500 },
                    input: {
                      backgroundColor: 'rgba(0, 255, 255, 0.05)',
                      borderColor: 'rgba(0, 255, 255, 0.3)',
                      color: '#E0E0E0',
                      '&:focus': { 
                        borderColor: '#00FFFF',
                        boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                      }
                    },
                    dropdown: {
                      backgroundColor: 'rgba(18, 18, 18, 0.95)',
                      border: '1px solid #00FFFF',
                      boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)'
                    },
                    option: {
                      color: '#E0E0E0',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                        color: '#00FFFF'
                      }
                    }
                  }}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="初始状态"
                  data={stateOptions}
                  value={editingEvidence.initialState}
                  onChange={(value) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      initialState: value as any
                    })
                  }
                  styles={{
                    label: { color: '#00FFFF', fontWeight: 500 },
                    input: {
                      backgroundColor: 'rgba(0, 255, 255, 0.05)',
                      borderColor: 'rgba(0, 255, 255, 0.3)',
                      color: '#E0E0E0',
                      '&:focus': { 
                        borderColor: '#00FFFF',
                        boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                      }
                    },
                    dropdown: {
                      backgroundColor: 'rgba(18, 18, 18, 0.95)',
                      border: '1px solid #00FFFF',
                      boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)'
                    },
                    option: {
                      color: '#E0E0E0',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 255, 255, 0.1)',
                        color: '#00FFFF'
                      }
                    }
                  }}
                />
              </Grid.Col>
            </Grid>

            <MultiSelect
              label="相关角色"
              placeholder="选择与此证物相关的角色（包括搭档、受害人等，不包括玩家）"
              data={getSelectableCharacters}
              value={editingEvidence.relatedCharacters || []}
              onChange={(values) =>
                setEditingEvidence({
                  ...editingEvidence,
                  relatedCharacters: values || []
                })
              }
              styles={{
                label: { color: '#00FFFF', fontWeight: 500 },
                input: {
                  backgroundColor: 'rgba(0, 255, 255, 0.05)',
                  borderColor: 'rgba(0, 255, 255, 0.3)',
                  color: '#E0E0E0',
                  '&::placeholder': { color: '#00FFFF', opacity: 0.7 },
                  '&:focus': { 
                    borderColor: '#00FFFF',
                    boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                  }
                },
                dropdown: {
                  backgroundColor: 'rgba(18, 18, 18, 0.95)',
                  border: '1px solid #00FFFF',
                  boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)'
                },
                option: {
                  color: '#E0E0E0',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 255, 255, 0.1)',
                    color: '#00FFFF'
                  }
                },
                pill: {
                  backgroundColor: 'rgba(78, 204, 163, 0.3)',
                  color: '#4ECCA3',
                  border: '1px solid rgba(78, 204, 163, 0.5)'
                }
              }}
            />

            {/* 智能生成证物名称和描述按钮 */}
            <Group justify="center" mt="md">
              <Button
                size="md"
                variant="outline"
                leftSection={<IconWand size={16} />}
                onClick={handleGenerateEvidence}
                loading={isGeneratingEvidence}
                disabled={!canGenerateEvidence()}
                styles={{
                  root: {
                    borderColor: canGenerateEvidence() ? '#4ECCA3' : 'rgba(78, 204, 163, 0.4)',
                    color: canGenerateEvidence() ? '#4ECCA3' : '#BDBDBD',
                    backgroundColor: canGenerateEvidence() ? 'transparent' : 'rgba(189, 189, 189, 0.05)',
                    fontSize: '13px',
                    height: '36px',
                    fontWeight: 600,
                    minWidth: '180px',
                    '&:hover': canGenerateEvidence() ? {
                      backgroundColor: 'rgba(78, 204, 163, 0.1)',
                      borderColor: '#4ECCA3',
                      transform: 'scale(1.02)'
                    } : {},
                    '&:disabled': {
                      borderColor: 'rgba(78, 204, 163, 0.4)',
                      color: '#BDBDBD',
                      backgroundColor: 'rgba(189, 189, 189, 0.05)',
                      opacity: 1
                    },
                    transition: 'all 0.2s ease'
                  }
                }}
              >
                🎯 生成证物名称和描述
              </Button>
            </Group>

            {/* 智能生成提示 */}
            {!canGenerateEvidence() && (
              <Alert
                color="blue"
                title="智能生成提示"
                styles={{
                  root: {
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    border: '1px solid rgba(0, 123, 255, 0.3)',
                    color: '#E6F3FF'
                  },
                  title: { color: '#00BFFF' }
                }}
              >
                <Text size="sm" c="#E6F3FF">
                  💡 设定好证物类别、重要程度、初始状态和相关角色后，即可使用智能生成功能自动创建证物名称和描述。
                </Text>
              </Alert>
            )}

            {/* 图像管理 - 三种方式 */}
            <div>
              <Text size="sm" fw={500} mb="sm" c="#87CEEB">证物图像</Text>
              
              {/* 图像预览区域 */}
              <Group gap="md" mb="md">
                <div style={{ textAlign: 'center' }}>
                  {editingEvidence.image ? (
                    // 判断是图标还是图片
                    editingEvidence.image.startsWith('data:') || editingEvidence.image.includes('/') ? (
                      <Image
                        src={imagePreview || getEvidenceImageUrl(editingEvidence.image)}
                        alt={editingEvidence.name}
                        width={120}
                        height={120}
                        fit="cover"
                        radius="sm"
                        style={{ border: '2px solid #87CEEB' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 120,
                          height: 120,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, rgba(135, 206, 235, 0.2) 0%, rgba(135, 206, 235, 0.1) 100%)',
                          border: '2px solid #87CEEB'
                        }}
                      >
                        <Text size="48px" style={{ lineHeight: 1 }}>
                          {getEvidenceIconDisplay(editingEvidence)}
                        </Text>
                      </div>
                    )
                  ) : (
                    <div
                      style={{
                        width: 120,
                        height: 120,
                        backgroundColor: 'rgba(135, 206, 235, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        border: '2px dashed rgba(135, 206, 235, 0.5)'
                      }}
                    >
                      <IconPhoto size={32} color="#87CEEB" />
                    </div>
                  )}
                  
                  {/* 图像类型提示 */}
                  <Text size="xs" c="dimmed" mt="xs" style={{ textAlign: 'center' }}>
                    {editingEvidence.image ? 
                      (editingEvidence.image.startsWith('data:') || editingEvidence.image.includes('/') ? 
                        '自定义图片' : 
                        getEvidenceIconInfo(editingEvidence.image).label
                      ) : 
                      '未选择图像'
                    }
                  </Text>
                </div>
                
                {/* 操作按钮组 */}
                <Stack gap="xs" style={{ flex: 1 }}>
                  {/* 方式1：选择预设图标 */}
                  <Button
                    size="xs"
                    variant="outline"
                    leftSection={<IconEye size={14} />}
                    onClick={() => setShowIconSelector(true)}
                    fullWidth
                    styles={{
                      root: {
                        borderColor: '#00C2FF',
                        color: '#00C2FF',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 194, 255, 0.1)',
                          borderColor: '#00C2FF'
                        }
                      }
                    }}
                  >
                    📋 选择图标
                  </Button>
                  
                  {/* 智能匹配按钮 */}
                  <Button
                    size="xs"
                    variant="outline"
                    leftSection={<IconSearch size={14} />}
                    onClick={handleSmartIconMatch}
                    disabled={!editingEvidence.name}
                    fullWidth
                    styles={{
                      root: {
                        borderColor: '#28A745',
                        color: '#28A745',
                        '&:hover': {
                          backgroundColor: 'rgba(40, 167, 69, 0.1)',
                          borderColor: '#28A745'
                        },
                        '&:disabled': {
                          borderColor: 'rgba(40, 167, 69, 0.3)',
                          color: 'rgba(40, 167, 69, 0.5)'
                        }
                      }
                    }}
                  >
                    🎯 智能匹配
                  </Button>
                  
                  {/* 方式2：选择预设图像 */}
                  <Button
                    size="xs"
                    variant="outline"
                    leftSection={<IconPhoto size={14} />}
                    onClick={handleOpenPresetImageSelector}
                    fullWidth
                    styles={{
                      root: {
                        borderColor: '#17A2B8',
                        color: '#17A2B8',
                        '&:hover': {
                          backgroundColor: 'rgba(23, 162, 184, 0.1)',
                          borderColor: '#17A2B8'
                        }
                      }
                    }}
                  >
                    🖼️ 图像库
                  </Button>
                  
                  {/* 方式3：AI生成图像 */}
                  <Button
                    size="xs"
                    variant="outline"
                    leftSection={<IconWand size={14} />}
                    onClick={() => handleGenerateImage(editingEvidence)}
                    loading={isGeneratingImage}
                    disabled={!editingEvidence.name || !editingEvidence.overview}
                    fullWidth
                    styles={{
                      root: {
                        borderColor: '#8B5CF6',
                        color: '#8B5CF6',
                        '&:hover': {
                          backgroundColor: 'rgba(139, 92, 246, 0.1)',
                          borderColor: '#8B5CF6'
                        },
                        '&:disabled': {
                          borderColor: 'rgba(139, 92, 246, 0.3)',
                          color: 'rgba(139, 92, 246, 0.5)'
                        }
                      }
                    }}
                  >
                    🤖 AI生成
                  </Button>
                  
                  {/* 方式3：本地上传 */}
                  <FileInput
                    size="xs"
                    placeholder="📁 本地上传"
                    accept="image/*"
                    value={imageFile}
                    onChange={handleImageUpload}
                    styles={{
                      input: {
                        backgroundColor: 'rgba(135, 206, 235, 0.1)',
                        borderColor: 'rgba(135, 206, 235, 0.3)',
                        color: '#E6F3FF',
                        textAlign: 'center',
                        '&::placeholder': { color: '#87CEEB', opacity: 0.7 },
                        '&:focus': { 
                        borderColor: '#00FFFF',
                        boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)'
                      }
                      }
                    }}
                  />
                </Stack>
              </Group>
            </div>

            <Group justify="flex-end" mt="md">
              <Button 
                variant="outline" 
                onClick={() => setShowEditModal(false)}
                styles={{
                  root: {
                    borderColor: '#87CEEB',
                    color: '#87CEEB',
                    '&:hover': {
                      backgroundColor: 'rgba(135, 206, 235, 0.1)',
                      borderColor: '#87CEEB'
                    }
                  }
                }}
              >
                取消
              </Button>
              <Button 
                onClick={() => handleSaveEvidence(editingEvidence)}
                disabled={!editingEvidence.name || (!editingEvidence.overview && !editingEvidence.description)}
                styles={{
                  root: {
                    backgroundColor: 'rgba(135, 206, 235, 0.3)',
                    borderColor: '#87CEEB',
                    color: '#E6F3FF',
                    '&:hover': {
                      backgroundColor: 'rgba(135, 206, 235, 0.4)',
                      borderColor: '#87CEEB'
                    },
                    '&:disabled': {
                      backgroundColor: 'rgba(135, 206, 235, 0.1)',
                      borderColor: 'rgba(135, 206, 235, 0.3)',
                      color: 'rgba(230, 243, 255, 0.5)'
                    }
                  }
                }}
              >
                保存
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* 图标选择器模态框 */}
      <Modal
        opened={showIconSelector}
        onClose={() => {
          setShowIconSelector(false);
          setIconSearchQuery('');
          setSelectedIconCategory('all');
        }}
        title="选择证物图标"
        size="lg"
        styles={{
          header: {
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            borderBottom: '1px solid rgba(135, 206, 235, 0.3)',
            color: '#87CEEB'
          },
          title: {
            color: '#87CEEB',
            fontWeight: 600,
            fontSize: '18px'
          },
          body: {
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            color: '#E6F3FF'
          },
          content: {
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            border: '1px solid rgba(135, 206, 235, 0.3)',
            borderRadius: '8px'
          },
          close: {
            color: '#87CEEB',
            '&:hover': {
              backgroundColor: 'rgba(135, 206, 235, 0.1)'
            }
          }
        }}
      >
        <Stack gap="md">
          {/* 搜索和筛选 */}
          <Group gap="sm">
            <TextInput
              placeholder="搜索图标..."
              value={iconSearchQuery}
              onChange={(e) => setIconSearchQuery(e.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
              rightSection={
                iconSearchQuery && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => setIconSearchQuery('')}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                )
              }
              style={{ flex: 1 }}
              styles={{
                input: {
                  backgroundColor: 'rgba(135, 206, 235, 0.1)',
                  borderColor: 'rgba(135, 206, 235, 0.3)',
                  color: '#E6F3FF',
                  '&::placeholder': { color: '#87CEEB', opacity: 0.7 },
                  '&:focus': { borderColor: '#87CEEB' }
                }
              }}
            />
            <Select
              placeholder="选择类别"
              data={iconCategoryOptions}
              value={selectedIconCategory}
              onChange={(value) => setSelectedIconCategory(value || 'all')}
              styles={{
                input: {
                  backgroundColor: 'rgba(135, 206, 235, 0.1)',
                  borderColor: 'rgba(135, 206, 235, 0.3)',
                  color: '#E6F3FF',
                  minWidth: 120,
                  '&:focus': { borderColor: '#87CEEB' }
                },
                dropdown: {
                  backgroundColor: 'rgba(30, 30, 30, 0.95)',
                  borderColor: 'rgba(135, 206, 235, 0.3)'
                },
                option: {
                  color: '#E6F3FF',
                  '&:hover': {
                    backgroundColor: 'rgba(135, 206, 235, 0.1)'
                  }
                }
              }}
            />
          </Group>
          
          {/* 图标网格 */}
          <ScrollArea.Autosize mah={400}>
            {filteredIcons.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                {iconSearchQuery ? '没有找到匹配的图标' : '该类别下没有图标'}
              </Text>
            ) : (
              <SimpleGrid cols={8} spacing="sm">
                {(filteredIcons || []).map((icon) => (
                  <Tooltip key={icon.value} label={icon.label}>
                    <Box
                      onClick={() => handleIconSelect(icon.value)}
                      style={{
                        cursor: 'pointer',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '2px solid transparent',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(135, 206, 235, 0.05)',
                        '&:hover': {
                          backgroundColor: 'rgba(135, 206, 235, 0.2)',
                          borderColor: '#87CEEB',
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <Text size="xl" style={{ lineHeight: 1, marginBottom: '4px' }}>
                        {icon.emoji}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                        {icon.label}
                      </Text>
                    </Box>
                  </Tooltip>
                ))}
              </SimpleGrid>
            )}
          </ScrollArea.Autosize>
          
          {/* 统计信息 */}
          <Text size="xs" c="dimmed" ta="center">
            共 {filteredIcons.length} 个图标
            {selectedIconCategory !== 'all' && ` (${iconCategoryOptions.find(c => c.value === selectedIconCategory)?.label})`}
          </Text>
        </Stack>
      </Modal>

      {/* 预设图像选择器模态框 */}
      <Modal
        opened={showPresetImageSelector}
        onClose={() => {
          setShowPresetImageSelector(false);
          setPresetImageSearchQuery('');
        }}
        title="选择证物图像"
        size="xl"
        centered
        styles={{
          content: {
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            border: '1px solid rgba(23, 162, 184, 0.3)',
            borderRadius: '8px'
          },
          header: {
            backgroundColor: 'rgba(23, 162, 184, 0.1)',
            borderBottom: '1px solid rgba(23, 162, 184, 0.3)'
          },
          title: {
            color: '#17A2B8',
            fontWeight: '600'
          },
          close: {
            color: '#17A2B8',
            '&:hover': {
              backgroundColor: 'rgba(23, 162, 184, 0.1)'
            }
          }
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="sm" c="#17A2B8">
              选择适合的证物图像，当前有 {(availablePresetImages || []).length} 个图像可选
            </Text>
            <Button
              size="xs"
              variant="outline"
              leftSection={<IconRefresh size={14} />}
              onClick={refreshPresetImages}
              styles={{
                root: {
                  borderColor: '#17A2B8',
                  color: '#17A2B8',
                  '&:hover': {
                    backgroundColor: 'rgba(23, 162, 184, 0.1)',
                    borderColor: '#17A2B8'
                  }
                }
              }}
            >
              刷新
            </Button>
          </Group>
          
          {/* 搜索框 */}
          <TextInput
            placeholder="🔍 搜索图像... (如: 破碎, 发簪, 刀具)"
            value={presetImageSearchQuery}
            onChange={(event) => setPresetImageSearchQuery(event.currentTarget.value)}
            styles={{
              input: {
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(23, 162, 184, 0.3)',
                color: '#FFFFFF',
                '&::placeholder': {
                  color: '#B0B0B0'
                },
                '&:focus': {
                  borderColor: '#17A2B8',
                  boxShadow: '0 0 10px rgba(23, 162, 184, 0.3)'
                }
              }
            }}
          />
          
          {/* 预设图像网格 */}
          <ScrollArea.Autosize mah={400}>
            {filteredPresetImages.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                {presetImageSearchQuery ? '没有找到匹配的图像' : '暂无可选图像'}
              </Text>
            ) : (
              <SimpleGrid cols={4} spacing="md">
                {(filteredPresetImages || []).map((imageName) => (
                  <Card
                    key={imageName}
                    shadow="sm"
                    padding="sm"
                    radius="md"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      backgroundColor: 'rgba(23, 162, 184, 0.05)',
                      borderColor: 'rgba(23, 162, 184, 0.3)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: 'rgba(23, 162, 184, 0.15)',
                        borderColor: '#17A2B8',
                        transform: 'translateY(-2px)'
                      }
                    }}
                    onClick={() => handlePresetImageSelect(imageName)}
                  >
                    <Stack align="center" gap="xs">
                      <Image
                        src={`/evidence_images/${encodeURIComponent(imageName)}`}
                        alt={getPresetImageDisplayName(imageName)}
                        width={120}
                        height={120}
                        fit="cover"
                        radius="sm"
                        fallbackSrc="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3e%3crect width='100%25' height='100%25' fill='%23f0f0f0'/%3e%3ctext x='50%25' y='50%25' font-family='Arial' font-size='14' text-anchor='middle' dy='.3em' fill='%23999'%3e🖼️%3c/text%3e%3c/svg%3e"
                      />
                      <Text size="xs" c="white" ta="center" fw={400} style={{ fontSize: '11px', lineHeight: '1.2' }}>
                        {getPresetImageDisplayName(imageName)}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </ScrollArea.Autosize>
          
          {/* 统计信息 */}
          <Text size="xs" c="dimmed" ta="center">
            共 {filteredPresetImages.length} 个可选图像
            {presetImageSearchQuery && ` (搜索: "${presetImageSearchQuery}")`}
          </Text>
        </Stack>
      </Modal>

    </Stack>
  );
};

export default EvidenceManagementPanel;
