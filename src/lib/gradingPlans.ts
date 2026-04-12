export type GradingPlan = {
  id: string;
  name: string;
  /** 申告価格の表示用（サービスレベル改定表に準拠） */
  declaredValueLabel: string;
  /**
   * 申告価格の上限（円）。「¥X以下」の X。
   * null は上限なし（プレミアム10の「¥…以上」など）。
   */
  maxDeclaredValueYen: number | null;
  fee: number;
  turnaroundDays: number;
};

/** PSA10想定販売額が当該プランの申告上限を超えるか（入力が無効・空のときは false） */
export function exceedsDeclaredValueMax(
  saleYen: number | null,
  plan: GradingPlan,
): boolean {
  if (saleYen === null) return false;
  const max = plan.maxDeclaredValueYen;
  if (max === null) return false;
  return saleYen > max;
}

/**
 * PSA鑑定プラン（料金・納期・申告価格は運用に合わせて編集してください）
 */
export const gradingPlans: GradingPlan[] = [
  {
    id: "value-bulk",
    name: "バリュー・バルク",
    declaredValueLabel: "¥80,000以下",
    maxDeclaredValueYen: 80_000,
    fee: 3980,
    turnaroundDays: 120,
  },
  {
    id: "value",
    name: "バリュー",
    declaredValueLabel: "¥80,000以下",
    maxDeclaredValueYen: 80_000,
    fee: 4980,
    turnaroundDays: 90,
  },
  {
    id: "value-plus",
    name: "バリュー・プラス",
    declaredValueLabel: "¥80,000以下",
    maxDeclaredValueYen: 80_000,
    fee: 7980,
    turnaroundDays: 60,
  },
  {
    id: "value-max",
    name: "バリュー・マックス",
    declaredValueLabel: "¥150,000以下",
    maxDeclaredValueYen: 150_000,
    fee: 8980,
    turnaroundDays: 40,
  },
  {
    id: "regular",
    name: "レギュラー",
    declaredValueLabel: "¥250,000以下",
    maxDeclaredValueYen: 250_000,
    fee: 11980,
    turnaroundDays: 30,
  },
  {
    id: "express",
    name: "エクスプレス",
    declaredValueLabel: "¥400,000以下",
    maxDeclaredValueYen: 400_000,
    fee: 22980,
    turnaroundDays: 25,
  },
  {
    id: "super-express",
    name: "スーパー・エクスプレス",
    declaredValueLabel: "¥750,000以下",
    maxDeclaredValueYen: 750_000,
    fee: 44980,
    turnaroundDays: 25,
  },
  {
    id: "walk-through",
    name: "ウォーク・スルー",
    declaredValueLabel: "¥1,500,000以下",
    maxDeclaredValueYen: 1_500_000,
    fee: 89980,
    turnaroundDays: 25,
  },
  {
    id: "premium-1",
    name: "プレミアム1",
    declaredValueLabel: "¥4,000,000以下",
    maxDeclaredValueYen: 4_000_000,
    fee: 149980,
    turnaroundDays: 25,
  },
  {
    id: "premium-2",
    name: "プレミアム2",
    declaredValueLabel: "¥8,000,000以下",
    maxDeclaredValueYen: 8_000_000,
    fee: 299980,
    turnaroundDays: 25,
  },
  {
    id: "premium-3",
    name: "プレミアム3",
    declaredValueLabel: "¥15,000,000以下",
    maxDeclaredValueYen: 15_000_000,
    fee: 449980,
    turnaroundDays: 25,
  },
  {
    id: "premium-5",
    name: "プレミアム5",
    declaredValueLabel: "¥35,000,000以下",
    maxDeclaredValueYen: 35_000_000,
    fee: 749980,
    turnaroundDays: 25,
  },
  {
    id: "premium-10",
    name: "プレミアム10",
    declaredValueLabel: "¥35,000,001以上",
    maxDeclaredValueYen: null,
    fee: 1499980,
    turnaroundDays: 15,
  },
];

export function getPlanById(id: string): GradingPlan | undefined {
  return gradingPlans.find((p) => p.id === id);
}
