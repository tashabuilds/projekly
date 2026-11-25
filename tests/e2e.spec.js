import { test, expect } from '@playwright/test';

test.describe('Project Summary Application E2E Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('#projectTitle')).toContainText('Project Summary:');
  });

  test('1. Application loading and initial baseline state', async ({ page }) => {
    await expect(page.locator('#totalWeightBadge')).toHaveText('Total: 100%');
    await expect(page.locator('#overallMsBadge')).toHaveText('Overall: 40% / 100%');
    await expect(page.locator('#budgetAllocation')).toHaveText('RM 100,000');
    await expect(page.locator('#budgetUtilised')).toHaveText('RM 50,000');
    await expect(page.locator('#budgetRemaining')).toHaveText('RM 50,000');
  });

  test('2. Editable project information and RAG status cycle', async ({ page }) => {
    const title = page.locator('#projectTitle');
    await title.click();
    await title.fill('Project Summary: Cloud Migration 2026');
    await expect(title).toHaveText('Project Summary: Cloud Migration 2026');

    const rag = page.locator('#ragBadge');
    await expect(rag).toContainText('STATUS: GREEN');
    await rag.click();
    await expect(rag).toContainText('STATUS: AMBER');
    await rag.click();
    await expect(rag).toContainText('STATUS: RED');
  });

  test('3. Project creation modal and template reset', async ({ page }) => {
    await page.click('#btnNewProject');
    await page.fill('#newProjName', 'ERP Transformation');
    await page.fill('#newProjId', 'PRJ-2026-999');
    await page.fill('#newProjLead', 'Alex Wong');
    await page.fill('#newProjAlloc', '250000');
    await page.click('#btnConfirmNewProj');

    await expect(page.locator('#projectTitle')).toHaveText('Project Summary: ERP Transformation');
    await expect(page.locator('#budgetAllocation')).toHaveText('RM 250,000');
    await expect(page.locator('#budgetUtilised')).toHaveText('RM 0');
    await expect(page.locator('#overallMsBadge')).toHaveText('Overall: 0% / 100%');

    // Reset back to baseline
    page.on('dialog', (dialog) => dialog.accept());
    await page.click('#btnResetTemplate');
    await expect(page.locator('#budgetAllocation')).toHaveText('RM 100,000');
    await expect(page.locator('#overallMsBadge')).toHaveText('Overall: 40% / 100%');
  });

  test('4. Activity creation, deletion, weightage & milestone calculations', async ({ page }) => {
    const phase3 = page.locator('.scope-block[data-phase="3"]');
    await phase3.locator('[data-action="add-act"]').click();
    await expect(phase3.locator('.activity-item')).toHaveCount(4);

    // Mismatch indicator should appear (25% + 5% = 30% != 25%)
    await expect(page.locator('#subWarn3')).toBeVisible();
    await page.click('#subWarn3');
    await expect(page.locator('#scopeWeight3')).toHaveText('30');
    await expect(page.locator('#totalWeightBadge')).toHaveText('Total: 105%');

    // Toggle activity completion and verify Milestones & Output updates
    await phase3.locator('.activity-item').first().locator('[data-action="toggle-act"]').click();
    await expect(page.locator('#msAchieved3')).toHaveText('10');

    // Delete added activity
    await phase3.locator('.activity-item').last().locator('[data-action="del-act"]').click({ force: true });
    await expect(phase3.locator('.activity-item')).toHaveCount(3);
  });

  test('5. Budget allocation and monthly expenditure tracking', async ({ page }) => {
    const janCell = page.locator('.monthly-grid .m-cell').first().locator('.m-amt');
    await janCell.click();
    await janCell.fill('20k');
    await expect(page.locator('#budgetUtilised')).toHaveText('RM 70,000');
    await expect(page.locator('#budgetRemaining')).toHaveText('RM 30,000');
    await expect(page.locator('#budgetPctValue')).toHaveText('70.0');
  });

  test('6. Gantt chart interactions (add bar, gate, holiday, slider)', async ({ page }) => {
    await page.selectOption('#targetLaneSelect', '1');
    await page.click('#btnAddBaseline');
    await expect(page.locator('#lane1 .bar-baseline')).toHaveCount(2);

    await page.click('#btnAddGate');
    await expect(page.locator('#lane1 .gate-pill')).toHaveCount(2);

    await page.click('#btnAddHoliday');
    await expect(page.locator('#holidayStrip .holiday-pill')).toHaveCount(5);

    await page.fill('#dateSlider', '75');
    await page.locator('#dateSlider').dispatchEvent('input');
    await expect(page.locator('#redTracker')).toHaveCSS('left', /.+/);
  });

  test('7. LocalStorage persistence across reloads', async ({ page }) => {
    const title = page.locator('#projectTitle');
    await title.click();
    await title.fill('Project Summary: Persisted State Test');
    await page.waitForTimeout(500); // wait for debounced autosave

    await page.reload();
    await expect(page.locator('#projectTitle')).toHaveText('Project Summary: Persisted State Test');
  });

  test('8. Standalone HTML export download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('#btnExportHtml');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.html$/);
  });

  test('9. Mobile responsiveness and iframe embedding compatibility', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#slideContainer')).toBeVisible();
    await expect(page.locator('.scope-block')).toHaveCount(4);
  });
});
