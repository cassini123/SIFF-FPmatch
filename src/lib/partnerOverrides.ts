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
