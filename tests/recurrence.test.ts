import {test} from 'node:test';
import assert from 'node:assert/strict';
import {occurs,validRecurrences,type Recurrence} from '../lib/recurrence';
const rule:Recurrence={id:'test',title:'Corrida',category:'Exercício',days:[2,4,6],amount:0,sortOrder:201,enabled:true};
test('recorrência respeita dias escolhidos e pausa',()=>{assert.equal(occurs(rule,'2026-11-03'),true);assert.equal(occurs(rule,'2026-11-04'),false);assert.equal(occurs({...rule,enabled:false},'2026-11-03'),false)});
test('configuração rejeita nomes duplicados, dias inválidos e quantidades incompatíveis',()=>{assert.equal(validRecurrences([rule]),true);assert.equal(validRecurrences([{...rule,days:[]}]),false);assert.equal(validRecurrences([{...rule,days:[7]}]),false);assert.equal(validRecurrences([rule,{...rule,id:'another'}]),false);assert.equal(validRecurrences([{...rule,amount:1.5}]),false);assert.equal(validRecurrences([{...rule,category:'inválida'}]),false)})
