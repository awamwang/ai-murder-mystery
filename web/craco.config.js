module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // 避免 micromark 在 development 条件下解析到依赖 assert/power-assert 的 dev 构建
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.conditionNames = [
        'browser',
        'module',
        'import',
        'require',
        'default',
      ];
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        assert: false,
        buffer: false,
        util: false,
      };
      return webpackConfig;
    },
  },
};
