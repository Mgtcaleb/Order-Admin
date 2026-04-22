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
const USD_TO_GBP_RATE = 0.79;
const STORE_SOURCE_OPTIONS = ['Amazon.com', 'Amazon.co.uk', 'Amazon.in'];
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
  const [isMovementHistoryVisible, setIsMovementHistoryVisible] = useState(false);
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
      <div className="min-h-screen bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm font-semibold text-slate-600">Loading order processing data...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold text-rose-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(120%_65%_at_14%_-14%,rgba(30,64,175,0.16),transparent_58%),radial-gradient(100%_70%_at_90%_-18%,rgba(13,148,136,0.14),transparent_62%),linear-gradient(180deg,#f8fafc_0%,#ffffff_48%,#f8fafc_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1520px] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <main className="flex flex-col">
          <div className="rounded-3xl border border-slate-700/20 bg-[linear-gradient(140deg,#0b1220_0%,#182335_46%,#0f766e_130%)] p-5 shadow-[0_35px_80px_-34px_rgba(2,6,23,0.8)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-white">
                  <DashboardIcon className="h-6 w-6 text-cyan-200" />
                  <span>Order Processing</span>
                </h1>
                <p className="mt-1.5 max-w-xl text-xs font-medium leading-relaxed text-slate-300">
                  Review and update pricing, sourcing, and transit details.
                </p>
                <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                  <span className="inline-block h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.2)]" />
                  Selling Country: {sellingCountry || 'Not set'}
                </span>
              </div>

              <div className="flex flex-col items-start gap-1.5 lg:items-end">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Order #</p>
                <p className="text-3xl font-black leading-none tracking-tight text-white">{orderNumber}</p>
                <div className="mt-0.5 flex flex-wrap gap-1.5 lg:justify-end">
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur ${getOrderStatusToneClasses(
                      completeOrderStatus.tone
                    )}`}
                  >
                    Complete Order Status: {completeOrderStatus.label}
                  </span>
                  <span className="rounded-full border border-cyan-200/50 bg-cyan-100/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-900">
                    PO: {poNumber}
                  </span>
                  <span className="rounded-full border border-amber-200/60 bg-amber-100/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900">
                    {items.length} Items
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200/80 bg-white/90 px-5 shadow-[0_20px_45px_-38px_rgba(15,23,42,0.55)] backdrop-blur-sm">
            <div className="divide-y divide-slate-200">
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
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.6)] backdrop-blur-sm" ref={movementHistoryRef}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <OrderHistoryIcon />
                <span>Order Movement History</span>
              </p>
              <button
                aria-pressed={isMovementHistoryVisible}
                aria-label={isMovementHistoryVisible ? 'Collapse order movement history' : 'Expand order movement history'}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                  isMovementHistoryVisible
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                }`}
                onClick={() => setIsMovementHistoryVisible((prev) => !prev)}
                type="button"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${
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
              <p className="mt-3 text-xs text-slate-500">Movement history is hidden. Click the down arrow to expand.</p>
            )}
          </div>

          <BottomActionTabs
            completeOrderStatus={completeOrderStatus}
            customer={customerView || customer}
            items={items}
            orderNumber={orderNumber}
            payment={payment}
            poNumber={poNumber}
            sellingCountry={sellingCountry}
          />
        </main>

        <aside className="space-y-4 border-t border-slate-200 pt-4 xl:sticky xl:top-4 xl:self-start xl:border-t-0 xl:pt-0">
          <InfoCard
            title="Customer Details"
            icon={<CustomerCardIcon className="h-5 w-5 text-blue-700" />}
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
            <DetailRow label="Name" value={customerView?.name || 'Not provided'} />
            <DetailRow label="Shipping Address" value={<ShippingAddressDetails address={customerView?.shippingAddress} />} />
            <DetailRow label="Phone Number" value={customerView?.phone || 'Not provided'} />
            <DetailRow label="Email Address" value={customerView?.email || 'Not provided'} />
            <DetailRow label="User ID" value={customerView?.userId || 'Not provided'} />
            <DetailRow label="Marketplace" value={customerView?.marketplace || 'Not provided'} />
            <DetailRow label="Country" value={customerView?.country || sellingCountry || 'Not provided'} />
            <DetailRow label="Marketplace Order ID" value={customerView?.marketplaceOrderId || 'Not provided'} />
            <DetailRow label="Orders Placed" value={String(customerView?.ordersPlaced ?? 'Not provided')} />
            <DetailRow label="Last Login" value={customerView?.lastLogin || 'Not provided'} />
            <DetailRow label="IP Address" value={customerView?.ipAddress || 'Not provided'} />
            <DetailRow label="Browser Details" value={customerView?.browserDetails || 'Not provided'} />
            <DetailRow label="Login" value={customerView?.loginChannel || 'Not provided'} />
          </InfoCard>

          <InfoCard icon={<PaymentCardIcon className="h-5 w-5 text-blue-700" />} title="Payment Details">
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
    idle: 'bg-slate-100 text-slate-600 border border-slate-200',
    saving: 'bg-amber-100 text-amber-800 border border-amber-200',
    saved: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    error: 'bg-rose-100 text-rose-800 border border-rose-200'
  };

  const oiId = item.oiId || `OI-${String(item.id).padStart(3, '0')}`;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(() => buildOiEditDraft(item));
  const [showCancellationControl, setShowCancellationControl] = useState(Boolean(item.cancellationRequested));
  const [cancellationReasonDraft, setCancellationReasonDraft] = useState(item.cancellationReason || '');
  const [cancellationError, setCancellationError] = useState('');
  const [isJourneyLogOpen, setIsJourneyLogOpen] = useState(false);
  const [selectedStoreSource, setSelectedStoreSource] = useState(item.storeSource || 'Amazon.com');
  const [pendingStoreSwitch, setPendingStoreSwitch] = useState(null);

  useEffect(() => {
    if (isEditModalOpen) {
      return;
    }

    setEditDraft(buildOiEditDraft(item));
    setShowCancellationControl(Boolean(item.cancellationRequested));
    setCancellationReasonDraft(item.cancellationReason || '');
    setCancellationError('');
  }, [item, isEditModalOpen]);

  useEffect(() => {
    setSelectedStoreSource(item.storeSource || 'Amazon.com');
    setPendingStoreSwitch(null);
  }, [item.id, item.storeSource]);

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
  const sourceCurrency = getPriceCurrencyMeta(item.storeSource);
  const currentStatusTagClasses = getStatusTagClasses(item.currentStatus);
  const journeyLogs = getOrderedJourneyLogs(item);

  const requestStoreSwitch = () => {
    if (!selectedStoreSource || selectedStoreSource === item.storeSource) {
      return;
    }

    const fromCurrency = getPriceCurrencyMeta(item.storeSource);
    const toCurrency = getPriceCurrencyMeta(selectedStoreSource);
    const convertedScrapedPrice = convertPriceAcrossCurrencies(item.scrapedPrice, fromCurrency.code, toCurrency.code);
    const convertedProcuredPrice = convertPriceAcrossCurrencies(item.procuredPrice, fromCurrency.code, toCurrency.code);

    setPendingStoreSwitch({
      fromSource: item.storeSource,
      toSource: selectedStoreSource,
      fromCurrency,
      toCurrency,
      scrapedPriceFrom: sanitizeNumericInput(item.scrapedPrice),
      scrapedPriceTo: convertedScrapedPrice,
      procuredPriceFrom: sanitizeNumericInput(item.procuredPrice),
      procuredPriceTo: convertedProcuredPrice,
      patch: {
        storeSource: selectedStoreSource,
        scrapedPrice: convertedScrapedPrice,
        procuredPrice: convertedProcuredPrice,
        storeUrl: getStoreUrlFromSource(selectedStoreSource, item.asin)
      }
    });
  };

  const confirmStoreSwitch = () => {
    if (!pendingStoreSwitch?.patch) {
      return;
    }

    Object.entries(pendingStoreSwitch.patch).forEach(([field, value]) => {
      onFieldChangeLocal(item.id, field, value);
    });
    onFieldCommit(item.id, pendingStoreSwitch.patch);
    setSelectedStoreSource(pendingStoreSwitch.toSource);
    setPendingStoreSwitch(null);
  };

  return (
    <article className="relative py-5">
      {syncState !== 'idle' ? (
        <div className="mb-2 flex justify-end">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${syncStyleByState[syncState]}`}>
            {syncTextByState[syncState]}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex w-[96px] shrink-0 flex-col gap-1.5">
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-slate-700">#{oiId}</p>
            <button
              className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-teal-300 hover:bg-teal-50"
              onClick={() => setIsJourneyLogOpen(true)}
              type="button"
            >
              <JourneyLogIcon className="h-3.5 w-3.5" />
              Logs
            </button>
            <img alt={item.name} className="h-20 w-20 rounded-2xl border border-slate-200 object-cover shadow-[0_12px_24px_-18px_rgba(15,23,42,0.65)] ring-1 ring-white" src={item.image} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[19px] font-bold leading-tight tracking-tight text-slate-900">{item.name}</h2>
              <button
                className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
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
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${currentStatusTagClasses}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {getStatusLabel(item.currentStatus)}
              </span>
            </div>
            <p className="mt-1 text-[14px] font-medium text-slate-500">SKU: {item.sku}</p>
            <div className="mt-2 grid gap-x-4 gap-y-1.5 text-[13px] text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
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

            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-3 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.5)]">
              <div className="flex items-center justify-between gap-3">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <ScaleIcon className="h-4 w-4 text-slate-500" />
                  <span>Weight Classifier</span>
                </p>
              </div>
              <div className="mt-1.5 grid gap-2 text-[12px] text-slate-700 sm:grid-cols-3">
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
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 transition hover:text-teal-800 hover:underline"
              href={item.storeUrl || getStoreUrlFromSource(item.storeSource, item.asin)}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              Store URL
            </a>

            <label className="mt-3 flex max-w-[520px] flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <CommercialInvoiceIcon />
                <span>Commercial Invoice Description</span>
              </span>
              <input
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-cyan-300 focus:outline-none"
                onBlur={(event) => onFieldCommit(item.id, { invoiceDescription: event.target.value })}
                onChange={(event) => onFieldChangeLocal(item.id, 'invoiceDescription', event.target.value)}
                placeholder="Amend invoice description"
                type="text"
                value={resolvedInvoiceDescription}
              />
            </label>

            <div className="mt-2 grid max-w-[520px] gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">HS Code</span>
                <input
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-cyan-300 focus:outline-none"
                  onBlur={(event) => onFieldCommit(item.id, { hsCode: event.target.value })}
                  onChange={(event) => onFieldChangeLocal(item.id, 'hsCode', event.target.value)}
                  placeholder="e.g. 2106.90"
                  type="text"
                  value={item.hsCode || ''}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Declared Value (USD)</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-2 text-[13px] font-medium text-slate-500">$</span>
                  <input
                    className="h-9 w-full rounded-md border border-slate-200 bg-white pl-7 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-cyan-300 focus:outline-none"
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
          </div>
        </div>

        <div className="w-full border-t border-slate-100 pt-3 xl:w-[320px] xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
          <div className="space-y-1.5 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-3 shadow-[0_15px_32px_-30px_rgba(15,23,42,0.5)]">
            <EditablePriceMetric
              currencySymbol={sourceCurrency.symbol}
              label={`Scraped Price (${sourceCurrency.code})`}
              disabled
              onBlurCommit={() => {}}
              onChangeValue={() => {}}
              value={item.scrapedPrice}
            />
            <EditablePriceMetric
              currencySymbol={sourceCurrency.symbol}
              label={`Procured Price (${sourceCurrency.code})`}
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

          <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_15px_32px_-30px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <StoreSourceIcon className="h-3.5 w-3.5 text-slate-500" />
                Store Source
              </p>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {sourceCurrency.code}
              </span>
            </div>

            <p className="mt-1 text-[15px] font-semibold text-slate-900">{item.storeSource}</p>

            <div className="mt-1.5 grid gap-1.5">
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-700">
                Change Store
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                  onChange={(event) => setSelectedStoreSource(event.target.value)}
                  value={selectedStoreSource}
                >
                  {STORE_SOURCE_OPTIONS.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-cyan-300 bg-cyan-50 px-3 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                disabled={selectedStoreSource === item.storeSource}
                onClick={requestStoreSwitch}
                type="button"
              >
                <SwitchStoreIcon className="h-3.5 w-3.5" />
                Switch Store
              </button>
            </div>

            {pendingStoreSwitch ? (
              <div className="mt-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-cyan-900">
                  {pendingStoreSwitch.fromSource} to {pendingStoreSwitch.toSource}
                </p>
                <p className="mt-1 text-[10px] text-cyan-800">
                  Scraped {formatCurrencyAmount(pendingStoreSwitch.scrapedPriceFrom, pendingStoreSwitch.fromCurrency.code)} to{' '}
                  {formatCurrencyAmount(pendingStoreSwitch.scrapedPriceTo, pendingStoreSwitch.toCurrency.code)}
                </p>
                <p className="text-[10px] text-cyan-800">
                  Procured {formatCurrencyAmount(pendingStoreSwitch.procuredPriceFrom, pendingStoreSwitch.fromCurrency.code)} to{' '}
                  {formatCurrencyAmount(pendingStoreSwitch.procuredPriceTo, pendingStoreSwitch.toCurrency.code)}
                </p>
                <p className="mt-1 text-[10px] font-medium text-cyan-900">Seller Price (INR) unchanged</p>
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-md border border-cyan-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 transition hover:bg-cyan-100"
                    onClick={confirmStoreSwitch}
                    type="button"
                  >
                    Confirm
                  </button>
                  <button
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100"
                    onClick={() => setPendingStoreSwitch(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-1.5 grid gap-1.5">
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-700">
                Store ID
                <input
                  className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-cyan-300 focus:outline-none"
                  onBlur={(event) => onFieldCommit(item.id, { storeId: event.target.value.trim() })}
                  onChange={(event) => onFieldChangeLocal(item.id, 'storeId', event.target.value)}
                  placeholder="Assign store ID"
                  type="text"
                  value={item.storeId || ''}
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-700">
                Alternative URL
                <input
                  className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-cyan-300 focus:outline-none"
                  onBlur={(event) => onFieldCommit(item.id, { alternativeUrl: event.target.value.trim() })}
                  onChange={(event) => onFieldChangeLocal(item.id, 'alternativeUrl', event.target.value)}
                  placeholder="Paste 3rd-party product link"
                  type="url"
                  value={item.alternativeUrl || ''}
                />
              </label>
            </div>
          </div>
        </div>
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
          className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
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
      <JourneyLogsModal
        isOpen={isJourneyLogOpen}
        itemName={item.name}
        logs={journeyLogs}
        oiId={oiId}
        onClose={() => setIsJourneyLogOpen(false)}
      />
    </article>
  );
}

function JourneyLogsModal({ isOpen, oiId, itemName, logs, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Item Journey Logs</p>
            <h3 className="text-base font-semibold text-slate-900">
              #{oiId} • {itemName}
            </h3>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">No journey logs available for this item yet.</p>
            ) : (
              logs.map((log, index) => (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5" key={`${log.timestamp}-${log.action}-${index}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-900">{log.action}</p>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {formatTimelineTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-700">
                    <span className="font-semibold">{log.actorName}</span>
                    <span className="text-slate-500"> • {log.actorRole}</span>
                  </p>
                  {log.location ? (
                    <p className="mt-0.5 text-[11px] italic text-slate-500">
                      {log.location}
                    </p>
                  ) : null}
                  {log.details ? (
                    <p className="mt-1 text-[12px] text-slate-600">{log.details}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
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
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500'
              : 'border-slate-200 bg-white text-slate-900 shadow-sm focus:border-cyan-300'
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
    firstMile: false,
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
    <section className="mt-4 overflow-hidden rounded-2xl bg-transparent shadow-none">
      <div className="flex justify-end px-3 pb-2">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          {getStatusLabel(safeStatus)}
        </span>
      </div>

      <div className="overflow-x-auto px-3 py-3.5">
        <ol className="flex min-w-[900px] items-start">
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
                      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${
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

                  <p className={`mt-1.5 text-[12px] font-semibold ${isReached ? 'text-slate-900' : 'text-slate-500'}`}>
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSectionByStep(index)} type="button">
                      <span>{getCompactStepLabel(step)}</span>
                      <span className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                          <path d="M7 10l5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </span>
                    </button>
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{getCompactStepSubLabel(index, checkpointDetails, stepEddTimestamps)}</p>
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
    <section className="border-b border-slate-200 px-3 py-3.5 last:border-b-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h4>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          {leftItems.map((item) => (
            <TimelineDetailRow item={item} key={`${title}-left-${item.label}`} />
          ))}
        </div>
        <div className="space-y-3">
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
      <p className="text-[11px] text-slate-500">{item.label}</p>
      <p
        className={`mt-0.5 text-[14px] font-semibold ${
          item.tone === 'positive' ? 'text-emerald-700' : item.tone === 'accent' ? 'text-cyan-700' : 'text-slate-900'
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
    <section className="mt-2.5">
      <p className="mt-1 text-xs text-slate-500">
        Focused Item: <span className="font-semibold text-slate-700">#{focusedId}</span>
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <MovementHistoryLane lane={middleLane} title="Middle Mile" />
        <MovementHistoryLane lane={lastLane} title="Last Mile" />
      </div>
    </section>
  );
}

function AmazonCartSection({ items }) {
  const cartLinks = useMemo(() => buildCartLinksByMarket(items), [items]);

  if (cartLinks.length === 0) {
    return null;
  }

  return (
    <section className="mt-3 flex flex-wrap items-center justify-end gap-2.5">
      {cartLinks.map((entry) => (
        <a
          aria-label={`Open ${entry.market} cart`}
          className="group inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_18px_30px_-18px_rgba(8,145,178,0.35)]"
          href={entry.url}
          key={entry.market}
          rel="noreferrer"
          target="_blank"
          title={`Open ${entry.market} cart`}
        >
          <AmazonBrandIcon />
          <span className="text-[11px] font-bold tracking-wide text-slate-700">
            Add to Cart - {getMarketCartLabel(entry.market)}
          </span>
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
            [{entry.totalQuantity}]
          </span>
        </a>
      ))}
    </section>
  );
}

function BottomActionTabs({ items, orderNumber, poNumber, payment, customer, sellingCountry, completeOrderStatus }) {
  const [activeTab, setActiveTab] = useState('');
  const [notificationLogs, setNotificationLogs] = useState([]);
  const cartLinks = useMemo(() => buildCartLinksByMarket(items), [items]);
  const cartByMarket = useMemo(
    () => new Map(cartLinks.map((entry) => [entry.market, entry])),
    [cartLinks]
  );
  const appendNotificationLog = (entry) => {
    const log = {
      id: `${entry.type || 'log'}-${entry.oiId || 'order'}-${Date.now()}`,
      createdAt: entry.createdAt || new Date().toISOString(),
      ...entry
    };

    setNotificationLogs((prev) => [log, ...prev].slice(0, 60));
  };

  const regularTabs = [
    { id: 'charge', label: 'Charge' },
    { id: 'edit-order', label: 'Edit Order' },
    { id: 'commercials', label: 'Commercials' },
    { id: 'adjustments', label: 'Adjustments' },
    { id: 'bot-info', label: 'Bot Info' },
    { id: 'notifications', label: 'Notifications' }
  ];

  const cartTabs = [
    { market: 'amazon.com' },
    { market: 'amazon.co.uk' },
    { market: 'amazon.in' }
  ].map(({ market }) => {
    const entry = cartByMarket.get(market);
    const qty = entry?.totalQuantity || 0;
    return {
      market,
      qty,
      href: entry?.url || '',
      label: `Add To Cart - ${getMarketCartLabel(market)} [${qty}]`
    };
  });

  return (
    <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_14px_30px_-34px_rgba(15,23,42,0.55)]">
      <p className="text-sm font-semibold text-slate-700">Customer Comment:</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {regularTabs.map((tab) => (
          <button
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-semibold transition ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white shadow-[0_8px_20px_-14px_rgba(59,130,246,0.85)]'
                : 'text-blue-600 hover:bg-blue-50'
            }`}
            key={tab.id}
            onClick={() => setActiveTab((prev) => (prev === tab.id ? '' : tab.id))}
            type="button"
          >
            <TabOptionIcon id={tab.id} />
            {tab.label}
          </button>
        ))}

        {cartTabs.map((tab) =>
          tab.href ? (
            <a
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-50"
              href={tab.href}
              key={tab.market}
              rel="noreferrer"
              target="_blank"
            >
              <TabOptionIcon id="add-to-cart" />
              {tab.label}
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-semibold text-slate-400"
              key={tab.market}
            >
              <TabOptionIcon id="add-to-cart" />
              {tab.label}
            </span>
          )
        )}
      </div>

      {activeTab === 'charge' ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ChargeDetailsPanel
            completeOrderStatus={completeOrderStatus}
            customer={customer}
            items={items}
            onAddNotificationLog={appendNotificationLog}
            orderNumber={orderNumber}
            payment={payment}
            poNumber={poNumber}
            sellingCountry={sellingCountry}
          />
        </div>
      ) : null}

      {activeTab === 'commercials' ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <FinanceTabSection embedded items={items} />
        </div>
      ) : null}

      {activeTab === 'adjustments' ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <AdjustmentsPanel items={items} onAddNotificationLog={appendNotificationLog} />
        </div>
      ) : null}

      {activeTab === 'notifications' ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <NotificationsPanel
            customer={customer}
            items={items}
            notificationLogs={notificationLogs}
            onAddNotificationLog={appendNotificationLog}
          />
        </div>
      ) : null}
    </section>
  );
}

function ChargeDetailsPanel({
  items,
  orderNumber,
  poNumber,
  payment,
  customer,
  sellingCountry,
  completeOrderStatus,
  onAddNotificationLog
}) {
  const [refundState, setRefundState] = useState('idle');
  const [refundRequestedAt, setRefundRequestedAt] = useState('');
  const transactions = useMemo(
    () => buildChargeTransactions(payment, {
      completeOrderStatus,
      customer,
      items,
      orderNumber,
      poNumber,
      sellingCountry
    }),
    [payment, orderNumber, poNumber, customer, sellingCountry, completeOrderStatus, items]
  );

  const requestRefund = (transaction) => {
    setRefundState('requested');
    const createdAt = new Date().toISOString();
    setRefundRequestedAt(createdAt);
    onAddNotificationLog?.({
      type: 'refund',
      title: 'Refund initiated',
      description: `Refund requested for transaction ${transaction.authTransactionId || transaction.id}`,
      oiId: items[0]?.oiId || '',
      recipient: customer?.email || '',
      channel: 'payment'
    });
  };

  if (!transactions.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <p className="text-[12px] font-medium text-slate-600">No transaction details found.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <h3 className="text-[30px] font-medium tracking-tight text-slate-800">Transactions</h3>

      <div className="mt-2.5 space-y-3">
        {transactions.map((transaction) => (
          <article className="rounded-lg border border-slate-200 bg-white p-3" key={transaction.id}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-2.5">
              <p className="text-[20px] font-semibold text-slate-800">
                Charged:{' '}
                <span
                  className={`inline-flex rounded-md px-2.5 py-0.5 text-[13px] font-semibold ${
                    transaction.charged
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {transaction.charged ? 'Success' : 'Failed'}
                </span>
              </p>
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[15px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                disabled={refundState === 'requested' || !transaction.charged}
                onClick={() => requestRefund(transaction)}
                type="button"
              >
                {refundState === 'requested' ? 'Refund Requested' : 'Refund'}
              </button>
            </div>

            <div className="border-b border-slate-200 py-2.5">
              <p className="text-[15px] font-semibold text-slate-800">Amount:</p>
              <p className="text-[14px] text-slate-700">Country format : {transaction.countryAmount}</p>
              <p className="text-[14px] text-slate-700">General Format : {transaction.generalAmount}</p>
            </div>

            <div className="border-b border-slate-200 py-2.5">
              <p className="text-[15px] font-semibold text-slate-800">Auth Transaction Id:</p>
              <p className="text-[15px] text-slate-800">
                {transaction.authTransactionId}
                <span className="ml-1 font-semibold">Created:</span>
                {transaction.createdAt ? formatTimelineTimestamp(transaction.createdAt) : 'Not recorded'}
              </p>
            </div>

            <div className="space-y-1.5 py-2.5">
              <TransactionInfoRow label="UID" value={transaction.uid} />
              <TransactionInfoRow label="Action ID" value={transaction.actionId} />
              <TransactionInfoRow label="Status" value={transaction.status} />
              <TransactionInfoRow label="Card" value={transaction.cardMasked} />
              <TransactionInfoRow label="Reference" value={transaction.reference} />
              <TransactionInfoRow label="Processing Reference Number" value={transaction.processingReferenceNumber} />
              <TransactionInfoRow label="Processing Transaction UID" value={transaction.processingTransactionUid} />
              <TransactionInfoRow label="Processing entity" value={transaction.processingEntity} />
              <TransactionInfoRow label="Previous payment id" value={transaction.previousPaymentId || '-'} />
              <TransactionInfoRow label="Transaction for Order ids" value={transaction.transactionForOrderId} />
              <TransactionInfoRow label="Order #" value={transaction.orderNumber} />
              <TransactionInfoRow label="PO #" value={transaction.poNumber} />
              <TransactionInfoRow label="Marketplace" value={transaction.marketplace} />
              <TransactionInfoRow label="Marketplace Order ID" value={transaction.marketplaceOrderId} />
              <TransactionInfoRow label="Billing Address" value={transaction.billingAddress} />
              <TransactionInfoRow label="Complete Order Status" value={transaction.completeOrderStatus} />
            </div>
          </article>
        ))}
      </div>

      {refundRequestedAt ? (
        <p className="mt-2 text-[11px] font-medium text-amber-700">
          Refund request submitted at {formatTimelineTimestamp(refundRequestedAt)}.
        </p>
      ) : null}
    </section>
  );
}

function TransactionInfoRow({ label, value }) {
  return (
    <p className="text-[14px] text-slate-700">
      <span className="font-semibold text-slate-800">{label}:</span> {value || 'Not provided'}
    </p>
  );
}

function buildChargeTransactions(payment, context) {
  const countryCurrency = getCurrencyCodeForCountry(context?.sellingCountry);
  const orderTotalUsd = toFiniteNumber(payment?.orderTotal, 0);
  const countryAmount = payment?.countryAmount
    ? String(payment.countryAmount)
    : formatCurrencyAmount(convertUsdToCurrency(orderTotalUsd, countryCurrency), countryCurrency);
  const generalAmount = payment?.generalAmount ? String(payment.generalAmount) : formatUsd(orderTotalUsd);
  const fallbackId = payment?.transactionId || payment?.authTransactionId || 'TXN-UNAVAILABLE';

  if (Array.isArray(payment?.transactions) && payment.transactions.length) {
    return payment.transactions.map((transaction, index) => ({
      actionId: transaction.actionId || payment?.actionId || '-',
      authTransactionId: transaction.authTransactionId || payment?.authTransactionId || fallbackId,
      billingAddress: transaction.billingAddress || payment?.billingAddress || '-',
      cardMasked: transaction.cardMasked || payment?.cardMasked || payment?.method || '-',
      charged: Boolean(transaction.charged ?? payment?.charged ?? true),
      completeOrderStatus: context?.completeOrderStatus?.label || 'Not provided',
      countryAmount: transaction.countryAmount || countryAmount,
      createdAt: transaction.createdAt || payment?.createdAt || '',
      generalAmount: transaction.generalAmount || generalAmount,
      id: transaction.id || `${fallbackId}-${index}`,
      marketplace: context?.customer?.marketplace || 'Not provided',
      marketplaceOrderId: context?.customer?.marketplaceOrderId || 'Not provided',
      orderNumber: context?.orderNumber || 'Not provided',
      poNumber: context?.poNumber || 'Not provided',
      previousPaymentId: transaction.previousPaymentId || payment?.previousPaymentId || '',
      processingEntity: transaction.processingEntity || payment?.processingEntity || '-',
      processingReferenceNumber: transaction.processingReferenceNumber || payment?.processingReferenceNumber || '-',
      processingTransactionUid: transaction.processingTransactionUid || payment?.processingTransactionUid || '-',
      reference: transaction.reference || payment?.reference || '-',
      status: transaction.status || payment?.status || 'Approved',
      transactionForOrderId: transaction.transactionForOrderId || payment?.transactionForOrderId || context?.orderNumber || '-',
      uid: transaction.uid || payment?.uid || payment?.authTransactionId || fallbackId
    }));
  }

  return [
    {
      actionId: payment?.actionId || '-',
      authTransactionId: payment?.authTransactionId || fallbackId,
      billingAddress: payment?.billingAddress || '-',
      cardMasked: payment?.cardMasked || payment?.method || '-',
      charged: Boolean(payment?.charged ?? true),
      completeOrderStatus: context?.completeOrderStatus?.label || 'Not provided',
      countryAmount,
      createdAt: payment?.createdAt || '',
      generalAmount,
      id: fallbackId,
      marketplace: context?.customer?.marketplace || 'Not provided',
      marketplaceOrderId: context?.customer?.marketplaceOrderId || 'Not provided',
      orderNumber: context?.orderNumber || 'Not provided',
      poNumber: context?.poNumber || 'Not provided',
      previousPaymentId: payment?.previousPaymentId || '',
      processingEntity: payment?.processingEntity || '-',
      processingReferenceNumber: payment?.processingReferenceNumber || '-',
      processingTransactionUid: payment?.processingTransactionUid || '-',
      reference: payment?.reference || '-',
      status: payment?.status || 'Approved',
      transactionForOrderId: payment?.transactionForOrderId || context?.orderNumber || '-',
      uid: payment?.uid || payment?.authTransactionId || fallbackId
    }
  ];
}

function getCurrencyCodeForCountry(country) {
  const value = String(country || '').toLowerCase();
  if (value.includes('india')) {
    return 'INR';
  }
  if (value.includes('united kingdom') || value.includes('uk')) {
    return 'GBP';
  }
  if (value.includes('uae') || value.includes('united arab emirates')) {
    return 'AED';
  }
  return 'USD';
}

function AdjustmentsPanel({ items, onAddNotificationLog }) {
  const [draftByOiId, setDraftByOiId] = useState(() =>
    Object.fromEntries(
      items.map((item) => [
        item.oiId,
        {
          action: '',
          reason: '',
          priority: 'standard'
        }
      ])
    )
  );
  const [lastAppliedAtByOiId, setLastAppliedAtByOiId] = useState({});

  useEffect(() => {
    setDraftByOiId((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        if (!next[item.oiId]) {
          next[item.oiId] = { action: '', reason: '', priority: 'standard' };
        }
      });
      return next;
    });
  }, [items]);

  const applyCount = useMemo(
    () => Object.values(lastAppliedAtByOiId).filter(Boolean).length,
    [lastAppliedAtByOiId]
  );

  const countsByAction = useMemo(() => {
    const counts = { replace: 0, refund: 0, reorder: 0 };
    Object.values(draftByOiId).forEach((draft) => {
      if (draft?.action && counts[draft.action] !== undefined) {
        counts[draft.action] += 1;
      }
    });
    return counts;
  }, [draftByOiId]);

  const applyForItem = (oiId) => {
    const draft = draftByOiId[oiId];
    if (!draft?.action) {
      return;
    }

    const appliedAt = new Date().toISOString();
    setLastAppliedAtByOiId((prev) => ({
      ...prev,
      [oiId]: appliedAt
    }));
    const targetItem = items.find((item) => item.oiId === oiId);
    onAddNotificationLog?.({
      type: draft.action,
      title: `${toTitleCase(draft.action)} applied`,
      description:
        draft.reason?.trim() ||
        `${toTitleCase(draft.action)} action recorded for #${oiId}${targetItem?.sku ? ` (${targetItem.sku})` : ''}`,
      oiId,
      channel: 'operations',
      recipient: 'Internal Ops',
      createdAt: appliedAt
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <AdjustmentStatChip label="Items in scope" value={String(items.length)} />
        <AdjustmentStatChip label="Replace selected" value={String(countsByAction.replace)} />
        <AdjustmentStatChip label="Refund selected" value={String(countsByAction.refund)} />
        <AdjustmentStatChip label="Reorder selected" value={String(countsByAction.reorder)} />
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-[980px] table-fixed text-left">
          <thead className="bg-slate-100">
            <tr>
              <th className="w-[100px] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">#OI-ID</th>
              <th className="w-[300px] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Item</th>
              <th className="w-[160px] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Adjustment Option</th>
              <th className="w-[140px] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Priority</th>
              <th className="px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Reason / Notes</th>
              <th className="w-[170px] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const draft = draftByOiId[item.oiId] || { action: '', reason: '', priority: 'standard' };
              const appliedAt = lastAppliedAtByOiId[item.oiId];

              return (
                <tr className={`border-t border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`} key={item.id}>
                  <td className="px-2.5 py-2 text-[11px] font-semibold text-slate-800">#{item.oiId}</td>
                  <td className="px-2.5 py-2">
                    <p className="line-clamp-2 text-[12px] font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">SKU: {item.sku}</p>
                  </td>
                  <td className="px-2.5 py-2">
                    <select
                      className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setDraftByOiId((prev) => ({
                          ...prev,
                          [item.oiId]: { ...draft, action: event.target.value }
                        }))
                      }
                      value={draft.action}
                    >
                      <option value="">Select</option>
                      <option value="replace">Replace</option>
                      <option value="refund">Refund</option>
                      <option value="reorder">Reorder</option>
                    </select>
                  </td>
                  <td className="px-2.5 py-2">
                    <select
                      className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setDraftByOiId((prev) => ({
                          ...prev,
                          [item.oiId]: { ...draft, priority: event.target.value }
                        }))
                      }
                      value={draft.priority}
                    >
                      <option value="standard">Standard</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
                      onChange={(event) =>
                        setDraftByOiId((prev) => ({
                          ...prev,
                          [item.oiId]: { ...draft, reason: event.target.value }
                        }))
                      }
                      placeholder="Add adjustment context"
                      type="text"
                      value={draft.reason}
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <button
                      className="inline-flex h-8 items-center justify-center rounded-md border border-blue-300 bg-blue-50 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 transition hover:border-blue-400 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={!draft.action}
                      onClick={() => applyForItem(item.oiId)}
                      type="button"
                    >
                      Apply
                    </button>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {appliedAt ? `Applied ${formatTimelineTimestamp(appliedAt)}` : 'Not applied'}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Adjustment actions configured: <span className="font-semibold text-slate-700">{applyCount}</span>
      </p>
    </section>
  );
}

function AdjustmentStatChip({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function NotificationsPanel({ items, customer, notificationLogs = [], onAddNotificationLog }) {
  const [eventDraftByKey, setEventDraftByKey] = useState({});

  const notificationEvents = useMemo(() => {
    const outOfStockItems = items.filter((item) => {
      const reason = String(item.cancellationReason || '').toLowerCase();
      return reason.includes('inventory unavailable');
    });

    const cancellationItems = items.filter((item) => Boolean(item.cancellationRequested));

    const lastMileDelayItems = items.filter((item) => {
      const eddRaw = item?.checkpointDetails?.lastMile?.edd;
      if (!eddRaw) {
        return false;
      }
      const eddTime = new Date(eddRaw).getTime();
      if (!Number.isFinite(eddTime)) {
        return false;
      }
      const arrivedAt = item?.checkpointDetails?.lastMile?.arrivedAt;
      return !arrivedAt && Date.now() > eddTime && Number(item.currentStatus) < TIMELINE_STEPS.length - 1;
    });

    return [
      {
        key: 'out-of-stock',
        label: 'Out of stock of item',
        defaultTemplate: 'stockout-apology',
        items: outOfStockItems
      },
      {
        key: 'customer-cancellation',
        label: 'Cancellation requested by customer',
        defaultTemplate: 'cancellation-confirmation',
        items: cancellationItems
      },
      {
        key: 'last-mile-delay',
        label: 'Last mile courier delay',
        defaultTemplate: 'courier-delay-update',
        items: lastMileDelayItems
      }
    ];
  }, [items]);

  useEffect(() => {
    setEventDraftByKey((prev) => {
      const next = { ...prev };
      notificationEvents.forEach((event) => {
        if (!next[event.key]) {
          next[event.key] = {
            oiId: event.items[0]?.oiId || '',
            template: event.defaultTemplate,
            channel: 'email'
          };
        } else {
          const preferredOiId = next[event.key].oiId;
          const hasSelected = event.items.some((item) => item.oiId === preferredOiId);
          next[event.key] = {
            channel: next[event.key].channel || 'email',
            template: next[event.key].template || event.defaultTemplate,
            oiId: hasSelected ? preferredOiId : event.items[0]?.oiId || ''
          };
        }
      });
      return next;
    });
  }, [notificationEvents]);

  const sendNotification = (eventConfig) => {
    const draft = eventDraftByKey[eventConfig.key];
    if (!draft?.oiId) {
      return;
    }

    const selectedItem = items.find((item) => item.oiId === draft.oiId);
    onAddNotificationLog?.({
      type: 'email-notification',
      title: eventConfig.label,
      description: `${draft.template} sent for ${selectedItem?.name || 'item'}`,
      channel: draft.channel,
      oiId: draft.oiId,
      recipient: customer?.email || 'customer@email.com',
      createdAt: new Date().toISOString()
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="space-y-2">
        {notificationEvents.map((eventConfig) => {
          const draft = eventDraftByKey[eventConfig.key] || {
            oiId: '',
            template: eventConfig.defaultTemplate,
            channel: 'email'
          };

          return (
            <div className="rounded-lg border border-slate-200 bg-white p-2.5" key={eventConfig.key}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-slate-900">{eventConfig.label}</p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {eventConfig.items.length} matched
                </span>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Send To
                  <select
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:border-blue-400 focus:outline-none"
                    onChange={(event) =>
                      setEventDraftByKey((prev) => ({
                        ...prev,
                        [eventConfig.key]: { ...draft, channel: event.target.value }
                      }))
                    }
                    value={draft.channel}
                  >
                    <option value="email">Email</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Item
                  <select
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:border-blue-400 focus:outline-none"
                    onChange={(event) =>
                      setEventDraftByKey((prev) => ({
                        ...prev,
                        [eventConfig.key]: { ...draft, oiId: event.target.value }
                      }))
                    }
                    value={draft.oiId}
                  >
                    <option value="">Select #OI-ID</option>
                    {eventConfig.items.map((item) => (
                      <option key={`${eventConfig.key}-${item.oiId}`} value={item.oiId}>
                        #{item.oiId} - {item.sku}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Email Template
                  <select
                    className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:border-blue-400 focus:outline-none"
                    onChange={(event) =>
                      setEventDraftByKey((prev) => ({
                        ...prev,
                        [eventConfig.key]: { ...draft, template: event.target.value }
                      }))
                    }
                    value={draft.template}
                  >
                    <option value="stockout-apology">Stockout Apology</option>
                    <option value="cancellation-confirmation">Cancellation Confirmation</option>
                    <option value="courier-delay-update">Courier Delay Update</option>
                    <option value="custom-status-update">Custom Status Update</option>
                  </select>
                </label>

                <div className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>Dispatch</span>
                  <button
                    className="inline-flex h-8 items-center justify-center rounded-md border border-blue-300 bg-blue-50 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 transition hover:border-blue-400 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!draft.oiId || !eventConfig.items.length}
                    onClick={() => sendNotification(eventConfig)}
                    type="button"
                  >
                    Send Email
                  </button>
                </div>
              </div>

              <p className="mt-1.5 text-[11px] text-slate-500">
                Recipient: <span className="font-semibold text-slate-700">{customer?.email || 'customer@email.com'}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Notification Logs</p>
        {notificationLogs.length ? (
          <div className="mt-2 space-y-1.5">
            {notificationLogs.slice(0, 10).map((entry) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5" key={entry.id}>
                <p className="text-[11px] font-semibold text-slate-800">
                  {entry.title || 'Activity'} {entry.oiId ? `• #${entry.oiId}` : ''}
                </p>
                <p className="text-[10px] text-slate-600">
                  {entry.description || 'No description'} • {entry.channel || 'system'} • {entry.recipient || 'N/A'}
                </p>
                <p className="text-[10px] text-slate-500">{formatTimelineTimestamp(entry.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-slate-500">No notification logs yet.</p>
        )}
      </div>
    </section>
  );
}

function toTitleCase(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function TabOptionIcon({ id, className = 'h-3.5 w-3.5' }) {
  switch (id) {
    case 'charge':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M12 3v18M16 7H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case 'edit-order':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M13 7l4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    case 'commercials':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M4 20h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <rect height="7" rx="1.2" stroke="currentColor" width="3.5" x="6" y="10" />
          <rect height="10" rx="1.2" stroke="currentColor" width="3.5" x="10.5" y="7" />
          <rect height="5" rx="1.2" stroke="currentColor" width="3.5" x="15" y="12" />
        </svg>
      );
    case 'adjustments':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M4 7h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <circle cx="9" cy="7" fill="currentColor" r="2" />
          <circle cx="15" cy="17" fill="currentColor" r="2" />
        </svg>
      );
    case 'bot-info':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <rect height="10" rx="2.5" stroke="currentColor" width="14" x="5" y="8" />
          <path d="M12 4v3M8 18v2M16 18v2M19 12h2M3 12h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <circle cx="10" cy="12.5" fill="currentColor" r="1" />
          <circle cx="14" cy="12.5" fill="currentColor" r="1" />
        </svg>
      );
    case 'notifications':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M7 10a5 5 0 1 1 10 0v4l2 2H5l2-2v-4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    case 'add-to-cart':
      return (
        <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
          <path d="M3 5h2l2 10h10l2-7H7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <circle cx="9" cy="19" fill="currentColor" r="1.3" />
          <circle cx="17" cy="19" fill="currentColor" r="1.3" />
        </svg>
      );
    default:
      return null;
  }
}

function getMarketCartLabel(market) {
  if (market === 'amazon.co.uk') {
    return 'UK';
  }

  if (market === 'amazon.in') {
    return 'India';
  }

  return 'US';
}

function buildCartLinksByMarket(items = []) {
  const groupedAsins = new Map();

  items.forEach((item) => {
    const market = getAmazonMarketFromSource(item.storeSource);
    const asin = (item.asin || '').trim();
    const parsedQuantity = Number(item.quantity ?? item.qty ?? 1);
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.floor(parsedQuantity) : 1;

    if (!market || !asin) {
      return;
    }

    if (!groupedAsins.has(market)) {
      groupedAsins.set(market, new Map());
    }

    const marketAsinMap = groupedAsins.get(market);
    marketAsinMap.set(asin, (marketAsinMap.get(asin) || 0) + quantity);
  });

  return Array.from(groupedAsins.entries())
    .map(([market, marketAsinMap]) => {
      const asinEntries = Array.from(marketAsinMap.entries()).map(([asin, quantity]) => ({ asin, quantity }));
      const totalQuantity = asinEntries.reduce((sum, entry) => sum + entry.quantity, 0);

      return {
        market,
        asinEntries,
        uniqueAsinCount: asinEntries.length,
        totalQuantity,
        url: buildAmazonCartUrl(market, asinEntries)
      };
    })
    .filter((entry) => Boolean(entry.url));
}

function AmazonBrandIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6 rounded-md shadow-sm" fill="none" viewBox="0 0 36 36">
      <rect fill="#ff9900" height="36" rx="8" width="36" />
      <text
        fill="#ffffff"
        fontFamily="Georgia, serif"
        fontSize="21"
        fontWeight="700"
        x="12.3"
        y="20.8"
      >
        a
      </text>
      <path
        d="M7.5 24.8C12 28 20.1 28.2 27.1 23.9"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path d="M24.7 22.8h3.6l-1.9 2.9" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function FinanceTabSection({ items, embedded = false }) {
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
  const isExpanded = embedded || isFinanceOpen;

  return (
    <section
      className={`${embedded ? '' : 'mt-4'} rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-3 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.55)]`}
    >
      {embedded ? (
        <p className="text-xs text-slate-500">
          Unit economics per order item. Active item: <span className="font-semibold text-slate-700">#{activeItem.oiId}</span>
        </p>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              <CommercialsIcon />
              <span>Commercials</span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Unit economics per order item. Active item: <span className="font-semibold text-slate-700">#{activeItem.oiId}</span>
            </p>
          </div>
          <button
            aria-label={isFinanceOpen ? 'Collapse commercials' : 'Expand commercials'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
              isFinanceOpen
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
            }`}
            onClick={() => setIsFinanceOpen((prev) => !prev)}
            type="button"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${isFinanceOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
            >
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      )}

      {!isExpanded ? (
        <p className="mt-2 text-xs text-slate-500">Commercials view is collapsed. Click the arrow to expand.</p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {items.map((item) => (
              <button
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
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

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <FinanceSummaryCard label="Base Landed Cost (USD)" tone="slate" value={formatUsd(finance.baseLandedCostUsd)} />
            <FinanceSummaryCard label="Required Selling Price (USD)" tone="blue" value={formatUsd(finance.requiredSellingPriceUsd)} />
            <FinanceSummaryCard label="Gross Profit (USD)" tone={finance.grossProfitUsd >= 0 ? 'emerald' : 'rose'} value={formatUsd(finance.grossProfitUsd)} />
            <FinanceSummaryCard label="Pricing Status" tone={finance.pricingStatus === 'OK' ? 'emerald' : 'amber'} value={finance.pricingStatus} />
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-[1100px] table-fixed text-left">
              <thead className="sticky top-0 z-10">
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
                    {section.rows.map((row, rowIndex) => (
                      <tr
                        className={`border-t border-slate-100 align-top ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                        key={`${section.title || 'default'}-${row.element}`}
                      >
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
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
          <path d="M4 19h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M7 19v-7l5-3 5 3v7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M10.5 16h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    default:
      return <div className={common} />;
  }
}

function DashboardIcon({ className = 'h-5 w-5 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CustomerCardIcon({ className = 'h-5 w-5 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 18.5a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="17.5" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14.5 18.5a4.5 4.5 0 0 1 6 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function PaymentCardIcon({ className = 'h-5 w-5 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="5" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ItemBoxIcon({ className = 'h-4 w-4 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 8l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M4 8v8l8 4 8-4V8" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ScaleIcon({ className = 'h-4 w-4 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 4v16M5 9h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M7 9l-3 5h6l-3-5zM17 9l-3 5h6l-3-5z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'h-4 w-4 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CommercialsIcon({ className = 'h-4 w-4 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="3" />
      <path d="M8 8h8M8 12h3M8 16h8M13.5 12h2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function StoreSourceIcon({ className = 'h-4 w-4 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 8.5L6 4h12l2 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M5 9h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 13h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SwitchStoreIcon({ className = 'h-4 w-4 text-slate-600' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 7h11l-2.5-2.5M17 17H6l2.5 2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M18 7l-2.5 2.5M6 17l2.5-2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
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

function JourneyLogIcon({ className = 'h-4 w-4 text-slate-500' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 3h8l4 4v14H7z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M15 3v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M10 12h6M10 16h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="9" cy="8" fill="currentColor" r="1.1" />
    </svg>
  );
}

function CustomerTags({ customer }) {
  const tier = getCustomerTierLabel(customer?.ordersPlaced);
  const source = getSourceTag(customer?.marketplace);

  return (
    <div className="mb-2.5 flex flex-wrap gap-2">
      {tier && (
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
            tier === 'VVIP'
              ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100 text-amber-900'
              : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-900'
          }`}
        >
          {tier}
        </span>
      )}
      <span className="rounded-full border border-cyan-200 bg-gradient-to-r from-cyan-50 to-cyan-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-900 shadow-sm">
        Source: {source}
      </span>
    </div>
  );
}

function InfoCard({ children, title, icon = null, actions = null }) {
  return (
    <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_26px_52px_-36px_rgba(15,23,42,0.55)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-[22px] font-black tracking-tight text-slate-900">
          {icon}
          <span>{title}</span>
        </h2>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailRow({ label, value, emphasize = false }) {
  const isPrimitiveValue = ['string', 'number', 'boolean'].includes(typeof value);

  return (
    <div className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] items-start gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <div>
        {isPrimitiveValue ? (
          <p className={`break-words text-[15px] leading-snug ${emphasize ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{value}</p>
        ) : (
          <div>{value}</div>
        )}
      </div>
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
        <p className="text-[14px] leading-snug text-slate-700" key={field.label}>
          <span className="font-semibold text-slate-500">{field.label}: </span>
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
    return 'border-emerald-200/70 bg-emerald-100/90 text-emerald-900';
  }

  if (tone === 'warning') {
    return 'border-amber-200/70 bg-amber-100/90 text-amber-900';
  }

  if (tone === 'critical') {
    return 'border-rose-200/70 bg-rose-100/90 text-rose-900';
  }

  if (tone === 'active') {
    return 'border-cyan-200/80 bg-cyan-100/90 text-cyan-900';
  }

  return 'border-slate-200/70 bg-slate-100/90 text-slate-800';
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

function getStatusTagClasses(status) {
  if (status <= 1) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (status <= 3) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status <= 4) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-violet-200 bg-violet-50 text-violet-700';
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

function getPriceCurrencyMeta(storeSource) {
  const market = getAmazonMarketFromSource(storeSource) || 'amazon.com';

  if (market === 'amazon.co.uk') {
    return { code: 'GBP', symbol: '£' };
  }

  if (market === 'amazon.in') {
    return { code: 'INR', symbol: '₹' };
  }

  return { code: 'USD', symbol: '$' };
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

function convertPriceAcrossCurrencies(value, fromCurrency, toCurrency) {
  const fromCode = String(fromCurrency || '').toUpperCase();
  const toCode = String(toCurrency || '').toUpperCase();
  if (!fromCode || !toCode) {
    return sanitizeNumericInput(value);
  }

  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) {
    return '0.00';
  }

  if (fromCode === toCode) {
    return sanitizeNumericInput(amount);
  }

  const amountInUsd = convertCurrencyToUsd(amount, fromCode);
  const convertedAmount = convertUsdToCurrency(amountInUsd, toCode);
  return sanitizeNumericInput(convertedAmount);
}

function convertCurrencyToUsd(amount, currencyCode) {
  const code = String(currencyCode || '').toUpperCase();
  if (!Number.isFinite(amount)) {
    return 0;
  }

  if (code === 'GBP') {
    return amount / USD_TO_GBP_RATE;
  }

  if (code === 'INR') {
    return amount / USD_TO_INR_RATE;
  }

  return amount;
}

function convertUsdToCurrency(usdAmount, currencyCode) {
  const code = String(currencyCode || '').toUpperCase();
  if (!Number.isFinite(usdAmount)) {
    return 0;
  }

  if (code === 'GBP') {
    return usdAmount * USD_TO_GBP_RATE;
  }

  if (code === 'INR') {
    return usdAmount * USD_TO_INR_RATE;
  }

  return usdAmount;
}

function formatCurrencyAmount(value, currencyCode) {
  const code = String(currencyCode || '').toUpperCase() || 'USD';
  const parsed = Number.parseFloat(value);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  const locale = code === 'INR' ? 'en-IN' : code === 'GBP' ? 'en-GB' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function buildAmazonCartUrl(market, asinEntries) {
  const base = AMAZON_CART_BASE_BY_MARKET[market];
  if (!base || !Array.isArray(asinEntries) || asinEntries.length === 0) {
    return '';
  }

  const normalizedEntries = asinEntries
    .map((entry) => {
      const asin = String(entry?.asin || '').trim();
      const parsedQuantity = Number(entry?.quantity);
      const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.floor(parsedQuantity) : 1;

      return { asin, quantity };
    })
    .filter((entry) => Boolean(entry.asin));

  if (normalizedEntries.length === 0) {
    return '';
  }

  const params = new URLSearchParams();
  normalizedEntries.forEach((entry, index) => {
    const position = index + 1;
    params.set(`ASIN.${position}`, entry.asin);
    params.set(`Quantity.${position}`, String(entry.quantity));
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

function getOrderedJourneyLogs(item) {
  const rawLogs = Array.isArray(item?.journeyLogs) ? item.journeyLogs : [];
  if (!rawLogs.length) {
    return [];
  }

  return [...rawLogs].sort((a, b) => {
    const first = new Date(a?.timestamp || '').getTime();
    const second = new Date(b?.timestamp || '').getTime();
    const firstSafe = Number.isFinite(first) ? first : Number.MAX_SAFE_INTEGER;
    const secondSafe = Number.isFinite(second) ? second : Number.MAX_SAFE_INTEGER;
    return firstSafe - secondSafe;
  });
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
