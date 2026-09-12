import React, { CSSProperties } from 'react';
import { Modal, ModalProps, MantineTheme } from '@mantine/core';

/**
 * 统一的 Modal 基础组件，封装项目中所有 Modal 共用的极光主题样式。
 * 
 * 支持两种预设风格：
 * - 'aurora'（默认）：半透明深色背景 + 青色边框 + 模糊效果
 * - 'solid'：实色深色背景 + 青色边框（EndModal / IntroModal 风格）
 * 
 * 也可以通过 styles prop 覆盖任何预设样式。
 */

export type ModalVariant = 'aurora' | 'solid';

type ModalStylesObject = Partial<Record<string, CSSProperties | Record<string, any>>>;
type ModalStylesInput = ModalStylesObject | ((theme: MantineTheme) => ModalStylesObject);

interface BaseModalProps extends Omit<ModalProps, 'styles'> {
  variant?: ModalVariant;
  styles?: ModalStylesInput;
}

const variantStyles: Record<ModalVariant, ModalStylesObject> = {
  aurora: {
    content: {
      background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(30, 30, 30, 0.98) 100%)',
      border: '2px solid rgba(0, 194, 255, 0.3)',
      borderRadius: '16px',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 194, 255, 0.2)',
      color: '#FFFFFF'
    },
    header: {
      background: 'transparent',
      borderBottom: '1px solid rgba(0, 194, 255, 0.2)',
      paddingBottom: '16px'
    },
    title: {
      color: '#FFFFFF',
      fontSize: '24px',
      fontWeight: '700',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
    },
    body: {
      padding: '24px'
    },
    close: {
      color: '#FFFFFF',
      '&:hover': {
        backgroundColor: 'rgba(0, 194, 255, 0.1)'
      }
    }
  },
  solid: {
    content: {
      background: 'linear-gradient(135deg, #2A2A3E 0%, #1E1E2E 100%)',
      border: '2px solid #00C2FF',
      borderRadius: '16px',
      boxShadow: '0 0 30px rgba(0, 194, 255, 0.5)',
      color: '#FFFFFF'
    },
    header: {
      background: 'rgba(0, 194, 255, 0.1)',
      borderBottom: '1px solid #00C2FF',
      padding: '20px'
    },
    body: {
      padding: '24px',
      background: 'rgba(255, 255, 255, 0.02)'
    }
  }
};

const resolveStyles = (
  input: ModalStylesInput | undefined,
  theme: MantineTheme
): ModalStylesObject => {
  if (!input) {
    return {};
  }
  return typeof input === 'function' ? input(theme) : input;
};

const BaseModal: React.FC<BaseModalProps> = ({
  variant = 'aurora',
  styles,
  children,
  ...rest
}) => {
  // 合并预设样式和自定义样式
  const baseStyles = variantStyles[variant];
  const mergedStyles: ModalProps['styles'] = styles
    ? ((theme: MantineTheme) => {
        const base = resolveStyles(baseStyles, theme);
        const custom = resolveStyles(styles, theme);
        return {
          ...base,
          ...custom,
          content: { ...base.content, ...custom.content },
          header: { ...base.header, ...custom.header },
          title: { ...base.title, ...custom.title },
          body: { ...base.body, ...custom.body },
          close: { ...base.close, ...custom.close },
        };
      }) as ModalProps['styles']
    : (baseStyles as ModalProps['styles']);

  return (
    <Modal styles={mergedStyles} {...rest}>
      {children}
    </Modal>
  );
};

export default BaseModal;
