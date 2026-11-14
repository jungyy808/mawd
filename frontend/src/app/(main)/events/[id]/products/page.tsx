"use client";
// Figma: 판매 설정 · 브랜드와 수량 / 판매 상품 선택
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type EventOut, type Product, api, uploadProductImage, won } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { Badge, Button, Card, Empty, ErrorBox, Field, Spinner, inputCls } from "@/components/events/ui";

export default function EventProductsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { reload } = useEvent();
  const [ev, setEv] = useState<EventOut | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newP, setNewP] = useState({ name: "", sku: "", price: "", stock: "" });
  const [newImg, setNewImg] = useState<File | null>(null);
  const [brand, setBrand] = useState("");
  const [brandPicked, setBrandPicked] = useState(true);
  const [added, setAdded] = useState("");
  useEffect(() => { api<{ store: { name: string } }>("/api/stores/me").then((r) => setBrand(r.store.name)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    try {
      const [e, ps] = await Promise.all([api<EventOut>(`/api/events/${id}`), api<Product[]>("/api/products")]);
      setEv(e);
      setProducts(ps);
      setQty(Object.fromEntries(e.products.map((p) => [p.product_id, p.planned_qty])));
      setPicked(Object.fromEntries(e.products.map((p) => [p.product_id, true])));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const addProduct = async () => {
    try {
      let p = await api<Product>("/api/products", {
        method: "POST",
        json: { name: newP.name, sku: newP.sku, price: Number(newP.price || 0), stock: Number(newP.stock || 0) },
      });
      if (newImg) p = await uploadProductImage(p.id, newImg).catch(() => p);
      setProducts((ps) => [...(ps ?? []), p]);
      setPicked((s) => ({ ...s, [p.id]: true }));
      setNewP({ name: "", sku: "", price: "", stock: "" });
      setNewImg(null);
      setAdded(p.name);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = Object.keys(picked).filter((k) => picked[k]).map((k) => ({ product_id: k, planned_qty: qty[k] ?? 0 }));
      await api(`/api/events/${id}/products`, { method: "PUT", json: body });
      await reload();
      router.push(`/events/${id}/stock`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  if (error && !ev) return <ErrorBox message={error} onRetry={load} />;
  if (!ev || !products) return <Spinner text="불러오는 중" />;

  const shown = products.filter((p) => !q || p.name.includes(q) || p.sku.includes(q));
  const selected = products.filter((p) => picked[p.id]);

  return (
    <div>
      <p className="mb-4 text-sm text-neutral-500">판매할 상품과 준비 수량을 정합니다. 원가는 예산·손익 탭에서 넣어요.</p>

      <Card title="판매 브랜드" className="mb-4">
        <p className="text-sm text-neutral-600">브랜드를 선택하면 해당 브랜드의 판매 상품 목록이 열려요.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setBrandPicked(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${brandPicked ? "bg-[#6d53f1] text-white" : "border border-[#6d53f1] text-[#6d53f1]"}`}>
            {brand || "내 브랜드"} {brandPicked ? "선택됨 ✓" : "선택"}
          </button>
          <a href="/settings/brand" className="text-sm text-neutral-500 underline">브랜드 정보 수정</a>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card title="상품 목록">
          <input className={`${inputCls} mb-3`} placeholder="상품명 또는 SKU 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          {shown.length === 0 ? (
            <Empty>등록된 상품이 없어요. 오른쪽에서 바로 추가하거나 브랜드·상품에서 등록하세요.</Empty>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {shown.map((p) => {
                const n = qty[p.id] ?? 0;
                const short = Math.max(0, n - p.stock);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                    <input type="checkbox" className="h-4 w-4" checked={!!picked[p.id]} onChange={(e) => setPicked((s) => ({ ...s, [p.id]: e.target.checked }))} />
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                    ) : <span className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 text-[10px] text-neutral-400">없음</span>}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.sku ? `${p.sku} · ` : ""}{p.name}</p>
                      <p className="text-xs text-neutral-500">{won(p.price)} · 행사 가용 {p.stock}개</p>
                      {picked[p.id] && short > 0 && <p className="mt-1 text-xs text-amber-700">가용 수량보다 {short}개 많아요. 추가 입고를 확인하세요.</p>}
                    </div>
                    {picked[p.id] && (
                      <div className="flex items-center gap-1">
                        <button className="h-8 w-8 rounded border" onClick={() => setQty((s) => ({ ...s, [p.id]: Math.max(0, n - 1) }))}>−</button>
                        <input className="h-8 w-16 rounded border text-center text-sm" type="number" value={n} onChange={(e) => setQty((s) => ({ ...s, [p.id]: Math.max(0, Number(e.target.value || 0)) }))} />
                        <button className="h-8 w-8 rounded border" onClick={() => setQty((s) => ({ ...s, [p.id]: n + 1 }))}>+</button>
                        <span className="text-xs text-neutral-500">개</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title={`선택한 상품 · ${selected.length}개`}>
            <ul className="space-y-1 text-sm">
              {selected.map((p) => (
                <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-neutral-500">{qty[p.id] ?? 0}개</span></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-500">판매 예정 수량은 재고 계획에 사용됩니다. 비워 두고 나중에 입력할 수 있어요.</p>
            {error && <div className="mt-3"><ErrorBox message={error} /></div>}
            <Button onClick={save} disabled={saving} className="mt-4 w-full">{saving ? "저장 중…" : "행사 저장하고 준비 시작"}</Button>
          </Card>
          <Card title="판매 상품 추가">
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">{brand || "내 브랜드"} 상품 목록에 등록하고 이번 행사에 선택해요.</p>
              <Field label="상품명" required><input className={inputCls} value={newP.name} onChange={(e) => { setAdded(""); setNewP({ ...newP, name: e.target.value }); }} placeholder="예: 겨울 엽서" /></Field>
              <Field label="판매 가격 (원)" required><input className={inputCls} type="number" value={newP.price} onChange={(e) => setNewP({ ...newP, price: e.target.value })} placeholder="3000" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="SKU (선택)" value={newP.sku} onChange={(e) => setNewP({ ...newP, sku: e.target.value })} />
                <input className={inputCls} placeholder="재고 (선택)" type="number" value={newP.stock} onChange={(e) => setNewP({ ...newP, stock: e.target.value })} />
              </div>
              <div className="rounded-lg bg-neutral-50 p-3 text-xs">
                <p className="font-semibold text-neutral-700">상품 이미지 · 선택</p>
                {newImg ? (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate">첨부됨 · {newImg.name}</span>
                    <button onClick={() => setNewImg(null)} className="shrink-0 rounded border border-neutral-300 bg-white px-2 py-1">이미지 제거</button>
                  </div>
                ) : (
                  <label className="mt-1 block cursor-pointer text-[#6d53f1] underline">
                    이미지 첨부
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setNewImg(e.target.files?.[0] ?? null)} />
                  </label>
                )}
                <p className="mt-1 text-neutral-500">이미지를 첨부하지 않아도 상품을 등록할 수 있어요.</p>
              </div>
              <Button onClick={addProduct} disabled={!newP.name.trim() || !newP.price} className="w-full">상품 등록하고 선택</Button>
              {added && <p className="text-xs font-medium text-emerald-700">‘{added}’을(를) 추가하고 선택했어요 ✓</p>}
              <Badge>브랜드·상품 메뉴에서도 관리할 수 있어요</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
