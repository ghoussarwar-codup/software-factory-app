export default [
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly'
      }
    },
    rules: {
      'no-debugger': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-undef': 'error',
      'no-unused-vars': 'error'
    }
  }
];
