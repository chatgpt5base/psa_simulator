import { addBusinessDaysAfter } from "./businessDays";
import type { GradingPlan } from "./gradingPlans";

/** プランに依存しない到着〜受付開始まで */
export type SharedTimelineBase = {
  arrivalSource: "input" | "estimated";
  effectiveArrival: Date;
  receptionEarliest: Date;
  receptionLatest: Date;
};

export type PlanTimelineSlice = {
  returnEarliest: Date;
  returnLatest: Date;
};

export type TimelineResult = SharedTimelineBase & PlanTimelineSlice;

export type PlanComparisonRow = {
  plan: GradingPlan;
  profit: ProfitResult | null;
  /** 発送日未入力時は null */
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
  const t = raw.trim();
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
  arrivalOverride: Date | null;
  oneWayShippingBusinessDays: number;
}): SharedTimelineBase {
  const { shipDate, arrivalOverride } = inputs;
  const oneWay = Math.max(0, Math.floor(inputs.oneWayShippingBusinessDays));

  let effectiveArrival: Date;
  let arrivalSource: "input" | "estimated";

  if (arrivalOverride) {
    effectiveArrival = arrivalOverride;
    arrivalSource = "input";
  } else {
    effectiveArrival = addBusinessDaysAfter(shipDate, oneWay);
    arrivalSource = "estimated";
  }

  const receptionEarliest = addBusinessDaysAfter(effectiveArrival, 10);
  const receptionLatest = addBusinessDaysAfter(effectiveArrival, 20);

  return {
    arrivalSource,
    effectiveArrival,
    receptionEarliest,
    receptionLatest,
  };
}

export function computePlanTimelineSlice(
  base: SharedTimelineBase,
  plan: GradingPlan,
): PlanTimelineSlice {
  const returnEarliest = addBusinessDaysAfter(
    base.receptionEarliest,
    plan.turnaroundDays,
  );
  const returnLatest = addBusinessDaysAfter(
    base.receptionLatest,
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
  arrivalOverride: Date | null;
  oneWayShippingBusinessDays: number;
  purchase: string;
  salePrice: string;
  commissionRate: string;
  otherCost: string;
}): {
  shared: SharedTimelineBase | null;
  rows: PlanComparisonRow[];
} {
  const { plans, shipDate } = inputs;
  if (!shipDate) {
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
    arrivalOverride: inputs.arrivalOverride,
    oneWayShippingBusinessDays: inputs.oneWayShippingBusinessDays,
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
  arrivalOverride: Date | null;
  oneWayShippingBusinessDays: number;
  plan: GradingPlan;
}): TimelineResult | null {
  const { shipDate, plan } = inputs;
  const shared = computeSharedTimelineBase({
    shipDate,
    arrivalOverride: inputs.arrivalOverride,
    oneWayShippingBusinessDays: inputs.oneWayShippingBusinessDays,
  });
  const slice = computePlanTimelineSlice(shared, plan);
  return { ...shared, ...slice };
}
