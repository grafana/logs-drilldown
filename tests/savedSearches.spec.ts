import { expect, test } from '@grafana/plugin-e2e';

import pluginJson from '../src/plugin.json';
import { testIds } from '../src/services/testIds';
import { E2EComboboxStrings, ExplorePage, serviceSelectionPaginationTextMatch } from './fixtures/explore';

test.describe('saved searches', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page }, testInfo) => {
    explorePage = new ExplorePage(page, testInfo);
    await page.setViewportSize({ height: 600, width: 1280 });
    await explorePage.clearLocalStorage();
    explorePage.captureConsoleLogs();
  });

  test.afterEach(async () => {
    await explorePage.unroute();
    explorePage.echoConsoleLogsOnRetry();
  });

  test('should save a search, go back to landing page, and load it', async ({ page }) => {
    // Step 1: Navigate to service details
    await explorePage.gotoServices();
    await expect(page.getByText(serviceSelectionPaginationTextMatch)).toBeVisible();

    await expect(page.getByRole('heading', { name: 'tempo-ingester' })).toBeVisible();

    await explorePage.addServiceName();
    await explorePage.clickShowLogs();

    // Wait for the logs tab to be visible and active
    await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toBeVisible();
    await explorePage.assertTabsNotLoading();

    // Step 2: Click the save search button
    const saveSearchButton = page.getByRole('button', { name: 'Save search' });
    await expect(saveSearchButton).toBeVisible();
    await saveSearchButton.click();

    // Step 3: Verify the save search modal is open and fill in the form
    await expect(page.getByRole('heading', { name: 'Save current search' })).toBeVisible();

    // Fill in the title field
    const titleInput = page.getByLabel('Title');
    await expect(titleInput).toBeVisible();
    const searchTitle = `Test Search ${Date.now()}`;
    await titleInput.fill(searchTitle);

    // Fill in the description field
    const descriptionInput = page.getByLabel('Description');
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.fill('Test description for saved search');

    // Submit the form
    const saveButton = page.getByRole('button', { name: 'Save', exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Step 4: Verify the search was saved successfully
    // The modal should close automatically after saving
    await expect(page.getByRole('heading', { name: 'Save current search' })).not.toBeVisible();

    // Step 5: Go back to the landing page
    const removeServiceButton = page.getByLabel(E2EComboboxStrings.labels.removeServiceLabel);
    await expect(removeServiceButton).toBeVisible();
    await removeServiceButton.click();

    // Verify we're back on the service selection page
    await expect(page.getByText(serviceSelectionPaginationTextMatch)).toBeVisible();

    // Step 6: Click the load search button
    const loadSearchButton = page.getByRole('button', { name: 'Load saved search' });
    await expect(loadSearchButton).toBeEnabled();
    await loadSearchButton.click();

    // Step 7: Verify the load search modal is open
    await expect(page.getByRole('heading', { name: 'Load a previously saved search' })).toBeVisible();

    // Step 8: Select the saved search we just created
    // The search should be in the list
    const savedSearchItem = page.getByRole('radio', { name: searchTitle });
    await expect(savedSearchItem).toBeVisible();
    await savedSearchItem.click();

    // Verify the search details are displayed
    await expect(page.getByText(searchTitle)).toHaveCount(2);
    await expect(page.getByText('Test description for saved search')).toBeVisible();

    // Step 9: Click the Select button to load the search
    const selectButton = page.getByRole('link', { name: 'Select' });
    await expect(selectButton).toBeVisible();
    await selectButton.click();

    // Step 10: Verify we're navigated to the service details page with the correct filter
    await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toBeVisible();
    await expect(page.getByLabel('Edit filter with key')).toContainText('service_name = tempo-ingester');
  });

  test('should show empty state when no saved searches exist', async ({ page }) => {
    await explorePage.gotoServices();
    await expect(page.getByText(serviceSelectionPaginationTextMatch)).toBeVisible();

    // The load search button should be disabled when there are no saved searches
    const loadSearchButton = page.getByRole('button', { name: 'No saved searches to load' });
    await expect(loadSearchButton).toBeDisabled();
  });

  test('should allow deleting a saved search', async ({ page }) => {
    // First, create a saved search
    await explorePage.gotoServices();
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('nginx');
    await page.keyboard.press('Escape');

    await explorePage.addServiceName();
    await explorePage.clickShowLogs();
    await explorePage.assertTabsNotLoading();

    // Save the search
    const saveSearchButton = page.getByRole('button', { name: 'Save search' });
    await saveSearchButton.click();

    const searchTitle = `Deletable Search ${Date.now()}`;
    await page.getByLabel('Title').fill(searchTitle);
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Wait for modal to close
    await expect(page.getByRole('heading', { name: 'Save current search' })).not.toBeVisible();

    // Navigate back to landing page
    await page.getByLabel(E2EComboboxStrings.labels.removeServiceLabel).click();
    await expect(page.getByText(serviceSelectionPaginationTextMatch)).toBeVisible();

    // Open load search modal
    const loadSearchButton = page.getByRole('button', { name: 'Load saved search' });
    await loadSearchButton.click();

    // Select the saved search
    const savedSearchItem = page.getByRole('radio', { name: searchTitle });
    await savedSearchItem.click();

    // Check if unlock if needed
    if ((await page.getByRole('button', { name: 'Unlock query' }).count()) > 0) {
      const unlockButton = page.getByRole('button', { name: 'Unlock query' });
      await expect(unlockButton).toBeVisible();
      await unlockButton.click();
    }

    // Click the delete button
    const deleteButton = page.getByRole('button', { name: 'Remove' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Verify the search is removed from the list
    await expect(savedSearchItem).not.toBeVisible();
    await expect(page.getByText('No saved searches to display.')).toBeVisible();

    // Close the modal
    await page.keyboard.press('Escape');

    // Wait for modal to close
    await expect(page.getByRole('heading', { name: 'Load a previously saved search' })).not.toBeVisible();
  });

  test('should warn when saving a duplicate search', async ({ page }) => {
    // Create a saved search
    await explorePage.gotoServices();
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('mimir-ingester');
    await page.keyboard.press('Escape');

    await explorePage.addServiceName();
    await explorePage.clickShowLogs();
    await explorePage.assertTabsNotLoading();

    // Save the search
    const saveSearchButton = page.getByRole('button', { name: 'Save search' });
    await saveSearchButton.click();

    const searchTitle = `Duplicate Search ${Date.now()}`;
    await page.getByLabel('Title').fill(searchTitle);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Save current search' })).not.toBeVisible();

    // Try to save the same search again (same query, different title)
    await saveSearchButton.click();
    await expect(page.getByRole('heading', { name: 'Save current search' })).toBeVisible();

    // Should show a warning about existing search
    await expect(page.getByText(/There is a previously saved search with the same query/i)).toBeVisible();

    // Close the modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Save current search' })).not.toBeVisible();
  });

  test('should navigate to service selection from breakdown and load search', async ({ page }) => {
    // Start from the service selection page
    await explorePage.gotoServices();

    // Navigate to a service breakdown
    await explorePage.servicesSearch.click();
    await explorePage.servicesSearch.pressSequentially('tempo-ingester');
    await page.keyboard.press('Escape');

    await explorePage.addServiceName();
    await explorePage.clickShowLogs();
    await explorePage.assertTabsNotLoading();

    // Save a search from the breakdown view
    const saveSearchButton = page.getByRole('button', { name: 'Save search' });
    await saveSearchButton.click();

    const searchTitle = `Nav Test Search ${Date.now()}`;
    await page.getByLabel('Title').fill(searchTitle);
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Navigate to patterns tab
    await page.getByTestId(testIds.exploreServiceDetails.tabPatterns).click();
    await explorePage.assertTabsNotLoading();

    // Navigate back to service selection using the mega menu
    await page.getByTestId('data-testid navigation mega-menu').getByRole('link', { name: 'Logs' }).click();
    await expect(page.getByText(serviceSelectionPaginationTextMatch)).toBeVisible();

    // Load the saved search
    const loadSearchButton = page.getByRole('button', { name: 'Load saved search' });
    await loadSearchButton.click();

    const savedSearchItem = page.getByRole('radio', { name: searchTitle });
    await savedSearchItem.click();

    const selectButton = page.getByRole('link', { name: 'Select' });
    await selectButton.click();

    // Verify we're back on the breakdown view with correct filter
    await expect(page.getByTestId(testIds.exploreServiceDetails.tabLogs)).toBeVisible();
    await expect(page.getByLabel('Edit filter with key')).toContainText('service_name = tempo-ingester');
  });
});
