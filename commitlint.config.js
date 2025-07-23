module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Commit types omitted from changelogs
    'type-enum': [
      2,
      'always',
      ['docs', 'style', 'refactor', 'perf', 'ci', 'build', 'revert', 'wip', 'experimental', 'release'],
    ],
  },
};
