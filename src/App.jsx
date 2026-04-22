import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchOrderProcessingData, saveOrderItemPatch } from './api/mockOrderApi';

const TIMELINE_STEPS = [
  'Departed from Seller',
  'Consolidation Delaware, USA',
  'Middle Mile',
  'Distribution Delhi, India',
  'Last Mile',
  'Delivery Address'
];

const USD_TO_INR_RATE = 83.25;

function App() {
  const [orderNumber, setOrderNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [selectedOiId, setSelectedOiId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [payment, setPayment] = useState(null);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [syncStateByItem, setSyncStateByItem] = useState({});
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
        setPayment(data.payment);
        setOrderNumber(data.orderNumber || 'ORDER-UNAVAILABLE');
        setPoNumber(data.poNumber || 'PO-UNAVAILABLE');
        setItems(
          data.items.map((item) => ({
            ...item,
            sellerPriceInr: item.sellerPriceInr || usdToInr(item.sellPrice)
          }))
        );
      } catch (error) {
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

  const updateItemFieldLocal = (id, field, value) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  useEffect(() => {
    if (!selectedOiId && items.length > 0) {
      const firstOiId = items[0].oiId || `OI-${String(items[0].id).padStart(3, '0')}`;
      setSelectedOiId(firstOiId);
    }
  }, [items, selectedOiId]);

  const focusMovementHistory = (oiId) => {
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
    } catch (error) {
      if (saveRequestVersion.current[id] === nextVersion) {
        setSyncStateByItem((prev) => ({ ...prev, [id]: 'error' }));
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm font-semibold text-slate-600">Loading order processing data...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold text-rose-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="flex flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Order Processing</h1>
              <p className="mt-1 text-sm text-slate-500">Review and update pricing, sourcing, and transit details.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Order #</p>
                <p className="text-2xl font-black leading-tight text-slate-900">{orderNumber}</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-800">
                PO: {poNumber}
              </span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                {items.length} Items
              </span>
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
                syncState={syncStateByItem[item.id] || 'idle'}
              />
            ))}
          </div>

          <div ref={movementHistoryRef}>
            <OrderMovementHistoryPanel items={items} selectedOiId={selectedOiId} />
          </div>
        </main>

        <aside className="space-y-7 border-t border-slate-200 pt-6 xl:sticky xl:top-8 xl:self-start xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <InfoCard title="Customer Details">
            <CustomerTags customer={customer} />
            <DetailRow label="User ID" value={customer?.userId || 'Not provided'} />
            <DetailRow label="Name" value={customer?.name || 'Not provided'} />
            <DetailRow label="Email" value={customer?.email || 'Not provided'} />
            <DetailRow label="Phone" value={customer?.phone || 'Not provided'} />
            <DetailRow label="Marketplace" value={customer?.marketplace || 'Not provided'} />
            <DetailRow label="Orders Placed" value={String(customer?.ordersPlaced ?? 'Not provided')} />
            <DetailRow label="Last Login" value={customer?.lastLogin || 'Not provided'} />
            <DetailRow label="IP Address" value={customer?.ipAddress || 'Not provided'} />
            <DetailRow label="Browser Details" value={customer?.browserDetails || 'Not provided'} />
            <DetailRow label="Login" value={customer?.loginChannel || 'Not provided'} />
            <DetailRow label="Shipping Address" value={customer?.shippingAddress || 'Not provided'} />
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

function OrderItemCard({ item, onFieldChangeLocal, onFieldCommit, syncState, onViewHistory }) {
  const handlePriceChange = (field, value) => {
    onFieldChangeLocal(item.id, field, value);
  };

  const handlePriceCommit = (field, value) => {
    onFieldCommit(item.id, { [field]: value });
  };

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

  return (
    <article className="py-5 first:pt-4">
      <div className="mb-3 flex justify-end">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${syncStyleByState[syncState]}`}>
          {syncTextByState[syncState]}
        </span>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <img
            alt={item.name}
            className="h-24 w-24 rounded-lg object-cover"
            src={item.image}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{item.name}</h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                #{oiId}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">SKU: {item.sku}</p>

            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-600">
              <span><span className="font-semibold text-slate-700">ASIN:</span> {item.asin}</span>
              <span><span className="font-semibold text-slate-700">Purchase Ref:</span> {item.amazonPurchaseReference || 'N/A'}</span>
              <span><span className="font-semibold text-slate-700">Scraped Weight:</span> {item.scrapedWeight || 'N/A'}</span>
              <span><span className="font-semibold text-slate-700">AI Weight:</span> {item.aiWeight || 'N/A'}</span>
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
              label="Scraped Price"
              currencySymbol="$"
              onBlurCommit={(value) => handlePriceCommit('scrapedPrice', value)}
              onChangeValue={(value) => handlePriceChange('scrapedPrice', value)}
              value={item.scrapedPrice}
            />
            <EditablePriceMetric
              label="Procured Price"
              currencySymbol="$"
              onBlurCommit={(value) => handlePriceCommit('procuredPrice', value)}
              onChangeValue={(value) => handlePriceChange('procuredPrice', value)}
              value={item.procuredPrice}
            />
            <EditablePriceMetric
              currencySymbol="₹"
              label="Seller Price (INR)"
              onBlurCommit={(value) => {
                const inr = sanitizeNumericInput(value);
                handlePriceCommit('sellerPriceInr', inr);
                handlePriceCommit('sellPrice', inrToUsd(inr));
              }}
              onChangeValue={(value) => {
                const inr = sanitizeNumericInput(value);
                handlePriceChange('sellerPriceInr', inr);
                handlePriceChange('sellPrice', inrToUsd(inr));
              }}
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
    </article>
  );
}

function EditablePriceMetric({ label, onBlurCommit, onChangeValue, value, currencySymbol = '$' }) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative w-32">
        <span className="pointer-events-none absolute left-2.5 top-2 text-sm font-medium text-slate-500">{currencySymbol}</span>
        <input
          className="h-9 w-full rounded-md border border-slate-300 bg-white pl-6 pr-2 text-sm font-semibold text-slate-900 focus:border-slate-400 focus:outline-none"
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
  const trackLeftPercent = 50 / steps.length;
  const trackWidthPercent = ((steps.length - 1) / steps.length) * 100;
  const progressRatio = steps.length > 1 ? safeStatus / (steps.length - 1) : 1;
  const progressWidthPercent = trackWidthPercent * progressRatio;

  return (
    <section className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Order Status Timeline</h3>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          {getStatusLabel(safeStatus)}
        </span>
      </div>

      <div className="mt-4">
        <div className="relative">
          <div
            className="timeline-track hidden xl:block"
            style={{
              left: `${trackLeftPercent}%`,
              width: `${trackWidthPercent}%`
            }}
          />
          <div
            className="timeline-progress hidden xl:block"
            style={{
              left: `${trackLeftPercent}%`,
              width: `${progressWidthPercent}%`
            }}
          />

          <ol className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            {steps.map((step, index) => {
              const isReached = index <= safeStatus;
              const isCurrent = index === safeStatus;

              return (
                <li className="px-1" key={step}>
                  <div className="flex flex-col items-start">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.2)]'
                          : isReached
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <StepIcon stepIndex={index} />
                    </span>
                    <p
                      className={`mt-2 text-[15px] font-semibold leading-snug ${
                        isReached ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {step}
                    </p>
                  </div>

                  <div className="mt-2 space-y-1 text-[12px] leading-5">
                    <p className="text-slate-600">
                      <span className="font-semibold text-slate-500">EDD: </span>
                      {getStepEddText(stepEddTimestamps, index)}
                    </p>
                    <p className={`${isReached ? 'text-emerald-700' : 'text-slate-500'}`}>
                      <span className="font-semibold text-slate-500">Arrived: </span>
                      {getStepTimestampStatus(stepTimestamps, index, isReached)}
                    </p>
                  </div>

                  {index === 1 && (
                    <div className="mt-2">
                      <ReadOnlyMilestoneDropdown
                        milestones={checkpointDetails?.consolidationDelaware?.milestones}
                        title="Consolidation Events"
                      />
                    </div>
                  )}
                  {index === 2 && (
                    <div className="mt-2">
                      <MovementInfoPanel
                        arrivedAt={checkpointDetails?.middleMile?.arrivedAt}
                        departedAt={checkpointDetails?.middleMile?.departedAt}
                        edd={checkpointDetails?.middleMile?.edd}
                        referenceLabel="HAWB"
                        referenceValue={checkpointDetails?.middleMile?.hawb}
                      />
                    </div>
                  )}
                  {index === 3 && (
                    <div className="mt-2">
                      <ReadOnlyMilestoneDropdown
                        milestones={checkpointDetails?.distributionDelhi?.milestones}
                        title="Distribution Delhi Ops"
                      />
                    </div>
                  )}
                  {index === 4 && (
                    <div className="mt-2">
                      <MovementInfoPanel
                        arrivedAt={checkpointDetails?.lastMile?.arrivedAt}
                        departedAt={checkpointDetails?.lastMile?.departedAt}
                        edd={checkpointDetails?.lastMile?.edd}
                        referenceLabel="AWB"
                        referenceValue={checkpointDetails?.lastMile?.awb}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
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
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Order Movement History</h3>
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

function ReadOnlyMilestoneDropdown({ title, milestones = [] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition group-hover:text-slate-800">
        {title}
      </summary>
      <div className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
        {milestones.length === 0 && (
          <div className="text-[10px] text-slate-500">
            No checkpoint data available.
          </div>
        )}
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
            <img
              alt={item.oiId}
              className="h-4 w-4 rounded-full object-cover"
              src={item.image}
            />
            <span className="text-[10px] font-semibold text-slate-700">#{item.oiId}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {lane.rows.length === 0 && (
          <p className="text-[11px] text-slate-500">No movement events yet.</p>
        )}
        {lane.rows.map((row) => {
          const done = Boolean(row.timestamp);
          return (
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-[11px]" key={row.key}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">#{row.oiId}</span>
                  <span className="font-semibold text-slate-800">{row.event}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                  {row.note}
                </p>
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
          <path
            d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z"
          />
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

function CustomerTags({ customer }) {
  const tier = getCustomerTierLabel(customer?.ordersPlaced);
  const source = getSourceTag(customer?.marketplace);

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {tier && (
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            tier === 'VVIP'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {tier}
        </span>
      )}
      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
        Source: {source}
      </span>
    </div>
  );
}

function InfoCard({ children, title }) {
  return (
    <section className="border-b border-slate-200 pb-6 last:border-b-0">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value, emphasize = false }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-1.5 last:border-b-0">
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-right text-sm leading-snug ${emphasize ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {value}
      </p>
    </div>
  );
}

function getStatusLabel(statusIndex) {
  return TIMELINE_STEPS[statusIndex] || 'Status unavailable';
}

function getOppositeStoreSource(source) {
  return source === 'Amazon.com' ? 'Amazon.co.uk' : 'Amazon.com';
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
  if (!asin) {
    return storeSource === 'Amazon.co.uk' ? 'https://www.amazon.co.uk' : 'https://www.amazon.com';
  }

  return storeSource === 'Amazon.co.uk'
    ? `https://www.amazon.co.uk/dp/${asin}`
    : `https://www.amazon.com/dp/${asin}`;
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
