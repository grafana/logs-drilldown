const PRETTIER_WRITE = 'prettier --write --ignore-path .prettierignore';

module.exports = {
  'src/**/*.{js,jsx,ts,tsx}': 'yarn lint',
  '**/*': ['eslint --fix', 'bash -c tsc-files --noEmit', PRETTIER_WRITE],
  '*.{ts,tsx,js,go,md,mdx,yml,yaml,json,scss,css}': (filenames) => {
    if (filenames.length === 0) {
      return [];
    }
    return `cspell -c cspell.config.json --no-progress --no-summary ${filenames.join(' ')}`;
  },
};
