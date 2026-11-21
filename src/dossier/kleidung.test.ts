import { describe, expect, it } from 'vitest';
import { teilBild } from './build';
import type { TeamProfile } from '../domain/types';

const team = { kits: {
  home: { shirt: 'weiß', shorts: 'schwarz', socks: 'weiß', images: { shirt: 'data:weiss', shorts: 'data:hose-schwarz' } },
  away: null,
  weitere: [{ shirt: 'Schwarz', shorts: 'schwarz', socks: 'schwarz', images: { shirt: 'data:schwarz' } }],
} } as unknown as TeamProfile;

describe('Spielkleidung: Bild je Teil und Farbe', () => {
  it('findet das schwarze Trikot auch in anderer Kombination', () => {
    const kit = { shirt: 'schwarz', shorts: 'weiß', socks: 'weiß' };
    expect(teilBild(kit, team, 'shirt')).toBe('data:schwarz');
    expect(teilBild(kit, team, 'socks')).toBeUndefined();
    expect(teilBild({ shirt: 'Weiße', shorts: 'schwarz', socks: '' }, team, 'shirt')).toBe('data:weiss');
    expect(teilBild({ shirt: 'weiß', shorts: 'schwarz', socks: '' }, team, 'shorts')).toBe('data:hose-schwarz');
  });
});
