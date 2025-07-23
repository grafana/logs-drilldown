module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow additional types that won't appear in changelogs
    'type-enum': [
      2,
      'always',
      ['docs', 'style', 'refactor', 'perf', 'ci', 'build', 'revert', 'wip', 'experimental', 'release'],
    ],
  },
};
