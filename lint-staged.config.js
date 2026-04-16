const PRETTIER_WRITE = 'prettier --write --ignore-path .prettierignore';

module.exports = {
  'src/**/*.{js,jsx,ts,tsx}': 'yarn lint',
  '**/*': ['eslint --fix', 'bash -c tsc-files --noEmit', PRETTIER_WRITE],
  // Matches staged files with these extensions except under tests/ (cspell ignores tests/; checking them exits 1 with 0 files).
  '!(tests/**/*).{ts,tsx,js,go,md,mdx,yml,yaml,json,scss,css}':
    'cspell -c cspell.config.json --no-progress --no-summary',
};
