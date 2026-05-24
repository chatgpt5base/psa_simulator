import { addBusinessDaysAfter } from "./businessDays";
import type { GradingPlan } from "./gradingPlans";

/** PSA到着から荷物到着のお知らせ（予定納期カウント開始）までの目安（営業日） */
export const ARRIVAL_NOTIFICATION_BUSINESS_DAYS_MIN = 20;
export const ARRIVAL_NOTIFICATION_BUSINESS_DAYS_MAX = 30;

/** プランに依存しない到着〜予定納期カウント開始まで */
export type SharedTimelineBase = {
  effectiveArrival: Date;
  countdownStartEarliest: Date;
  countdownStartLatest: Date;
};

export type PlanTimelineSlice = {
  returnEarliest: Date;
  returnLatest: Date;
};

export type TimelineResult = SharedTimelineBase & PlanTimelineSlice;

export type PlanComparisonRow = {
  plan: GradingPlan;
  profit: ProfitResult | null;
  /** 発送日・片道配送日数未入力時は null */
  timeline: PlanTimelineSlice | null;
};

export type ProfitResult = {
  gradingFee: number;
  totalCost: number;
  commissionAmount: number;
  profit: number;
  marginPercent: number | null;
};

function safeNumber(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function computeProfit(inputs: {
  purchase: string;
  plan: GradingPlan;
  salePrice: string;
  commissionRate: string;
  otherCost: string;
}): ProfitResult | null {
  const purchase = safeNumber(inputs.purchase);
  const sale = safeNumber(inputs.salePrice);
  const rate = safeNumber(inputs.commissionRate);
  const other = safeNumber(inputs.otherCost);

  if (purchase === null || sale === null || rate === null || other === null) {
    return null;
  }

  const gradingFee = inputs.plan.fee;
  const totalCost = purchase + gradingFee + other;
  const commissionAmount = (sale * rate) / 100;
  const profit = sale - commissionAmount - totalCost;
  const marginPercent = sale !== 0 ? (profit / sale) * 100 : null;

  return {
    gradingFee,
    totalCost,
    commissionAmount,
    profit,
    marginPercent,
  };
}

export function computeSharedTimelineBase(inputs: {
  shipDate: Date;
  oneWayShippingBusinessDays: number;
}): SharedTimelineBase {
  const { shipDate } = inputs;
  const oneWay = Math.max(0, Math.floor(inputs.oneWayShippingBusinessDays));

  const effectiveArrival = addBusinessDaysAfter(shipDate, oneWay);
  const countdownStartEarliest = addBusinessDaysAfter(
    effectiveArrival,
    ARRIVAL_NOTIFICATION_BUSINESS_DAYS_MIN,
  );
  const countdownStartLatest = addBusinessDaysAfter(
    effectiveArrival,
    ARRIVAL_NOTIFICATION_BUSINESS_DAYS_MAX,
  );

  return {
    effectiveArrival,
    countdownStartEarliest,
    countdownStartLatest,
  };
}

export function computePlanTimelineSlice(
  base: SharedTimelineBase,
  plan: GradingPlan,
): PlanTimelineSlice {
  const returnEarliest = addBusinessDaysAfter(
    base.countdownStartEarliest,
    plan.turnaroundDays,
  );
  const returnLatest = addBusinessDaysAfter(
    base.countdownStartLatest,
    plan.turnaroundDays,
  );
  return {
    returnEarliest,
    returnLatest,
  };
}

export function buildPlanComparisonRows(inputs: {
  plans: GradingPlan[];
  shipDate: Date | null;
  /** 未入力のときはスケジュールを出さない */
  oneWayShippingBusinessDays: number | null;
  purchase: string;
  salePrice: string;
  commissionRate: string;
  otherCost: string;
}): {
  shared: SharedTimelineBase | null;
  rows: PlanComparisonRow[];
} {
  const { plans, shipDate } = inputs;
  const oneWay = inputs.oneWayShippingBusinessDays;

  if (!shipDate || oneWay === null) {
    return {
      shared: null,
      rows: plans.map((plan) => ({
        plan,
        profit: computeProfit({
          purchase: inputs.purchase,
          plan,
          salePrice: inputs.salePrice,
          commissionRate: inputs.commissionRate,
          otherCost: inputs.otherCost,
        }),
        timeline: null,
      })),
    };
  }

  const shared = computeSharedTimelineBase({
    shipDate,
    oneWayShippingBusinessDays: oneWay,
  });

  const rows: PlanComparisonRow[] = plans.map((plan) => ({
    plan,
    profit: computeProfit({
      purchase: inputs.purchase,
      plan,
      salePrice: inputs.salePrice,
      commissionRate: inputs.commissionRate,
      otherCost: inputs.otherCost,
    }),
    timeline: computePlanTimelineSlice(shared, plan),
  }));

  return { shared, rows };
}

export function computeTimeline(inputs: {
  shipDate: Date;
  oneWayShippingBusinessDays: number;
  plan: GradingPlan;
}): TimelineResult | null {
  const { shipDate, plan } = inputs;
  const shared = computeSharedTimelineBase({
    shipDate,
    oneWayShippingBusinessDays: inputs.oneWayShippingBusinessDays,
  });
  const slice = computePlanTimelineSlice(shared, plan);
  return { ...shared, ...slice };
}
