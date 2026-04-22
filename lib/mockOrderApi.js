const MOCK_ORDER_DATA = {
  orderNumber: 'ORD-2026-04-21-7842',
  poNumber: 'PO-US-2026-0419-117',
  sellingCountry: 'India',
  customer: {
    userId: 'USR-100294',
    name: 'Alex Morgan',
    email: 'alex.morgan@email.com',
    phone: '+91 98765 43210',
    country: 'India',
    marketplace: 'Amazon Marketplace',
    marketplaceOrderId: 'AMZ-ORDER-114-9982713-5524301',
    ordersPlaced: 58,
    lastLogin: '21 Apr 2026, 12:34 pm',
    ipAddress: '103.24.119.42',
    browserDetails: 'Chrome 135 on macOS',
    loginChannel: 'Web',
    shippingAddress: {
      addressLine1: 'Flat 804, Shanti Heights',
      addressLine2: 'Near Link Square Mall',
      provinceState: 'Maharashtra',
      city: 'Mumbai',
      area: 'Andheri West',
      zipCode: '400053'
    }
  },
  payment: {
    method: 'Visa **** 4242',
    billingAddress: 'Flat 804, Shanti Heights, Andheri West, Mumbai, Maharashtra 400053, India',
    transactionId: 'TXN-9J3K2L-84Q1',
    orderTotal: '272.50'
  },
  items: [
    {
      id: 1,
      oiId: 'OI-1001',
      name: 'Metagenics OmegaGenics Fish Oil EPA-DHA 720 mg - 120 Softgels',
      sku: 'META-EPAL7120',
      image: '/images/product-1.svg',
      scrapedPrice: '62.90',
      procuredPrice: '55.75',
      sellPrice: '74.40',
      asin: 'B001HJYUDG',
      amazonPurchaseReference: 'AMZ-PR-552701',
      storeSource: 'Amazon.com',
      storeUrl: 'https://amazon.com/gp/aw/d/B001HJYUDG/?_encoding=UTF8&pd_rd_plhdr=t&aaxitk=caf5dddf2da1ec0d93b0aa2b1793a689&hsa_cr_id=0&qid=1776763938&sr=1-1-9e67e56a-6f64-441f-a281-df67fc737124&ref_=sbx_s_sparkle_sbtcd_asin_0_bkgd&pd_rd_w=cl3Rp&content-id=amzn1.sym.2fb72bc8-96ef-420d-b08f-c04b69f36507%3Aamzn1.sym.2fb72bc8-96ef-420d-b08f-c04b69f36507&pf_rd_p=2fb72bc8-96ef-420d-b08f-c04b69f36507&pf_rd_r=9TNYPSGS0731GV43EKCT&pd_rd_wg=ZVHPk&pd_rd_r=a7a51fb8-2970-49b9-abff-3fb0d6c08503',
      scrapedWeight: '0.44 kg',
      aiWeight: '0.43 kg',
      invoiceDescription: 'Dietary fish oil softgel supplement, retail bottle, non-hazardous',
      hsCode: '2106.90',
      declaredValue: '62.90',
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
      name: 'MacuHealth Omega-3 Fish Oil Supplement - 120 Softgels',
      sku: 'MACU-B093TF3SZW',
      image: '/images/product-2.svg',
      scrapedPrice: '75.00',
      procuredPrice: '68.40',
      sellPrice: '89.50',
      asin: 'B093TF3SZW',
      amazonPurchaseReference: 'AMZ-PR-552742',
      storeSource: 'Amazon.com',
      storeUrl: 'https://www.amazon.com/MacuHealth-Supplement-Triglyceride-Environmentally-Sustainable/dp/B093TF3SZW/ref=sr_1_3_sspa?crid=Y50X78T6IRGP&dib=eyJ2IjoiMSJ9.O43CaMd06Lk_ec38pFWTKXXZP-DuN007-Wn1uYlpurdHxa6nx8MWJ6J6SHxHF0rGveiKcnD7wSR7qLAHRRSg18Dz_OALjccee0QpuTvv_udBQ8iIKjNxwCvFITW9wI2yXYx5ddlwYILQ3Z_L7tSFaPzo-cSenniLHD9ROavC04c_stYPNMHKuRKhkAFbllZnRfozX45BfiSL0b8x-2MI8QUvESbP8v5flW9EEYgyxj0N5qSn5ga0WO9vWOkXXdRdFhfatM2h6x7uh8LQ-XhX7cUqShEymymT6rNgJX-TOKo.ZmYQefGhLFgbW5iYXUh0I2iMYDLYr4xx733l7seQaC4&dib_tag=se&keywords=Optimum+Nutrition+Fish+Oil%2C+60+Softgels&qid=1776763938&s=hpc&sprefix=%2Caps%2C419&sr=1-3-spons&sp_csd=d2lkZ2V0TmFtZT1zcF9hdGY&psc=1',
      scrapedWeight: '0.38 kg',
      aiWeight: '0.37 kg',
      invoiceDescription: 'Omega-3 fish oil softgel supplement, retail bottle, non-hazardous',
      hsCode: '2106.90',
      declaredValue: '75.00',
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
