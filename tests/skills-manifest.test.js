const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('skills.json manifest', () => {
  it('has enriched entries with id, triggers, and cli_aliases', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'skills.json'), 'utf8')
    );
    assert.ok(manifest.entries.length >= 5);
    for (const entry of manifest.entries) {
      assert.ok(entry.id, `missing id for ${entry.path}`);
      assert.ok(entry.name);
      assert.ok(entry.description);
      assert.ok(Array.isArray(entry.triggers) && entry.triggers.length > 0);
      assert.ok(Array.isArray(entry.cli_aliases) && entry.cli_aliases.length > 0);
    }
  });
});