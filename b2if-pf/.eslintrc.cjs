module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    // Lei 1 — Limite de linhas obrigatório
    'max-lines': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],

    // Lei 4 — TypeScript strict (apenas para arquivos .ts/.tsx novos)
    '@typescript-eslint/no-explicit-any': 'warn',

    // Boas práticas
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // Desativados para migração incremental (arquivos .js legados)
    'react/prop-types': 'off',
  },
  overrides: [
    {
      // Regras mais rígidas apenas para arquivos TypeScript novos
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      },
    },
  ],
};
