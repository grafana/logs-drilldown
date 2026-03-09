const PRETTIER_WRITE = 'prettier --write --ignore-unknown';

module.exports = {
  'src/**/*.{js,jsx,ts,tsx}': 'yarn lint',
  '**/*': ['eslint --fix', 'bash -c tsc-files --noEmit', PRETTIER_WRITE],
};
