import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frames } from '../src/engine/server.js';

const collect = () => {
  const got: string[] = [];
  return { got, push: frames((m) => got.push(m)) };
};

test('several messages in one chunk, and one over several', () => {
  const { got, push } = collect();
  push(Buffer.from('{"id":1}\0{"id":2}\0{"id"'));
  push(Buffer.from(':3,"result"'));
  push(Buffer.from(':{}}\0'));
  assert.deepEqual(got, ['{"id":1}', '{"id":2}', '{"id":3,"result":{}}']);
});

test('a character split between two chunks', () => {
  const { got, push } = collect();
  const message = Buffer.from('{"title":"Facture é"}\0');
  const cut = message.indexOf(Buffer.from('é')) + 1;
  push(message.subarray(0, cut));
  push(message.subarray(cut));
  assert.deepEqual(got, ['{"title":"Facture é"}']);
});
