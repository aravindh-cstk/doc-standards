'use strict';

// This doc type's findings carry both the shared root rule IDs (from the
// doc-type-agnostic content checks it reuses) and this folder's own AR-*
// structural rule IDs, so byId() has to resolve against both registries.
const rootRegistry = require('../../../scripts/data/rules-registry.json');
const arRegistry = require('../rules-registry.json');
const registry = [...rootRegistry, ...arRegistry];

function byId(id) {
  return registry.find((r) => r.id === id) || null;
}

function byCheckId(checkId) {
  return registry.filter((r) => r.checkId === checkId);
}

function forDocType(docType) {
  return registry.filter((r) => r.docTypes.includes('all') || r.docTypes.includes(docType));
}

function byTier(tier, docType) {
  const scoped = docType ? forDocType(docType) : registry;
  return scoped.filter((r) => r.tier === tier);
}

module.exports = { registry, byId, byCheckId, forDocType, byTier };
