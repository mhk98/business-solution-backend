const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { createRequire } = require("node:module");

function setup() {
  const filename = path.resolve("app/modules/user/user.service.js");
  const realRequire = createRequire(filename);
  const target = { Id: 2, role: "superAdmin", FirstName: "Before" };
  const writes = [];
  const user = {
    findOne: async () => ({ ...target }),
    update: async (data) => { writes.push(data); Object.assign(target, data); },
    findAll: async (options) => { user.query = options; return [target]; },
    count: async () => 1,
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module, exports: module.exports, console, process,
    require(name) {
      if (name === "../../../models") return { user };
      if (name === "../masterPermission/masterPermission.service") return {
        getSelfPermission: async (actor) => ({
          canManageMasterPermission: actor?.role === "superAdmin" || actor?.Email === "master@example.com",
        }),
      };
      if (name === "../rolePermission/rolePermission.service" ||
          name === "../../middlewares/sendEmail") return {};
      return realRequire(name);
    },
  }, { filename });
  return { service: module.exports, writes, user };
}

for (const actor of [
  { Id: 1, role: "superAdmin" },
  { Id: 1, role: "staff", Email: "master@example.com" },
]) {
  test(actor.role + " master can read and edit another super admin", async () => {
    const { service, writes } = setup();
    assert.equal((await service.getUserById(2, actor)).Id, 2);
    const updated = await service.updateUserFromDB(2, { FirstName: "After" }, actor);
    assert.equal(updated.FirstName, "After");
    assert.equal(writes.length, 1);
  });
}
test("ordinary admin cannot read or edit another super admin", async () => {
  const { service, writes } = setup();
  const actor = { Id: 1, role: "admin" };
  await assert.rejects(service.getUserById(2, actor), /Access denied/);
  await assert.rejects(service.updateUserFromDB(2, { FirstName: "After" }, actor), /Access denied/);
  assert.equal(writes.length, 0);
});
test("super admin can still edit own profile", async () => {
  const { service } = setup();
  assert.equal((await service.updateUserFromDB(2, { FirstName: "Self" }, { Id: 2 })).FirstName, "Self");
});
test("master listing includes super admins, ordinary listing excludes them", async () => {
  const { service, user } = setup();
  const { Op } = require("sequelize");
  await service.getAllUserFromDB({}, {}, { role: "staff", Email: "master@example.com" });
  assert.equal(user.query.where[Op.and].some((condition) => condition.role), false);
  await service.getAllUserFromDB({}, {}, { role: "admin" });
  assert.equal(user.query.where[Op.and].some((condition) => condition.role), true);
});
