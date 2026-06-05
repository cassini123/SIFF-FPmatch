import { SubtitlerRow } from '@/lib/parseSubtitlerExcel';

export const MANUAL_PARTNER_STORAGE_KEY = 'manual_partner_overrides_v1';

export type ManualPartnerOverrides = Record<string, string | null>;

export function loadManualPartnerOverrides(): ManualPartnerOverrides {
  try {
    const raw = localStorage.getItem(MANUAL_PARTNER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as ManualPartnerOverrides;
  } catch {
    return {};
  }
}

export function saveManualPartnerOverrides(overrides: ManualPartnerOverrides): void {
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(MANUAL_PARTNER_STORAGE_KEY);
    } else {
      localStorage.setItem(MANUAL_PARTNER_STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch (e) {
    console.error('保存手动搭档覆盖失败:', e);
  }
}

export function getEffectivePartner(
  name: string,
  excelPartner: string | null | undefined,
  overrides: ManualPartnerOverrides
): string | null {
  if (name in overrides) {
    return overrides[name];
  }
  return excelPartner?.trim() || null;
}

export function isManualPartnerOverride(
  name: string,
  overrides: ManualPartnerOverrides
): boolean {
  return name in overrides;
}

export function applyManualPartnerChange(
  overrides: ManualPartnerOverrides,
  name: string,
  partner: string | null,
  rows: SubtitlerRow[]
): ManualPartnerOverrides {
  const next = { ...overrides };
  const previousPartner = getEffectivePartner(
    name,
    rows.find(r => r.name === name)?.partner,
    overrides
  );

  if (partner) {
    next[name] = partner;
    next[partner] = name;
  } else {
    next[name] = null;
  }

  if (previousPartner && previousPartner !== partner) {
    const prevEffective = getEffectivePartner(
      previousPartner,
      rows.find(r => r.name === previousPartner)?.partner,
      overrides
    );
    if (prevEffective === name) {
      next[previousPartner] = null;
    }
  }

  return next;
}

export function buildBidirectionalPartnerMap(
  rows: SubtitlerRow[],
  manualPartnerOverrides: ManualPartnerOverrides = {}
): {
  partnerOf: Map<string, string>;
  warnings: string[];
} {
  const raw = new Map<string, string>();
  const warnings: string[] = [];

  rows.forEach(row => {
    const partner = getEffectivePartner(row.name, row.partner, manualPartnerOverrides);
    if (partner) {
      raw.set(row.name, partner);
    }
  });

  const partnerOf = new Map<string, string>();
  raw.forEach((partner, name) => {
    if (raw.get(partner) === name) {
      partnerOf.set(name, partner);
    } else if (raw.has(partner)) {
      warnings.push(`「${name}」与「${partner}」的搭档关系不是双向绑定，排班时将视为无搭档`);
    }
  });

  return { partnerOf, warnings };
}

export function getBidirectionalPartner(
  name: string,
  rows: SubtitlerRow[],
  manualPartnerOverrides: ManualPartnerOverrides = {}
): string | null {
  return buildBidirectionalPartnerMap(rows, manualPartnerOverrides).partnerOf.get(name) ?? null;
}

export function hasBidirectionalPartner(
  name: string,
  rows: SubtitlerRow[],
  manualPartnerOverrides: ManualPartnerOverrides = {}
): boolean {
  return getBidirectionalPartner(name, rows, manualPartnerOverrides) !== null;
}

