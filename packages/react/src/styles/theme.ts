/**
 * Theme configuration for x402 React components
 *
 * Provides default colors, sizes, and other design tokens.
 * Can be used to customize component appearance.
 */

export interface X402Theme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    gray: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    background: {
      primary: string;
      secondary: string;
      success: string;
      error: string;
      warning: string;
      info: string;
    };
    border: {
      default: string;
      light: string;
      focus: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

/**
 * Default theme configuration
 */
export const defaultTheme: X402Theme = {
  colors: {
    primary: '#3b82f6',
    secondary: '#6b7280',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    background: {
      primary: '#eff6ff',
      secondary: '#f3f4f6',
      success: '#f0fdf4',
      error: '#fef2f2',
      warning: '#fffbeb',
      info: '#eff6ff',
    },
    border: {
      default: '#e5e7eb',
      light: '#f3f4f6',
      focus: '#3b82f6',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  borderRadius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  fontSize: {
    xs: '11px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '24px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
};

/**
 * Dark theme configuration
 */
export const darkTheme: X402Theme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    primary: '#60a5fa',
    secondary: '#9ca3af',
    gray: {
      50: '#111827',
      100: '#1f2937',
      200: '#374151',
      300: '#4b5563',
      400: '#6b7280',
      500: '#9ca3af',
      600: '#d1d5db',
      700: '#e5e7eb',
      800: '#f3f4f6',
      900: '#f9fafb',
    },
    background: {
      primary: '#1e3a8a',
      secondary: '#1f2937',
      success: '#064e3b',
      error: '#7f1d1d',
      warning: '#78350f',
      info: '#1e3a8a',
    },
    border: {
      default: '#374151',
      light: '#4b5563',
      focus: '#60a5fa',
    },
  },
};

/**
 * Helper function to create custom theme
 *
 * @example
 * ```ts
 * const customTheme = createTheme({
 *   colors: {
 *     primary: '#8b5cf6', // Purple
 *   }
 * });
 * ```
 */
export function createTheme(overrides: Partial<X402Theme>): X402Theme {
  return {
    ...defaultTheme,
    ...overrides,
    colors: {
      ...defaultTheme.colors,
      ...overrides.colors,
      gray: {
        ...defaultTheme.colors.gray,
        ...(overrides.colors?.gray || {}),
      },
      background: {
        ...defaultTheme.colors.background,
        ...(overrides.colors?.background || {}),
      },
      border: {
        ...defaultTheme.colors.border,
        ...(overrides.colors?.border || {}),
      },
    },
    spacing: {
      ...defaultTheme.spacing,
      ...overrides.spacing,
    },
    borderRadius: {
      ...defaultTheme.borderRadius,
      ...overrides.borderRadius,
    },
    fontSize: {
      ...defaultTheme.fontSize,
      ...overrides.fontSize,
    },
    fontWeight: {
      ...defaultTheme.fontWeight,
      ...overrides.fontWeight,
    },
    shadows: {
      ...defaultTheme.shadows,
      ...overrides.shadows,
    },
  };
}

/**
 * USDC token colors (for reference)
 */
export const usdcColors = {
  primary: '#2775ca',
  light: '#eff6ff',
  dark: '#1e3a8a',
};

/**
 * Solana brand colors (for reference)
 */
export const solanaColors = {
  green: '#14f195',
  purple: '#9945ff',
  gradient: 'linear-gradient(135deg, #14f195 0%, #9945ff 100%)',
};