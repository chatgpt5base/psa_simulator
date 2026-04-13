"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { exceedsDeclaredValueMax, gradingPlans } from "@/lib/gradingPlans";
import {
  formatDateJa,
  formatDateShortJa,
  parseInputDate,
} from "@/lib/dateParse";
import { formatAmountFromDigits, stripAmountCommas } from "@/lib/amountInput";
import { buildPlanComparisonRows } from "@/lib/simulatorCalculations";
import type { PlanComparisonRow } from "@/lib/simulatorCalculations";

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function pctFormat(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Daily profit = profit / plan turnaroundDays (business days). */
const dailyYen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

function formatDailyProfit(
  profit: number | null,
  turnaroundDays: number,
): string {
  if (profit === null || turnaroundDays <= 0) return "—";
  return `${dailyYen.format(profit / turnaroundDays)}/日`;
}

function formatDailyEfficiency(
  profit: number | null,
  totalCost: number | null,
  turnaroundDays: number,
): string {
  if (profit === null || totalCost === null || totalCost <= 0 || turnaroundDays <= 0) {
    return "—";
  }
  const efficiencyPerDay = ((profit / totalCost) / turnaroundDays) * 100;
  return `${pctFormat(efficiencyPerDay)}%/日`;
}

/** 申告上限内かつ想定利益がプラスのプランのみ戦略判定に含める */
function strategyEligible(
  r: PlanComparisonRow,
  saleYenParsed: number | null,
): boolean {
  return (
    r.profit !== null &&
    !exceedsDeclaredValueMax(saleYenParsed, r.plan) &&
    r.profit.profit >= 0
  );
}

type StrategyFlags = {
  profit: boolean;
  speed: boolean;
  balance: boolean;
};

function computeStrategyFlagsByPlanId(
  rows: PlanComparisonRow[],
  saleYenParsed: number | null,
): Map<string, StrategyFlags> {
  const eligible = rows.filter((r) => strategyEligible(r, saleYenParsed));
  const result = new Map<string, StrategyFlags>();
  for (const r of rows) {
    result.set(r.plan.id, { profit: false, speed: false, balance: false });
  }
  if (eligible.length === 0) return result;

  let maxProfit = -Infinity;
  for (const r of eligible) {
    maxProfit = Math.max(maxProfit, r.profit!.profit);
  }
  for (const r of eligible) {
    if (r.profit!.profit === maxProfit) {
      result.get(r.plan.id)!.profit = true;
    }
  }

  const nearEqual = (a: number, b: number) => Math.abs(a - b) < 1e-9;

  /** スピード重視: 日次利益（想定利益÷所要営業日）が最大 */
  let maxDailyProfit = -Infinity;
  for (const r of eligible) {
    if (r.plan.turnaroundDays <= 0) continue;
    maxDailyProfit = Math.max(
      maxDailyProfit,
      r.profit!.profit / r.plan.turnaroundDays,
    );
  }
  for (const r of eligible) {
    if (r.plan.turnaroundDays <= 0) continue;
    if (nearEqual(r.profit!.profit / r.plan.turnaroundDays, maxDailyProfit)) {
      result.get(r.plan.id)!.speed = true;
    }
  }

  /** バランス重視: 日利効率（(想定利益÷総コスト)÷所要営業日）が最大 */
  let maxEfficiency = -Infinity;
  for (const r of eligible) {
    const tc = r.profit!.totalCost;
    if (tc <= 0 || r.plan.turnaroundDays <= 0) continue;
    maxEfficiency = Math.max(
      maxEfficiency,
      (r.profit!.profit / tc) / r.plan.turnaroundDays,
    );
  }
  for (const r of eligible) {
    const tc = r.profit!.totalCost;
    if (tc <= 0 || r.plan.turnaroundDays <= 0) continue;
    if (nearEqual((r.profit!.profit / tc) / r.plan.turnaroundDays, maxEfficiency)) {
      result.get(r.plan.id)!.balance = true;
    }
  }

  return result;
}

function strategyRowHighlightStyle(flags: StrategyFlags): CSSProperties | undefined {
  const layers: string[] = [];
  if (flags.profit) layers.push("rgba(251, 191, 36, 0.09)");
  if (flags.speed) layers.push("rgba(56, 189, 248, 0.09)");
  if (flags.balance) layers.push("rgba(167, 139, 250, 0.09)");
  if (layers.length === 0) return undefined;
  if (layers.length === 1) return { backgroundColor: layers[0] };
  return {
    background: `linear-gradient(120deg, ${layers.join(", ")})`,
  };
}

function StrategyBadges({
  flags,
  className = "",
}: {
  flags: StrategyFlags;
  className?: string;
}) {
  if (!flags.profit && !flags.speed && !flags.balance) return null;
  return (
    <span className={["flex gap-1", className].filter(Boolean).join(" ")}>
      {flags.profit && (
        <span className="shrink-0 rounded-full border border-amber-300/45 bg-amber-400/20 px-1.5 py-px text-[10px] font-semibold text-amber-100">
          利益重視
        </span>
      )}
      {flags.speed && (
        <span className="shrink-0 rounded-full border border-sky-400/45 bg-sky-500/20 px-1.5 py-px text-[10px] font-semibold text-sky-100">
          スピード重視
        </span>
      )}
      {flags.balance && (
        <span className="shrink-0 rounded-full border border-violet-400/45 bg-violet-500/20 px-1.5 py-px text-[10px] font-semibold text-violet-100">
          バランス重視
        </span>
      )}
    </span>
  );
}

/** リセット時・未選択時の片道配送日数（空） */
const ONE_WAY_EMPTY = "";

const RESET_INPUTS = {
  purchase: "",
  salePrice: "",
  commissionRate: "10",
  otherCost: "0",
  shipDateStr: "",
  oneWayBizDays: ONE_WAY_EMPTY,
};

/** 初回表示のデフォルト */
const DEFAULT_ONE_WAY_BIZ_DAYS = "2";

export function SimulatorClient() {
  const [purchase, setPurchase] = useState<string>(RESET_INPUTS.purchase);
  const [salePrice, setSalePrice] = useState<string>(RESET_INPUTS.salePrice);
  const [commissionRate, setCommissionRate] = useState<string>(
    RESET_INPUTS.commissionRate,
  );
  const [otherCost, setOtherCost] = useState<string>(() =>
    formatAmountFromDigits(RESET_INPUTS.otherCost),
  );
  const [shipDateStr, setShipDateStr] = useState<string>(
    RESET_INPUTS.shipDateStr,
  );
  const [oneWayBizDays, setOneWayBizDays] = useState<string>(
    DEFAULT_ONE_WAY_BIZ_DAYS,
  );

  function resetInputs() {
    setPurchase(RESET_INPUTS.purchase);
    setSalePrice(RESET_INPUTS.salePrice);
    setCommissionRate(RESET_INPUTS.commissionRate);
    setOtherCost(formatAmountFromDigits(RESET_INPUTS.otherCost));
    setShipDateStr(RESET_INPUTS.shipDateStr);
    setOneWayBizDays(RESET_INPUTS.oneWayBizDays);
  }

  const shipDate = useMemo(() => parseInputDate(shipDateStr), [shipDateStr]);
  /** 未入力時はスケジュール計算しない */
  const oneWayShippingBusinessDays = useMemo((): number | null => {
    const t = oneWayBizDays.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
  }, [oneWayBizDays]);

  /** PSA10想定販売額（数値として解釈できた場合のみ） */
  const saleYenParsed = useMemo((): number | null => {
    const t = stripAmountCommas(salePrice);
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }, [salePrice]);

  const { shared, rows } = useMemo(
    () =>
      buildPlanComparisonRows({
        plans: gradingPlans,
        shipDate,
        oneWayShippingBusinessDays,
        purchase,
        salePrice,
        commissionRate,
        otherCost,
      }),
    [
      shipDate,
      oneWayShippingBusinessDays,
      purchase,
      salePrice,
      commissionRate,
      otherCost,
    ],
  );

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    const allHaveProfit = copy.every((r) => r.profit !== null);
    if (allHaveProfit) {
      copy.sort((a, b) => b.profit!.profit - a.profit!.profit);
    }
    return copy;
  }, [rows]);

  const strategyFlagsByPlanId = useMemo(
    () => computeStrategyFlagsByPlanId(rows, saleYenParsed),
    [rows, saleYenParsed],
  );

  const rowStrategyFlags = (r: PlanComparisonRow): StrategyFlags =>
    strategyFlagsByPlanId.get(r.plan.id) ?? {
      profit: false,
      speed: false,
      balance: false,
    };

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-zinc-100 outline-none ring-amber-200/30 transition placeholder:text-zinc-500 focus:border-amber-200/40 focus:ring-2";

  const labelClass = "text-xs font-medium tracking-wide text-zinc-400";

  /** 申告上限超過、または想定利益がマイナス */
  const rowGrayed = (r: PlanComparisonRow) =>
    exceedsDeclaredValueMax(saleYenParsed, r.plan) ||
    (r.profit !== null && r.profit.profit < 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="mb-10 text-center sm:mb-12">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          PSA鑑定 利益シミュレーター
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          条件を一度入力すると、全プランの想定利益・返却目安を並べて比較できます。
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-8">
        <h2 className="text-sm font-semibold text-zinc-200">入力</h2>
        <p className="mt-1 text-xs text-zinc-500">
          日付は土日と日本の祝日（振替休日・国民の休日を含む）を除く営業日で計算します。
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="purchase">
              仕入れ額（円）
            </label>
            <input
              id="purchase"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
              placeholder="例: 50,000"
              value={purchase}
              onChange={(e) =>
                setPurchase(formatAmountFromDigits(e.target.value))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="sale">
              PSA10想定販売額（円）
            </label>
            <input
              id="sale"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
              placeholder="例: 120,000"
              value={salePrice}
              onChange={(e) =>
                setSalePrice(formatAmountFromDigits(e.target.value))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="fee-rate">
              販売手数料率（%）
            </label>
            <input
              id="fee-rate"
              type="number"
              inputMode="decimal"
              className={inputClass}
              placeholder="例: 10"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="other">
              その他費用（円）
            </label>
            <input
              id="other"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass}
              placeholder="例: 2,000"
              value={otherCost}
              onChange={(e) =>
                setOtherCost(formatAmountFromDigits(e.target.value))
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ship">
              発送日
            </label>
            <input
              id="ship"
              type="date"
              className={inputClass}
              value={shipDateStr}
              onChange={(e) => setShipDateStr(e.target.value)}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
              PSA到着は「発送日 + 片道配送日数」で推定します。
            </p>
          </div>
          <div>
            <label className={labelClass} htmlFor="oneway">
              片道配送日数
            </label>
            <input
              id="oneway"
              type="number"
              inputMode="numeric"
              min={0}
              className={inputClass}
              placeholder="未選択"
              value={oneWayBizDays}
              onChange={(e) => setOneWayBizDays(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={resetInputs}
            className="rounded-lg border border-white/15 bg-white/[0.06] px-6 py-2.5 text-xs font-medium text-zinc-300 transition hover:border-amber-200/30 hover:bg-amber-200/10 hover:text-amber-50"
          >
            入力をリセット
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            共通スケジュール（全プラン同じ）
          </h2>
          {shared && (
            <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-100/90">
              営業日ベース
            </span>
          )}
        </div>

        {!shipDate ? (
          <p className="mt-6 text-sm text-zinc-500">
            発送日を入力すると、PSA到着・受付開始予想（最短・最長）を表示します。
          </p>
        ) : oneWayShippingBusinessDays === null ? (
          <p className="mt-6 text-sm text-zinc-500">
            片道配送日数を入力すると、スケジュールを表示します。
          </p>
        ) : !shared ? (
          <p className="mt-6 text-sm text-zinc-500">計算できませんでした。</p>
        ) : (
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
              <dt className="text-xs text-zinc-500">PSA到着（推定）</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-100">
                {formatDateJa(shared.effectiveArrival)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
              <dt className="text-xs text-zinc-500">受付開始予想（最短）</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-100">
                {formatDateJa(shared.receptionEarliest)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-zinc-500">受付開始予想（最長）</dt>
              <dd className="mt-1 text-sm font-medium text-zinc-100">
                {formatDateJa(shared.receptionLatest)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/15 px-4 py-3 sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-zinc-500">目安</dt>
              <dd className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                到着の翌営業日から +10 / +20 営業日後に受付開始（土日・祝日除く）。返却日はプランの所要営業日で異なります。
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">
              プラン別比較
            </h2>
            <div className="mt-2 space-y-2 text-xs text-zinc-500">
              <p>
                収支欄が揃うと、想定利益の高い順に並べ替えます。申告価格上限超過、または想定利益がマイナスのプランはグレー表示です。
              </p>
              <p>
                日次利益は想定利益を、納期にあたる所要営業日で割った値です。
                日利効率は（想定利益 ÷（仕入れ額 + その他費用 + 鑑定料））÷ 所要営業日です。
              </p>
              <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] leading-relaxed">
                <p className="font-medium text-zinc-400">鑑定戦略ラベル（申告上限内かつ想定利益がプラスのプランのみ対象）</p>
                <ul className="mt-2 list-inside list-disc space-y-1.5 marker:text-zinc-600">
                  <li>
                    <span className="font-medium text-amber-200/90">利益重視</span>
                    ：指標は想定利益が最大のプランに付与します（同率のときは複数に付きます）。
                  </li>
                  <li>
                    <span className="font-medium text-sky-200/90">スピード重視</span>
                    ：指標は日次利益（想定利益÷所要営業日）が最大のプランに付与します（同率のときは複数に付きます）。
                  </li>
                  <li>
                    <span className="font-medium text-violet-200/90">バランス重視</span>
                    ：指標は日利効率（（想定利益÷総コスト）÷所要営業日）が最大のプランに付与します（同率のときは複数に付きます）。
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* モバイル: カード一覧 */}
        <div className="mt-6 space-y-3 lg:hidden">
          {sortedRows.map((r) => {
            const f = rowStrategyFlags(r);
            const hasStrategy =
              !rowGrayed(r) && (f.profit || f.speed || f.balance);
            return (
              <div
                key={r.plan.id}
                className={`rounded-xl border px-4 py-4 ${
                  rowGrayed(r)
                    ? "border-white/5 bg-black/[0.12] opacity-[0.42]"
                    : hasStrategy
                      ? "border-white/15"
                      : "border-white/10 bg-black/20"
                }`}
                style={
                  !rowGrayed(r) ? strategyRowHighlightStyle(f) : undefined
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-100">{r.plan.name}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                      申告価格 {r.plan.declaredValueLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                     鑑定料 {yen.format(r.plan.fee)} ・ 約
                      {r.plan.turnaroundDays}営業日
                    </p>
                  </div>
                  <StrategyBadges
                    flags={f}
                    className="shrink-0 flex-row flex-wrap items-center justify-end"
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500">想定利益</p>
                    <p
                      className={`mt-0.5 font-semibold tabular-nums ${
                        r.profit === null
                          ? "text-zinc-500"
                          : r.profit.profit >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                      }`}
                    >
                      {r.profit === null ? "—" : yen.format(r.profit.profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">日次利益</p>
                    <p
                      className={`mt-0.5 font-semibold tabular-nums ${
                        r.profit === null
                          ? "text-zinc-500"
                          : r.profit.profit >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                      }`}
                    >
                      {formatDailyProfit(
                        r.profit?.profit ?? null,
                        r.plan.turnaroundDays,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">日利効率</p>
                    <p
                      className={`mt-0.5 font-semibold tabular-nums ${
                        r.profit === null
                          ? "text-zinc-500"
                          : r.profit.profit >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                      }`}
                    >
                      {formatDailyEfficiency(
                        r.profit?.profit ?? null,
                        r.profit?.totalCost ?? null,
                        r.plan.turnaroundDays,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">粗利率</p>
                    <p className="mt-0.5 font-medium tabular-nums text-zinc-200">
                      {r.profit?.marginPercent === undefined ||
                      r.profit?.marginPercent === null
                        ? "—"
                        : `${pctFormat(r.profit.marginPercent)}%`}
                    </p>
                  </div>
                </div>
                {r.timeline && shipDate && oneWayShippingBusinessDays !== null ? (
                  <div className="mt-3 border-t border-white/10 pt-3 text-[11px] text-zinc-400">
                    <p>
                      返却（短）{" "}
                      <span className="text-zinc-200">
                        {formatDateShortJa(r.timeline.returnEarliest)}
                      </span>
                    </p>
                    <p className="mt-1">
                      返却（長）{" "}
                      <span className="text-zinc-200">
                        {formatDateShortJa(r.timeline.returnLatest)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-zinc-500">
                    発送日と片道配送日数を入れると返却目安が表示されます。
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* デスクトップ: 表 */}
        <div className="mt-6 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-zinc-500">
                <th className="sticky left-0 z-10 min-w-[220px] bg-zinc-950/95 py-3 pr-4 font-medium backdrop-blur-sm">
                  プラン
                </th>
                <th className="whitespace-nowrap py-3 pr-4 font-medium">
                  鑑定料
                </th>
                <th className="whitespace-nowrap py-3 pr-4 font-medium">
                  所要営業日
                </th>
                <th className="whitespace-nowrap py-3 pr-4 font-medium">
                  想定利益
                </th>
                <th
                  className="whitespace-nowrap py-3 pr-4 font-medium"
                  title="想定利益÷所要営業日（納期）"
                >
                  日次利益
                </th>
                <th
                  className="whitespace-nowrap py-3 pr-4 font-medium"
                  title="（想定利益 ÷（仕入れ額 + その他費用 + 鑑定料））÷ 所要営業日"
                >
                  日利効率
                </th>
                <th className="whitespace-nowrap py-3 pr-4 font-medium">
                  粗利率
                </th>
                <th className="whitespace-nowrap py-3 pr-4 font-medium">
                  返却（最短）
                </th>
                <th className="whitespace-nowrap py-3 pr-4 font-medium">
                  返却（最長）
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const f = rowStrategyFlags(r);
                const hasStrategy =
                  !rowGrayed(r) && (f.profit || f.speed || f.balance);
                return (
                  <tr
                    key={r.plan.id}
                    className={`border-b border-white/5 ${
                      rowGrayed(r) ? "opacity-[0.42]" : ""
                    }`}
                    style={
                      !rowGrayed(r) ? strategyRowHighlightStyle(f) : undefined
                    }
                  >
                  <td
                    className={`sticky left-0 z-10 min-w-[220px] pl-2 py-3 pr-4 font-medium backdrop-blur-sm ${
                      rowGrayed(r)
                        ? "border-white/5 bg-zinc-950/90"
                        : hasStrategy
                          ? "border-white/10 !bg-transparent"
                          : "bg-zinc-950/90"
                    }`}
                    style={
                      !rowGrayed(r) ? strategyRowHighlightStyle(f) : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 pr-2">
                        <span className="block text-zinc-100">{r.plan.name}</span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500">
                          申告価格 {r.plan.declaredValueLabel}
                        </span>
                      </div>
                      <StrategyBadges
                        flags={f}
                        className="shrink-0 flex-col items-end justify-start"
                      />
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-zinc-300">
                    {yen.format(r.plan.fee)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-zinc-400">
                    {r.plan.turnaroundDays}
                  </td>
                  <td
                    className={`whitespace-nowrap py-3 pr-4 font-semibold tabular-nums ${
                      r.profit === null
                        ? "text-zinc-500"
                        : r.profit.profit >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                    }`}
                  >
                    {r.profit === null ? "—" : yen.format(r.profit.profit)}
                  </td>
                  <td
                    className={`whitespace-nowrap py-3 pr-4 font-semibold tabular-nums ${
                      r.profit === null
                        ? "text-zinc-500"
                        : r.profit.profit >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                    }`}
                  >
                    {formatDailyProfit(
                      r.profit?.profit ?? null,
                      r.plan.turnaroundDays,
                    )}
                  </td>
                  <td
                    className={`whitespace-nowrap py-3 pr-4 font-semibold tabular-nums ${
                      r.profit === null
                        ? "text-zinc-500"
                        : r.profit.profit >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                    }`}
                  >
                    {formatDailyEfficiency(
                      r.profit?.profit ?? null,
                      r.profit?.totalCost ?? null,
                      r.plan.turnaroundDays,
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-zinc-300">
                    {r.profit === null || r.profit.marginPercent === null
                      ? "—"
                      : `${pctFormat(r.profit.marginPercent)}%`}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-zinc-300">
                    {r.timeline
                      ? formatDateShortJa(r.timeline.returnEarliest)
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-zinc-300">
                    {r.timeline
                      ? formatDateShortJa(r.timeline.returnLatest)
                      : "—"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-12 text-center text-[11px] leading-relaxed text-zinc-600">
        表示はあくまでシミュレーションです。あらかじめご了承ください。
      </footer>
    </div>
  );
}
