export type GradingPlan = {
  id: string;
  name: string;
  fee: number;
  turnaroundDays: number;
};

/**
 * PSA鑑定プラン（料金・納期は運用に合わせて編集してください）
 */
export const gradingPlans: GradingPlan[] = [
  { id: "value-bulk", name: "バリュー・バルク", fee: 3980, turnaroundDays: 120 },
  { id: "value", name: "バリュー", fee: 4980, turnaroundDays: 90 },
  { id: "value-plus", name: "バリュー・プラス", fee: 7980, turnaroundDays: 60 },
  { id: "value-max", name: "バリュー・マックス", fee: 8980, turnaroundDays: 40 },
  { id: "regular", name: "レギュラー", fee: 11980, turnaroundDays: 30 },
  { id: "express", name: "エクスプレス", fee: 22980, turnaroundDays: 25 },
  { id: "super-express", name: "スーパー・エクスプレス", fee: 44980, turnaroundDays: 25 },
];

export function getPlanById(id: string): GradingPlan | undefined {
  return gradingPlans.find((p) => p.id === id);
}
