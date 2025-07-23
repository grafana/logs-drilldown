module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow additional types that won't appear in changelogs
    'type-enum': [
      2,
      'always',
      [
        'docs', // no changelog
        'style', // no changelog
        'refactor', // no changelog
        'perf', // no changelog
        'ci', // no changelog
        'build', // no changelog
        'revert', // no changelog
        'wip', // no changelog - work in progress
        'experimental', // no changelog - experimental features
        'release', // no changelog - release commits
      ],
    ],
  },
};
