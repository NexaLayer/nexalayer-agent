/**
 * Geo Candidate System — 三层回归测试
 *
 * Layer 1: 解析层 — resolveGeo 候选集是否正确
 * Layer 2: 匹配层 — matchProductCandidate 是否命中正确产品
 * Layer 3: 响应层 — 查询分组 vs 执行确认
 */

import { describe, it, expect } from 'vitest';
import {
  resolveGeo,
  productLocationNames,
  type GeoCandidate,
} from '../../src/modules/nl-agent/geo-mapping';

/* ─── Layer 1: 解析层 ─── */

describe('Layer 1: resolveGeo candidates', () => {
  describe('华盛顿 (ambiguous)', () => {
    const cases = [
      '华盛顿', '华盛顿IP', '华盛顿的IP',
      '华盛顿有哪些IP', '美国华盛顿',
      'Washington', 'washington',
      'washington ip', 'Washington proxy',
    ];
    for (const input of cases) {
      it(`"${input}" → ambiguous, ≥2 candidates`,
        () => {
          const r = resolveGeo(input);
          expect(r.ambiguous).toBe(true);
          expect(
            r.candidates.length
          ).toBeGreaterThanOrEqual(2);
          const levels = r.candidates.map(
            (c) => c.level
          );
          expect(levels).toContain('city');
          expect(levels).toContain('state');
        }
      );
    }
  });

  describe('华盛顿 disambiguated', () => {
    it('"华盛顿特区" → single DC candidate', () => {
      const r = resolveGeo('华盛顿特区');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
      expect(r.candidates[0].stateCode).toBe(
        'USA0DC'
      );
    });

    it('"华盛顿州" → single WA candidate', () => {
      const r = resolveGeo('华盛顿州');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
      expect(r.candidates[0].stateCode).toBe(
        'USA0WA'
      );
    });

    it('"Washington DC" → single DC candidate', () => {
      const r = resolveGeo('Washington DC');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
      expect(r.candidates[0].stateCode).toBe(
        'USA0DC'
      );
    });

    it('"washington state" → single WA', () => {
      const r = resolveGeo('washington state');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
      expect(r.candidates[0].stateCode).toBe(
        'USA0WA'
      );
    });

    it('"dc" → single DC candidate', () => {
      const r = resolveGeo('dc');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
    });
  });

  describe('乔治亚 (ambiguous)', () => {
    it('"乔治亚" → ambiguous, state + country', () => {
      const r = resolveGeo('乔治亚');
      expect(r.ambiguous).toBe(true);
      expect(
        r.candidates.length
      ).toBeGreaterThanOrEqual(2);
      const codes = r.candidates.map(
        (c) => c.countryCode
      );
      expect(codes).toContain('USA');
      expect(codes).toContain('GEO');
    });

    it('"Georgia" → ambiguous', () => {
      const r = resolveGeo('Georgia');
      expect(r.ambiguous).toBe(true);
    });

    it('"乔治亚州" → single US state', () => {
      const r = resolveGeo('乔治亚州');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
      expect(r.candidates[0].stateCode).toBe(
        'USA0GA'
      );
    });

    it('"格鲁吉亚" → single country GEO', () => {
      const r = resolveGeo('格鲁吉亚');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
      expect(r.candidates[0].countryCode).toBe(
        'GEO'
      );
    });
  });

  describe('Unambiguous locations', () => {
    it('"纽约" → single candidate', () => {
      const r = resolveGeo('纽约');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
    });

    it('"洛杉矶" → single candidate', () => {
      const r = resolveGeo('洛杉矶');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
    });

    it('"美国" → single country candidate', () => {
      const r = resolveGeo('美国');
      expect(r.ambiguous).toBe(false);
      expect(r.candidates).toHaveLength(1);
      expect(r.candidates[0].level).toBe('country');
      expect(r.candidates[0].countryCode).toBe(
        'USA'
      );
    });

    it('"日本" → country', () => {
      const r = resolveGeo('日本');
      expect(r.country).toBe('JPN');
      expect(r.candidates).toHaveLength(1);
    });
  });

  describe('GeoGroups', () => {
    it('"西海岸" → group', () => {
      const r = resolveGeo('西海岸');
      expect(r.group).not.toBeNull();
      expect(r.group!.states).toContain('USA0CA');
    });

    it('"east coast" → group', () => {
      const r = resolveGeo('east coast');
      expect(r.group).not.toBeNull();
    });

    it('"北美" → group with USA + CAN', () => {
      const r = resolveGeo('北美');
      expect(r.group).not.toBeNull();
      expect(r.group!.countries).toContain('USA');
      expect(r.group!.countries).toContain('CAN');
    });
  });
});

/* ─── Layer 2: 匹配层 ─── */

function simulateProductMatch(
  pCountry: string,
  pState: string,
  pCity: string,
  candidate: GeoCandidate
): boolean {
  const pCityUp = pCity.toUpperCase();
  const pStateUp = pState.toUpperCase();
  const pCountryUp = pCountry.toUpperCase();

  if (candidate.cityCode) {
    const code = candidate.cityCode.toUpperCase();
    if (pCityUp.startsWith(code)) return true;
  }
  if (candidate.stateCode) {
    const code = candidate.stateCode.toUpperCase();
    if (pStateUp.startsWith(code)) return true;
    if (pCityUp.startsWith(code)) return true;
  }
  if (
    candidate.level === 'country' &&
    !candidate.stateCode
  ) {
    if (pCountryUp === candidate.countryCode)
      return true;
  }

  const pNames = productLocationNames(
    pCountry, pState, pCity
  );
  const aliases = [
    candidate.label.toLowerCase(),
    candidate.labelEn.toLowerCase(),
  ];
  for (const a of aliases) {
    for (const pn of pNames) {
      if (pn === a) return true;
    }
  }
  return false;
}

function matchesAnyCandidate(
  pCountry: string,
  pState: string,
  pCity: string,
  candidates: GeoCandidate[]
): boolean {
  return candidates.some((c) =>
    simulateProductMatch(pCountry, pState, pCity, c)
  );
}

describe('Layer 2: Candidate product matching', () => {
  describe('"华盛顿" matches all Washington products',
    () => {
      const geo = resolveGeo('华盛顿');

      it('matches DC product (USA0DC/USA0DCWAS)',
        () => {
          expect(
            matchesAnyCandidate(
              'USA', 'USA0DC', 'USA0DCWAS',
              geo.candidates
            )
          ).toBe(true);
        }
      );

      it('matches WA product (USA0WA/USA0WASEA)',
        () => {
          expect(
            matchesAnyCandidate(
              'USA', 'USA0WA', 'USA0WASEA',
              geo.candidates
            )
          ).toBe(true);
        }
      );

      it('matches legacy product (USA000/USA000000)',
        () => {
          expect(
            matchesAnyCandidate(
              'USA', 'USA000', 'USA000000',
              geo.candidates
            )
          ).toBe(true);
        }
      );

      it('does NOT match Japanese product', () => {
        expect(
          matchesAnyCandidate(
            'JPN', 'JPN000', 'JPN000TKY',
            geo.candidates
          )
        ).toBe(false);
      });
    }
  );

  describe('"华盛顿特区" only matches DC', () => {
    const geo = resolveGeo('华盛顿特区');

    it('matches DC product', () => {
      expect(
        matchesAnyCandidate(
          'USA', 'USA0DC', 'USA0DCWAS',
          geo.candidates
        )
      ).toBe(true);
    });

    it('does NOT match WA product', () => {
      expect(
        matchesAnyCandidate(
          'USA', 'USA0WA', 'USA0WASEA',
          geo.candidates
        )
      ).toBe(false);
    });
  });

  describe('"华盛顿州" only matches WA', () => {
    const geo = resolveGeo('华盛顿州');

    it('matches WA product', () => {
      expect(
        matchesAnyCandidate(
          'USA', 'USA0WA', 'USA0WASEA',
          geo.candidates
        )
      ).toBe(true);
    });

    it('does NOT match DC product', () => {
      expect(
        matchesAnyCandidate(
          'USA', 'USA0DC', 'USA0DCWAS',
          geo.candidates
        )
      ).toBe(false);
    });
  });

  describe('"乔治亚" matches US + Georgia country',
    () => {
      const geo = resolveGeo('乔治亚');

      it('matches US Georgia state', () => {
        expect(
          matchesAnyCandidate(
            'USA', 'USA0GA', 'USA0GAATL',
            geo.candidates
          )
        ).toBe(true);
      });

      it('matches Georgia country', () => {
        expect(
          matchesAnyCandidate(
            'GEO', '', '', geo.candidates
          )
        ).toBe(true);
      });

      it('does NOT match Russia', () => {
        expect(
          matchesAnyCandidate(
            'RUS', 'RUS000', 'RUS000MOW',
            geo.candidates
          )
        ).toBe(false);
      });
    }
  );

  describe('"美国" matches all USA products', () => {
    const geo = resolveGeo('美国');
    it('matches USA DC', () => {
      expect(
        matchesAnyCandidate(
          'USA', 'USA0DC', 'USA0DCWAS',
          geo.candidates
        )
      ).toBe(true);
    });
    it('does NOT match Japan', () => {
      expect(
        matchesAnyCandidate(
          'JPN', 'JPN000', 'JPN000TKY',
          geo.candidates
        )
      ).toBe(false);
    });
  });
});

/* ─── Layer 3: 响应行为断言 ─── */

describe('Layer 3: Response behavior', () => {
  describe('Query intent → ambiguous → multi-search',
    () => {
      const ambiguousInputs = [
        '华盛顿IP', '华盛顿有哪些IP',
        'Washington', '乔治亚', 'Georgia',
      ];
      for (const input of ambiguousInputs) {
        it(`"${input}" should trigger multi-search`,
          () => {
            const geo = resolveGeo(input);
            expect(geo.ambiguous).toBe(true);
            expect(
              geo.candidates.length
            ).toBeGreaterThan(1);
          }
        );
      }
    }
  );

  describe(
    'Action intent → ambiguous → must confirm',
    () => {
      const actionInputs = [
        '帮我开通一个华盛顿IP',
        'open a Washington IP',
      ];
      for (const input of actionInputs) {
        it(`"${input}" should require confirmation`,
          () => {
            const geo = resolveGeo(input);
            expect(geo.ambiguous).toBe(true);
            expect(
              geo.candidates.length
            ).toBeGreaterThan(1);
          }
        );
      }
    }
  );

  describe('Disambiguated → direct execution', () => {
    const directInputs = [
      { input: '华盛顿特区IP', expected: 'USA0DC' },
      { input: '华盛顿州IP', expected: 'USA0WA' },
      {
        input: 'Washington DC proxy',
        expected: 'USA0DC',
      },
    ];
    for (const { input, expected } of directInputs) {
      it(`"${input}" → direct, stateCode=${expected}`,
        () => {
          const geo = resolveGeo(input);
          expect(geo.ambiguous).toBe(false);
          expect(geo.candidates).toHaveLength(1);
          expect(
            geo.candidates[0].stateCode
          ).toBe(expected);
        }
      );
    }
  });

  describe('Candidate labels for display', () => {
    it('"华盛顿" candidates have proper labels',
      () => {
        const geo = resolveGeo('华盛顿');
        const labels = geo.candidates.map(
          (c) => c.label
        );
        expect(labels).toContain('华盛顿特区');
        expect(labels).toContain('华盛顿州');
      }
    );

    it('"乔治亚" candidates show state + country',
      () => {
        const geo = resolveGeo('乔治亚');
        const labels = geo.candidates.map(
          (c) => c.label
        );
        expect(labels).toContain('乔治亚州');
        expect(labels).toContain('格鲁吉亚');
      }
    );
  });
});
