const PRETTIER_WRITE = 'prettier --write --ignore-path .prettierignore';

module.exports = {
  'src/**/*.{js,jsx,ts,tsx}': 'pnpm run lint',
  '**/*': ['eslint --fix', 'bash -c tsc-files --noEmit', PRETTIER_WRITE],
};
