"use client";
// Figma 15 · 브랜드·상품: 브랜드 프로필 · 상품 목록 · 상품 세부 정보
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, won } from "@/components/events/api";
import { Button, ErrorBox, Field, Spinner, inputCls } from "@/components/events/ui";

type Store = { name: string; category: string; intro: string; tone: string; target_customer: string; sales_channel: string; region: string; monthly_budget: number };
type Product = { id: string; name: string; sku: string; price: number; stock: number; url: string; selling_point: string; cost: number };
type Draft = Omit<Product, "id">;

const EMPTY: Draft = { name: "", sku: "", price: 0, stock: 0, url: "", selling_point: "", cost: 0 };

function Panel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-black">{title}</h2>{right}</div>
      {children}
    </section>
  );
}

function Saved({ show }: { show: boolean }) {
  return show ? <span className="text-sm font-medium text-emerald-600">저장됨 ✓</span> : null;
}

export default function BrandPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [storeSaved, setStoreSaved] = useState(false);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [prodSaved, setProdSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = () => api<Product[]>("/api/products").then((l) => { setProducts(l); return l; });

  useEffect(() => {
    api<{ store: Store }>("/api/stores/me").then((r) => setStore(r.store)).catch((e) => setError(e.message));
    loadProducts().then((l) => { if (l[0]) pick(l[0]); else pick("new"); }).catch((e) => setError(e.message));
  }, []);

  const pick = (p: Product | "new") => {
    setProdSaved(false);
    setError("");
    if (p === "new") { setSelected("new"); setDraft(EMPTY); return; }
    setSelected(p.id);
    const { id: _id, ...rest } = p; // eslint-disable-line @typescript-eslint/no-unused-vars
    setDraft({ ...EMPTY, ...rest });
  };

  const saveStore = async () => {
    if (!store) return;
    setBusy(true); setError("");
    try {
      const r = await api<{ store: Store }>("/api/stores/me", { method: "PATCH", json: store });
      setStore(r.store); setStoreSaved(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const saveProduct = async () => {
    if (!draft.name.trim()) { setError("상품명을 입력해 주세요."); return; }
    setBusy(true); setError("");
    try {
      const saved = selected === "new" || !selected
        ? await api<Product>("/api/products", { method: "POST", json: draft })
        : await api<Product>(`/api/products/${selected}`, { method: "PATCH", json: draft });
      await loadProducts();
      setSelected(saved.id);
      setProdSaved(true);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const removeProduct = async () => {
    if (!selected || selected === "new" || !confirm("이 상품을 삭제할까요?")) return;
    setBusy(true);
    try {
      await api(`/api/products/${selected}`, { method: "DELETE" });
      const l = await loadProducts();
      if (l[0]) pick(l[0]); else pick("new");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const setS = (k: keyof Store, v: string) => { setStoreSaved(false); setStore((s) => (s ? { ...s, [k]: v } : s)); };
  const setD = (k: keyof Draft, v: string | number) => { setProdSaved(false); setDraft((d) => ({ ...d, [k]: v })); };
  const num = (v: string) => Math.max(0, Math.floor(Number(v.replace(/[^\d]/g, "")) || 0));

  return (
    <div className="mx-auto max-w-[1128px]">
      <Link href="/settings" className="text-sm text-[#55545e] hover:underline">〈 설정</Link>
      <h1 className="mt-2 text-3xl font-bold text-black">브랜드·상품</h1>
      <p className="mt-2 text-base text-[#55545e]">행사와 홍보에 사용하는 브랜드 정보와 상품이에요.</p>
      <button onClick={() => pick("new")} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[#6d53f1] px-4 text-sm font-semibold text-white">
        <span className="text-xl leading-none">＋</span> 상품 추가
      </button>
      {error && <div className="mt-4"><ErrorBox message={error} /></div>}
      {(!store || !products) && !error && <Spinner text="불러오는 중" />}

      {store && products && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Panel title="브랜드 프로필" right={<Saved show={storeSaved} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="브랜드명" required><input className={inputCls} value={store.name} onChange={(e) => setS("name", e.target.value)} /></Field>
                <Field label="업종" required><input className={inputCls} value={store.category} onChange={(e) => setS("category", e.target.value)} /></Field>
              </div>
              <Field label="소개"><input className={inputCls} value={store.intro} onChange={(e) => setS("intro", e.target.value)} placeholder="예: 일상 기록용 문구" /></Field>
              <Field label="말투"><input className={inputCls} value={store.tone} onChange={(e) => setS("tone", e.target.value)} placeholder="예: 차분하고 다정하게" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="고객"><input className={inputCls} value={store.target_customer} onChange={(e) => setS("target_customer", e.target.value)} placeholder="예: 기록 취미 고객" /></Field>
                <Field label="판매 채널"><input className={inputCls} value={store.sales_channel} onChange={(e) => setS("sales_channel", e.target.value)} placeholder="예: 스마트스토어" /></Field>
              </div>
              <Button onClick={saveStore} disabled={busy || storeSaved || !store.name.trim() || !store.category.trim()}>
                {storeSaved ? "저장됨 ✓" : "브랜드 정보 저장"}
              </Button>
            </div>
          </Panel>

          <Panel title="상품 목록" right={<span className="text-sm text-[#55545e]">{products.length}개</span>}>
            {products.length === 0 && <p className="text-sm text-[#55545e]">아직 상품이 없어요. ‘상품 추가’로 등록하세요.</p>}
            <ul className="divide-y divide-neutral-100">
              {products.map((p) => (
                <li key={p.id}>
                  <button onClick={() => pick(p)}
                    className={`w-full rounded-lg px-3 py-3 text-left ${selected === p.id ? "bg-[#6d53f1]/10" : "hover:bg-neutral-50"}`}>
                    <p className="font-semibold text-black">{p.sku ? `${p.sku} · ` : ""}{p.name}</p>
                    <p className="mt-0.5 text-sm text-[#55545e]">{won(p.price)} · 현재고 {p.stock}개{p.cost ? ` · 원가 ${won(p.cost)}` : ""}</p>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {selected && (
            <Panel title={selected === "new" ? "새 상품" : "상품 세부 정보"} right={<Saved show={prodSaved} />} className="lg:col-span-2">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="상품명" required><input className={inputCls} value={draft.name} onChange={(e) => setD("name", e.target.value)} placeholder="예: 포켓 노트" /></Field>
                <Field label="SKU"><input className={inputCls} value={draft.sku} onChange={(e) => setD("sku", e.target.value)} placeholder="예: A-01" /></Field>
                <Field label="판매가 (원)"><input inputMode="numeric" className={inputCls} value={draft.price || ""} onChange={(e) => setD("price", num(e.target.value))} placeholder="12000" /></Field>
                <Field label="개당 원가 (원)" hint="손익분기점 계산에 써요"><input inputMode="numeric" className={inputCls} value={draft.cost || ""} onChange={(e) => setD("cost", num(e.target.value))} placeholder="5000" /></Field>
                <Field label="현재고 (개)"><input inputMode="numeric" className={inputCls} value={draft.stock || ""} onChange={(e) => setD("stock", num(e.target.value))} placeholder="30" /></Field>
                <Field label="상품 URL"><input className={inputCls} value={draft.url} onChange={(e) => setD("url", e.target.value)} placeholder="https://smartstore.naver.com/…" /></Field>
                <div className="md:col-span-2"><Field label="소구점"><input className={inputCls} value={draft.selling_point} onChange={(e) => setD("selling_point", e.target.value)} placeholder="예: 가벼운 휴대성" /></Field></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={saveProduct} disabled={busy || prodSaved}>{prodSaved ? "저장됨 ✓" : "상품 저장"}</Button>
                {selected !== "new" && <Button variant="ghost" onClick={removeProduct} disabled={busy}>삭제</Button>}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
