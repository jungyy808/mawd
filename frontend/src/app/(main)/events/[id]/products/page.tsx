"use client";
// Figma 20:3486 (Desktop - 4) · 판매 상품 설정
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import defaultProductImg from "@/assets/events/product-default.png";
import { type EventOut, type Product, api, uploadProductImage } from "@/components/events/api";
import { useEvent } from "@/components/events/EventShell";
import { ErrorBox, Spinner } from "@/components/events/ui";

interface StoreMeOut {
  store_id: string;
  store: {
    name: string;
    category: string;
    intro: string;
  };
}

const fieldCls =
  "h-12 w-full rounded-[9px] bg-[#d9d9d9] px-4 text-[20px] text-black placeholder:font-medium placeholder:text-[#6e6d79] focus:outline-none focus:ring-2 focus:ring-[#6d53f1]";

const cardInputCls =
  "h-9 w-full rounded-lg border border-neutral-300 bg-white px-2.5 text-right text-[15px] font-bold tabular-nums text-black focus:border-[#6d53f1] focus:outline-none";

export default function EventProductsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { reload } = useEvent();

  const [ev, setEv] = useState<EventOut | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [brandName, setBrandName] = useState("");
  const [initialBrandName, setInitialBrandName] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 개별 카드 수정 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", price: "", qty: "" });

  // 새 상품 추가 카드 상태
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState({ name: "", price: "", qty: "" });
  const [newImg, setNewImg] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, ps, storeRes] = await Promise.all([
        api<EventOut>(`/api/events/${id}`),
        api<Product[]>("/api/products"),
        api<StoreMeOut>("/api/stores/me").catch(() => null),
      ]);
      setEv(e);
      setProducts(ps);
      if (storeRes?.store?.name) {
        setBrandName(storeRes.store.name);
        setInitialBrandName(storeRes.store.name);
      }

      // 상품은 브랜드 공용이라 여기서 전부 선택해 두면 이 행사에도 그대로 저장돼
      // 다른 행사에서 만든 상품까지 등록된다. 이 행사에 연결된 상품만 선택 상태로 둔다.
      const savedQty = Object.fromEntries(e.products.map((p) => [p.product_id, p.planned_qty]));
      setQty(Object.fromEntries(ps.map((p) => [p.id, savedQty[p.id] ?? p.stock ?? 30])));
      setPicked(Object.fromEntries(e.products.map((p) => [p.product_id, true])));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const persistEventProducts = async (
    nextPicked: Record<string, boolean>,
    nextQty: Record<string, number>,
  ) => {
    const body = Object.keys(nextPicked)
      .filter((k) => nextPicked[k])
      .map((k) => ({ product_id: k, planned_qty: nextQty[k] ?? 0 }));
    await api(`/api/events/${id}/products`, { method: "PUT", json: body });
    await reload();
  };

  const saveBrandName = async () => {
    const trimmed = brandName.trim();
    if (!trimmed || trimmed === initialBrandName) return;
    try {
      await api("/api/stores/me", { method: "PATCH", json: { name: trimmed } });
      setInitialBrandName(trimmed);
    } catch {
      /* 무시 */
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditDraft({
      name: p.name,
      price: String(p.price ?? 0),
      qty: String(qty[p.id] ?? p.stock ?? 0),
    });
  };

  const saveCardEdit = async (p: Product) => {
    const nextName = editDraft.name.trim() || p.name;
    const nextPrice = Math.max(0, Number(editDraft.price || 0));
    const nextQtyVal = Math.max(0, Number(editDraft.qty || 0));

    try {
      setError("");
      if (nextName !== p.name || nextPrice !== p.price) {
        const updated = await api<Product>(`/api/products/${p.id}`, {
          method: "PATCH",
          json: { name: nextName, price: nextPrice },
        });
        setProducts((prev) => (prev ?? []).map((item) => (item.id === p.id ? updated : item)));
      }
      const nextPicked = { ...picked, [p.id]: true };
      const nextQty = { ...qty, [p.id]: nextQtyVal };
      setPicked(nextPicked);
      setQty(nextQty);
      setEditingId(null);
      await persistEventProducts(nextPicked, nextQty);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removeCardProduct = async (productId: string) => {
    try {
      setError("");
      const nextPicked = { ...picked, [productId]: false };
      setPicked(nextPicked);
      setEditingId(null);
      await persistEventProducts(nextPicked, qty);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // 상품 사진 바꾸기 (main 브랜치의 업로드 API 사용)
  const changePhoto = async (p: Product, file: File | null) => {
    if (!file) return;
    try {
      setError("");
      const updated = await uploadProductImage(p.id, file);
      setProducts((prev) => (prev ?? []).map((item) => (item.id === p.id ? updated : item)));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddProduct = async () => {
    const name = newDraft.name.trim();
    if (!name) return;
    const price = Math.max(0, Number(newDraft.price || 0));
    const planned = Math.max(0, Number(newDraft.qty || 0));

    try {
      setError("");
      let created = await api<Product>("/api/products", {
        method: "POST",
        json: { name, sku: "", price, stock: planned },
      });
      if (newImg) created = await uploadProductImage(created.id, newImg).catch(() => created);
      const nextProducts = [...(products ?? []), created];
      const nextPicked = { ...picked, [created.id]: true };
      const nextQty = { ...qty, [created.id]: planned };
      setProducts(nextProducts);
      setPicked(nextPicked);
      setQty(nextQty);
      setNewDraft({ name: "", price: "", qty: "" });
      setNewImg(null);
      setAdding(false);
      await persistEventProducts(nextPicked, nextQty);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // 이미 만들어 둔 상품을 이 행사에만 추가한다 (다른 행사는 그대로)
  const addExistingProduct = async (p: Product) => {
    const nextPicked = { ...picked, [p.id]: true };
    const nextQty = { ...qty, [p.id]: qty[p.id] ?? p.stock ?? 30 };
    setPicked(nextPicked);
    setQty(nextQty);
    try {
      setError("");
      await persistEventProducts(nextPicked, nextQty);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    setError("");
    try {
      await saveBrandName();
      await persistEventProducts(picked, qty);
      router.push(`/events/${id}/stock`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  if (error && !ev) return <ErrorBox message={error} onRetry={load} />;
  if (!ev || !products) return <Spinner text="불러오는 중" />;

  const visibleProducts = products.filter((p) => picked[p.id]);
  const otherProducts = products.filter((p) => !picked[p.id]);

  return (
    <div className="w-full max-w-[1093px] pb-10 md:ml-[33px] md:mt-5">
      <h1 className="text-[32px] font-bold leading-[38px] text-black">판매 상품 설정</h1>
      <p className="mt-3 text-[20px] font-medium leading-6 text-[#6e6d79]">
        참가하려는 행사의 모집·참가 안내 페이지에서 정보를 가져와요
      </p>

      {/* 판매 브랜드 섹션 */}
      <section className="mt-[55px] rounded-[15px] bg-white px-5 pb-8 pt-7 shadow-[0px_0px_18px_2px_rgba(0,0,0,0.09)] sm:px-[35px]">
        <label htmlFor="brand-name-input" className="block text-[20px] font-semibold leading-6 text-black">
          판매 브랜드
        </label>
        <input
          id="brand-name-input"
          name="brand_name"
          type="text"
          className={`${fieldCls} mt-5`}
          placeholder="브랜드 이름 작성"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          onBlur={saveBrandName}
        />
      </section>

      {/* 판매 상품 섹션 */}
      <h2 className="mt-[52px] text-[20px] font-semibold leading-6 text-black">판매 상품</h2>

      {error && (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProducts.map((p) => {
          const isEditing = editingId === p.id;
          const plannedQty = qty[p.id] ?? p.stock ?? 0;

          return (
            <article
              key={p.id}
              className="flex flex-col rounded-[15px] bg-white p-5 shadow-[0px_0px_18px_2px_rgba(0,0,0,0.09)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image_url || defaultProductImg.src}
                alt={p.name}
                className="block aspect-[382/222] w-full rounded-[10px] object-cover"
              />
              {isEditing && (
                <label className="mt-2 inline-flex cursor-pointer items-center justify-center self-start rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                  사진 바꾸기
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => changePhoto(p, e.target.files?.[0] ?? null)} />
                </label>
              )}

              {isEditing ? (
                <div className="mt-4 flex flex-1 flex-col justify-between gap-3">
                  <div className="space-y-2.5 text-[15px]">
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`name-${p.id}`} className="whitespace-nowrap text-sm font-medium text-[#374151]">
                        상품명
                      </label>
                      <input
                        id={`name-${p.id}`}
                        type="text"
                        className={`${cardInputCls} text-left font-semibold`}
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`price-${p.id}`} className="whitespace-nowrap text-sm font-medium text-[#374151]">
                        판매가
                      </label>
                      <div className="flex w-full items-center gap-1">
                        <input
                          id={`price-${p.id}`}
                          type="text"
                          inputMode="numeric"
                          className={`${cardInputCls} min-w-0 flex-1`}
                          value={editDraft.price}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, price: e.target.value.replace(/[^0-9]/g, "") }))
                          }
                        />
                        <span className="text-sm font-bold text-black">원</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`qty-${p.id}`} className="whitespace-nowrap text-sm font-medium text-[#374151]">
                        판매 예정 수량
                      </label>
                      <div className="flex w-full items-center gap-1">
                        <input
                          id={`qty-${p.id}`}
                          type="text"
                          inputMode="numeric"
                          className={`${cardInputCls} min-w-0 flex-1`}
                          value={editDraft.qty}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, qty: e.target.value.replace(/[^0-9]/g, "") }))
                          }
                        />
                        <span className="text-sm font-bold text-black">개</span>
                      </div>
                    </div>
                  </div>

                  <footer className="mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => removeCardProduct(p.id)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      제외
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => saveCardEdit(p)}
                        className="inline-flex h-9 items-center justify-center rounded-full bg-[#6d53f1] px-5 text-sm font-semibold text-white transition hover:bg-[#5b42e0]"
                      >
                        저장
                      </button>
                    </div>
                  </footer>
                </div>
              ) : (
                <>
                  <h3 className="mt-4 text-[20px] font-bold leading-6 text-black">{p.name}</h3>

                  <div className="mt-4 space-y-2 text-[15px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#374151]">판매가</span>
                      <span className="font-bold tabular-nums text-black">
                        {(p.price ?? 0).toLocaleString("ko-KR")}원
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#374151]">판매 예정 수량</span>
                      <span className="font-bold tabular-nums text-black">{plannedQty}개</span>
                    </div>
                  </div>

                  <footer className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="inline-flex h-9 items-center justify-center rounded-full bg-[#6d53f1] px-5 text-sm font-semibold text-white transition hover:bg-[#5b42e0]"
                    >
                      수정하기
                    </button>
                  </footer>
                </>
              )}
            </article>
          );
        })}

        {/* 새 상품 추가 카드 또는 원형 + 버튼 */}
        {adding ? (
          <article className="flex flex-col rounded-[15px] bg-white p-5 shadow-[0px_0px_18px_2px_rgba(0,0,0,0.09)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={defaultProductImg.src}
              alt="새 상품 미리보기"
              className="block aspect-[382/222] w-full rounded-[10px] object-cover"
            />
            <label className="mt-2 inline-flex cursor-pointer items-center justify-center self-start rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
              {newImg ? newImg.name : "사진 선택 (선택)"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setNewImg(e.target.files?.[0] ?? null)} />
            </label>
            <div className="mt-4 flex flex-1 flex-col justify-between gap-3">
              <div className="space-y-2.5 text-[15px]">
                <div className="flex flex-col gap-1">
                  <label htmlFor="new-product-name" className="whitespace-nowrap text-sm font-medium text-[#374151]">
                    상품명
                  </label>
                  <input
                    id="new-product-name"
                    type="text"
                    placeholder="예: 포켓 노트"
                    className={`${cardInputCls} text-left font-semibold`}
                    value={newDraft.name}
                    onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="new-product-price" className="whitespace-nowrap text-sm font-medium text-[#374151]">
                    판매가
                  </label>
                  <div className="flex w-full items-center gap-1">
                    <input
                      id="new-product-price"
                      type="text"
                      inputMode="numeric"
                      placeholder="예: 12000"
                      className={`${cardInputCls} min-w-0 flex-1`}
                      value={newDraft.price}
                      onChange={(e) =>
                        setNewDraft((d) => ({ ...d, price: e.target.value.replace(/[^0-9]/g, "") }))
                      }
                    />
                    <span className="text-sm font-bold text-black">원</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="new-product-qty" className="whitespace-nowrap text-sm font-medium text-[#374151]">
                    판매 예정 수량
                  </label>
                  <div className="flex w-full items-center gap-1">
                    <input
                      id="new-product-qty"
                      type="text"
                      inputMode="numeric"
                      placeholder="예: 30"
                      className={`${cardInputCls} min-w-0 flex-1`}
                      value={newDraft.qty}
                      onChange={(e) =>
                        setNewDraft((d) => ({ ...d, qty: e.target.value.replace(/[^0-9]/g, "") }))
                      }
                    />
                    <span className="text-sm font-bold text-black">개</span>
                  </div>
                </div>
              </div>

              <footer className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!newDraft.name.trim()}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[#6d53f1] px-5 text-sm font-semibold text-white transition hover:bg-[#5b42e0] disabled:opacity-40"
                >
                  추가하기
                </button>
              </footer>
            </div>
          </article>
        ) : (
          <div className="flex min-h-[340px] items-center justify-center">
            <button
              type="button"
              onClick={() => setAdding(true)}
              aria-label="판매 상품 추가"
              className="flex size-[92px] items-center justify-center rounded-full bg-white text-[#6d53f1] shadow-[0px_0px_18px_2px_rgba(0,0,0,0.09)] transition hover:scale-105 hover:bg-[#6d53f1]/5"
            >
              <svg
                width="42"
                height="42"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {otherProducts.length > 0 && (
        <section className="mt-8">
          <h3 className="text-base font-semibold text-black">내 상품에서 추가</h3>
          <p className="mt-1 text-sm text-[#6e6d79]">이미 만들어 둔 상품이에요. 누르면 이번 행사에만 추가됩니다.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {otherProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addExistingProduct(p)}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-[#6d53f1] hover:text-[#6d53f1]"
              >
                <span>{p.name}</span>
                <span className="text-xs text-[#6e6d79]">{(p.price ?? 0).toLocaleString("ko-KR")}원</span>
                <span aria-hidden="true" className="text-base leading-none">＋</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="inline-flex h-11 w-[162px] items-center justify-center rounded-[7px] bg-[#6d53f1] text-base font-semibold text-white transition hover:bg-[#5b42e0] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "저장 중…" : "다음으로"}
        </button>
      </div>
    </div>
  );
}
