import React, { useState, useEffect, useCallback } from 'react';
import { 
  Modal, Button, Text, ScrollArea, Paper, Stack, Group, 
  ActionIcon, Tooltip, Badge, Divider, Alert, Loader,
  TypographyStylesProvider, Menu
} from '@mantine/core';
import { IconTrash, IconEye, IconClock, IconFileText, IconDots, IconRefresh } from '@tabler/icons-react';
import { Script } from '../types/script';
import { API_URL } from '../constants';

// 剧透故事数据类型
interface SpoilerStory {
  id: number;
  scriptId: string;
  title: string;
  content: string;
  generatedAt: string;
  wordCount: number;
  generationDuration: number;
  aiModel: string;
  promptVersion: string;
  sessionId: string;
}

interface SpoilerHistoryModalProps {
  opened: boolean;
  onClose: () => void;
  script?: Script;
  onViewStory: (story: SpoilerStory) => void; // 查看故事的回调
}

// 增强的Markdown转HTML函数（复用SpoilerStoryModal的）
const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown.trim()) return '';
  
  let html = markdown
    // 先处理标题（避免被段落标签包围）
    .replace(/^## (.*$)/gim, '</p><h2 style="color: #FFD700; font-size: 24px; font-weight: bold; margin: 32px 0 20px 0; border-bottom: 2px solid #FFD700; padding-bottom: 10px; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);">$1</h2><p style="margin: 16px 0; text-indent: 2em; line-height: 1.8;">')
    .replace(/^### (.*$)/gim, '</p><h3 style="color: #00FFFF; font-size: 20px; font-weight: bold; margin: 24px 0 16px 0; text-shadow: 0 0 8px rgba(0, 255, 255, 0.4);">$1</h3><p style="margin: 16px 0; text-indent: 2em; line-height: 1.8;">')
    // 粗体和斜体
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #FFD700; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em style="color: #B8B8B8; font-style: italic; opacity: 0.9;">$1</em>')
    // 段落分隔
    .replace(/\n\n+/g, '</p><p style="margin: 20px 0; text-indent: 2em; line-height: 1.8;">')
    // 单个换行
    .replace(/\n/g, '<br/>');
  
  // 包装在段落标签中，并清理多余的标签
  html = '<p style="margin: 16px 0; text-indent: 2em; line-height: 1.8;">' + html + '</p>';
  
  // 清理多余的空段落
  html = html
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>\s*<\/p>/g, '')
    .replace(/(<\/h[23]>)<p[^>]*>(<h[23])/g, '$1$2');
  
  return html;
};

const SpoilerHistoryModal: React.FC<SpoilerHistoryModalProps> = ({ 
  opened, 
  onClose, 
  script,
  onViewStory
}) => {
  const [stories, setStories] = useState<SpoilerStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStory, setSelectedStory] = useState<SpoilerStory | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // 加载历史剧透故事
  const loadStories = useCallback(async () => {
    if (!script?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/db/spoiler-stories/${script.id}`);
      const data = await response.json();
      
      if (data.success) {
        setStories(data.stories || []);
        console.log(`📚 加载了 ${data.stories?.length || 0} 个历史剧透故事`);
      } else {
        console.error('加载历史剧透故事失败:', data.message);
      }
    } catch (error) {
      console.error('加载历史剧透故事出错:', error);
    } finally {
      setLoading(false);
    }
  }, [script?.id]);

  // 删除故事
  const deleteStory = async (storyId: number) => {
    try {
      const response = await fetch(`${API_URL}/db/spoiler-stories/${storyId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        setStories(stories.filter(story => story.id !== storyId));
        console.log('✅ 删除剧透故事成功');
        
        // 如果正在查看被删除的故事，返回列表
        if (selectedStory?.id === storyId) {
          setSelectedStory(null);
          setViewMode('list');
        }
      } else {
        console.error('删除剧透故事失败:', data.message);
      }
    } catch (error) {
      console.error('删除剧透故事出错:', error);
    }
  };

  // 查看故事详情
  const viewStoryDetail = (story: SpoilerStory) => {
    setSelectedStory(story);
    setViewMode('detail');
  };

  // 返回列表视图
  const backToList = () => {
    setSelectedStory(null);
    setViewMode('list');
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '未知时间';
    }
  };

  // 格式化生成时长
  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds.toFixed(0)}秒`;
  };

  // 当模态框打开时加载数据
  useEffect(() => {
    if (opened && script) {
      loadStories();
      setViewMode('list');
      setSelectedStory(null);
    }
  }, [opened, script, loadStories]);

  if (!script) {
    return (
      <Modal 
        opened={opened} 
        onClose={onClose} 
        size="md"
        title={<Text size="lg" fw={700} style={{ color: '#E63946' }}>历史剧透故事</Text>}
        styles={{
          content: { backgroundColor: '#1A1A2E' },
          header: { backgroundColor: '#1A1A2E', borderBottom: '1px solid #333' }
        }}
      >
        <Text style={{ color: '#E0E0E0', textAlign: 'center', padding: '20px' }}>
          暂无剧本数据
        </Text>
        <Button onClick={onClose} fullWidth mt="md" style={{
          backgroundColor: '#4ECCA3',
          color: '#FFFFFF'
        }}>
          关闭
        </Button>
      </Modal>
    );
  }

  return (
    <Modal 
      opened={opened} 
      onClose={onClose} 
      size={viewMode === 'detail' ? '95vw' : 'xl'}
      title={
        <Group gap="md">
          <Text size="xl" fw={700} style={{ 
            color: '#FFFFFF',
            textShadow: '0 0 15px rgba(167, 139, 250, 0.8)'
          }}>
            📚 历史剧透故事
          </Text>
          {viewMode === 'list' && (
            <Badge color="cyan" variant="light">
              {script.title}
            </Badge>
          )}
          {viewMode === 'detail' && selectedStory && (
            <Badge color="purple" variant="light">
              {selectedStory.title}
            </Badge>
          )}
        </Group>
      }
      styles={{
        content: { 
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none'
        },
        header: { 
          backgroundColor: 'rgba(26, 26, 46, 0.95)',
          borderBottom: '2px solid #A78BFA',
          backdropFilter: 'blur(10px)'
        },
        body: {
          padding: 0
        }
      }}
    >
      <div style={{
        background: `
          linear-gradient(135deg, 
            #0a0a23 0%, 
            #1a1a3e 15%, 
            #2d1b69 30%, 
            #1e3a5f 45%, 
            #0f2027 60%, 
            #203a43 75%, 
            #2c5364 90%, 
            #0f3460 100%
          )
        `,
        minHeight: viewMode === 'detail' ? '80vh' : '70vh',
        padding: '20px'
      }}>
        <Stack gap="md" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          {/* 列表视图 */}
          {viewMode === 'list' && (
            <>
              {/* 操作栏 */}
              <Paper p="md" style={{
                background: 'rgba(0, 0, 0, 0.8)',
                border: '2px solid #A78BFA',
                borderRadius: '12px'
              }}>
                <Group justify="space-between">
                  <Text size="md" fw={600} style={{ color: '#A78BFA' }}>
                    共找到 {stories.length} 个历史剧透故事
                  </Text>
                  <Group gap="sm">
                    <Button
                      leftSection={<IconRefresh size={16} />}
                      onClick={loadStories}
                      disabled={loading}
                      size="sm"
                      styles={{
                        root: {
                          backgroundColor: '#4ECCA3',
                          color: '#FFFFFF',
                          '&:hover': {
                            backgroundColor: '#45B7AA'
                          }
                        }
                      }}
                    >
                      刷新
                    </Button>
                  </Group>
                </Group>
              </Paper>

              {/* 故事列表 */}
              <ScrollArea h="50vh">
                <Stack gap="md">
                  {loading ? (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      height: '200px' 
                    }}>
                      <Stack align="center" gap="md">
                        <Loader size="lg" color="#A78BFA" />
                        <Text style={{ color: '#A78BFA' }}>
                          正在加载历史故事...
                        </Text>
                      </Stack>
                    </div>
                  ) : stories.length === 0 ? (
                    <Alert 
                      color="yellow" 
                      title="暂无历史故事" 
                      icon={<IconFileText />}
                      style={{
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        border: '1px solid rgba(255, 193, 7, 0.3)'
                      }}
                    >
                      <Text style={{ color: '#E0E0E0' }}>
                        还没有为这个剧本生成过剧透故事。完成游戏后生成第一个剧透故事吧！
                      </Text>
                    </Alert>
                  ) : (
                    stories.map((story) => (
                      <Paper 
                        key={story.id}
                        p="md" 
                        style={{
                          background: 'rgba(0, 0, 0, 0.9)',
                          border: '1px solid #A78BFA',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#00FFFF';
                          e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#A78BFA';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <Group justify="space-between" align="flex-start">
                          <div style={{ flex: 1 }}>
                            <Group gap="sm" mb="xs">
                              <Text size="lg" fw={600} style={{ color: '#FFFFFF' }}>
                                {story.title}
                              </Text>
                              <Badge color="purple" size="sm" variant="light">
                                {story.aiModel}
                              </Badge>
                            </Group>
                            
                            <Group gap="md" mb="sm">
                              <Group gap="xs">
                                <IconClock size={14} color="#B8B8B8" />
                                <Text size="xs" style={{ color: '#B8B8B8' }}>
                                  {formatDate(story.generatedAt)}
                                </Text>
                              </Group>
                              <Group gap="xs">
                                <IconFileText size={14} color="#B8B8B8" />
                                <Text size="xs" style={{ color: '#B8B8B8' }}>
                                  {story.wordCount} 字
                                </Text>
                              </Group>
                              <Text size="xs" style={{ color: '#B8B8B8' }}>
                                生成耗时: {formatDuration(story.generationDuration)}
                              </Text>
                            </Group>
                            
                            {/* 故事预览 */}
                            <Text 
                              size="sm" 
                              style={{ 
                                color: '#E0E0E0', 
                                opacity: 0.8,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {story.content.replace(/[#*]/g, '').substring(0, 150)}...
                            </Text>
                          </div>
                          
                          <Group gap="xs">
                            <Tooltip label="查看完整故事">
                              <ActionIcon
                                variant="filled"
                                color="cyan"
                                size="lg"
                                onClick={() => viewStoryDetail(story)}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            
                            <Menu shadow="md" width={120}>
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size="lg"
                                >
                                  <IconDots size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              
                              <Menu.Dropdown style={{ backgroundColor: '#2C2E33' }}>
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => deleteStory(story.id)}
                                >
                                  删除
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Group>
                      </Paper>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </>
          )}

          {/* 详情视图 */}
          {viewMode === 'detail' && selectedStory && (
            <>
              {/* 返回按钮和故事信息 */}
              <Paper p="md" style={{
                background: 'rgba(0, 0, 0, 0.8)',
                border: '2px solid #A78BFA',
                borderRadius: '12px'
              }}>
                <Group justify="space-between" mb="md">
                  <Button
                    variant="subtle"
                    leftSection={<IconRefresh size={16} />}
                    onClick={backToList}
                    style={{ color: '#A78BFA' }}
                  >
                    返回列表
                  </Button>
                  
                  <Group gap="md">
                    <Badge color="purple" variant="light">
                      {selectedStory.aiModel}
                    </Badge>
                    <Badge color="cyan" variant="light">
                      {selectedStory.wordCount} 字
                    </Badge>
                  </Group>
                </Group>
                
                <Divider color="#444" />
                
                <Group gap="md" mt="md">
                  <Text size="sm" style={{ color: '#B8B8B8' }}>
                    生成时间: {formatDate(selectedStory.generatedAt)}
                  </Text>
                  <Text size="sm" style={{ color: '#B8B8B8' }}>
                    生成耗时: {formatDuration(selectedStory.generationDuration)}
                  </Text>
                  <Text size="sm" style={{ color: '#B8B8B8' }}>
                    提示词版本: {selectedStory.promptVersion}
                  </Text>
                </Group>
              </Paper>

              {/* 故事内容 */}
              <Paper p="xl" style={{
                background: 'rgba(0, 0, 0, 0.9)',
                border: '2px solid #A78BFA',
                borderRadius: '16px',
                minHeight: '50vh',
                boxShadow: '0 0 20px rgba(167, 139, 250, 0.3)'
              }}>
                <ScrollArea h="50vh">
                  <TypographyStylesProvider>
                    <div 
                      style={{
                        color: '#FFFFFF',
                        fontSize: '16px',
                        lineHeight: '1.8',
                        fontFamily: '"Noto Serif SC", "Georgia", serif',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: convertMarkdownToHtml(selectedStory.content)
                      }}
                    />
                  </TypographyStylesProvider>
                </ScrollArea>
              </Paper>
            </>
          )}

          {/* 操作按钮 */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center'
          }}>
            <Button 
              onClick={onClose}
              styles={{
                root: {
                  backgroundColor: '#4ECCA3',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  border: '1px solid #4ECCA3',
                  boxShadow: '0 0 15px rgba(76, 236, 163, 0.5)',
                  '&:hover': {
                    backgroundColor: '#45B7AA',
                    boxShadow: '0 0 20px rgba(76, 236, 163, 0.7)',
                    transform: 'translateY(-1px)'
                  }
                }
              }}
            >
              关闭
            </Button>
          </div>
        </Stack>
      </div>
    </Modal>
  );
};

export default SpoilerHistoryModal;
