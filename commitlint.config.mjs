export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['backend', 'frontend', 'e2e', 'ci', 'deps', 'docs', 'release', 'repo'],
    ],
    'subject-case': [0],
  },
};
