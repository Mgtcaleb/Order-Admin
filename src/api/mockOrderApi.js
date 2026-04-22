const MOCK_ORDER_DATA = {
  orderNumber: 'ORD-2026-04-21-7842',
  poNumber: 'PO-US-2026-0419-117',
  customer: {
    userId: 'USR-100294',
    name: 'Alex Morgan',
    email: 'alex.morgan@email.com',
    phone: '+1 (202) 555-0172',
    marketplace: 'Amazon Marketplace',
    ordersPlaced: 58,
    lastLogin: '21 Apr 2026, 12:34 pm',
    ipAddress: '103.24.119.42',
    browserDetails: 'Chrome 135 on macOS',
    loginChannel: 'Web',
    shippingAddress: '1428 Ocean View Dr, San Diego, CA 92103'
  },
  payment: {
    method: 'Visa **** 4242',
    billingAddress: '1428 Ocean View Dr, San Diego, CA 92103',
    transactionId: 'TXN-9J3K2L-84Q1',
    orderTotal: '272.50'
  },
  items: [
    {
      id: 1,
      oiId: 'OI-1001',
      name: 'Noise-Cancelling Bluetooth Headphones',
      sku: 'HDP-NCB-1002',
      image: 'https://placehold.co/112x112/e2e8f0/0f172a?text=Item+1',
      scrapedPrice: '74.99',
      procuredPrice: '67.25',
      sellPrice: '89.00',
      asin: 'B0D4X9ZQ11',
      amazonPurchaseReference: 'AMZ-PR-448291',
      storeSource: 'Amazon.com',
      storeUrl: 'https://www.amazon.com/dp/B0D4X9ZQ11',
      scrapedWeight: '0.42 kg',
      aiWeight: '0.40 kg',
      alternativeUrl: '',
      currentStatus: 1,
      stepEddTimestamps: [
        '2026-04-21T06:50:00+05:30',
        '2026-04-21T09:30:00+05:30',
        '2026-04-21T14:15:00+05:30',
        '2026-04-21T20:40:00+05:30',
        '2026-04-22T09:20:00+05:30',
        '2026-04-22T14:00:00+05:30'
      ],
      stepTimestamps: [
        '2026-04-21T07:10:00+05:30',
        '2026-04-21T09:18:00+05:30',
        null,
        null,
        null,
        null
      ],
      checkpointDetails: {
        consolidationDelaware: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T09:18:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T09:46:00+05:30' },
            { label: 'Assigned Box ID - BX-DLW-1072', timestamp: null },
            { label: 'Departure from Consolidation', timestamp: null }
          ]
        },
        middleMile: {
          hawb: 'HAWB-DEL-884109',
          departedAt: null,
          arrivedAt: null,
          edd: '2026-04-21T14:15:00+05:30',
          movementHistory: [
            { label: 'Flight Booking Confirmed', timestamp: '2026-04-21T10:05:00+05:30' },
            { label: 'Manifest Created', timestamp: '2026-04-21T11:18:00+05:30' },
            { label: 'Departed Origin Airport', timestamp: null },
            { label: 'Arrived Destination Airport', timestamp: null }
          ]
        },
        distributionDelhi: {
          milestones: [
            { label: 'Item Check IN', timestamp: null },
            { label: 'Item QC', timestamp: null },
            { label: 'Item Shelving', timestamp: null },
            { label: 'Item Packing', timestamp: null },
            { label: 'Assigned for Last Mile', timestamp: null }
          ]
        },
        lastMile: {
          awb: 'AWB-DEL-550981',
          departedAt: null,
          arrivedAt: null,
          edd: '2026-04-22T09:20:00+05:30',
          movementHistory: [
            { label: 'AWB Generated', timestamp: '2026-04-21T23:40:00+05:30' },
            { label: 'Courier Assigned', timestamp: null },
            { label: 'Out for Delivery', timestamp: null },
            { label: 'Delivered', timestamp: null }
          ],
          courierCheckpoints: [
            { label: 'Courier Picked Parcel', timestamp: null },
            { label: 'Reached Local Delivery Hub', timestamp: null },
            { label: 'Out for Delivery', timestamp: null },
            { label: 'Delivery Attempt', timestamp: null }
          ]
        }
      }
    },
    {
      id: 2,
      oiId: 'OI-1002',
      name: '4K Webcam Pro with Privacy Shutter',
      sku: 'CAM-4K-PS-882',
      image: 'https://placehold.co/112x112/cbd5e1/0f172a?text=Item+2',
      scrapedPrice: '58.00',
      procuredPrice: '54.60',
      sellPrice: '71.50',
      asin: 'B0B8L2MKT5',
      amazonPurchaseReference: 'AMZ-PR-448327',
      storeSource: 'Amazon.co.uk',
      storeUrl: 'https://www.amazon.co.uk/dp/B0B8L2MKT5',
      scrapedWeight: '0.31 kg',
      aiWeight: '0.33 kg',
      alternativeUrl: '',
      currentStatus: 3,
      stepEddTimestamps: [
        '2026-04-21T06:30:00+05:30',
        '2026-04-21T08:20:00+05:30',
        '2026-04-21T10:45:00+05:30',
        '2026-04-21T17:30:00+05:30',
        '2026-04-22T07:10:00+05:30',
        '2026-04-22T13:40:00+05:30'
      ],
      stepTimestamps: [
        '2026-04-21T06:45:00+05:30',
        '2026-04-21T08:02:00+05:30',
        '2026-04-21T10:35:00+05:30',
        '2026-04-21T17:12:00+05:30',
        null,
        null
      ],
      checkpointDetails: {
        consolidationDelaware: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T08:02:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T08:28:00+05:30' },
            { label: 'Assigned Box ID - BX-DLW-1411', timestamp: '2026-04-21T09:02:00+05:30' },
            { label: 'Departure from Consolidation', timestamp: '2026-04-21T09:26:00+05:30' }
          ]
        },
        middleMile: {
          hawb: 'HAWB-DEL-775410',
          departedAt: '2026-04-21T09:44:00+05:30',
          arrivedAt: '2026-04-21T10:35:00+05:30',
          edd: '2026-04-21T10:45:00+05:30',
          movementHistory: [
            { label: 'Flight Booking Confirmed', timestamp: '2026-04-21T08:52:00+05:30' },
            { label: 'Departed Origin Airport', timestamp: '2026-04-21T09:44:00+05:30' },
            { label: 'Landed at Destination Airport', timestamp: '2026-04-21T10:35:00+05:30' },
            { label: 'Received by Ground Ops', timestamp: '2026-04-21T10:48:00+05:30' }
          ]
        },
        distributionDelhi: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T17:12:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T17:38:00+05:30' },
            { label: 'Item Shelving', timestamp: null },
            { label: 'Item Packing', timestamp: null },
            { label: 'Assigned for Last Mile', timestamp: null }
          ]
        },
        lastMile: {
          awb: 'AWB-DEL-551230',
          departedAt: null,
          arrivedAt: null,
          edd: '2026-04-22T07:10:00+05:30',
          movementHistory: [
            { label: 'AWB Generated', timestamp: '2026-04-21T22:28:00+05:30' },
            { label: 'Courier Assigned', timestamp: '2026-04-22T05:30:00+05:30' },
            { label: 'Out for Delivery', timestamp: null },
            { label: 'Delivery Attempt', timestamp: null }
          ],
          courierCheckpoints: [
            { label: 'Courier Picked Parcel', timestamp: null },
            { label: 'Reached Local Delivery Hub', timestamp: null },
            { label: 'Out for Delivery', timestamp: null },
            { label: 'Delivery Attempt', timestamp: null }
          ]
        }
      }
    },
    {
      id: 3,
      oiId: 'OI-1003',
      name: 'Ergonomic Mechanical Keyboard',
      sku: 'KEY-MECH-ERG-407',
      image: 'https://placehold.co/112x112/bae6fd/0f172a?text=Item+3',
      scrapedPrice: '96.40',
      procuredPrice: '86.70',
      sellPrice: '112.00',
      asin: 'B0CLW22P8Y',
      amazonPurchaseReference: 'AMZ-PR-448389',
      storeSource: 'Amazon.com',
      storeUrl: 'https://www.amazon.com/dp/B0CLW22P8Y',
      scrapedWeight: '1.08 kg',
      aiWeight: '1.12 kg',
      alternativeUrl: '',
      currentStatus: 4,
      stepEddTimestamps: [
        '2026-04-21T08:40:00+05:30',
        '2026-04-21T11:10:00+05:30',
        '2026-04-21T14:30:00+05:30',
        '2026-04-21T20:00:00+05:30',
        '2026-04-22T08:15:00+05:30',
        '2026-04-22T16:30:00+05:30'
      ],
      stepTimestamps: [
        '2026-04-21T08:58:00+05:30',
        '2026-04-21T11:04:00+05:30',
        '2026-04-21T14:20:00+05:30',
        '2026-04-21T19:35:00+05:30',
        '2026-04-22T08:02:00+05:30',
        null
      ],
      checkpointDetails: {
        consolidationDelaware: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T11:04:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T11:29:00+05:30' },
            { label: 'Assigned Box ID - BX-DLW-1888', timestamp: '2026-04-21T12:08:00+05:30' },
            { label: 'Departure from Consolidation', timestamp: '2026-04-21T12:33:00+05:30' }
          ]
        },
        middleMile: {
          hawb: 'HAWB-DEL-908173',
          departedAt: '2026-04-21T12:40:00+05:30',
          arrivedAt: '2026-04-21T14:20:00+05:30',
          edd: '2026-04-21T14:30:00+05:30',
          movementHistory: [
            { label: 'Flight Booking Confirmed', timestamp: '2026-04-21T11:45:00+05:30' },
            { label: 'Departed Origin Airport', timestamp: '2026-04-21T12:40:00+05:30' },
            { label: 'Landed at Destination Airport', timestamp: '2026-04-21T14:20:00+05:30' },
            { label: 'Received by Ground Ops', timestamp: '2026-04-21T14:29:00+05:30' }
          ]
        },
        distributionDelhi: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T19:35:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T20:02:00+05:30' },
            { label: 'Item Shelving', timestamp: '2026-04-21T20:31:00+05:30' },
            { label: 'Item Packing', timestamp: '2026-04-21T21:18:00+05:30' },
            { label: 'Assigned for Last Mile', timestamp: '2026-04-21T22:05:00+05:30' }
          ]
        },
        lastMile: {
          awb: 'AWB-DEL-551874',
          departedAt: '2026-04-22T08:02:00+05:30',
          arrivedAt: null,
          edd: '2026-04-22T08:15:00+05:30',
          movementHistory: [
            { label: 'AWB Generated', timestamp: '2026-04-21T23:02:00+05:30' },
            { label: 'Courier Assigned', timestamp: '2026-04-22T07:18:00+05:30' },
            { label: 'Out for Delivery', timestamp: '2026-04-22T08:02:00+05:30' },
            { label: 'Delivered', timestamp: null }
          ],
          courierCheckpoints: [
            { label: 'Courier Picked Parcel', timestamp: '2026-04-22T08:02:00+05:30' },
            { label: 'Reached Local Delivery Hub', timestamp: '2026-04-22T10:12:00+05:30' },
            { label: 'Out for Delivery', timestamp: null },
            { label: 'Delivery Attempt', timestamp: null }
          ]
        }
      }
    }
  ]
};

const API_DELAY_MS = 450;

const sleep = (delay) => new Promise((resolve) => {
  setTimeout(resolve, delay);
});

const cloneData = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

export async function fetchOrderProcessingData() {
  await sleep(API_DELAY_MS);
  return cloneData(MOCK_ORDER_DATA);
}

export async function saveOrderItemPatch(itemId, patch) {
  await sleep(300);

  return {
    itemId,
    patch,
    savedAt: new Date().toISOString()
  };
}
