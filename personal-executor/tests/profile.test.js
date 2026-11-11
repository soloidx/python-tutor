import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRules, compareObservations } from '../../src/personalRuleProfile.js';

test('las reglas comparan conjuntamente salida normalizada y escalares tipados', () => {
  const rules = validateRules([{kind:'stdout', equals:'42'}, {kind:'variable', name:'respuesta', equals:42}, {kind:'variable', name:'activo', equals:true}]);
  assert.equal(compareObservations(rules, {output:'42\n', variables:{respuesta:{type:'number', value:42}, activo:{type:'boolean', value:true}}}), true);
  assert.equal(compareObservations(rules, {output:'42\n', variables:{respuesta:{type:'string', value:'42'}, activo:{type:'boolean', value:true}}}), false);
});

test('rechaza reglas fuera del perfil sin evaluar expresiones', () => {
  for (const rules of [[{kind:'expression', equals:'True'}], [{kind:'variable',name:'x',equals:null}], [{kind:'variable',name:'x',equals:Number.MAX_SAFE_INTEGER + 1}], [{kind:'stdout',equals:'ok',check:'True'}], []]) {
    assert.throws(() => validateRules(rules));
  }
});

test('rechaza observaciones incompletas o fuera del perfil', () => {
  const rules = validateRules([{kind:'variable',name:'x',equals:1}]);
  assert.throws(() => compareObservations(rules, {output:'',variables:{}}));
  assert.throws(() => compareObservations(rules, {output:'',variables:{x:{type:'object',value:[]}}}));
});
