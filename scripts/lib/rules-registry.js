'use strict';

const registry = require('../data/rules-registry.json');

function byId(id) {
  return registry.find((r) => r.id === id) || null;
}

function byCheckId(checkId) {
  return registry.filter((r) => r.checkId === checkId);
}

/** Rules applicable to a doc type: entries tagged "all" plus entries tagged with this specific type. */
function forDocType(docType) {
  return registry.filter((r) => r.docTypes.includes('all') || r.docTypes.includes(docType));
}

function byTier(tier, docType) {
  const scoped = docType ? forDocType(docType) : registry;
  return scoped.filter((r) => r.tier === tier);
}

module.exports = { registry, byId, byCheckId, forDocType, byTier };
