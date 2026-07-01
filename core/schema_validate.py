"""Lightweight JSON Schema validator (zero dependencies beyond stdlib)."""

import json
import os
import re


def _type_of(value):
    if value is None:
        return "null"
    if isinstance(value, list):
        return "array"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int) and not isinstance(value, bool):
        return "integer"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _matches_type(value, expected):
    types = expected if isinstance(expected, list) else [expected]
    actual = _type_of(value)
    for t in types:
        if t == "integer" and isinstance(value, int) and not isinstance(value, bool):
            return True
        if t == "number" and isinstance(value, (int, float)) and not isinstance(value, bool):
            return True
        if actual == t:
            return True
    return False


def _resolve_ref(ref, root_schema):
    if not ref.startswith("#/"):
        return None
    node = root_schema
    for part in ref[2:].split("/"):
        node = node.get(part) if isinstance(node, dict) else None
        if node is None:
            return None
    return node


def _validate_node(value, schema, root_schema, pointer, errors):
    if not isinstance(schema, dict):
        return

    if "$ref" in schema:
        resolved = _resolve_ref(schema["$ref"], root_schema)
        if resolved:
            _validate_node(value, resolved, root_schema, pointer, errors)
        else:
            errors.append(f"{pointer}: unresolved $ref {schema['$ref']}")
        return

    if "oneOf" in schema:
        valid = 0
        for branch in schema["oneOf"]:
            branch_errs = []
            _validate_node(value, branch, root_schema, pointer, branch_errs)
            if not branch_errs:
                valid += 1
        if valid != 1:
            errors.append(f"{pointer}: must match exactly one schema branch (matched {valid})")
        return

    if "type" in schema and not _matches_type(value, schema["type"]):
        errors.append(f"{pointer}: expected type {schema['type']}, got {_type_of(value)}")
        return

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{pointer}: must be one of {', '.join(map(str, schema['enum']))}")

    if "const" in schema and value != schema["const"]:
        errors.append(f"{pointer}: must equal {json.dumps(schema['const'])}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{pointer}: must be >= {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{pointer}: must be <= {schema['maximum']}")

    if isinstance(value, str) and "pattern" in schema:
        if not re.match(schema["pattern"], value):
            errors.append(f"{pointer}: must match pattern {schema['pattern']}")

    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f'{pointer}: missing required property "{key}"')
        for key, prop_schema in schema.get("properties", {}).items():
            if key in value:
                _validate_node(value[key], prop_schema, root_schema, f"{pointer}/{key}", errors)

    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            _validate_node(item, schema["items"], root_schema, f"{pointer}[{i}]", errors)


def validate_against_schema(data, schema):
    errors = []
    _validate_node(data, schema, schema, "", errors)
    return {"valid": len(errors) == 0, "errors": errors}


def load_schema(schema_name):
    file_name = schema_name if schema_name.endswith(".json") else f"{schema_name}.schema.json"
    schema_path = os.path.join(os.path.dirname(__file__), "schemas", file_name)
    if not os.path.exists(schema_path):
        raise FileNotFoundError(f"Schema not found: {schema_path}")
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_with_named_schema(data, schema_name):
    schema = load_schema(schema_name)
    return validate_against_schema(data, schema)