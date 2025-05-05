import { reportInteraction } from '@grafana/runtime';

import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from './analytics';

jest.mock('@grafana/runtime');

test('Reports an event with the expected name and properties', () => {
  reportAppInteraction(
    USER_EVENTS_PAGES.service_selection,
    USER_EVENTS_ACTIONS[USER_EVENTS_PAGES.service_details].open_in_explore_clicked,
    { query: '{a="b"}' }
  );
  expect(reportInteraction).toHaveBeenCalledWith('grafana_lokiexplore_app_service_selection_open_in_explore_clicked', {
    query: '{a="b"}',
  });
});
