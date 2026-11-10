/* Closed data protocol shared by the demo's separate browser realms. */
const ValidationProtocol = (() => {
  'use strict';
  const keysOf = Object.keys, isArray = Array.isArray, finite = Number.isFinite, abs = Math.abs;
  const record = value => value !== null && typeof value === 'object' && !isArray(value);
  const text = (value, max = 20000) => typeof value === 'string' && value.length <= max;
  const name = value => text(value, 64) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
  const id = value => text(value, 64) && /^[A-Za-z0-9-]+$/.test(value);
  const scalar = value => typeof value === 'boolean' || text(value) || (typeof value === 'number' && finite(value) && abs(value) <= 9007199254740991);
  const fields = (value, required) => record(value) && keysOf(value).length === required.length && required.every(key => Object.hasOwn(value, key));
  function observations(value) {
    if (!record(value) || keysOf(value).length > 20) return false;
    return keysOf(value).every(key => name(key) && fields(value[key], ['type', 'value']) && scalar(value[key].value) && value[key].type === typeof value[key].value);
  }
  function request(value) {
    if (!record(value) || value.v !== 1 || !id(value.id)) return false;
    if (value.type === 'cancel') return fields(value, ['v', 'type', 'id']);
    return value.type === 'execute' && fields(value, ['v', 'type', 'id', 'code', 'names']) && text(value.code, 16000) && isArray(value.names) && value.names.length <= 20 && value.names.every(name) && new Set(value.names).size === value.names.length;
  }
  function reply(value, withId) {
    if (!record(value) || value.v !== 1) return false;
    const base = withId ? ['v', 'type', 'id'] : ['v', 'type'];
    if (withId && !id(value.id)) return false;
    switch (value.type) {
      case 'loading': case 'cancelled': return withId && fields(value, base);
      case 'ready': return !withId && fields(value, [...base, 'version']) && value.version === '0.28.3';
      case 'running': return withId && fields(value, [...base, 'version']) && value.version === '0.28.3';
      case 'observations': return fields(value, [...base, 'output', 'variables']) && text(value.output) && observations(value.variables);
      case 'load-error': case 'execution-error': case 'unsupported': case 'limit': case 'timeout':
        return fields(value, [...base, 'message', 'output']) && text(value.message) && text(value.output);
      default: return false;
    }
  }
  const workerReply = value => reply(value, false);
  const frameReply = value => (fields(value, ['v', 'type']) && value.v === 1 && value.type === 'executor-ready') || reply(value, true);
  return Object.freeze({record, text, name, id, scalar, fields, request, workerReply, frameReply});
})();
