# Changelog

## 1.0.29

##### Documentation Changes

*  Update troubleshooting page (#1568) (437a568a)
*  Update install and troubleshooting (#1564) (657880b3)
*  update stale readme, fix docker install script (#1565) (fc776d76)

##### Bug Fixes

*  unexpected clear variable behavior (#1567) (089fdfa2)
*  validate primary label correctly (#1561) (ee12a20b)
*  fix RegExp.source removing flags, use toString instead (#1563) (a9207d23)
*  stale urls (#1562) (e2eae8b8)


## 1.0.28

##### Chores

*  fix runtime error when viewing label value breakdown (#1552) (e55074b5)
*  upgrade Scenes and Grafana deps (#1548) (1f4455a7)
* **docker:**  use grafana version from base docker file, run cp weekly (#1550) (c0955ffa)

##### New Features

* **embedded:**  allow resetting filters (#1549) (d6e536c6)
*  add expanded log controls state (#1546) (77c9815f)
*  Asserts insight timeline widget integration (#1543) (ec1c37ad)
* **VariableLayoutScene:**
  *  add control to expand and collapse (#1541) (053d8c90)
  *  add control to expand and collapse (12eee7b1)

##### Bug Fixes

* **volume:**  Y-axis labels not shortened (#1540) (d63e2a32)

##### Other Changes

* **VariableLayoutScene:**  add control to expand and collapse" (f801ae66)


## 1.0.27

##### Chores

* **LineFilter:**  increase default width to accommodate for placeholder (#1539) (9ed579a4)
*  update line filters placeholder (#1538) (4b3e342e)
*  bump @grafana/create-plugin configuration to 5.26.0 (#1524) (eca1d90a)
*  add tenant id to generator, and enable auth in loki (#1519) (6ff03d0a)
*  downgrade field errors (#1518) (defa358e)
*  externalized component events (#1517) (a032cf2a)
* **faro:**  faro log successful plugin load (#1529) (025ed256)

##### New Features

* **LineLimitScene:**
  *  error message, invalidation state (#1537) (d978a797)
  *  track max lines (#1530) (b82d9768)
* **logs:**  expose line limit in all visualizations (#1527) (f107e0e7)

##### Bug Fixes

*  add tenant id to log-generator (#1522) (5225d621)


## 1.0.26

##### Chores

* **@grafana/assistant:**  bump grafana/assistant sdk (#1514) (f23ba6d5)
* **JSON:**  remove experimental banner (#1508) (37c843bc)
* **playwright:**  run smoke tests for older grafana versions (#1479) (d803b75c)
*  bump @grafana/create-plugin configuration to 5.25.7 (#1470) (45980e3f)

##### Documentation Changes

*  Add links to Explore (#1504) (83ea6090)

##### New Features

* **levels:**  allow custom options in level variable (#1509) (2d6bec3f)
* **EmbeddedLogs:**  fix missing keyLabel in parsed line filters (#1500) (4a8678d7)
*  grafana assistant expr based links (#1491) (92d76722)
*  add data source image (#1485) (764cda81)

##### Bug Fixes

* **json:**  light icon buttons (#1513) (20cd5a2e)
* **ServiceSelectionScene:**  roll back showing stored displayed fields (#1510) (9f99a2f1)
* **links:**  show queryless button when no label selector is present (#1507) (9eeafdcc)
* **table:**  make column menu keyboard accessible (#1490) (b177429a)
* **ci:**  e2e fails (#1506) (d9e707f7)
*  force reset metadata on embedded instantation (#1489) (b844998c)

##### Tests

* **e2e:**  add matrix test suite (#1480) (44ebd92f)


## 1.0.25

##### New Features

* **fields:**  field name view (#1374) (79378a18)

##### Bug Fixes

* **assistant:**  move `getObservablePluginLinks` to `@grafana/assistant` package (#1477) (1cbbe3d9)
*  prevent runtime error in Grafana 11.6 from crashing in Drilldown 1.0.24 (#1475) (a0b6fca7)


## 1.0.24

##### Chores

* **performance:**  Sharding - always join on labels (#1472) (1e3bf13d)
* **ci:**  turn on the argo workflows for releasing to prod without auto merge (#1445) (20c219ec)
* **dep:**  update grafana dependencies for compatibility (#1451) (8f0dbdcd)
* **JSON:**
  *  replace inline svgs with background images (#1446) (c1796e05)
  *  memoize to prevent uncessary re-renders (#1441) (531348cb)

##### New Features

* **Patterns:**  filter by level (#1459) (65a92234)
* **assistant-context:**  provide datasource and labels as context to Assistant (#1458) (b085e756)

##### Bug Fixes

*  prevent runtime error (#1473) (adc8fc3c)
* **shardQuerySplitting:**  stop when hitting max series (#1469) (0f3b1de9)
* **ServiceSelection:**
  *  header offset conflict with sidebar apps (#1468) (2e3f7edb)
  *  reset service selection after changing data source (#1455) (d43f0180)
* **fields:**  show max series notice in panel (#1467) (131b2502)
* **serviceSelection:**  respect displayed fields if previously set (#1456) (8dbbceb9)
* **Links:**  multi dashboard variable interpolation (#1454) (a5e4ed9c)

##### Other Changes

*  hide certain commit msgs (#1442) (7eb6b3e8)

##### Tests

* **e2e:**  fix e2e (#1448) (4cc60c31)


## 1.0.23

##### Chores

*  prevent search undefined error (#1444) (96b3f2b4)
*  track panels on activation (#1439) (68e9d7e9)
*  add tracking on go to explore button used in embedded UI (#1438) (767477a5)
*  refactor root navigation component out (#1402) (da7b3daf)
* **analytics:**  on query event (#1440) (24bce571)
* **deps:**  bump golang.org/x/oauth2 (#1434) (0c0789f9)
* **JSON:**
  *  refactor JSON methods (#1431) (2db009c6)
  *  only calculate line filter matches if highlighting is enabled (#1416) (f8a1393f)

##### New Features

* **analytics:**  report viz init once (#1443) (b6f59ccc)
* **assistant:**  add `Explain in Assistant` panel option (#1426) (4bb4a1be)
* **table:**
  *  column width estimator and toggle logsPanelControls (#1422) (12930739)
  *  core table unification (#1354) (823926d7)
*  implement ux feedback (#1429) (5238f67b)
* **LogsPanel:**  exclude panels from interactions and add custom patterns key (#1432) (7d7ab85b)
* **JSON:**
  *  links (#1420) (0ae7cd2e)
  *  hover & selected styles (#1418) (9d654c87)
  *  share link to line (#1406) (4ab18e92)
  *  Add detected_level button (#1407) (2bcce8f6)
  *  add copy log text button (#1393) (9beae02c)
  *  line wrap (#1388) (d24cc109)
  *  line filter and syntax highlighting (#1382) (767f8c15)

##### Bug Fixes

* **ad-hoc filters:**  fix duplicate filters (#1430) (892c238b)
* **JSON:**
  *  tooltip copy not updating (#1415) (20da3bab)
  *  selected buttons not showing active style (#1413) (28791c3b)
  *  sort dataframe before transform (#1386) (8b51090c)
* **LogsPanelScene:**  pass setDisplayedFields (#1421) (c77f0435)
* **LogsPanel:**  visible range and panel improvements (#1410) (616ef849)
* **links:**  interpolate expression and datasource variable (#1411) (b3840645)
* **table:**  fix overflow with docked nav (#1403) (e51dcdcc)


## 1.0.22

##### Chores

* **eslint:**  disable sort/object-properties, remove recommendations (#1392) (c7941852)
*  bump @grafana/create-plugin configuration to 5.25.1 (#1365) (65e6e53d)
*  whitelist grafana-plugins-platform-bot[bot] (#1383) (ac0f59d7)

##### New Features

*  enable Logs Drilldown link in Metrics Drilldown (#1389) (8fb4422e)
* **LogsPanel:**  set details mode (#1391) (d1befe8c)

##### Bug Fixes

*  limit patterns to 500 (#1390) (e2abf9a7)


## 1.0.21

##### New Features

* **JSON:**  support labels/metadata filtering in JSON viz (#1370) (2de9c052)
* **Embbedding:**  open embedding API for default line filters (#1376) (0d866b88)
* **patterns:**  allow disabling patterns in Logs Drilldown (#1361) (76bd7196)
*  calculate sparsity on errored/partial data (#1358) (e3bcb5ac)

##### Bug Fixes

* **JSON:**  detected fields not always getting called on activation (#1368) (987874cc)
*  dont run volume query when collapse (#1363) (f29bc32a)

##### Other Changes

*  Publish each commit to dev + ops, auto-merge dev and ops PRs (#1375) (a25eb8c6)


## 1.0.20

##### Chores

* **gha:**  update ci to deploy ops with new argo workflows (#1349) (250c5444)

##### New Features

* **EmbeddedLogs:**  embedded logs url parameter namespace (#1353) (11340a2c)


## 1.0.19

##### Chores

*  add bundle-types workflow (#1327) (ef3bc6df)

##### New Features

* **FieldsBreakdown:**  Show panels with errors (#1346) (7d0f70bc)
* **FieldValues:**  add better max series limit error message (#1345) (7f1df4cd)

##### Bug Fixes

* **datasources:**  default datasources (#1348) (b0842eab)

##### Refactors

* **changelog:**  manually fix changelog (#1342) (63333a8e)

##### Tests

*  hopeful flake fix (21c05825)


## 1.0.18

##### Chores

* **gha:**
  *  id-token permission (#1338) (283b1fb2)
  *  update ci to ci/cd job to auto deploy to dev (#1321) (a600310f)
  *  github permissions are fun (#1314) (d650a4f1)
  *  add proper permissions to format gh issues (#1312) (118774d3)
  *  update deployment tools wf (#1297) (6ccbf550)
* **deps:**  bump golang.org/x/net (#1326) (b43e2320)
* **gh issues:**
  *  formate issues with labels and project (#1291) (8e4777c1)
  *  update issue templates (#1290) (ffe12ffb)

##### New Features

* **embedding:**
  *  Embedded readonly filters (#1315) (43abb74d)
  *  Embedded Service Scene Component (#1294) (bd4f5e36)
* **LogsPanelScene:**  pass custom items to new panel (#1306) (3d011c63)
*  add token to generator (#1305) (784f7764)

##### Bug Fixes

* **logs-panel:**  infinite scroll broken by double jsonFields interpolation (#1302) (97619800)
* **JSON:**  add second json parser stage (#1301) (20b338dd)
* **EmbeddedLogs:**  Prevent readonly filter removal (#1323) (39678dbe)

## 1.0.17

##### Chores

* **gh issues:**
  *  format issues with labels and project (#1291) (8e4777c1)
  *  update issue templates (#1290) (ffe12ffb)
* **lint:**  lint all the things, except ignore (#1289) (5798dec4)

##### Bug Fixes

* **table:**  move sorting and remove initial sorting from table (#1284) (f0561406)

## 1.0.16

##### Chores

*  Call interpolateExpression (#1276) (796cacee)
*  Run lint (#1274) (fa1d3b7d)
*  Update Grafana assets to 11.6.1 (#1270) (505a307a)
*  Add option to output to syslog from the generator (#1240) (14057e9f)
* **vault:**  Use vault, remove old gha (#1272) (b4b9a896)
* **plugin-ci-workflows:**
  *  Publish skip playwright (#1263) (5becc84a)
  *  Playwright skip dev image (#1262) (99ef2c9b)

##### Documentation Changes

*  Add favorites docs to readme (#1277) (cd64dbfc)
*  Dashboards > Visualizations (#1261) (216b9256)

## 1.0.15

##### Chores

- (plugin-ci-workflows) - init vanilla plugin-ci-workflows (#1215) (ea21ded8)
- bump @grafana/create-plugin configuration to 5.19.8 (#1232) (9ffc46f6)
- **plugin-ci-workflows:** temporarily disable release.yml (#1256) (8517cc0f)
- **bundle-stats:** swap bundlewatch for cp gha bundle-stats (#1252) (2121df39)
- **e2e:** clean up & flake prevention (#1247) (0ee52382)
- **eslint:** sort, a11y, cleanup husky, lint (#1219) (f3505456)

##### Documentation Changes

- Updating screenshots and docs (#1248) (a1db542d)
- update the versions in the README (#1249) (6f4c3c48)
- JSON viewer documentation (#1243) (a78469d9)

##### Bug Fixes

- Fix field filters causing fields to disappear from table & logs panel (#1253) (f8882f08)
- **aggregated-metric:** Dropdown broken on click (#1246) (bf4f021d)
- **links:** Single escaped doublequote bug (#1242) (cd8168ac)

## 1.0.14

##### Chores

- **docker-compose:** update loki to 3.5.0 (#1235) (a1a763c3)
- add a few fixes to the logs needed for the GrafanaCon talk (#1231) (02661080)
- update version check for controls (#1220) (7fa43723)
- otel generator changes (#1206) (60738a68)
- add changelog (ac81678c)
- **zizmor:** update for template-injection (#1222) (e565937a)
- **gh actions:** check pr titles for conventional commits (#1218) (8d6f25df)

##### New Features

- Use new Log Controls component (#1204) (a58e2762)
- JSON Viz (#1209)" (#1210) (5e014e98)
- support numeric operators for int fields (#1227) (4f4b7981)

##### Bug Fixes

- **line-filters:** Expand no longer working. (#1238) (1dbbb75d)
- Empty results layout in JSON and Table (#1236) (beb9489e)
- Panel menu visibility in json (#1216) (af1ed41a)
- JSON - line format containing unsupported chars (#1214) (c2c8bf23)
- **table:** missing line filter (#1237) (a1a4ea82)
- **zizmor:** fix conventional-commits error (#1229) (93cc282c)

## 1.0.13

##### Bug Fixes

- Fix issue with release pipeline

## 1.0.12

##### Chores

- Remove `ToolbarExtensionsRenderer` (#1187) (ba7383ac)
- (Provisioning) - Add loki datasource and env (#1175) (9d319574)
- (Grafana 11.6) - Update to latest grafana 11.6 and latest plugin libraries, remove comments (#1162) (d8edbcb5)
- Updating to Scenes v6 (#1019) (a13d9e21)
- Conditionally display "show logs" buttons (#1194) (fad95388)
- Simplify panel buttons (#1188) (37c50063)

##### New Features

- (LogPanelTable) - Sync the display fields and urlColumns between the logs panel and table (#1189) (139c5803)
- (LayoutSwitcher) - Set layoutSwitcher from localStorage (#1172) (df7454e3)
- Line filter validation (#1190) (f38aa5fd)

##### Bug Fixes

- Patterns table displaying percentage relative to current search results (#1186) (f3bb1fe4)
- ParseLabelFilters throw error (#1181) (72378ff9)
- Fix url sharing and line filter migrations (#1176) (7c2ecb77)

## 1.0.11

##### Chores

- (gh actions) - pin to tag for security (#1173) (a58f29ec)
- Bump @grafana/create-plugin configuration to 5.19.1 (#1159) (ae36050c)
- Fix e2e test (#1135) (7873d6dd)

##### Documentation Changes

- Update readme to include discover_log_levels config requirement (#1143) (359e9766)

##### New Features

- Add critical/fatal log level (#1146) (038a8146)
- Add support for uppercase log level and color warning as a warn (#1137) (4675f4a7)

##### Bug Fixes

- Links should use `firstValueFrom` (#1170) (7caf11c8)
- Changelog (#1169) (c662e796)
- Error being thrown when toggling case sensitivity with empty value (#1153) (156245c9)
- Set step as 10s for aggregated metric queries (#1145) (b370c190)

##### Other Changes

- Remove padding and combine level with fields (#1168) (977a839d)
- Make extensions compatibly with different Grafana versions (#1148) (e2c75d29)

## 1.0.10

##### Chores

- Fix e2e test (#1135) (7873d6dd)

##### Documentation Changes

- Update readme to include discover_log_levels config requirement (#1143) (359e9766)

##### New Features

- Add critical/fatal log level (#1146) (038a8146)
- Add support for uppercase log level and color warning as a warn (#1137) (4675f4a7)

##### Bug Fixes

- Error thrown when toggling case sensitivity with an empty value (#1153) (156245c9)
- Set step as 10s for aggregated metric queries (#1145) (b370c190)

##### Other Changes

- Make extensions compatibly with different Grafana versions (#1148) (e2c75d29)


View [releases](https://github.com/grafana/explore-logs/releases/) on GitHub for up-to-date changelog information.

## 1.0.9

##### New Features

- Value drilldown UX: Multiple include filters (https://github.com/grafana/explore-logs/pull/1074)
- Service selection pagination: generate options based on totalCount (https://github.com/grafana/explore-logs/pull/1077)
- Display error message when logs fail to load (https://github.com/grafana/explore-logs/pull/1079)
- No Loki datasource splash page: (https://github.com/grafana/explore-logs/pull/1061)
- Navigation UX: Open pages in new tab (https://github.com/grafana/explore-logs/pull/1106)
- Table UX: surface field menu options in column header (https://github.com/grafana/explore-logs/pull/1064)
- Table UX: Add Manage columns button to table header (https://github.com/grafana/explore-logs/pull/1057)
- Line filters UX: expand input on focus (https://github.com/grafana/explore-logs/pull/1113)
- Service Scene UX: Pagination (https://github.com/grafana/explore-logs/pull/1058)
- Link extensions: Open in Explore logs button (https://github.com/grafana/explore-logs/pull/1035)
- Link extensions: Add pattern filter support (https://github.com/grafana/explore-logs/pull/1036)
- Link extensions: Support multiple include filters in queries from Explore (https://github.com/grafana/explore-logs/pull/1103)

##### Bug Fixes

- Empty label values missing labelValues (https://github.com/grafana/explore-logs/pull/1111)
- Move share button to right side on mobile (https://github.com/grafana/explore-logs/pull/1115)
- Clear filters icon not working with detected_level (https://github.com/grafana/explore-logs/pull/1105)
- Add overflow-y to tabs container (https://github.com/grafana/explore-logs/pull/1104)
- ServiceSelectionPagination: check for undefined in options (https://github.com/grafana/explore-logs/pull/1080
- Cannot add more then 2 values for same label (https://github.com/grafana/explore-logs/pull/1088)
- Allow direction to be updated when sort order changes (https://github.com/grafana/explore-logs/pull/1082)

##### Chores

- Increase loki max log length (https://github.com/grafana/explore-logs/pull/1112)
- Add missing image, remove empty section (https://github.com/grafana/explore-logs/pull/1089)
- Make OTEL endpoint configurable in generator dockerfile (https://github.com/grafana/explore-logs/pull/1075)
- Rename: rename exposed component (https://github.com/grafana/explore-logs/pull/1094)
- Add metadata to logged error (https://github.com/grafana/explore-logs/pull/1129)

##### Documentation Changes

- Fix title copy (https://github.com/grafana/explore-logs/pull/1092)

##### Other Changes

- Add `fieldConfig` to investigations context (https://github.com/grafana/explore-logs/pull/1124)
- Investigations: change investigations plugin id (https://github.com/grafana/explore-logs/pull/1084)
- E2E flake (https://github.com/grafana/explore-logs/pull/1101)

## 1.0.8

- Open in Explore logs button by @kozhuhds in https://github.com/grafana/explore-logs/pull/1035
- Table: Add manage columns button to table header by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1057
- Table: Hide custom pixel width, surface field menu options in column header by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1064
- Service selection: Pagination by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1058
- Make OTEL endpoint configurable in generator dockerfile by @shantanualsi in https://github.com/grafana/explore-logs/pull/1075
- Service Selection Pagination: Generate options based on total count by @matyax in https://github.com/grafana/explore-logs/pull/1077
- Service Selection Pagination: Check for possibly undefined in options by @matyax in https://github.com/grafana/explore-logs/pull/1080
- Explore links: Add pattern filter support by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1036
- Logs Panel: Display error message when logs fail to load by @matyax in https://github.com/grafana/explore-logs/pull/1079
- Docs: Migrate images to media service by @robbymilo in https://github.com/grafana/explore-logs/pull/1081
- Query runner: Allow direction to be updated when sort order changes by @matyax in https://github.com/grafana/explore-logs/pull/1082
- Investigations: change investigations plugin id by @svennergr in https://github.com/grafana/explore-logs/pull/1084
- Grafana Drilldown Logs by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1054
- Labels combobox: Cannot add more then 2 values for same label by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1088
- README: Fix missing image, empty section by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1089
- No loki datasource: Splash page by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1061
- Fix splash page relative URL, update img in readme by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1090
- Docs: Fix title copy by @knylander-grafana in https://github.com/grafana/explore-logs/pull/1092

## 1.0.7

- Link extensions: Add support for line filters by @gtk-grafana in https://github.com/grafana/explore-logs/pull/997
- Link extensions: Add support for fields by @gtk-grafana in https://github.com/grafana/explore-logs/pull/999
- Patterns: Patterns containing quotes break when added as filter by @gtk-grafana in https://github.com/grafana/explore-logs/issues/1003
- Service Selection: make volume search case-insensitive by @gtk-grafana in https://github.com/grafana/explore-logs/issues/1012
- Regex labels: Support queries from explore by @gtk-grafana in https://github.com/grafana/explore-logs/issues/1010
- Table: Open in Explore links do not add labelFieldName by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1018
- Patterns: Not configured state not working by @gtk-grafana in https://github.com/grafana/explore-logs/issues/1021
- Fields: Regex by @gtk-grafana in https://github.com/grafana/explore-logs/pull/1023
- Logs Volume: Set axis soft min of 0 by @gtk-grafana in https://github.com/grafana/explore-logs/issues/1041
- Logs: Apply query direction in query runner by @matyax in https://github.com/grafana/explore-logs/pull/1047
- Filters: Expression builder - differentiate user input from selected tags/values by @gtk-grafana in https://github.com/grafana/explore-logs/issues/1045
- Upgrade scenes to prevent panels from not being hidden by @svennergr in https://github.com/grafana/explore-logs/issues/1025

## 1.0.6

- Line filters: Regex support by @gtk-grafana in https://github.com/grafana/explore-logs/pull/963
- Line filters: Allow backticks5 by @gtk-grafana in https://github.com/grafana/explore-logs/pull/992
- Fix: use urlUtil instead of UrlSearchParams by @gtk-grafana in https://github.com/grafana/explore-logs/pull/994
- Sorting: prevent sorting timeFields in place by @svennergr in https://github.com/grafana/explore-logs/pull/996

## 1.0.5

- feat(explorations): remove disabled state by @svennergr in https://github.com/grafana/explore-logs/pull/913
- Webpack: upgrade to 5.95 by @gtk-grafana in https://github.com/grafana/explore-logs/pull/914
- chore: cleanup faro error messages by @gtk-grafana in https://github.com/grafana/explore-logs/pull/915
- Logs Panel: move log panel options and add sort order by @gtk-grafana in https://github.com/grafana/explore-logs/pull/920
- Panel Menus by @gtk-grafana in https://github.com/grafana/explore-logs/pull/892
- fix(firefox-panel-hidden): add position absolute by @svennergr in https://github.com/grafana/explore-logs/pull/928
- SortLevelTransformation: account for possibly empty fields by @matyax in https://github.com/grafana/explore-logs/pull/929
- Chore: Better type safety with ts-reset by @gtk-grafana in https://github.com/grafana/explore-logs/pull/926
- Queries: remove placeholder query and sanitize stream selector by @matyax in https://github.com/grafana/explore-logs/pull/930
- Field labels: histogram option for numeric fields by @gtk-grafana in https://github.com/grafana/explore-logs/pull/924
- LogsVolumePanel: Add infinite scroll for logs and display visible range by @matyax in https://github.com/grafana/explore-logs/pull/925
- Upgrade scenes to v5.29.0 by @gtk-grafana in https://github.com/grafana/explore-logs/pull/938
- Breakdown panels: Add shared crosshairs by @gtk-grafana in https://github.com/grafana/explore-logs/pull/940
- Logs Panel: Combine wrapLogMessage with prettifyLogMessage by @matyax in https://github.com/grafana/explore-logs/pull/944
- Value breakdowns: Update UI by @gtk-grafana in https://github.com/grafana/explore-logs/pull/936
- Remove go to explore button, add PanelMenu to logs & table panels by @gtk-grafana in https://github.com/grafana/explore-logs/pull/942
- Timeseries panels: Map field display names to color by @gtk-grafana in https://github.com/grafana/explore-logs/pull/937
- Panels: Keybindings by @gtk-grafana in https://github.com/grafana/explore-logs/pull/946
- chore: update livereload plugin port by @fcjack in https://github.com/grafana/explore-logs/pull/948
- fix(LogsVolumePanel): fix display of visible range when using cached data by @matyax in https://github.com/grafana/explore-logs/pull/955
- Line filter: add case sensitive line filter state to local storage by @gtk-grafana in https://github.com/grafana/explore-logs/pull/956
- Keybindings: support time range copy/paste by @gtk-grafana in https://github.com/grafana/explore-logs/pull/960
- Logs Volume: Set relative height and allow to collapse by @matyax in https://github.com/grafana/explore-logs/pull/964
- Logs Tab: Show log line count by @gtk-grafana in https://github.com/grafana/explore-logs/pull/951
- Logs panel: update service data when receiving new logs by @matyax in https://github.com/grafana/explore-logs/pull/967
- fix(panel-menu): menu throwing error in logs table by @svennergr in https://github.com/grafana/explore-logs/pull/968
- fix(panelmenu): `Investigations` causing multiple same keys by @svennergr in https://github.com/grafana/explore-logs/pull/965
- feat(patterns): use grafana's calculated `interval` as `step` by @svennergr in https://github.com/grafana/explore-logs/pull/974
- Table: Show log text not preserved in URL state by @gtk-grafana in https://github.com/grafana/explore-logs/pull/979
- Table: Column order not preserved in URL by @gtk-grafana in https://github.com/grafana/explore-logs/pull/978
- chore: run `yarn audit fix` by @gtk-grafana in https://github.com/grafana/explore-logs/pull/982
- Update `make docs` procedure by @github-actions in https://github.com/grafana/explore-logs/pull/972
- Add support to generate OTEL logs in generate script by @shantanualsi in https://github.com/grafana/explore-logs/pull/973
- Logs: Issue queries in forward or backward direction depending on the selected sorting option by @matyax in https://github.com/grafana/explore-logs/pull/970
- Breakdowns: Add share menu by @gtk-grafana in https://github.com/grafana/explore-logs/pull/983
- chore: clean up copy texts by @gtk-grafana in https://github.com/grafana/explore-logs/pull/987
- Logs panel: Direction and wrap URL state by @gtk-grafana in https://github.com/grafana/explore-logs/pull/985

## 1.0.4

- fix: console error when undefined jsondata.interval by @gtk-grafana in https://github.com/grafana/explore-logs/pull/877
- ServiceSelectionScene: Manual query runners by @gtk-grafana in https://github.com/grafana/explore-logs/pull/868
- Detected fields: Use detected_fields response to determine if avg_over_time query should be run by @gtk-grafana in https://github.com/grafana/explore-logs/pull/871
- feat(combineResponses): improve label comparison performance by @matyax in https://github.com/grafana/explore-logs/pull/880
- chore: bump @bsull/augurs to 0.6.0 by @sd2k in https://github.com/grafana/explore-logs/pull/882
- Labels variable: Combobox by @gtk-grafana in https://github.com/grafana/explore-logs/pull/878
- Chore: Rename the sorting option in explore metrics by @itsmylife in https://github.com/grafana/explore-logs/pull/883
- Go to Explore button: keep visual preferences in Explore link by @matyax in https://github.com/grafana/explore-logs/pull/885
- Service selection: Label selection UI by @gtk-grafana in https://github.com/grafana/explore-logs/pull/881
- Fix favoriting on label select by @gtk-grafana in https://github.com/grafana/explore-logs/pull/908
- Panel UI: Numeric filtering by @gtk-grafana in https://github.com/grafana/explore-logs/pull/894

## 1.0.3

- feat(exploration): add `grafana-lokiexplore-app/metric-exploration/v1` entrypoint by @svennergr in https://github.com/grafana/explore-logs/pull/840
- Initial label docs by @stevendungan in https://github.com/grafana/explore-logs/pull/853
- chore(intercept-banner): move into `container` by @svennergr in https://github.com/grafana/explore-logs/pull/854
- Logs panel: add button to copy link to log line by @matyax in https://github.com/grafana/explore-logs/pull/855
- fix: fix broken tsc-files command by @gtk-grafana in https://github.com/grafana/explore-logs/pull/860
- Add conditional extension point for testing sidecar functionality by @aocenas in https://github.com/grafana/explore-logs/pull/828
- Ad hoc variables: add support for detected_field/.../values by @gtk-grafana in https://github.com/grafana/explore-logs/pull/848
- Fix: tsc-files ignores tsconfig.json when called through husky hooks by @gtk-grafana in https://github.com/grafana/explore-logs/pull/867
- Config: Administrator config - max interval by @gtk-grafana in https://github.com/grafana/explore-logs/pull/843
- feat(shardSplitting): improve error handling by @matyax in https://github.com/grafana/explore-logs/pull/873

## 1.0.2

- Module: Split it up + heavy refactor by @gtk-grafana in https://github.com/grafana/explore-logs/pull/768
- Breakdowns: Remove service_name requirement by @gtk-grafana in https://github.com/grafana/explore-logs/pull/801
- docs: update installation instructions by @JStickler in https://github.com/grafana/explore-logs/pull/815
- Shard query splitting: use dynamic grouping by @matyax in https://github.com/grafana/explore-logs/pull/814
- fix(routing): check for sluggified value in URL by @matyax in https://github.com/grafana/explore-logs/pull/817
- Shard query splitting: add retrying flag to prevent cancelled requests by @matyax in https://github.com/grafana/explore-logs/pull/818
- Service selection: Showing incorrect list of services after changing datasource on breakdown views by @gtk-grafana in https://github.com/grafana/explore-logs/pull/811
- Service selection: Starting with labels besides service_name by @gtk-grafana in https://github.com/grafana/explore-logs/pull/813
- chore: upgrade grafana deps to 11.2.x and update extensions to use `addLink` by @svennergr in https://github.com/grafana/explore-logs/pull/824
- Patterns: Fix broken data link in pattern viz by @gtk-grafana in https://github.com/grafana/explore-logs/pull/831
- Shard query splitting: limit group size to be less than the remaining shards by @matyax in https://github.com/grafana/explore-logs/pull/829
- Patterns: fix flashing no patterns UI when loading by @gtk-grafana in https://github.com/grafana/explore-logs/pull/833
- Bundlewatch by @gtk-grafana in https://github.com/grafana/explore-logs/pull/830
- Bundlewatch: add main as base branch by @gtk-grafana in https://github.com/grafana/explore-logs/pull/836
- Primary label selection: Better empty volume UI by @gtk-grafana in https://github.com/grafana/explore-logs/pull/835
- Structured metadata: Refactor into new variable by @gtk-grafana in https://github.com/grafana/explore-logs/pull/826
- Breakdowns: Changing primary label doesn't update tab count by @gtk-grafana in https://github.com/grafana/explore-logs/pull/845
- Structured metadata: Changes to ad-hoc variable doesn't run detected_fields by @gtk-grafana in https://github.com/grafana/explore-logs/pull/849

## 1.0.0

- fix(shardQuerySplitting): do not emit empty data by @matyax in https://github.com/grafana/explore-logs/pull/793
- removed preview warning and updated some copy (added link to support) by @matryer in https://github.com/grafana/explore-logs/pull/792
- Frontend instrumentation by @gtk-grafana in https://github.com/grafana/explore-logs/pull/790
- Aggregated metrics: Use sum_over_time query for aggregated metric queries by @gtk-grafana in https://github.com/grafana/explore-logs/pull/789
- fix: fall back to mixed parser if the field is missing parser in url parameter by @gtk-grafana in https://github.com/grafana/explore-logs/pull/788
- Update workflows to use actions that don't need organization secrets by @svennergr in https://github.com/grafana/explore-logs/pull/784
- label values: fix label values stuck in loading state by @gtk-grafana in https://github.com/grafana/explore-logs/pull/783
- Shard query splitting: send the whole stream selector to fetch shard values by @gtk-grafana in https://github.com/grafana/explore-logs/pull/782
- chore(shardQuerySplitting): start in Streaming state by @BitDesert in https://github.com/grafana/explore-logs/pull/781
- fix(patterns-breakdown): fix expression to create pattern key breakdown by @gtk-grafana in https://github.com/grafana/explore-logs/pull/780
- fix(service-selection-scrolling): remove forced overflow scroll by @matyax in https://github.com/grafana/explore-logs/pull/779
- GA: remove preview badge by @gtk-grafana in https://github.com/grafana/explore-logs/pull/778
- GA: Remove preview copy in intercept banner by @gtk-grafana in https://github.com/grafana/explore-logs/pull/777

## 0.1.4

- Fields: include and exclude empty values by @gtk-grafana in https://github.com/grafana/explore-logs/pull/703
- Update `make docs` procedure by @github-actions in https://github.com/grafana/explore-logs/pull/716
- Displayed fields: persist selection in local storage and URL by @matyax in https://github.com/grafana/explore-logs/pull/733
- Sync loki versions in docker-compose.dev.yaml by @gtk-grafana in https://github.com/grafana/explore-logs/pull/745
- fix: grafana image tag by @BitDesert in https://github.com/grafana/explore-logs/pull/743
- generator: add new service with mix of json and logfmt by @gtk-grafana in https://github.com/grafana/explore-logs/pull/749
- Logs Volume Panel: properly handle "logs" detected level by @matyax in https://github.com/grafana/explore-logs/pull/751
- feat(detected-fields): use `/detected_fields` API by @svennergr in https://github.com/grafana/explore-logs/pull/736
- enable sharding in docker containers by @gtk-grafana in https://github.com/grafana/explore-logs/pull/754
- Line filter: Case sensitive search by @gtk-grafana in https://github.com/grafana/explore-logs/pull/744
- Shard query splitting: Split queries by stream shards by @matyax in https://github.com/grafana/explore-logs/pull/715
- chore: replace react-beautiful-dnd with successor by @gtk-grafana in https://github.com/grafana/explore-logs/pull/579
- Service selection: show previous filter text in service search input by @gtk-grafana in https://github.com/grafana/explore-logs/pull/763
- feat(generator): log `traceID` as structured metadata by @svennergr in https://github.com/grafana/explore-logs/pull/766
- Labels: Fix labels list not updating when detected_labels loads while user is viewing another tab by @gtk-grafana in https://github.com/grafana/explore-logs/pull/757
- Fields: Fix incorrect field count by @gtk-grafana in https://github.com/grafana/explore-logs/pull/761
- Link extensions: fix services with slash by @gtk-grafana in https://github.com/grafana/explore-logs/pull/770

## New Contributors

- @moxious made their first contribution in https://github.com/grafana/explore-logs/pull/673
- @github-actions made their first contribution in https://github.com/grafana/explore-logs/pull/716
- @BitDesert made their first contribution in https://github.com/grafana/explore-logs/pull/743

## 0.1.3

- added better hero image by @matryer in https://github.com/grafana/explore-logs/pull/598
- Updated plugin links to docs by @matryer in https://github.com/grafana/explore-logs/pull/599
- docs: Copyedit for style and docs standards by @JStickler in https://github.com/grafana/explore-logs/pull/582
- docs: embedded video by @matryer in https://github.com/grafana/explore-logs/pull/601
- docs: Fix heading levels by @JStickler in https://github.com/grafana/explore-logs/pull/602
- Docs update docs link by @matryer in https://github.com/grafana/explore-logs/pull/603
- docs: better sentence by @matryer in https://github.com/grafana/explore-logs/pull/604
- feat(log-context): add LogContext to logspanel by @svennergr in https://github.com/grafana/explore-logs/pull/607
- docs: more standardization edits by @JStickler in https://github.com/grafana/explore-logs/pull/605
- chore(main-release): bump patch version before doing a main build by @svennergr in https://github.com/grafana/explore-logs/pull/612
- docs: Update metadata with canonical URLs by @JStickler in https://github.com/grafana/explore-logs/pull/610
- Release 0.1.1 by @svennergr in https://github.com/grafana/explore-logs/pull/613
- chore: do not run release if triggered from drone by @svennergr in https://github.com/grafana/explore-logs/pull/615
- added a note about ephemeral patterns by @matryer in https://github.com/grafana/explore-logs/pull/619
- Value breakdowns: maintain filters between value changes by @matyax in https://github.com/grafana/explore-logs/pull/609
- Sorting: memoize sorting function by @matyax in https://github.com/grafana/explore-logs/pull/584
- Fields: fix loading forever when fields return empty by @gtk-grafana in https://github.com/grafana/explore-logs/pull/620
- Patterns: Show UI message when time range is too old to show patterns by @gtk-grafana in https://github.com/grafana/explore-logs/pull/618
- Chore: Clean up subscriptions by @gtk-grafana in https://github.com/grafana/explore-logs/pull/624
- Label queries: remove unneccessary filters and parsers in query expression by @svennergr in https://github.com/grafana/explore-logs/pull/628
- Service views: Prevent extra queries by @gtk-grafana in https://github.com/grafana/explore-logs/pull/629

## New Contributors

- @moxious made their first contribution in https://github.com/grafana/explore-logs/pull/673

## 0.1.2

- added better hero image by @matryer in https://github.com/grafana/explore-logs/pull/598
- Updated plugin links to docs by @matryer in https://github.com/grafana/explore-logs/pull/599
- docs: Copyedit for style and docs standards by @JStickler in https://github.com/grafana/explore-logs/pull/582
- docs: embedded video by @matryer in https://github.com/grafana/explore-logs/pull/601
- docs: Fix heading levels by @JStickler in https://github.com/grafana/explore-logs/pull/602
- Docs update docs link by @matryer in https://github.com/grafana/explore-logs/pull/603
- docs: better sentence by @matryer in https://github.com/grafana/explore-logs/pull/604
- feat(log-context): add LogContext to logspanel by @svennergr in https://github.com/grafana/explore-logs/pull/607
- docs: more standardization edits by @JStickler in https://github.com/grafana/explore-logs/pull/605
- chore(main-release): bump patch version before doing a main build by @svennergr in https://github.com/grafana/explore-logs/pull/612
- docs: Update metadata with canonical URLs by @JStickler in https://github.com/grafana/explore-logs/pull/610
- Release 0.1.1 by @svennergr in https://github.com/grafana/explore-logs/pull/613
- chore: do not run release if triggered from drone by @svennergr in https://github.com/grafana/explore-logs/pull/615
- added a note about ephemeral patterns by @matryer in https://github.com/grafana/explore-logs/pull/619
- Value breakdowns: maintain filters between value changes by @matyax in https://github.com/grafana/explore-logs/pull/609
- Sorting: memoize sorting function by @matyax in https://github.com/grafana/explore-logs/pull/584
- Fields: fix loading forever when fields return empty by @gtk-grafana in https://github.com/grafana/explore-logs/pull/620
- Patterns: Show UI message when time range is too old to show patterns by @gtk-grafana in https://github.com/grafana/explore-logs/pull/618
- Chore: Clean up subscriptions by @gtk-grafana in https://github.com/grafana/explore-logs/pull/624
- Label queries: remove unneccessary filters and parsers in query expression by @svennergr in https://github.com/grafana/explore-logs/pull/628
- Service views: Prevent extra queries by @gtk-grafana in https://github.com/grafana/explore-logs/pull/629

**Full Changelog**: https://github.com/grafana/explore-logs/compare/v0.1.1...v0.1.2

## 0.1.1

- feat(log-context): add LogContext to logspanel [#607](https://github.com/grafana/explore-logs/pull/607)

## 0.1.0

- Release public preview version.
