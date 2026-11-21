import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { getTileName } from '../src/tileMap.ts';

test('tile names identify the suit, number and pronunciation', () => {
  for (const [id, name] of [
    ['1m', '一萬（イーマン）'],
    ['9m', '九萬（キューマン）'],
    ['2p', '二筒（リャンピン）'],
    ['8p', '八筒（パーピン）'],
    ['4s', '四索（スーソー）'],
    ['6s', '六索（ローソー）'],
    ['1z', '東（トン）'],
    ['2z', '南（ナン）'],
    ['3z', '西（シャー）'],
    ['4z', '北（ペー）'],
    ['5z', '白（ハク）'],
    ['6z', '發（ハツ）'],
    ['7z', '中（チュン）'],
  ]) {
    assert.equal(getTileName(id), name);
  }
});

test('unknown tile identifiers are reported without being treated as valid tiles', () => {
  const warn = mock.method(console, 'warn', () => {});
  try {
    assert.equal(getTileName('0m'), '不明な牌');
    assert.equal(getTileName('toString'), '不明な牌');
    assert.equal(warn.mock.callCount(), 2);
  } finally {
    warn.mock.restore();
  }
});
