/**
 * Lightweight JSON Schema validator (zero dependencies).
 * Supports: type, required, enum, const, minimum, maximum, pattern, oneOf, $ref (local $defs).
 */

const fs = require('fs');
const path = require('path');

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((t) => {
    if (t === 'integer') return Number.isInteger(value);
    if (t === 'number') return typeof value === 'number' && !Number.isNaN(value);
    return typeOf(value) === t;
  });
}

function resolveRef(ref, rootSchema) {
  if (!ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/');
  let node = rootSchema;
  for (const part of parts) {
    node = node?.[part];
    if (!node) return null;
  }
  return node;
}

function validateNode(value, schema, rootSchema, pointer, errors) {
  if (!schema || typeof schema !== 'object') return;

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, rootSchema);
    if (resolved) validateNode(value, resolved, rootSchema, pointer, errors);
    else errors.push(`${pointer}: unresolved $ref ${schema.$ref}`);
    return;
  }

  if (schema.oneOf) {
    const branchErrors = [];
    let validBranches = 0;
    for (const branch of schema.oneOf) {
      const branchErrs = [];
      validateNode(value, branch, rootSchema, pointer, branchErrs);
      if (branchErrs.length === 0) validBranches += 1;
      else branchErrors.push(branchErrs);
    }
    if (validBranches !== 1) {
      errors.push(`${pointer}: must match exactly one schema branch (matched ${validBranches})`);
    }
    return;
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${pointer}: expected type ${JSON.stringify(schema.type)}, got ${typeOf(value)}`);
    return;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${pointer}: must be one of ${schema.enum.join(', ')}`);
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${pointer}: must equal ${JSON.stringify(schema.const)}`);
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${pointer}: must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${pointer}: must be <= ${schema.maximum}`);
    }
  }

  if (typeof value === 'string' && schema.pattern) {
    const re = new RegExp(schema.pattern);
    if (!re.test(value)) errors.push(`${pointer}: must match pattern ${schema.pattern}`);
  }

  if (schema.required && typeOf(value) === 'object') {
    for (const key of schema.required) {
      if (value[key] === undefined) errors.push(`${pointer}: missing required property "${key}"`);
    }
  }

  if (schema.properties && typeOf(value) === 'object') {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (value[key] !== undefined) {
        validateNode(value[key], propSchema, rootSchema, `${pointer}/${key}`, errors);
      }
    }
  }

  if (schema.items && typeOf(value) === 'array') {
    value.forEach((item, i) => {
      validateNode(item, schema.items, rootSchema, `${pointer}[${i}]`, errors);
    });
  }
}

function validateAgainstSchema(data, schema) {
  const errors = [];
  validateNode(data, schema, schema, '', errors);
  return { valid: errors.length === 0, errors };
}

function loadSchema(schemaName) {
  const file = schemaName.endsWith('.json') ? schemaName : `${schemaName}.schema.json`;
  const schemaPath = path.join(__dirname, 'schemas', file);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

function validateWithNamedSchema(data, schemaName) {
  const schema = loadSchema(schemaName);
  return validateAgainstSchema(data, schema);
}

module.exports = {
  validateAgainstSchema,
  validateWithNamedSchema,
  loadSchema,
};