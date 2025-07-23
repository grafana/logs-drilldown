module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Commit types omitted from changelogs
    'type-enum': [2, 'always', ['omit', 'internal', 'chore', 'skip']],
  },
};
