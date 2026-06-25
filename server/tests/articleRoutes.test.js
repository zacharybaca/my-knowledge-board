import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../routes/articleRoutes.js';

const getRoutePathsInOrder = () =>
  router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);

test('article routes include duplicate-check endpoint', () => {
  const checkDuplicateRoute = router.stack.find(
    (layer) => layer.route?.path === '/check-duplicate',
  );

  assert.ok(checkDuplicateRoute, 'expected /check-duplicate route to exist');
  assert.equal(Boolean(checkDuplicateRoute.route.methods.post), true);
});

test('article route ordering keeps static paths ahead of /:id', () => {
  const orderedPaths = getRoutePathsInOrder();

  const favoritesIndex = orderedPaths.indexOf('/favorites');
  const duplicateCheckIndex = orderedPaths.indexOf('/check-duplicate');
  const dynamicIdIndex = orderedPaths.indexOf('/:id');

  assert.notEqual(favoritesIndex, -1, 'expected /favorites route to exist');
  assert.notEqual(
    duplicateCheckIndex,
    -1,
    'expected /check-duplicate route to exist',
  );
  assert.notEqual(dynamicIdIndex, -1, 'expected /:id route to exist');

  assert.ok(
    favoritesIndex < dynamicIdIndex,
    'expected /favorites to be registered before /:id',
  );
  assert.ok(
    duplicateCheckIndex < dynamicIdIndex,
    'expected /check-duplicate to be registered before /:id',
  );
});
