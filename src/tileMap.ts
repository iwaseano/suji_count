function buildAssetPath(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return normalizedBase ? `${normalizedBase}/${normalizedPath}` : `/${normalizedPath}`;
}

const tileSvgPathMap: Record<string, string> = {
  '1m': 'tiles/Regular/Man1.svg',
  '2m': 'tiles/Regular/Man2.svg',
  '3m': 'tiles/Regular/Man3.svg',
  '4m': 'tiles/Regular/Man4.svg',
  '5m': 'tiles/Regular/Man5.svg',
  '6m': 'tiles/Regular/Man6.svg',
  '7m': 'tiles/Regular/Man7.svg',
  '8m': 'tiles/Regular/Man8.svg',
  '9m': 'tiles/Regular/Man9.svg',
  '1p': 'tiles/Regular/Pin1.svg',
  '2p': 'tiles/Regular/Pin2.svg',
  '3p': 'tiles/Regular/Pin3.svg',
  '4p': 'tiles/Regular/Pin4.svg',
  '5p': 'tiles/Regular/Pin5.svg',
  '6p': 'tiles/Regular/Pin6.svg',
  '7p': 'tiles/Regular/Pin7.svg',
  '8p': 'tiles/Regular/Pin8.svg',
  '9p': 'tiles/Regular/Pin9.svg',
  '1s': 'tiles/Regular/Sou1.svg',
  '2s': 'tiles/Regular/Sou2.svg',
  '3s': 'tiles/Regular/Sou3.svg',
  '4s': 'tiles/Regular/Sou4.svg',
  '5s': 'tiles/Regular/Sou5.svg',
  '6s': 'tiles/Regular/Sou6.svg',
  '7s': 'tiles/Regular/Sou7.svg',
  '8s': 'tiles/Regular/Sou8.svg',
  '9s': 'tiles/Regular/Sou9.svg',
  '1z': 'tiles/Regular/Ton.svg',
  '2z': 'tiles/Regular/Nan.svg',
  '3z': 'tiles/Regular/Shaa.svg',
  '4z': 'tiles/Regular/Pei.svg',
  '5z': 'tiles/Regular/Haku.svg',
  '6z': 'tiles/Regular/Hatsu.svg',
  '7z': 'tiles/Regular/Chun.svg',
};

const tileNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const tileNumberReadings = ['イー', 'リャン', 'サン', 'スー', 'ウー', 'ロー', 'チー', 'パー', 'キュー'];
const tileSuits: Record<string, { name: string; reading: string }> = {
  m: { name: '萬', reading: 'マン' },
  p: { name: '筒', reading: 'ピン' },
  s: { name: '索', reading: 'ソー' },
};
const honorTileNames = new Map([
  ['1z', '東（トン）'],
  ['2z', '南（ナン）'],
  ['3z', '西（シャー）'],
  ['4z', '北（ペー）'],
  ['5z', '白（ハク）'],
  ['6z', '發（ハツ）'],
  ['7z', '中（チュン）'],
]);

export function getTileSvgPath(tileId: string): string {
  return buildAssetPath(tileSvgPathMap[tileId] ?? 'tiles/Regular/Man1.svg');
}

export function getTileName(tileId: string): string {
  const honorName = honorTileNames.get(tileId);
  if (honorName) {
    return honorName;
  }

  const match = /^([1-9])([mps])$/.exec(tileId);
  if (match) {
    const index = Number(match[1]) - 1;
    const suit = tileSuits[match[2]];
    return `${tileNumbers[index]}${suit.name}（${tileNumberReadings[index]}${suit.reading}）`;
  }

  console.warn('Unknown tile identifier:', tileId);
  return '不明な牌';
}
