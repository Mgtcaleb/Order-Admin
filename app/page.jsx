'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { fetchOrderProcessingData, saveOrderItemPatch } from '../lib/mockOrderApi';
import { estimatePackageMetrics } from '../lib/weightClassifier';

const TIMELINE_STEPS = [
  'Departed from Seller',
  'Consolidation Delaware, USA',
  'Middle Mile',
  'Distribution Delhi, India',
  'Last Mile',
  'Delivery Address'
];

const USD_TO_INR_RATE = 83.25;
const AMAZON_CART_BASE_BY_MARKET = {
  'amazon.com': 'https://www.amazon.com/gp/aws/cart/add.html',
  'amazon.co.uk': 'https://www.amazon.co.uk/gp/aws/cart/add.html',
  'amazon.in': 'https://www.amazon.in/gp/aws/cart/add.html'
};
const CANCELLATION_REASON_OPTIONS = [
  'Customer requested cancellation',
  'Payment verification failed',
  'Inventory unavailable',
  'Price mismatch detected',
  'Compliance hold',
  'Duplicate order'
];
const FINANCE_DEFAULTS = Object.freeze({
  fxRate: 94.0,
  purchaseChargesRate: 0.05,
  mmFreightRateUsdPerKg: 5.77,
  customsDutyRate: 0.2,
  clearanceFeeInrPerShipment: 10000,
  unitsPerShipment: 50,
  consolidationRateUsdPerKg: 1.33,
  itemQcUsdPerUnit: 0.4,
  lastMileDeliveryInrPerKg: 130.64,
  lastMileDutyRate: 0,
  vatGstRate: 0,
  fixedOverheadUsdPerUnit: 0.19,
  amazonFeeRate: 0.179,
  paymentCardFeeRate: 0,
  targetMarginRate: 0.1,
  displayRoundingIncrementInr: 1,
  localCurrencySubunits: 100
});
const EMPTY_SHIPPING_ADDRESS = Object.freeze({
  addressLine1: '',
  addressLine2: '',
  provinceState: '',
  city: '',
  area: '',
  zipCode: ''
});

function App() {
  const [orderNumber, setOrderNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [sellingCountry, setSellingCountry] = useState('');
  const [selectedOiId, setSelectedOiId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [isCustomerEditMode, setIsCustomerEditMode] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({
    name: '',
    phone: '',
    shippingAddress: getDefaultShippingAddress()
  });
  const [customerEditError, setCustomerEditError] = useState('');
  const [payment, setPayment] = useState(null);
  const [items, setItems] = useState([]);
  const [weightClassifierByItem, setWeightClassifierByItem] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [syncStateByItem, setSyncStateByItem] = useState({});
  const [isMovementHistoryVisible, setIsMovementHistoryVisible] = useState(true);
  const saveRequestVersion = useRef({});
  const movementHistoryRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadOrderData = async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const data = await fetchOrderProcessingData();

        if (!isMounted) {
          return;
        }

        setCustomer(data.customer);
        setCustomerDraft({
          name: data.customer?.name || '',
          phone: data.customer?.phone || '',
          shippingAddress: normalizeShippingAddress(data.customer?.shippingAddress)
        });
        setPayment(data.payment);
        setOrderNumber(data.orderNumber || 'ORDER-UNAVAILABLE');
        setPoNumber(data.poNumber || 'PO-UNAVAILABLE');
        setSellingCountry(data.sellingCountry || inferSellingCountry(data.items, data.customer));
        const nextItems = data.items.map((item) => ({
          ...item,
          sellerPriceInr: item.sellerPriceInr || usdToInr(item.sellPrice)
        }));
        setItems(nextItems);
        setWeightClassifierByItem(buildInitialWeightClassifierData(nextItems));
      } catch {
        if (!isMounted) {
          return;
        }

        setLoadError('Could not load order details. Please refresh and try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadOrderData();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalInr = useMemo(() => {
    return items
      .reduce((sum, item) => sum + (Number.parseFloat(item.sellerPriceInr) || 0), 0)
      .toFixed(2);
  }, [items]);
  const completeOrderStatus = useMemo(() => getCompleteOrderStatus(items), [items]);
  const customerView = useMemo(() => {
    if (!customer) {
      return customer;
    }

    if (!isCustomerEditMode) {
      return customer;
    }

    return {
      ...customer,
      name: customerDraft.name,
      phone: customerDraft.phone,
      shippingAddress: customerDraft.shippingAddress
    };
  }, [customer, customerDraft, isCustomerEditMode]);

  const updateItemFieldLocal = (id, field, value) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const openCustomerEdit = () => {
    setCustomerDraft({
      name: customer?.name || '',
      phone: customer?.phone || '',
      shippingAddress: normalizeShippingAddress(customer?.shippingAddress)
    });
    setCustomerEditError('');
    setIsCustomerEditMode(true);
  };

  const cancelCustomerEdit = () => {
    setCustomerDraft({
      name: customer?.name || '',
      phone: customer?.phone || '',
      shippingAddress: normalizeShippingAddress(customer?.shippingAddress)
    });
    setCustomerEditError('');
    setIsCustomerEditMode(false);
  };

  const saveCustomerEdit = () => {
    const nextName = customerDraft.name.trim();
    const nextPhone = customerDraft.phone.trim();
    const nextShippingAddress = normalizeShippingAddress(customerDraft.shippingAddress);

    if (
      !nextName ||
      !nextPhone ||
      !nextShippingAddress.addressLine1 ||
      !nextShippingAddress.provinceState ||
      !nextShippingAddress.city ||
      !nextShippingAddress.area ||
      !nextShippingAddress.zipCode
    ) {
      setCustomerEditError('Please fill all required shipping address fields.');
      return;
    }

    setCustomer((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        name: nextName,
        phone: nextPhone,
        shippingAddress: nextShippingAddress
      };
    });
    setCustomerEditError('');
    setIsCustomerEditMode(false);
  };

  useEffect(() => {
    if (!selectedOiId && items.length > 0) {
      const firstOiId = items[0].oiId || `OI-${String(items[0].id).padStart(3, '0')}`;
      setSelectedOiId(firstOiId);
    }
  }, [items, selectedOiId]);

  const focusMovementHistory = (oiId) => {
    setIsMovementHistoryVisible(true);
    setSelectedOiId(oiId);
    setTimeout(() => {
      movementHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const commitItemPatch = async (id, patch) => {
    const nextVersion = (saveRequestVersion.current[id] || 0) + 1;
    saveRequestVersion.current[id] = nextVersion;

    setSyncStateByItem((prev) => ({ ...prev, [id]: 'saving' }));

    try {
      await saveOrderItemPatch(id, patch);

      if (saveRequestVersion.current[id] === nextVersion) {
        setSyncStateByItem((prev) => ({ ...prev, [id]: 'saved' }));
        setTimeout(() => {
          setSyncStateByItem((prev) => (prev[id] === 'saved' ? { ...prev, [id]: 'idle' } : prev));
        }, 1200);
      }
    } catch {
      if (saveRequestVersion.current[id] === nextVersion) {
        setSyncStateByItem((prev) => ({ ...prev, [id]: 'error' }));
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm font-semibold text-slate-600">Loading order processing data...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold text-rose-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="flex flex-col">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/50 p-5 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Order Processing</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">Review and update pricing, sourcing, and transit details.</p>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.16)]" />
                  Selling Country: {sellingCountry || 'Not set'}
                </span>
              </div>

              <div className="flex flex-col items-start gap-2 lg:items-end">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Order #</p>
                <p className="text-4xl font-black leading-none tracking-tight text-slate-900">{orderNumber}</p>
                <div className="mt-1 flex flex-wrap gap-2 lg:justify-end">
                  <span
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide ${getOrderStatusToneClasses(
                      completeOrderStatus.tone
                    )}`}
                  >
                    Complete Order Status: {completeOrderStatus.label}
                  </span>
                  <span className="rounded-full border border-blue-200 bg-blue-100 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-800">
                    PO: {poNumber}
                  </span>
                  <span className="rounded-full border border-slate-800 bg-slate-900 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                    {items.length} Items
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 divide-y divide-slate-200">
            {items.map((item) => (
              <OrderItemCard
                item={item}
                key={item.id}
                onFieldChangeLocal={updateItemFieldLocal}
                onFieldCommit={commitItemPatch}
                onViewHistory={focusMovementHistory}
                classifierOutput={weightClassifierByItem[item.id]}
                syncState={syncStateByItem[item.id] || 'idle'}
              />
            ))}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4" ref={movementHistoryRef}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Order Movement History</p>
              <button
                aria-pressed={isMovementHistoryVisible}
                aria-label={isMovementHistoryVisible ? 'Collapse order movement history' : 'Expand order movement history'}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                  isMovementHistoryVisible
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                }`}
                onClick={() => setIsMovementHistoryVisible((prev) => !prev)}
                type="button"
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-300 ease-out ${
                    isMovementHistoryVisible ? 'rotate-180' : 'motion-safe:animate-bounce'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M7 10l5 5 5-5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            </div>

            {isMovementHistoryVisible ? (
              <OrderMovementHistoryPanel items={items} selectedOiId={selectedOiId} />
            ) : (
              <p className="mt-2 text-xs text-slate-500">Movement history is hidden. Click the down arrow to expand.</p>
            )}
          </div>

          <AmazonCartSection items={items} />
          <FinanceTabSection items={items} />
        </main>

        <aside className="space-y-7 border-t border-slate-200 pt-6 xl:sticky xl:top-8 xl:self-start xl:border-t-0 xl:pt-0">
          <InfoCard
            title="Customer Details"
            actions={
              isCustomerEditMode ? (
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                    onClick={cancelCustomerEdit}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md border border-blue-300 bg-blue-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
                    onClick={saveCustomerEdit}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                  onClick={openCustomerEdit}
                  type="button"
                >
                  Edit
                </button>
              )
            }
          >
            <CustomerTags customer={customer} />
            {isCustomerEditMode ? (
              <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Name
                  <input
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-blue-400 focus:outline-none"
                    onChange={(event) => setCustomerDraft((prev) => ({ ...prev, name: event.target.value }))}
                    type="text"
                    value={customerDraft.name}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Phone Number
                  <input
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-blue-400 focus:outline-none"
                    onChange={(event) => setCustomerDraft((prev) => ({ ...prev, phone: event.target.value }))}
                    type="tel"
                    value={customerDraft.phone}
                  />
                </label>
                <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Address Line 1
                    <input
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setCustomerDraft((prev) => ({
                          ...prev,
                          shippingAddress: { ...prev.shippingAddress, addressLine1: event.target.value }
                        }))
                      }
                      type="text"
                      value={customerDraft.shippingAddress.addressLine1}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Address Line 2
                    <input
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setCustomerDraft((prev) => ({
                          ...prev,
                          shippingAddress: { ...prev.shippingAddress, addressLine2: event.target.value }
                        }))
                      }
                      type="text"
                      value={customerDraft.shippingAddress.addressLine2}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Province/State
                    <input
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setCustomerDraft((prev) => ({
                          ...prev,
                          shippingAddress: { ...prev.shippingAddress, provinceState: event.target.value }
                        }))
                      }
                      type="text"
                      value={customerDraft.shippingAddress.provinceState}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    City
                    <input
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setCustomerDraft((prev) => ({
                          ...prev,
                          shippingAddress: { ...prev.shippingAddress, city: event.target.value }
                        }))
                      }
                      type="text"
                      value={customerDraft.shippingAddress.city}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Area
                    <input
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setCustomerDraft((prev) => ({
                          ...prev,
                          shippingAddress: { ...prev.shippingAddress, area: event.target.value }
                        }))
                      }
                      type="text"
                      value={customerDraft.shippingAddress.area}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Zip Code
                    <input
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setCustomerDraft((prev) => ({
                          ...prev,
                          shippingAddress: { ...prev.shippingAddress, zipCode: event.target.value }
                        }))
                      }
                      type="text"
                      value={customerDraft.shippingAddress.zipCode}
                    />
                  </label>
                </div>
                {customerEditError ? <p className="text-[11px] font-medium text-rose-600">{customerEditError}</p> : null}
              </div>
            ) : null}
            <DetailRow label="User ID" value={customerView?.userId || 'Not provided'} />
            <DetailRow label="Name" value={customerView?.name || 'Not provided'} />
            <DetailRow label="Email" value={customerView?.email || 'Not provided'} />
            <DetailRow label="Phone" value={customerView?.phone || 'Not provided'} />
            <DetailRow label="Marketplace" value={customerView?.marketplace || 'Not provided'} />
            <DetailRow label="Country" value={customerView?.country || sellingCountry || 'Not provided'} />
            <DetailRow label="Marketplace Order ID" value={customerView?.marketplaceOrderId || 'Not provided'} />
            <DetailRow label="Orders Placed" value={String(customerView?.ordersPlaced ?? 'Not provided')} />
            <DetailRow label="Last Login" value={customerView?.lastLogin || 'Not provided'} />
            <DetailRow label="IP Address" value={customerView?.ipAddress || 'Not provided'} />
            <DetailRow label="Browser Details" value={customerView?.browserDetails || 'Not provided'} />
            <DetailRow label="Login" value={customerView?.loginChannel || 'Not provided'} />
            <DetailRow label="Shipping Address" value={<ShippingAddressDetails address={customerView?.shippingAddress} />} />
          </InfoCard>

          <InfoCard title="Payment Details">
            <DetailRow label="Payment Method" value={payment?.method || 'Not provided'} />
            <DetailRow label="Billing Address" value={payment?.billingAddress || 'Not provided'} />
            <DetailRow label="Transaction ID" value={payment?.transactionId || 'Not provided'} />
            <DetailRow label="Order Total" value={`₹${totalInr}`} emphasize />
          </InfoCard>
        </aside>
      </div>
    </div>
  );
}

function OrderItemCard({
  item,
  onFieldChangeLocal,
  onFieldCommit,
  syncState,
  onViewHistory,
  classifierOutput
}) {
  const syncTextByState = {
    idle: 'Up to date',
    saving: 'Syncing changes...',
    saved: 'Saved',
    error: 'Sync failed'
  };

  const syncStyleByState = {
    idle: 'bg-slate-200 text-slate-600',
    saving: 'bg-amber-100 text-amber-700',
    saved: 'bg-emerald-100 text-emerald-700',
    error: 'bg-rose-100 text-rose-700'
  };

  const oiId = item.oiId || `OI-${String(item.id).padStart(3, '0')}`;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(() => buildOiEditDraft(item));
  const [showCancellationControl, setShowCancellationControl] = useState(Boolean(item.cancellationRequested));
  const [cancellationReasonDraft, setCancellationReasonDraft] = useState(item.cancellationReason || '');
  const [cancellationError, setCancellationError] = useState('');

  useEffect(() => {
    if (isEditModalOpen) {
      return;
    }

    setEditDraft(buildOiEditDraft(item));
    setShowCancellationControl(Boolean(item.cancellationRequested));
    setCancellationReasonDraft(item.cancellationReason || '');
    setCancellationError('');
  }, [item, isEditModalOpen]);

  const openEditModal = () => {
    setEditDraft(buildOiEditDraft(item));
    setShowCancellationControl(Boolean(item.cancellationRequested));
    setCancellationReasonDraft(item.cancellationReason || '');
    setCancellationError('');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setCancellationError('');
  };

  const saveEditChanges = () => {
    if (showCancellationControl && !cancellationReasonDraft) {
      setCancellationError('Please select a cancellation reason.');
      return;
    }

    const normalizedProcured = sanitizeNumericInput(editDraft.procuredPrice);
    const normalizedSellerInr = sanitizeNumericInput(editDraft.sellerPriceInr);
    const patch = {
      sku: editDraft.sku,
      asin: editDraft.asin,
      scrapedWeight: editDraft.scrapedWeight,
      procuredPrice: normalizedProcured,
      sellerPriceInr: normalizedSellerInr,
      sellPrice: inrToUsd(normalizedSellerInr),
      flagged: editDraft.flagged,
      cancellationRequested: showCancellationControl,
      cancellationReason: showCancellationControl ? cancellationReasonDraft : '',
      cancellationRequestedAt: showCancellationControl ? item.cancellationRequestedAt || new Date().toISOString() : null
    };

    Object.entries(patch).forEach(([field, value]) => {
      onFieldChangeLocal(item.id, field, value);
    });
    onFieldCommit(item.id, patch);

    closeEditModal();
  };

  const resolvedClassifierOutput =
    classifierOutput ||
    estimatePackageMetrics({
      title: item.name,
      description: item.description || '',
      asin: item.asin,
      scrapedWeight: item.scrapedWeight
    });
  const resolvedInvoiceDescription = item.invoiceDescription || item.name;

  return (
    <article className="py-5 first:pt-4">
      <div className="mb-3 flex justify-end">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${syncStyleByState[syncState]}`}>
          {syncTextByState[syncState]}
        </span>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <img alt={item.name} className="h-24 w-24 rounded-lg object-cover" src={item.image} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{item.name}</h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">#{oiId}</span>
              <button
                className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                onClick={openEditModal}
                type="button"
              >
                Edit #OI
              </button>
              {item.flagged ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Flagged
                </span>
              ) : null}
              {item.cancellationRequested ? (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                  Cancellation Requested
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">SKU: {item.sku}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-600">
              <span>
                <span className="font-semibold text-slate-700">ASIN:</span> {item.asin}
              </span>
              <span>
                <span className="font-semibold text-slate-700">Purchase Ref:</span> {item.amazonPurchaseReference || 'N/A'}
              </span>
              <span>
                <span className="font-semibold text-slate-700">Scraped Weight:</span> {item.scrapedWeight || 'N/A'}
              </span>
              <span>
                <span className="font-semibold text-slate-700">AI Weight:</span>{' '}
                {resolvedClassifierOutput
                  ? `${resolvedClassifierOutput.gross_weight} ${resolvedClassifierOutput.weight_unit}`
                  : item.aiWeight || 'N/A'}
              </span>
              <span>
                <span className="font-semibold text-slate-700">AI Dimensions:</span>{' '}
                {resolvedClassifierOutput
                  ? `${resolvedClassifierOutput.length} x ${resolvedClassifierOutput.width} x ${resolvedClassifierOutput.height} ${resolvedClassifierOutput.dimension_unit}`
                  : 'N/A'}
              </span>
            </div>

            <div className="mt-2 border-t border-slate-100 pt-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Weight Classifier</p>
              </div>
              <div className="mt-2 grid gap-2 text-[12px] text-slate-700 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Gross Weight</p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {resolvedClassifierOutput.gross_weight} {resolvedClassifierOutput.weight_unit}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Package Size</p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {resolvedClassifierOutput.length} x {resolvedClassifierOutput.width} x {resolvedClassifierOutput.height}{' '}
                    {resolvedClassifierOutput.dimension_unit}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Packing Basis</p>
                  <p className="mt-0.5 text-slate-700">Retail pack, compact orientation</p>
                </div>
              </div>
            </div>

            <a
              className="mt-2 inline-flex text-sm font-semibold text-blue-700 hover:underline"
              href={item.storeUrl || getStoreUrlFromSource(item.storeSource, item.asin)}
              rel="noreferrer"
              target="_blank"
            >
              Store URL
            </a>
          </div>
        </div>

        <div className="w-full border-t border-slate-100 pt-3 xl:w-[320px] xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
          <div className="space-y-2">
            <EditablePriceMetric
              currencySymbol="$"
              label="Scraped Price"
              disabled
              onBlurCommit={() => {}}
              onChangeValue={() => {}}
              value={item.scrapedPrice}
            />
            <EditablePriceMetric
              currencySymbol="$"
              label="Procured Price"
              disabled
              onBlurCommit={() => {}}
              onChangeValue={() => {}}
              value={item.procuredPrice}
            />
            <EditablePriceMetric
              currencySymbol="₹"
              disabled
              label="Seller Price (INR)"
              onBlurCommit={() => {}}
              onChangeValue={() => {}}
              value={item.sellerPriceInr}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[220px_240px_minmax(0,1fr)]">
        <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>Store Source</span>
          <button
            className="flex h-10 items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={() => {
              const nextValue = getOppositeStoreSource(item.storeSource);
              onFieldChangeLocal(item.id, 'storeSource', nextValue);
              onFieldCommit(item.id, { storeSource: nextValue });
            }}
            type="button"
          >
            <span>{item.storeSource}</span>
            <span className="text-xs uppercase tracking-wide text-slate-500">Switch</span>
          </button>
        </div>

        <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>Current Status</span>
          <div className="flex h-10 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.24)]" />
            <span className="ml-2 truncate text-sm font-semibold text-emerald-800">{getStatusLabel(item.currentStatus)}</span>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Alternative URL
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            onBlur={(event) => onFieldCommit(item.id, { alternativeUrl: event.target.value })}
            onChange={(event) => onFieldChangeLocal(item.id, 'alternativeUrl', event.target.value)}
            placeholder="Paste 3rd-party product link"
            type="url"
            value={item.alternativeUrl}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 xl:grid-cols-[minmax(0,1fr)_180px_200px]">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <CommercialInvoiceIcon />
            <span>Commercial Invoice Description</span>
          </span>
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            onBlur={(event) => onFieldCommit(item.id, { invoiceDescription: event.target.value })}
            onChange={(event) => onFieldChangeLocal(item.id, 'invoiceDescription', event.target.value)}
            placeholder="Amend invoice description"
            type="text"
            value={resolvedInvoiceDescription}
          />
        </label>

        <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          <span>HS Code</span>
          <input
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            onBlur={(event) => onFieldCommit(item.id, { hsCode: event.target.value })}
            onChange={(event) => onFieldChangeLocal(item.id, 'hsCode', event.target.value)}
            placeholder="e.g. 2106.90"
            type="text"
            value={item.hsCode || ''}
          />
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Declared Value (USD)
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-2 text-sm font-medium text-slate-500">$</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              min="0"
              onBlur={(event) => onFieldCommit(item.id, { declaredValue: sanitizeNumericInput(event.target.value) })}
              onChange={(event) => onFieldChangeLocal(item.id, 'declaredValue', event.target.value)}
              placeholder="0.00"
              step="0.01"
              type="number"
              value={item.declaredValue || ''}
            />
          </div>
        </label>
      </div>

      <OrderTimeline
        checkpointDetails={item.checkpointDetails}
        currentStatus={item.currentStatus}
        stepEddTimestamps={item.stepEddTimestamps}
        stepTimestamps={item.stepTimestamps}
        steps={TIMELINE_STEPS}
      />
      <div className="mt-3 flex justify-end">
        <button
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
          onClick={() => onViewHistory(oiId)}
          type="button"
        >
          View Movement History
        </button>
      </div>

      <EditOiModal
        cancellationError={cancellationError}
        cancellationReasonDraft={cancellationReasonDraft}
        draft={editDraft}
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onDraftChange={setEditDraft}
        onSave={saveEditChanges}
        onToggleCancellation={() => {
          setShowCancellationControl((prev) => {
            const nextValue = !prev;
            if (!nextValue) {
              setCancellationError('');
            }
            return nextValue;
          });
        }}
        onUpdateCancellationReason={(reason) => {
          setCancellationReasonDraft(reason);
          if (reason) {
            setCancellationError('');
          }
        }}
        oiId={oiId}
        showCancellationControl={showCancellationControl}
      />
    </article>
  );
}

function EditOiModal({
  isOpen,
  oiId,
  draft,
  onDraftChange,
  onClose,
  onSave,
  showCancellationControl,
  onToggleCancellation,
  cancellationReasonDraft,
  onUpdateCancellationReason,
  cancellationError
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Edit Order Item</p>
            <h3 className="text-lg font-semibold text-slate-900">#{oiId}</h3>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              SKU
              <input
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none"
                onChange={(event) => onDraftChange((prev) => ({ ...prev, sku: event.target.value }))}
                type="text"
                value={draft.sku}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              ASIN
              <input
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none"
                onChange={(event) => onDraftChange((prev) => ({ ...prev, asin: event.target.value }))}
                type="text"
                value={draft.asin}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Weight
              <input
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none"
                onChange={(event) => onDraftChange((prev) => ({ ...prev, scrapedWeight: event.target.value }))}
                placeholder="e.g. 0.44 kg"
                type="text"
                value={draft.scrapedWeight}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Procured Price (USD)
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-medium text-slate-500">$</span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 text-sm font-semibold normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none"
                  min="0"
                  onChange={(event) => onDraftChange((prev) => ({ ...prev, procuredPrice: event.target.value }))}
                  step="0.01"
                  type="number"
                  value={draft.procuredPrice}
                />
              </div>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Seller Price (INR)
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-medium text-slate-500">₹</span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 text-sm font-semibold normal-case tracking-normal text-slate-700 focus:border-slate-400 focus:outline-none"
                  min="0"
                  onChange={(event) => onDraftChange((prev) => ({ ...prev, sellerPriceInr: event.target.value }))}
                  step="0.01"
                  type="number"
                  value={draft.sellerPriceInr}
                />
              </div>
            </label>
          </div>

          <div className="grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-[170px_minmax(0,1fr)]">
            <button
              className={`h-10 rounded-md border px-3 text-xs font-semibold uppercase tracking-wide transition ${
                draft.flagged
                  ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
              onClick={() => onDraftChange((prev) => ({ ...prev, flagged: !prev.flagged }))}
              type="button"
            >
              {draft.flagged ? 'Unflag Item' : 'Flag Item'}
            </button>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Cancel Item</p>
                <button
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                    showCancellationControl
                      ? 'border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-100'
                  }`}
                  onClick={onToggleCancellation}
                  type="button"
                >
                  {showCancellationControl ? 'Cancellation Enabled' : 'Enable Cancellation'}
                </button>
              </div>

              {showCancellationControl ? (
                <div className="mt-2">
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                    onChange={(event) => onUpdateCancellationReason(event.target.value)}
                    value={cancellationReasonDraft}
                  >
                    <option value="">Select cancellation reason</option>
                    {CANCELLATION_REASON_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {cancellationError ? <p className="mt-1 text-[11px] text-rose-600">{cancellationError}</p> : null}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">Keep this disabled if cancellation is not required.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            className="h-10 rounded-md border border-slate-300 px-4 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-md border border-blue-300 bg-blue-600 px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
            onClick={onSave}
            type="button"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function buildOiEditDraft(item) {
  return {
    sku: item.sku || '',
    asin: item.asin || '',
    scrapedWeight: item.scrapedWeight || '',
    procuredPrice: item.procuredPrice || '',
    sellerPriceInr: item.sellerPriceInr || '',
    flagged: Boolean(item.flagged)
  };
}

function EditablePriceMetric({ label, onBlurCommit, onChangeValue, value, currencySymbol = '$', disabled = false }) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative w-32">
        <span
          className={`pointer-events-none absolute left-2.5 top-2 text-sm font-medium ${
            disabled ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {currencySymbol}
        </span>
        <input
          className={`h-9 w-full rounded-md border pl-6 pr-2 text-sm font-semibold focus:outline-none ${
            disabled
              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
              : 'border-slate-300 bg-white text-slate-900 focus:border-slate-400'
          }`}
          disabled={disabled}
          min="0"
          onBlur={(event) => onBlurCommit(event.target.value)}
          onChange={(event) => onChangeValue(event.target.value)}
          step="0.01"
          type="number"
          value={value}
        />
      </div>
    </label>
  );
}

function OrderTimeline({ steps, currentStatus, stepTimestamps, stepEddTimestamps, checkpointDetails }) {
  const safeStatus = Math.min(Math.max(currentStatus, 0), steps.length - 1);
  const consolidationMilestones = checkpointDetails?.consolidationDelaware?.milestones || [];
  const distributionMilestones = checkpointDetails?.distributionDelhi?.milestones || [];
  const middleMile = checkpointDetails?.middleMile || {};
  const lastMile = checkpointDetails?.lastMile || {};
  const sectionKeyByStep = ['firstMile', 'consolidation', 'middleMile', 'distribution', 'lastMile', 'delivery'];
  const [openSections, setOpenSections] = useState({
    firstMile: true,
    consolidation: false,
    middleMile: false,
    distribution: false,
    lastMile: false,
    delivery: false
  });

  const completedConsolidationCount = consolidationMilestones.filter((item) => Boolean(item.timestamp)).length;
  const completedDistributionCount = distributionMilestones.filter((item) => Boolean(item.timestamp)).length;
  const completedMiddleMileCount = (middleMile.movementHistory || []).filter((item) => Boolean(item.timestamp)).length;
  const completedLastMileCount = (lastMile.courierCheckpoints || []).filter((item) => Boolean(item.timestamp)).length;
  const consolidationBoxId = extractBoxId(consolidationMilestones);
  const consolidationDeparture = findMilestoneTimestamp(consolidationMilestones, 'Departure from Consolidation');
  const distCheckIn = findMilestoneTimestamp(distributionMilestones, 'Item Check IN');
  const distQc = findMilestoneTimestamp(distributionMilestones, 'Item QC');
  const distShelving = findMilestoneTimestamp(distributionMilestones, 'Item Shelving');
  const distPacking = findMilestoneTimestamp(distributionMilestones, 'Item Packing');
  const distAssigned = findMilestoneTimestamp(distributionMilestones, 'Assigned for Last Mile');

  const toggleSectionByStep = (stepIndex) => {
    const key = sectionKeyByStep[stepIndex];
    if (!key) {
      return;
    }

    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Order Status Timeline</h3>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          {getStatusLabel(safeStatus)}
        </span>
      </div>

      <div className="overflow-x-auto px-4 py-5">
        <ol className="flex min-w-[980px] items-start">
          {steps.map((step, index) => {
            const isReached = index <= safeStatus;
            const isCurrent = index === safeStatus;
            const sectionKey = sectionKeyByStep[index];
            const isOpen = Boolean(openSections[sectionKey]);

            return (
              <li className="flex flex-1 items-start" key={step}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center">
                    <button
                      className="group/step"
                      onClick={() => toggleSectionByStep(index)}
                      type="button"
                    >
                      <span
                      className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 ${
                        isCurrent
                          ? 'border-emerald-300 bg-emerald-500 text-white shadow-[0_0_18px_rgba(16,185,129,0.35)]'
                          : isReached
                            ? 'border-emerald-200 bg-emerald-500 text-white'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                      }`}
                    >
                      <StepIcon stepIndex={index} />
                    </span>
                    </button>
                    {index < steps.length - 1 ? (
                      <span
                        className={`ml-2 h-[3px] w-full rounded-full ${
                          index < safeStatus ? 'bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.55)]' : 'bg-slate-200'
                        }`}
                      />
                    ) : null}
                  </div>

                  <p className={`mt-2 text-[13px] font-semibold ${isReached ? 'text-slate-900' : 'text-slate-500'}`}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSectionByStep(index)} type="button">
                      <span>{getCompactStepLabel(step)}</span>
                      <span className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                          <path d="M7 10l5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </span>
                    </button>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{getCompactStepSubLabel(index, checkpointDetails, stepEddTimestamps)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {openSections.firstMile && (
          <TimelineDetailSection
            leftItems={[
              { label: 'Carrier', value: 'Internal Transfer' },
              { label: 'Origin', value: 'Supplier warehouse' },
              { label: 'Departed', value: getStepTimestampStatus(stepTimestamps, 0, safeStatus >= 0) }
            ]}
            rightItems={[
              { label: 'Tracking', value: middleMile.hawb || 'Pending' },
              { label: 'Destination', value: 'Consolidation Delaware, USA' },
              { label: 'Arrived', value: getStepTimestampStatus(stepTimestamps, 1, safeStatus >= 1) }
            ]}
            title="First Mile"
          />
        )}

        {openSections.consolidation && (
          <TimelineDetailSection
            leftItems={[
              {
                label: 'Check-in Condition',
                value: completedConsolidationCount >= 2 ? 'Good' : 'Pending',
                tone: completedConsolidationCount >= 2 ? 'positive' : 'neutral'
              },
              { label: 'Box ID', value: consolidationBoxId || 'Pending' },
              { label: 'Events Completed', value: `${completedConsolidationCount}/${consolidationMilestones.length || 4}` }
            ]}
            rightItems={[
              { label: 'HAWB', value: middleMile.hawb || 'Pending' },
              { label: 'Departure from Consolidation', value: consolidationDeparture || 'Pending' },
              { label: 'Middle Mile EDD', value: middleMile.edd ? formatTimelineTimestamp(middleMile.edd) : 'Pending' }
            ]}
            title="Consolidation"
          />
        )}

        {openSections.middleMile && (
          <TimelineDetailSection
            leftItems={[
              { label: 'HAWB', value: middleMile.hawb || 'Pending' },
              { label: 'Departed', value: middleMile.departedAt ? formatTimelineTimestamp(middleMile.departedAt) : 'Pending' },
              { label: 'Arrived', value: middleMile.arrivedAt ? formatTimelineTimestamp(middleMile.arrivedAt) : 'Pending' }
            ]}
            rightItems={[
              { label: 'EDD', value: middleMile.edd ? formatTimelineTimestamp(middleMile.edd) : 'Pending' },
              { label: 'Movement Events', value: `${completedMiddleMileCount}/${(middleMile.movementHistory || []).length || 0}` },
              { label: 'Lane', value: 'Air Freight' }
            ]}
            title="Middle Mile"
          />
        )}

        {openSections.distribution && (
          <TimelineDetailSection
            leftItems={[
              { label: 'Item Check IN', value: distCheckIn || 'Pending' },
              { label: 'Item QC', value: distQc || 'Pending' },
              { label: 'Item Shelving', value: distShelving || 'Pending' }
            ]}
            rightItems={[
              {
                label: 'Packing State',
                value: distPacking ? 'Packed' : 'Pending',
                tone: distPacking ? 'accent' : 'neutral'
              },
              { label: 'Assigned for Last Mile', value: distAssigned || 'Pending' },
              { label: 'Events Completed', value: `${completedDistributionCount}/${distributionMilestones.length || 5}` }
            ]}
            title="Distribution"
          />
        )}

        {openSections.lastMile && (
          <TimelineDetailSection
            leftItems={[
              { label: 'AWB', value: lastMile.awb || 'Pending' },
              { label: 'Departed', value: lastMile.departedAt ? formatTimelineTimestamp(lastMile.departedAt) : 'Pending' },
              { label: 'Arrived', value: lastMile.arrivedAt ? formatTimelineTimestamp(lastMile.arrivedAt) : 'Pending' }
            ]}
            rightItems={[
              { label: 'EDD', value: lastMile.edd ? formatTimelineTimestamp(lastMile.edd) : 'Pending' },
              { label: 'Courier Checkpoints', value: `${completedLastMileCount}/${(lastMile.courierCheckpoints || []).length || 0}` },
              { label: 'Delivery Status', value: lastMile.arrivedAt ? 'Reached Destination Hub' : 'In Transit' }
            ]}
            title="Last Mile"
          />
        )}

        {openSections.delivery && (
          <TimelineDetailSection
            leftItems={[
              { label: 'Destination', value: 'Delivery Address' },
              { label: 'EDD', value: getStepEddText(stepEddTimestamps, 5) },
              { label: 'Arrived', value: getStepTimestampStatus(stepTimestamps, 5, safeStatus >= 5) }
            ]}
            rightItems={[
              { label: 'POD', value: safeStatus >= 5 ? 'Available' : 'Pending' },
              { label: 'Receiver', value: safeStatus >= 5 ? 'Customer' : 'Pending' },
              { label: 'Final Status', value: safeStatus >= 5 ? 'Delivered' : 'Awaiting delivery' }
            ]}
            title="Delivery Address"
          />
        )}
      </div>
    </section>
  );
}

function TimelineDetailSection({ title, leftItems, rightItems }) {
  return (
    <section className="border-b border-slate-200 px-4 py-5 last:border-b-0">
      <h4 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h4>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          {leftItems.map((item) => (
            <TimelineDetailRow item={item} key={`${title}-left-${item.label}`} />
          ))}
        </div>
        <div className="space-y-4">
          {rightItems.map((item) => (
            <TimelineDetailRow item={item} key={`${title}-right-${item.label}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineDetailRow({ item }) {
  return (
    <div>
      <p className="text-[12px] text-slate-500">{item.label}</p>
      <p
        className={`mt-0.5 text-[15px] font-semibold ${
          item.tone === 'positive' ? 'text-emerald-700' : item.tone === 'accent' ? 'text-violet-700' : 'text-slate-900'
        }`}
      >
        {item.value}
      </p>
    </div>
  );
}

function OrderMovementHistoryPanel({ items, selectedOiId }) {
  const normalizedItems = items.map((item) => ({
    ...item,
    oiId: item.oiId || `OI-${String(item.id).padStart(3, '0')}`
  }));

  const focusedItem = normalizedItems.find((item) => item.oiId === selectedOiId) || normalizedItems[0];
  const focusedId = focusedItem?.oiId || 'N/A';

  const middleLane = buildLaneData(normalizedItems, focusedItem, 'middleMile');
  const lastLane = buildLaneData(normalizedItems, focusedItem, 'lastMile');

  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
        <OrderHistoryIcon />
        <span>Order Movement History</span>
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Focused Item: <span className="font-semibold text-slate-700">#{focusedId}</span>
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <MovementHistoryLane lane={middleLane} title="Middle Mile" />
        <MovementHistoryLane lane={lastLane} title="Last Mile" />
      </div>
    </section>
  );
}

function AmazonCartSection({ items }) {
  const cartLinks = useMemo(() => {
    const groupedAsins = new Map();

    items.forEach((item) => {
      const market = getAmazonMarketFromSource(item.storeSource);
      const asin = (item.asin || '').trim();

      if (!market || !asin) {
        return;
      }

      if (!groupedAsins.has(market)) {
        groupedAsins.set(market, []);
      }

      const existingAsins = groupedAsins.get(market);
      if (!existingAsins.includes(asin)) {
        existingAsins.push(asin);
      }
    });

    return Array.from(groupedAsins.entries())
      .map(([market, asins]) => ({
        market,
        asins,
        url: buildAmazonCartUrl(market, asins)
      }))
      .filter((entry) => Boolean(entry.url));
  }, [items]);

  if (cartLinks.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
        <AddToCartIcon />
        <span>Add to Cart</span>
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Adds all order ASINs grouped by source marketplace with quantity set to 1.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {cartLinks.map((entry) => (
          <a
            className="inline-flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            href={entry.url}
            key={entry.market}
            rel="noreferrer"
            target="_blank"
          >
            <span>Add {entry.asins.length} item{entry.asins.length > 1 ? 's' : ''} to {entry.market} cart</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Open
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function FinanceTabSection({ items }) {
  const [activeOiId, setActiveOiId] = useState(items[0]?.oiId || '');
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);

  useEffect(() => {
    if (!items.length) {
      setActiveOiId('');
      return;
    }

    if (!items.some((item) => item.oiId === activeOiId)) {
      setActiveOiId(items[0].oiId);
    }
  }, [items, activeOiId]);

  if (!items.length) {
    return null;
  }

  const activeItem = items.find((item) => item.oiId === activeOiId) || items[0];
  const finance = buildFinanceModel(activeItem);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.55)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Commercials</h3>
          <p className="mt-1 text-xs text-slate-500">
            Unit economics per order item. Active item: <span className="font-semibold text-slate-700">#{activeItem.oiId}</span>
          </p>
        </div>
        <button
          aria-label={isFinanceOpen ? 'Collapse commercials' : 'Expand commercials'}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
            isFinanceOpen
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
          }`}
          onClick={() => setIsFinanceOpen((prev) => !prev)}
          type="button"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-300 ease-out ${isFinanceOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <path d="M7 10l5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </button>
      </div>

      {!isFinanceOpen ? (
        <p className="mt-2 text-xs text-slate-500">Commercials view is collapsed. Click the arrow to expand.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => (
              <button
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
                  item.oiId === activeItem.oiId
                    ? 'border-blue-200 bg-blue-100 text-blue-800'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                }`}
                key={item.id}
                onClick={() => setActiveOiId(item.oiId)}
                type="button"
              >
                #{item.oiId}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <FinanceSummaryCard label="Base Landed Cost (USD)" tone="slate" value={formatUsd(finance.baseLandedCostUsd)} />
            <FinanceSummaryCard label="Required Selling Price (USD)" tone="blue" value={formatUsd(finance.requiredSellingPriceUsd)} />
            <FinanceSummaryCard label="Gross Profit (USD)" tone={finance.grossProfitUsd >= 0 ? 'emerald' : 'rose'} value={formatUsd(finance.grossProfitUsd)} />
            <FinanceSummaryCard label="Pricing Status" tone={finance.pricingStatus === 'OK' ? 'emerald' : 'amber'} value={finance.pricingStatus} />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[1100px] table-fixed text-left">
              <thead>
                <tr className="bg-slate-100">
                  <th className="w-[200px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Element</th>
                  <th className="w-[300px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Description</th>
                  <th className="w-[110px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Unit</th>
                  <th className="w-[150px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Value</th>
                  <th className="w-[150px] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">INR / Local</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Formula Logic</th>
                </tr>
              </thead>
              <tbody>
                {finance.sections.map((section) => (
                  <Fragment key={section.title || section.rows[0]?.element}>
                    {section.title ? (
                      <tr className="bg-slate-50">
                        <td className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700" colSpan={6}>
                          {section.title}
                        </td>
                      </tr>
                    ) : null}
                    {section.rows.map((row) => (
                      <tr className="border-t border-slate-100 align-top" key={`${section.title || 'default'}-${row.element}`}>
                        <td className="px-3 py-1.5 text-[12px] font-semibold text-slate-800">{row.element}</td>
                        <td className="px-3 py-1.5 text-[12px] text-slate-600">{row.description}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-slate-500">{row.unit}</td>
                        <td className="px-3 py-1.5 text-[12px] font-semibold text-slate-900">{row.value}</td>
                        <td className="px-3 py-1.5 text-[12px] font-semibold text-slate-900">{row.localValue}</td>
                        <td className="px-3 py-1.5 text-[11px] text-slate-500">{row.formula}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function FinanceSummaryCard({ label, value, tone = 'slate' }) {
  const stylesByTone = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800'
  };
  const toneClasses = stylesByTone[tone] || stylesByTone.slate;

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClasses}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-[17px] font-black leading-none">{value}</p>
    </div>
  );
}

function ReadOnlyMilestoneDropdown({ title, milestones = [] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition group-hover:text-slate-800">
        {title}
      </summary>
      <div className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
        {milestones.length === 0 && <div className="text-[10px] text-slate-500">No checkpoint data available.</div>}
        {milestones.map((milestone) => {
          const done = Boolean(milestone.timestamp);
          return (
            <div className="text-[11px]" key={milestone.label}>
              <p className="text-[11px] font-semibold text-slate-700">{milestone.label}</p>
              <p className={`text-[10px] ${done ? 'text-emerald-700' : 'text-slate-500'}`}>
                {done ? `Done • ${formatTimelineTimestamp(milestone.timestamp)}` : 'Pending • Timestamp pending'}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function MovementInfoPanel({ referenceLabel, referenceValue, departedAt, arrivedAt, edd }) {
  return (
    <div className="space-y-1 border-l border-slate-200 pl-3 text-[11px]">
      <p className="text-[11px] text-slate-700">
        <span className="font-semibold text-slate-600">{referenceLabel}: </span>
        <span className="font-semibold">{referenceValue || 'Not assigned'}</span>
      </p>
      <p className="text-[11px] text-slate-700">
        <span className="font-semibold text-slate-600">Departed: </span>
        {departedAt ? formatTimelineTimestamp(departedAt) : 'Pending'}
      </p>
      <p className="text-[11px] text-slate-700">
        <span className="font-semibold text-slate-600">Arrived: </span>
        {arrivedAt ? formatTimelineTimestamp(arrivedAt) : 'Pending'}
      </p>
      <p className="text-[11px] text-slate-700">
        <span className="font-semibold text-slate-600">EDD: </span>
        {edd ? formatTimelineTimestamp(edd) : 'Not assigned'}
      </p>
    </div>
  );
}

function MovementHistoryLane({ title, lane }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500">
        {lane.referenceLabel}: <span className="font-semibold text-slate-700">{lane.referenceValue || 'N/A'}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {lane.relatedItems.map((item) => (
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1" key={item.oiId}>
            <img alt={item.oiId} className="h-4 w-4 rounded-full object-cover" src={item.image} />
            <span className="text-[10px] font-semibold text-slate-700">#{item.oiId}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {lane.rows.length === 0 && <p className="text-[11px] text-slate-500">No movement events yet.</p>}
        {lane.rows.map((row) => {
          const done = Boolean(row.timestamp);
          return (
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-[11px]" key={row.key}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">#{row.oiId}</span>
                  <span className="font-semibold text-slate-800">{row.event}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{row.note}</p>
              </div>
              <span className={`shrink-0 text-[10px] ${done ? 'text-emerald-700' : 'text-slate-500'}`}>
                {done ? formatTimelineTimestamp(row.timestamp) : 'Pending'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildLaneData(items, focusedItem, lane) {
  const referenceLabel = lane === 'middleMile' ? 'HAWB' : 'AWB';
  const referenceKey = lane === 'middleMile' ? 'hawb' : 'awb';
  const focusedReference = focusedItem?.checkpointDetails?.[lane]?.[referenceKey];
  const relatedItems = items.filter((item) => item.checkpointDetails?.[lane]?.[referenceKey] === focusedReference);
  const sourceItem = relatedItems[0];
  const sourceLaneInfo = sourceItem?.checkpointDetails?.[lane];
  const sourceEvents = sourceLaneInfo?.movementHistory || sourceLaneInfo?.courierCheckpoints || [];

  return {
    referenceLabel,
    referenceValue: focusedReference || 'N/A',
    relatedItems,
    rows: sourceEvents.map((event, index) => ({
      key: `${sourceItem?.oiId || 'oi'}-${lane}-${event.label}-${index}`,
      oiId: sourceItem?.oiId || 'N/A',
      event: event.label,
      note: `${referenceLabel} shared lane event`,
      timestamp: event.timestamp
    }))
  };
}

function StepIcon({ stepIndex }) {
  const common = 'h-4 w-4';

  switch (stepIndex) {
    case 0:
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24">
          <path d="M3 7h11v8H3z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M14 10h3l3 3v2h-6z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <circle cx="7" cy="17.5" r="1.5" fill="currentColor" />
          <circle cx="17" cy="17.5" r="1.5" fill="currentColor" />
        </svg>
      );
    case 1:
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24">
          <path d="M3 20h18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M5 20V9l7-4 7 4v11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M9 20v-5h6v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 2:
      return (
        <svg className={common} fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z" />
        </svg>
      );
    case 3:
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24">
          <path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M4 12l8 4 8-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M4 16l8 4 8-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 4:
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24">
          <path d="M3 8h10v7H3z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M13 11h4l3 3v1h-7z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <circle cx="7" cy="17" r="1.5" fill="currentColor" />
          <circle cx="17" cy="17" r="1.5" fill="currentColor" />
        </svg>
      );
    case 5:
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24">
          <path d="M4 11l8-6 8 6v8H4z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M9.5 15.5l1.8 1.8 3.4-3.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    default:
      return null;
  }
}

function CommercialInvoiceIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
      <path d="M7 3h8l4 4v14H7z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M15 3v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M10 13h6M10 17h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function OrderHistoryIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M4 12H2m20 0h-2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function AddToCartIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
      <path d="M3 5h2l2 10h10l2-7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="9" cy="19" r="1.5" fill="currentColor" />
      <circle cx="17" cy="19" r="1.5" fill="currentColor" />
      <path d="M17 7v4M15 9h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CustomerTags({ customer }) {
  const tier = getCustomerTierLabel(customer?.ordersPlaced);
  const source = getSourceTag(customer?.marketplace);

  return (
    <div className="mb-3 flex flex-wrap gap-2.5">
      {tier && (
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
            tier === 'VVIP' ? 'border-amber-200 bg-amber-100 text-amber-900' : 'border-emerald-200 bg-emerald-100 text-emerald-800'
          }`}
        >
          {tier}
        </span>
      )}
      <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-800">
        Source: {source}
      </span>
    </div>
  );
}

function InfoCard({ children, title, actions = null }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_15px_40px_-30px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {actions}
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  );
}

function DetailRow({ label, value, emphasize = false }) {
  const isPrimitiveValue = ['string', 'number', 'boolean'].includes(typeof value);

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      {isPrimitiveValue ? (
        <p className={`mt-1 break-words text-[15px] leading-snug ${emphasize ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
          {value}
        </p>
      ) : (
        <div className="mt-1">{value}</div>
      )}
    </div>
  );
}

function ShippingAddressDetails({ address }) {
  const normalized = normalizeShippingAddress(address);
  const fields = [
    { label: 'Address Line 1', value: normalized.addressLine1 },
    { label: 'Address Line 2', value: normalized.addressLine2 },
    { label: 'Province/State', value: normalized.provinceState },
    { label: 'City', value: normalized.city },
    { label: 'Area', value: normalized.area },
    { label: 'Zip Code', value: normalized.zipCode }
  ];

  return (
    <div className="space-y-1.5">
      {fields.map((field) => (
        <p className="text-[13px] leading-snug text-slate-700" key={field.label}>
          <span className="font-semibold text-slate-600">{field.label}: </span>
          <span className="font-medium text-slate-800">{field.value || 'Not provided'}</span>
        </p>
      ))}
    </div>
  );
}

function getDefaultShippingAddress() {
  return { ...EMPTY_SHIPPING_ADDRESS };
}

function normalizeShippingAddress(address) {
  if (!address) {
    return getDefaultShippingAddress();
  }

  if (typeof address === 'string') {
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      addressLine1: parts[0] || '',
      addressLine2: '',
      provinceState: parts[2] || '',
      city: parts[1] || '',
      area: '',
      zipCode: parts[3] || ''
    };
  }

  return {
    addressLine1: String(address.addressLine1 || address.line1 || '').trim(),
    addressLine2: String(address.addressLine2 || address.line2 || '').trim(),
    provinceState: String(address.provinceState || address.state || '').trim(),
    city: String(address.city || '').trim(),
    area: String(address.area || '').trim(),
    zipCode: String(address.zipCode || address.zip || '').trim()
  };
}

function flattenShippingAddress(address) {
  const normalized = normalizeShippingAddress(address);
  return [
    normalized.addressLine1,
    normalized.addressLine2,
    normalized.area,
    normalized.city,
    normalized.provinceState,
    normalized.zipCode
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getCompactStepLabel(step) {
  const compactMap = {
    'Departed from Seller': 'Store',
    'Consolidation Delaware, USA': 'Consolidation',
    'Middle Mile': 'Middle Mile',
    'Distribution Delhi, India': 'Distribution',
    'Last Mile': 'Last Mile',
    'Delivery Address': 'Delivery Address'
  };

  return compactMap[step] || step;
}

function getCompactStepSubLabel(index, checkpointDetails, stepEddTimestamps) {
  if (index === 0) {
    return 'Supplier warehouse';
  }

  if (index === 1) {
    return 'Distribution Center - Delaware (US)';
  }

  if (index === 2) {
    return checkpointDetails?.middleMile?.hawb || 'Air movement';
  }

  if (index === 3) {
    return 'Delivery Hub - Delhi';
  }

  if (index === 4) {
    return checkpointDetails?.lastMile?.awb || 'Last mile courier';
  }

  return stepEddTimestamps?.[index] ? `EDD: ${formatTimelineTimestamp(stepEddTimestamps[index])}` : 'Final destination';
}

function findMilestoneTimestamp(milestones = [], labelText = '') {
  const match = milestones.find((item) => (item.label || '').toLowerCase().includes(labelText.toLowerCase()));
  return match?.timestamp ? formatTimelineTimestamp(match.timestamp) : '';
}

function extractBoxId(milestones = []) {
  const match = milestones.find((item) => (item.label || '').toLowerCase().includes('assigned box id'));
  if (!match) {
    return '';
  }

  const parts = String(match.label).split('-');
  if (parts.length > 1) {
    return parts.slice(1).join('-').trim();
  }

  return match.timestamp ? 'Assigned' : '';
}

function getStatusLabel(statusIndex) {
  return TIMELINE_STEPS[statusIndex] || 'Status unavailable';
}

function getCompleteOrderStatus(items = []) {
  if (!items.length) {
    return { label: 'Status unavailable', tone: 'neutral' };
  }

  const checkpointFinalIndex = TIMELINE_STEPS.length - 1;
  const statusValues = items
    .map((item) => Number(item.currentStatus))
    .filter((value) => Number.isFinite(value));

  if (!statusValues.length) {
    return { label: 'Status unavailable', tone: 'neutral' };
  }

  const deliveredCount = statusValues.filter((status) => status >= checkpointFinalIndex).length;
  const cancellationCount = items.filter((item) => Boolean(item.cancellationRequested)).length;
  const maxStatus = Math.max(...statusValues);
  const minStatus = Math.min(...statusValues);

  if (cancellationCount === items.length) {
    return { label: 'Cancelled', tone: 'critical' };
  }

  if (deliveredCount === items.length) {
    return { label: 'Completed - Delivered', tone: 'success' };
  }

  if (deliveredCount > 0) {
    return { label: `Partially Delivered (${deliveredCount}/${items.length})`, tone: 'warning' };
  }

  if (maxStatus === minStatus) {
    return { label: getStatusLabel(maxStatus), tone: maxStatus >= 1 ? 'active' : 'neutral' };
  }

  if (maxStatus >= 4) {
    return { label: 'Final Mile In Progress', tone: 'active' };
  }

  if (maxStatus >= 2) {
    return { label: 'In Transit', tone: 'active' };
  }

  return { label: 'Processing Started', tone: 'neutral' };
}

function getOrderStatusToneClasses(tone) {
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-100 text-emerald-800';
  }

  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-100 text-amber-800';
  }

  if (tone === 'critical') {
    return 'border-rose-200 bg-rose-100 text-rose-800';
  }

  if (tone === 'active') {
    return 'border-indigo-200 bg-indigo-100 text-indigo-800';
  }

  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function inferSellingCountry(items = [], customer = null) {
  const sourceValues = items.map((item) => (item.storeSource || '').toLowerCase());
  if (sourceValues.some((source) => source.includes('amazon.co.uk'))) {
    return 'United Kingdom';
  }

  if (sourceValues.some((source) => source.includes('amazon.in'))) {
    return 'India';
  }

  if (sourceValues.some((source) => source.includes('amazon.com'))) {
    return 'United States';
  }

  const address = flattenShippingAddress(customer?.shippingAddress);
  if (address.includes('india')) {
    return 'India';
  }

  if (address.includes('uk') || address.includes('united kingdom')) {
    return 'United Kingdom';
  }

  return 'United States';
}

function getOppositeStoreSource(source) {
  if (source === 'Amazon.com') {
    return 'Amazon.co.uk';
  }

  if (source === 'Amazon.co.uk') {
    return 'Amazon.com';
  }

  return source || 'Amazon.com';
}

function getCustomerTierLabel(ordersPlaced) {
  const count = Number(ordersPlaced);
  if (!Number.isFinite(count)) {
    return '';
  }

  if (count > 50) {
    return 'VVIP';
  }

  if (count > 10) {
    return 'VIP';
  }

  return '';
}

function getSourceTag(marketplace) {
  const value = (marketplace || '').toLowerCase();
  if (value.includes('amazon') || value.includes('marketplace')) {
    return 'Marketplace';
  }

  return 'Website';
}

function getStoreUrlFromSource(storeSource, asin) {
  const market = getAmazonMarketFromSource(storeSource) || 'amazon.com';
  const baseDomain = market === 'amazon.co.uk' ? 'https://www.amazon.co.uk' : market === 'amazon.in' ? 'https://www.amazon.in' : 'https://www.amazon.com';

  if (!asin) {
    return baseDomain;
  }

  return `${baseDomain}/dp/${asin}`;
}

function getAmazonMarketFromSource(storeSource) {
  const value = (storeSource || '').toLowerCase();

  if (value.includes('amazon.co.uk')) {
    return 'amazon.co.uk';
  }

  if (value.includes('amazon.in')) {
    return 'amazon.in';
  }

  if (value.includes('amazon.com')) {
    return 'amazon.com';
  }

  return null;
}

function buildAmazonCartUrl(market, asins) {
  const base = AMAZON_CART_BASE_BY_MARKET[market];
  if (!base || !Array.isArray(asins) || asins.length === 0) {
    return '';
  }

  const params = new URLSearchParams();
  asins.forEach((asin, index) => {
    const position = index + 1;
    params.set(`ASIN.${position}`, asin);
    params.set(`Quantity.${position}`, '1');
  });
  params.set('AssociateTag', 'notag');

  return `${base}?${params.toString()}#:~:text=Add%20To%20Cart`;
}

function buildFinanceModel(item) {
  const fxRate = FINANCE_DEFAULTS.fxRate;
  const productWeightKg = parseWeightKg(item?.scrapedWeight) || 0.5;
  const productCostUsd = toFiniteNumber(item?.procuredPrice, toFiniteNumber(item?.scrapedPrice, 0));
  const purchaseChargesUsd = productCostUsd * FINANCE_DEFAULTS.purchaseChargesRate;
  const mmFreightUsd = productWeightKg * FINANCE_DEFAULTS.mmFreightRateUsdPerKg;
  const customsDutyUsd = productCostUsd * FINANCE_DEFAULTS.customsDutyRate;
  const clearanceFeeInrPerShipment = FINANCE_DEFAULTS.clearanceFeeInrPerShipment;
  const unitsPerShipment = FINANCE_DEFAULTS.unitsPerShipment;
  const clearanceFeeInrPerUnit = unitsPerShipment > 0 ? clearanceFeeInrPerShipment / unitsPerShipment : 0;
  const clearanceFeeInrAllocated = clearanceFeeInrPerUnit * productWeightKg;
  const clearanceFeeUsd = clearanceFeeInrAllocated / fxRate;
  const consolidationChargesUsd = productWeightKg * FINANCE_DEFAULTS.consolidationRateUsdPerKg;
  const itemQcUsd = FINANCE_DEFAULTS.itemQcUsdPerUnit;
  const lastMileCostInr = FINANCE_DEFAULTS.lastMileDeliveryInrPerKg * productWeightKg;
  const lastMileCostUsd = lastMileCostInr / fxRate;
  const lastMileDutyUsd = lastMileCostUsd * FINANCE_DEFAULTS.lastMileDutyRate;
  const vatChargesUsd = (lastMileCostUsd + lastMileDutyUsd) * FINANCE_DEFAULTS.vatGstRate;
  const fixedOverheadUsd = FINANCE_DEFAULTS.fixedOverheadUsdPerUnit;

  const baseLandedCostUsd =
    productCostUsd +
    purchaseChargesUsd +
    mmFreightUsd +
    customsDutyUsd +
    clearanceFeeUsd +
    consolidationChargesUsd +
    itemQcUsd +
    lastMileCostUsd +
    lastMileDutyUsd +
    vatChargesUsd +
    fixedOverheadUsd;

  const combinedRevenueRates =
    FINANCE_DEFAULTS.amazonFeeRate + FINANCE_DEFAULTS.paymentCardFeeRate + FINANCE_DEFAULTS.targetMarginRate;
  const requiredSellingPriceUsd =
    combinedRevenueRates < 1 ? baseLandedCostUsd / (1 - combinedRevenueRates) : 0;
  const amazonFeeUsd = requiredSellingPriceUsd * FINANCE_DEFAULTS.amazonFeeRate;
  const paymentCardFeeUsd = requiredSellingPriceUsd * FINANCE_DEFAULTS.paymentCardFeeRate;
  const grossProfitUsd =
    requiredSellingPriceUsd - baseLandedCostUsd - amazonFeeUsd - paymentCardFeeUsd;
  const marginCheckRate = requiredSellingPriceUsd > 0 ? grossProfitUsd / requiredSellingPriceUsd : 0;
  const unroundedDisplayPriceInr = requiredSellingPriceUsd * fxRate;
  const roundedDisplayPriceInr = roundToIncrement(
    unroundedDisplayPriceInr,
    FINANCE_DEFAULTS.displayRoundingIncrementInr
  );
  const finalPriceLocalSubunits = Math.round(
    roundedDisplayPriceInr * FINANCE_DEFAULTS.localCurrencySubunits
  );
  const landedCostAsPercentOfPrice =
    requiredSellingPriceUsd > 0 ? baseLandedCostUsd / requiredSellingPriceUsd : 0;
  const totalRevenueBasedFeesRate =
    FINANCE_DEFAULTS.amazonFeeRate + FINANCE_DEFAULTS.paymentCardFeeRate;
  const targetVsActualMarginDeltaPts =
    (marginCheckRate - FINANCE_DEFAULTS.targetMarginRate) * 100;
  const pricingStatus = combinedRevenueRates >= 1 ? 'CHECK INPUTS' : 'OK';
  const conversionCheck =
    roundedDisplayPriceInr >= unroundedDisplayPriceInr ? 'OK' : 'Review manually';

  const sections = [
    {
      title: '',
      rows: [
        {
          element: 'FX Rate',
          description: 'INR per 1 USD used for all currency conversion',
          unit: 'INR/USD',
          value: formatDecimal(fxRate, 2),
          localValue: '-',
          formula: 'Manual input'
        }
      ]
    },
    {
      title: 'Cost Build (USD)',
      rows: [
        {
          element: 'Product Cost',
          description: 'Pulled from inputs',
          unit: 'USD / unit',
          value: formatUsd(productCostUsd),
          localValue: formatInr(productCostUsd * fxRate),
          formula: 'Input product cost'
        },
        {
          element: 'Purchase Charges',
          description: 'Product cost × purchase charge %',
          unit: 'USD / unit',
          value: formatUsd(purchaseChargesUsd),
          localValue: formatInr(purchaseChargesUsd * fxRate),
          formula: 'Product Cost × Purchase Charge %'
        },
        {
          element: 'MM Freight',
          description: 'Weight × MM freight rate',
          unit: 'USD / unit',
          value: formatUsd(mmFreightUsd),
          localValue: formatInr(mmFreightUsd * fxRate),
          formula: 'Product Weight × MM Freight Rate'
        },
        {
          element: 'Customs Duty',
          description: 'Product cost × customs duty %',
          unit: 'USD / unit',
          value: formatUsd(customsDutyUsd),
          localValue: formatInr(customsDutyUsd * fxRate),
          formula: 'Product Cost × Customs Duty %'
        },
        {
          element: 'Clearance Fee (INR Allocation)',
          description: 'Shipment fee allocated against one unit shipment load',
          unit: 'INR / unit',
          value: formatInr(clearanceFeeInrAllocated),
          localValue: '-',
          formula: '(Clearance Fee / Shipment ÷ Units / Shipment) × Weight'
        },
        {
          element: 'Clearance Fee (USD)',
          description: 'INR clearance allocation converted to USD',
          unit: 'USD / unit',
          value: formatUsd(clearanceFeeUsd),
          localValue: formatInr(clearanceFeeUsd * fxRate),
          formula: 'INR Allocation ÷ FX Rate'
        },
        {
          element: 'Consolidation Charges',
          description: 'Weight × consolidation rate',
          unit: 'USD / unit',
          value: formatUsd(consolidationChargesUsd),
          localValue: formatInr(consolidationChargesUsd * fxRate),
          formula: 'Product Weight × Consolidation Rate'
        },
        {
          element: 'Item QC',
          description: 'Pulled from inputs',
          unit: 'USD / unit',
          value: formatUsd(itemQcUsd),
          localValue: formatInr(itemQcUsd * fxRate),
          formula: 'Input Item QC'
        },
        {
          element: 'Last-Mile Cost',
          description: 'Local delivery cost converted to USD',
          unit: 'USD / unit',
          value: formatUsd(lastMileCostUsd),
          localValue: formatInr(lastMileCostUsd * fxRate),
          formula: '(Last-Mile INR / kg × Weight) ÷ FX Rate'
        },
        {
          element: 'Last-Mile Duty',
          description: 'LM cost × duty %',
          unit: 'USD / unit',
          value: formatUsd(lastMileDutyUsd),
          localValue: formatInr(lastMileDutyUsd * fxRate),
          formula: 'Last-Mile Cost × Last-Mile Duty %'
        },
        {
          element: 'VAT Charges',
          description: 'Tax on LM cost plus LM duty',
          unit: 'USD / unit',
          value: formatUsd(vatChargesUsd),
          localValue: formatInr(vatChargesUsd * fxRate),
          formula: '(Last-Mile Cost + Last-Mile Duty) × VAT / GST %'
        },
        {
          element: 'Fixed Overhead',
          description: 'Pulled from inputs',
          unit: 'USD / unit',
          value: formatUsd(fixedOverheadUsd),
          localValue: formatInr(fixedOverheadUsd * fxRate),
          formula: 'Input Fixed Overhead'
        },
        {
          element: 'Base Landed Cost',
          description: 'Total per-unit landed cost before revenue-based fees',
          unit: 'USD / unit',
          value: formatUsd(baseLandedCostUsd),
          localValue: formatInr(baseLandedCostUsd * fxRate),
          formula: 'SUM(Product Cost … Fixed Overhead)'
        }
      ]
    },
    {
      title: 'Pricing Engine',
      rows: [
        {
          element: 'Required Selling Price',
          description: 'Reverse-price formula so target margin is preserved',
          unit: 'USD / unit',
          value: formatUsd(requiredSellingPriceUsd),
          localValue: formatInr(unroundedDisplayPriceInr),
          formula: 'Base Landed Cost ÷ (1 - Amazon Fee % - Payment Fee % - Target Margin %)'
        },
        {
          element: 'Amazon Fee',
          description: 'Selling price × Amazon fee %',
          unit: 'USD / unit',
          value: formatUsd(amazonFeeUsd),
          localValue: formatInr(amazonFeeUsd * fxRate),
          formula: 'Required Selling Price × Amazon Fee %'
        },
        {
          element: 'Payment/Card Fee',
          description: 'Selling price × payment fee %',
          unit: 'USD / unit',
          value: formatUsd(paymentCardFeeUsd),
          localValue: formatInr(paymentCardFeeUsd * fxRate),
          formula: 'Required Selling Price × Payment Fee %'
        },
        {
          element: 'Gross Profit',
          description: 'Selling price minus landed cost and revenue-based fees',
          unit: 'USD / unit',
          value: formatUsd(grossProfitUsd),
          localValue: formatInr(grossProfitUsd * fxRate),
          formula: 'Required Selling Price - Base Landed Cost - Amazon Fee - Payment Fee'
        },
        {
          element: 'Margin Check',
          description: 'Gross profit as % of selling price',
          unit: '% of selling price',
          value: formatPercent(marginCheckRate),
          localValue: '-',
          formula: 'Gross Profit ÷ Required Selling Price'
        },
        {
          element: 'Rounded Display Price',
          description: 'Nearest local selling price for customer-facing display',
          unit: 'INR / unit',
          value: formatInr(roundedDisplayPriceInr),
          localValue: '-',
          formula: 'Round(Required Selling Price × FX Rate, Rounding Increment)'
        },
        {
          element: 'Final Price Local Subunits',
          description: 'Rounded display price converted to local subunits',
          unit: 'subunits',
          value: formatSubunits(finalPriceLocalSubunits),
          localValue: '-',
          formula: 'Rounded Display Price × Local Currency Subunits'
        },
        {
          element: 'Landed Cost % of Selling Price',
          description: 'Base landed cost share of final price',
          unit: '% of selling price',
          value: formatPercent(landedCostAsPercentOfPrice),
          localValue: '-',
          formula: 'Base Landed Cost ÷ Required Selling Price'
        },
        {
          element: 'Total Revenue-Based Fees %',
          description: 'Amazon fee plus payment fee load on selling price',
          unit: '% of selling price',
          value: formatPercent(totalRevenueBasedFeesRate),
          localValue: '-',
          formula: 'Amazon Fee % + Payment/Card Fee %'
        },
        {
          element: 'Target vs Actual Margin Delta',
          description: 'Actual margin minus target margin',
          unit: '% pts',
          value: formatPoints(targetVsActualMarginDeltaPts),
          localValue: '-',
          formula: 'Margin Check - Target Margin'
        }
      ]
    },
    {
      title: 'Model Checks',
      rows: [
        {
          element: 'Pricing Status',
          description: 'Flags when fees + target margin exceed 100%',
          unit: 'status',
          value: pricingStatus,
          localValue: '-',
          formula: 'IF(Amazon Fee % + Payment Fee % + Target Margin % > 100%, "CHECK INPUTS", "OK")'
        },
        {
          element: 'Conversion Check',
          description: 'Rounded display price should be >= unrounded local price',
          unit: 'note',
          value: conversionCheck,
          localValue: '-',
          formula: 'Review if needed'
        }
      ]
    }
  ];

  return {
    baseLandedCostUsd,
    requiredSellingPriceUsd,
    grossProfitUsd,
    pricingStatus,
    sections
  };
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseWeightKg(value) {
  const parsed = Number.parseFloat(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundToIncrement(value, increment) {
  if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) {
    return 0;
  }
  return Math.round(value / increment) * increment;
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function formatInr(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(rate) {
  const pct = Number.isFinite(rate) ? rate * 100 : 0;
  return `${pct.toFixed(1)}%`;
}

function formatPoints(value) {
  const points = Number.isFinite(value) ? value : 0;
  return `${points >= 0 ? '+' : ''}${points.toFixed(1)} pts`;
}

function formatSubunits(value) {
  const number = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-IN').format(number);
}

function formatDecimal(value, fractionDigits = 2) {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : (0).toFixed(fractionDigits);
}

function buildInitialWeightClassifierData(orderItems) {
  return orderItems.reduce((accumulator, item) => {
    accumulator[item.id] = estimatePackageMetrics({
      title: item.name,
      description: item.description || '',
      asin: item.asin,
      scrapedWeight: item.scrapedWeight
    });
    return accumulator;
  }, {});
}

function sanitizeNumericInput(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function usdToInr(usdValue) {
  const parsedUsd = Number.parseFloat(usdValue);
  if (!Number.isFinite(parsedUsd)) {
    return '0.00';
  }

  return (parsedUsd * USD_TO_INR_RATE).toFixed(2);
}

function inrToUsd(inrValue) {
  const parsedInr = Number.parseFloat(inrValue);
  if (!Number.isFinite(parsedInr)) {
    return '0.00';
  }

  return (parsedInr / USD_TO_INR_RATE).toFixed(2);
}

function formatTimelineTimestamp(timestamp) {
  if (!timestamp) {
    return 'Timestamp pending';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getStepTimestampStatus(stepTimestamps, index, isReached) {
  const value = stepTimestamps?.[index];
  if (value) {
    return formatTimelineTimestamp(value);
  }

  return isReached ? 'Reached • Awaiting scan timestamp' : 'Pending';
}

function getStepEddText(stepEddTimestamps, index) {
  const value = stepEddTimestamps?.[index];
  if (value) {
    return formatTimelineTimestamp(value);
  }

  return 'Not assigned';
}

export default App;
