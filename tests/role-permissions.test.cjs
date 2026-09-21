const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { ALL_MENU_PERMISSIONS } = require('../app/enums/menuPermissions');
const records = new Map();
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '../../../models') return { rolePermission: {
    findOne: async ({ where }) => records.has(where.role) ? { menuPermissions: records.get(where.role) } : null,
    upsert: async ({ role, menuPermissions }) => records.set(role, menuPermissions),
  }};
  return originalLoad.call(this, name, ...args);
};
const service = require('../app/modules/rolePermission/rolePermission.service');
Module._load = originalLoad;

test('selected menu, submenu and report permissions survive save and read', async () => {
  const keys = ['packaging', 'packaging_stock_movement', 'damage_stock_movement', 'work_history', 'report_products'];
  assert.deepEqual((await service.updateRolePermissions('staff', keys)).menuPermissions, keys);
  assert.deepEqual(await service.getEffectiveMenuPermissions('staff'), keys);
});
test('explicit admin permissions and clearing are respected', async () => {
  assert.deepEqual((await service.updateRolePermissions('admin', ['inventory', 'stock_product'])).menuPermissions, ['inventory', 'stock_product']);
  assert.deepEqual((await service.updateRolePermissions('admin', [])).menuPermissions, []);
});
test('superAdmin always receives every menu permission, even with an empty saved record', async () => {
  records.set('superAdmin', []);
  assert.deepEqual(await service.getEffectiveMenuPermissions('superAdmin'), ALL_MENU_PERMISSIONS);
  assert.deepEqual((await service.updateRolePermissions('superAdmin', [])).menuPermissions, ALL_MENU_PERMISSIONS);
  assert.ok(ALL_MENU_PERMISSIONS.includes('master_permission'));
});
test('unknown permissions are still rejected', () => {
  assert.throws(() => service.validateMenuPermissions(['unknown_permission']), /Unknown menu permission/);
});
