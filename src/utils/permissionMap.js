"use strict";

/**
 * Turns a flat list of Permission rows into a { module: { action: true } }
 * map — e.g. { seed_company_management: { add_edit: true }, payments: { view: true } }.
 * selected — no extra logic needed on the client side.
 */
function buildPermissionMap(permissions = []) {
  return permissions.reduce((map, p) => {
    map[p.module] = map[p.module] || {};
    map[p.module][p.action] = true;
    return map;
  }, {});
}

module.exports = { buildPermissionMap };