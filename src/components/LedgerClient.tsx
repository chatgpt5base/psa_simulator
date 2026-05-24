"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ExpenseEntry = {
  id: string;
  date: string;
  item: string;
  category: string;
  amount: number;
  paymentMethod: string;
  note: string;
};

type SaleEntry = {
  id: string;
  date: string;
  item: string;
  channel: string;
  quantity: number;
  revenue: number;
  fee: number;
  shipping: number;
  cost: number;
  note: string;
};

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const pct = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
});

const STORAGE_EXPENSES = "psa-ledger-expenses-v1";
const STORAGE_SALES = "psa-ledger-sales-v1";

function parseNumber(v: string): number {
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function monthKeyFromDate(date: string): string {
  // date input is "YYYY-MM-DD", fallback keeps first 7 chars.
  return date.slice(0, 7);
}

function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LedgerClient({
  mode,
}: {
  mode: "purchase" | "sales";
}) {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [excelPickerOpen, setExcelPickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [excelMonths, setExcelMonths] = useState<string[]>(["all"]);

  const [expenseForm, setExpenseForm] = useState({
    date: "",
    item: "",
    category: "仕入れ",
    quantity: "1",
    amount: "",
    paymentMethod: "",
    note: "",
  });

  const [saleForm, setSaleForm] = useState({
    date: "",
    item: "",
    channel: "",
    quantity: "1",
    revenue: "",
    fee: "",
    shipping: "",
    cost: "",
    note: "",
  });

  useEffect(() => {
    const rawExpenses = localStorage.getItem(STORAGE_EXPENSES);
    const rawSales = localStorage.getItem(STORAGE_SALES);
    if (rawExpenses) {
      try {
        setExpenses(JSON.parse(rawExpenses) as ExpenseEntry[]);
      } catch {}
    }
    if (rawSales) {
      try {
        setSales(JSON.parse(rawSales) as SaleEntry[]);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_EXPENSES, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_SALES, JSON.stringify(sales));
  }, [sales]);

  const totals = useMemo(() => {
    const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const revenueTotal = sales.reduce((sum, s) => sum + s.revenue, 0);
    const feeTotal = sales.reduce((sum, s) => sum + s.fee + s.shipping, 0);
    const costTotal = sales.reduce((sum, s) => sum + s.cost, 0);
    const profit = revenueTotal - feeTotal - costTotal;
    return { expenseTotal, revenueTotal, feeTotal, costTotal, profit };
  }, [expenses, sales]);

  function addExpense() {
    if (!expenseForm.date || !expenseForm.item || !expenseForm.amount) return;
    const quantity = Math.max(1, Math.floor(parseNumber(expenseForm.quantity)));
    if (editingExpenseId) {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === editingExpenseId
            ? {
                ...e,
                date: expenseForm.date,
                item: expenseForm.item,
                category: expenseForm.category,
                amount: parseNumber(expenseForm.amount),
                paymentMethod: expenseForm.paymentMethod,
                note: expenseForm.note,
              }
            : e,
        ),
      );
      setEditingExpenseId(null);
    } else {
      const nextEntries: ExpenseEntry[] = Array.from({ length: quantity }, () => ({
        id: uid(),
        date: expenseForm.date,
        item: expenseForm.item,
        category: expenseForm.category,
        amount: parseNumber(expenseForm.amount),
        paymentMethod: expenseForm.paymentMethod,
        note: expenseForm.note,
      }));
      setExpenses((prev) => [...nextEntries, ...prev]);
    }
    setExpenseForm({
      date: "",
      item: "",
      category: "仕入れ",
      quantity: "1",
      amount: "",
      paymentMethod: "",
      note: "",
    });
  }

  function editExpense(expense: ExpenseEntry) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      date: expense.date,
      item: expense.item,
      category: expense.category,
      quantity: "1",
      amount: String(expense.amount),
      paymentMethod: expense.paymentMethod,
      note: expense.note,
    });
  }

  function deleteExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setSelectedExpenseIds((prev) => prev.filter((x) => x !== id));
    if (editingExpenseId === id) {
      setEditingExpenseId(null);
      setExpenseForm({
        date: "",
        item: "",
        category: "仕入れ",
        quantity: "1",
        amount: "",
        paymentMethod: "",
        note: "",
      });
    }
  }

  function toggleExpenseSelection(id: string) {
    setSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAllExpenses() {
    if (
      filteredExpenses.length > 0 &&
      filteredExpenses.every((e) => selectedExpenseIds.includes(e.id))
    ) {
      setSelectedExpenseIds([]);
      return;
    }
    setSelectedExpenseIds(filteredExpenses.map((e) => e.id));
  }

  function deleteSelectedExpenses() {
    if (selectedExpenseIds.length === 0) return;
    const selectedSet = new Set(selectedExpenseIds);
    setExpenses((prev) => prev.filter((e) => !selectedSet.has(e.id)));
    if (editingExpenseId && selectedSet.has(editingExpenseId)) {
      setEditingExpenseId(null);
      setExpenseForm({
        date: "",
        item: "",
        category: "仕入れ",
        quantity: "1",
        amount: "",
        paymentMethod: "",
        note: "",
      });
    }
    setSelectedExpenseIds([]);
  }

  function addSale() {
    if (!saleForm.date || !saleForm.item || !saleForm.revenue) return;
    const next: SaleEntry = {
      id: uid(),
      date: saleForm.date,
      item: saleForm.item,
      channel: saleForm.channel,
      quantity: Math.max(1, Math.floor(parseNumber(saleForm.quantity))),
      revenue: parseNumber(saleForm.revenue),
      fee: parseNumber(saleForm.fee),
      shipping: parseNumber(saleForm.shipping),
      cost: parseNumber(saleForm.cost),
      note: saleForm.note,
    };
    setSales((prev) => [next, ...prev]);
    setSaleForm({
      date: "",
      item: "",
      channel: "",
      quantity: "1",
      revenue: "",
      fee: "",
      shipping: "",
      cost: "",
      note: "",
    });
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-200/40";

  const expenseSuggestions = useMemo(
    () => ({
      categories: Array.from(new Set(expenses.map((e) => e.category))).filter(
        Boolean,
      ),
      items: Array.from(new Set(expenses.map((e) => e.item))).filter(Boolean),
      paymentMethods: Array.from(
        new Set(expenses.map((e) => e.paymentMethod)),
      ).filter(Boolean),
      notes: Array.from(new Set(expenses.map((e) => e.note))).filter(Boolean),
    }),
    [expenses],
  );

  const salesSuggestions = useMemo(
    () => ({
      channels: Array.from(new Set(sales.map((s) => s.channel))).filter(Boolean),
      items: Array.from(new Set(sales.map((s) => s.item))).filter(Boolean),
      notes: Array.from(new Set(sales.map((s) => s.note))).filter(Boolean),
    }),
    [sales],
  );

  const monthOptions = useMemo(() => {
    const src = mode === "purchase" ? expenses : sales;
    return Array.from(new Set(src.map((x) => monthKeyFromDate(x.date))))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
  }, [mode, expenses, sales]);

  const filteredExpenses = useMemo(
    () =>
      selectedMonth === "all"
        ? expenses
        : expenses.filter((e) => monthKeyFromDate(e.date) === selectedMonth),
    [expenses, selectedMonth],
  );

  const filteredSales = useMemo(
    () =>
      selectedMonth === "all"
        ? sales
        : sales.filter((s) => monthKeyFromDate(s.date) === selectedMonth),
    [sales, selectedMonth],
  );

  useEffect(() => {
    if (excelMonths.includes("all")) return;
    const valid = excelMonths.filter((m) => monthOptions.includes(m));
    if (valid.length === 0) {
      setExcelMonths(["all"]);
      return;
    }
    if (
      valid.length === excelMonths.length &&
      valid.every((m, i) => m === excelMonths[i])
    ) {
      return;
    }
    setExcelMonths(valid);
  }, [monthOptions, excelMonths]);

  const exportAllMonths = excelMonths.includes("all");

  function toggleExcelAll(checked: boolean) {
    setExcelMonths(checked ? ["all"] : []);
  }

  function toggleExcelMonth(month: string, checked: boolean) {
    setExcelMonths((prev) => {
      const base = prev.filter((m) => m !== "all");
      const next = checked ? [...base, month] : base.filter((m) => m !== month);
      return next.length === 0 ? ["all"] : Array.from(new Set(next));
    });
  }

  function exportExpensesCsv() {
    const rows = [
      ["日付", "勘定科目", "品名", "金額", "支払い方法", "備考"],
      ...expenses.map((e) => [
        e.date,
        e.category,
        e.item,
        String(e.amount),
        e.paymentMethod,
        e.note,
      ]),
    ];
    downloadCsv(`expenses-${todayStamp()}.csv`, rows);
  }

  function exportSalesCsv() {
    const rows = [
      ["売却日", "販路", "品名", "数量", "入金額", "手数料", "送料", "原価", "利益", "利益率", "備考"],
      ...sales.map((s) => {
        const totalCost = s.cost + s.fee + s.shipping;
        const profit = s.revenue - totalCost;
        const margin = s.revenue > 0 ? (profit / s.revenue) * 100 : null;
        return [
          s.date,
          s.channel,
          s.item,
          String(s.quantity),
          String(s.revenue),
          String(s.fee),
          String(s.shipping),
          String(s.cost),
          String(profit),
          margin === null ? "" : margin.toFixed(2),
          s.note,
        ];
      }),
    ];
    downloadCsv(`sales-${todayStamp()}.csv`, rows);
  }

  function exportExcel() {
    const expenseExport = exportAllMonths
      ? expenses
      : expenses.filter((e) => excelMonths.includes(monthKeyFromDate(e.date)));
    const salesExport = exportAllMonths
      ? sales
      : sales.filter((s) => excelMonths.includes(monthKeyFromDate(s.date)));

    const wb = XLSX.utils.book_new();
    const expenseSheet = XLSX.utils.json_to_sheet(
      expenseExport.map((e) => ({
        日付: e.date,
        勘定科目: e.category,
        品名: e.item,
        金額: e.amount,
        支払い方法: e.paymentMethod,
        備考: e.note,
      })),
    );
    const salesSheet = XLSX.utils.json_to_sheet(
      salesExport.map((s) => {
        const totalCost = s.cost + s.fee + s.shipping;
        const profit = s.revenue - totalCost;
        const margin = s.revenue > 0 ? (profit / s.revenue) * 100 : null;
        return {
          売却日: s.date,
          販路: s.channel,
          品名: s.item,
          数量: s.quantity,
          入金額: s.revenue,
          手数料: s.fee,
          送料: s.shipping,
          原価: s.cost,
          利益: profit,
          利益率: margin === null ? "" : Number(margin.toFixed(2)),
          備考: s.note,
        };
      }),
    );
    XLSX.utils.book_append_sheet(wb, expenseSheet, "仕入れ");
    XLSX.utils.book_append_sheet(wb, salesSheet, "売上");
    XLSX.writeFile(wb, `ledger-${todayStamp()}.xlsx`);
    setExcelPickerOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
            支出・売上管理
            <span className="ml-2 hidden text-base font-normal text-zinc-400 md:inline">
              （ベータ版）
            </span>
          </h1>
          <button
            type="button"
            aria-label="メニューを開く"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="rounded-lg border border-white/15 p-2 text-zinc-300 hover:border-white/30 hover:text-zinc-100 md:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          </button>
          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/ledger/purchase"
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                mode === "purchase"
                  ? "border-amber-300/50 bg-amber-300/10 text-amber-100"
                  : "border-white/15 text-zinc-300 hover:border-white/30"
              }`}
            >
              仕入れ
            </Link>
            <Link
              href="/ledger/sales"
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                mode === "sales"
                  ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-100"
                  : "border-white/15 text-zinc-300 hover:border-white/30"
              }`}
            >
              売上
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExcelPickerOpen((v) => !v)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-300/40 hover:text-emerald-200"
              >
                Excel出力
              </button>
              {excelPickerOpen && (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-white/15 bg-zinc-900/95 p-3 text-xs shadow-xl backdrop-blur">
                  <p className="mb-2 text-zinc-300">出力対象の年月</p>
                  <label className="mb-1 flex items-center gap-2 text-zinc-200">
                    <input
                      type="checkbox"
                      checked={exportAllMonths}
                      onChange={(e) => toggleExcelAll(e.target.checked)}
                    />
                    すべて
                  </label>
                  <div className="max-h-40 overflow-y-auto pr-1">
                    {monthOptions.map((m) => (
                      <label
                        key={m}
                        className="mb-1 flex items-center gap-2 text-zinc-300"
                      >
                        <input
                          type="checkbox"
                          checked={exportAllMonths || excelMonths.includes(m)}
                          onChange={(e) => toggleExcelMonth(m, e.target.checked)}
                          disabled={exportAllMonths}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={exportExcel}
                    className="mt-2 w-full rounded bg-emerald-300 px-2 py-1.5 text-zinc-900"
                  >
                    出力する
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={mode === "purchase" ? exportExpensesCsv : exportSalesCsv}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:border-sky-300/40 hover:text-sky-200"
            >
              {mode === "purchase" ? "仕入れCSV" : "売上CSV"}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:border-amber-200/30 hover:text-amber-100"
            >
              シミュレーターへ戻る
            </Link>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mt-3 rounded-xl border border-white/10 bg-[#121212] p-4 md:hidden">
            <p className="mb-3 text-xs text-zinc-400">（ベータ版）</p>
            <div className="flex flex-col gap-2">
              <Link
                href="/ledger/purchase"
                onClick={() => setMobileMenuOpen(false)}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  mode === "purchase"
                    ? "border-amber-300/50 bg-amber-300/10 text-amber-100"
                    : "border-white/15 text-zinc-300"
                }`}
              >
                仕入れ
              </Link>
              <Link
                href="/ledger/sales"
                onClick={() => setMobileMenuOpen(false)}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  mode === "sales"
                    ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-100"
                    : "border-white/15 text-zinc-300"
                }`}
              >
                売上
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExcelPickerOpen((v) => !v)}
                  className="w-full rounded-lg border border-white/15 px-3 py-2 text-left text-xs text-zinc-300"
                >
                  Excel出力
                </button>
                {excelPickerOpen && (
                  <div className="mt-2 rounded-lg border border-white/15 bg-zinc-900/95 p-3 text-xs">
                    <p className="mb-2 text-zinc-300">出力対象の年月</p>
                    <label className="mb-1 flex items-center gap-2 text-zinc-200">
                      <input
                        type="checkbox"
                        checked={exportAllMonths}
                        onChange={(e) => toggleExcelAll(e.target.checked)}
                      />
                      すべて
                    </label>
                    <div className="max-h-40 overflow-y-auto pr-1">
                      {monthOptions.map((m) => (
                        <label
                          key={m}
                          className="mb-1 flex items-center gap-2 text-zinc-300"
                        >
                          <input
                            type="checkbox"
                            checked={exportAllMonths || excelMonths.includes(m)}
                            onChange={(e) =>
                              toggleExcelMonth(m, e.target.checked)
                            }
                            disabled={exportAllMonths}
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportExcel();
                        setMobileMenuOpen(false);
                      }}
                      className="mt-2 w-full rounded bg-emerald-300 px-2 py-1.5 text-zinc-900"
                    >
                      出力する
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (mode === "purchase") exportExpensesCsv();
                  else exportSalesCsv();
                  setMobileMenuOpen(false);
                }}
                className="rounded-lg border border-white/15 px-3 py-2 text-left text-xs text-zinc-300"
              >
                {mode === "purchase" ? "仕入れCSV" : "売上CSV"}
              </button>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300"
              >
                シミュレーターへ戻る
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="支出合計" value={yen.format(totals.expenseTotal)} />
        <StatCard label="売上合計" value={yen.format(totals.revenueTotal)} />
        <StatCard label="手数料+送料" value={yen.format(totals.feeTotal)} />
        <StatCard label="原価合計" value={yen.format(totals.costTotal)} />
        <StatCard
          label="販売損益"
          value={yen.format(totals.profit)}
          positive={totals.profit >= 0}
        />
      </div>

      <div className="grid gap-6">
        <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${mode === "purchase" ? "" : "hidden"}`}>
          <h2 className="text-sm font-semibold text-zinc-200">支出登録</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="日付">
              <input
                type="date"
                className={inputClass}
                value={expenseForm.date}
                onChange={(e) =>
                  setExpenseForm((v) => ({ ...v, date: e.target.value }))
                }
              />
            </Field>
            <Field label="勘定科目">
              <input
                className={inputClass}
                placeholder="仕入れ / 鑑定経費 / 送料 など"
                list="expense-category-suggestions"
                value={expenseForm.category}
                onChange={(e) =>
                  setExpenseForm((v) => ({ ...v, category: e.target.value }))
                }
              />
            </Field>
            <Field label="品名">
              <input
                className={inputClass}
                list="expense-item-suggestions"
                value={expenseForm.item}
                onChange={(e) =>
                  setExpenseForm((v) => ({ ...v, item: e.target.value }))
                }
              />
            </Field>
            <Field label="枚数">
              <input
                inputMode="numeric"
                className={inputClass}
                value={expenseForm.quantity}
                onChange={(e) =>
                  setExpenseForm((v) => ({ ...v, quantity: e.target.value }))
                }
              />
            </Field>
            <Field label="金額">
              <input
                inputMode="numeric"
                className={inputClass}
                value={expenseForm.amount}
                onChange={(e) =>
                  setExpenseForm((v) => ({ ...v, amount: e.target.value }))
                }
              />
            </Field>
            <Field label="支払い方法">
              <input
                className={inputClass}
                list="expense-payment-suggestions"
                value={expenseForm.paymentMethod}
                onChange={(e) =>
                  setExpenseForm((v) => ({
                    ...v,
                    paymentMethod: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="備考">
              <input
                className={inputClass}
                list="expense-note-suggestions"
                value={expenseForm.note}
                onChange={(e) =>
                  setExpenseForm((v) => ({ ...v, note: e.target.value }))
                }
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={addExpense}
            className="mt-4 rounded-lg bg-amber-300 px-4 py-2 text-sm font-medium text-zinc-900"
          >
            {editingExpenseId ? "支出を更新" : "支出を追加"}
          </button>
          <button
            type="button"
            onClick={deleteSelectedExpenses}
            disabled={selectedExpenseIds.length === 0}
            className="ml-2 mt-4 rounded-lg border border-rose-300/30 px-4 py-2 text-sm text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            選択削除（{selectedExpenseIds.length}）
          </button>
          {editingExpenseId && (
            <button
              type="button"
              onClick={() => {
                setEditingExpenseId(null);
                setExpenseForm({
                  date: "",
                  item: "",
                  category: "仕入れ",
                  quantity: "1",
                  amount: "",
                  paymentMethod: "",
                  note: "",
                });
              }}
              className="ml-2 mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300"
            >
              キャンセル
            </button>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-400">支出リスト</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400" htmlFor="month-filter">
                月フィルター
              </label>
              <select
                id="month-filter"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-100"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">すべて</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="w-8 py-2">
                    <input
                      type="checkbox"
                      checked={
                        filteredExpenses.length > 0 &&
                        filteredExpenses.every((e) =>
                          selectedExpenseIds.includes(e.id),
                        )
                      }
                      onChange={toggleSelectAllExpenses}
                      aria-label="全選択"
                    />
                  </th>
                  <th className="py-2">日付</th>
                  <th className="py-2">勘定科目</th>
                  <th className="py-2">品名</th>
                  <th className="py-2">金額</th>
                  <th className="py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="border-t border-white/5 text-zinc-200">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={selectedExpenseIds.includes(e.id)}
                        onChange={() => toggleExpenseSelection(e.id)}
                        aria-label="行選択"
                      />
                    </td>
                    <td className="py-2">{e.date}</td>
                    <td className="py-2">{e.category}</td>
                    <td className="py-2">{e.item}</td>
                    <td className="py-2 tabular-nums">{yen.format(e.amount)}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => editExpense(e)}
                          className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-amber-300/40 hover:text-amber-100"
                          title="編集"
                          aria-label="編集"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExpense(e.id)}
                          className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-rose-300/40 hover:text-rose-200"
                          title="削除"
                          aria-label="削除"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="expense-category-suggestions">
            {expenseSuggestions.categories.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="expense-item-suggestions">
            {expenseSuggestions.items.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="expense-payment-suggestions">
            {expenseSuggestions.paymentMethods.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="expense-note-suggestions">
            {expenseSuggestions.notes.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </section>

        <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${mode === "sales" ? "" : "hidden"}`}>
          <h2 className="text-sm font-semibold text-zinc-200">販売登録</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="売却日">
              <input
                type="date"
                className={inputClass}
                value={saleForm.date}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, date: e.target.value }))
                }
              />
            </Field>
            <Field label="販路">
              <input
                className={inputClass}
                list="sales-channel-suggestions"
                value={saleForm.channel}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, channel: e.target.value }))
                }
              />
            </Field>
            <Field label="品名">
              <input
                className={inputClass}
                list="sales-item-suggestions"
                value={saleForm.item}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, item: e.target.value }))
                }
              />
            </Field>
            <Field label="数量">
              <input
                inputMode="numeric"
                className={inputClass}
                value={saleForm.quantity}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, quantity: e.target.value }))
                }
              />
            </Field>
            <Field label="入金額">
              <input
                inputMode="numeric"
                className={inputClass}
                value={saleForm.revenue}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, revenue: e.target.value }))
                }
              />
            </Field>
            <Field label="手数料">
              <input
                inputMode="numeric"
                className={inputClass}
                value={saleForm.fee}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, fee: e.target.value }))
                }
              />
            </Field>
            <Field label="送料">
              <input
                inputMode="numeric"
                className={inputClass}
                value={saleForm.shipping}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, shipping: e.target.value }))
                }
              />
            </Field>
            <Field label="原価">
              <input
                inputMode="numeric"
                className={inputClass}
                value={saleForm.cost}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, cost: e.target.value }))
                }
              />
            </Field>
            <Field label="備考">
              <input
                className={inputClass}
                list="sales-note-suggestions"
                value={saleForm.note}
                onChange={(e) =>
                  setSaleForm((v) => ({ ...v, note: e.target.value }))
                }
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={addSale}
            className="mt-4 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-medium text-zinc-900"
          >
            販売を追加
          </button>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2">売却日</th>
                  <th className="py-2">品名</th>
                  <th className="py-2">入金額</th>
                  <th className="py-2">費用合計</th>
                  <th className="py-2">利益</th>
                  <th className="py-2">利益率</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((s) => {
                  const totalCost = s.cost + s.fee + s.shipping;
                  const profit = s.revenue - totalCost;
                  const margin = s.revenue > 0 ? (profit / s.revenue) * 100 : null;
                  return (
                    <tr key={s.id} className="border-t border-white/5 text-zinc-200">
                      <td className="py-2">{s.date}</td>
                      <td className="py-2">{s.item}</td>
                      <td className="py-2 tabular-nums">{yen.format(s.revenue)}</td>
                      <td className="py-2 tabular-nums">{yen.format(totalCost)}</td>
                      <td
                        className={`py-2 tabular-nums ${
                          profit >= 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {yen.format(profit)}
                      </td>
                      <td className="py-2 tabular-nums">
                        {margin === null ? "—" : `${pct.format(margin)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <datalist id="sales-channel-suggestions">
            {salesSuggestions.channels.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="sales-item-suggestions">
            {salesSuggestions.items.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="sales-note-suggestions">
            {salesSuggestions.notes.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold tabular-nums ${
          positive === undefined
            ? "text-zinc-100"
            : positive
              ? "text-emerald-300"
              : "text-rose-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs text-zinc-400">
      {label}
      {children}
    </label>
  );
}
