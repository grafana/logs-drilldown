const PRETTIER_WRITE = 'prettier --write';

module.exports = {
  '**/*': ['eslint --fix', 'bash -c tsc-files --noEmit', PRETTIER_WRITE],
};
