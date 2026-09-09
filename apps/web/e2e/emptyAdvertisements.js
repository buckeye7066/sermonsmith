// The authenticated shell fetches ads independently of the page under test.
// Keep these unrelated requests in the fixture, never on the production API.
export async function mockEmptyAdvertisements(page) {
  await page.route('**/api/advertisements', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.route('**/api/advertisements/capabilities', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"canManage":false}',
  }));
}
