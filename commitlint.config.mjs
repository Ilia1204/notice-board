export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['backend', 'frontend', 'ci', 'deps', 'docs', 'release', 'repo'],
    ],
    'subject-case': [0],
  },
};
