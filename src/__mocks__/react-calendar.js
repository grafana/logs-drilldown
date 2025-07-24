const React = require('react');

const Calendar = jest.fn(({ onChange, value, ...props }) => {
  return React.createElement('div', {
    'data-testid': 'calendar',
    onClick: () => onChange && onChange(new Date()),
    ...props,
  });
});

module.exports = Calendar;
module.exports.default = Calendar;
