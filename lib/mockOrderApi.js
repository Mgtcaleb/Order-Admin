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
    orderTotal: '566.70',
    charged: true,
    status: 'Approved',
    createdAt: '2026-04-21T19:54:00+05:30',
    authTransactionId: 'pay_jgwgaq73sqfk7fjgqe3xyqqizu',
    uid: 'pay_jgwgaq73sqfk7fjgqe3xyqqizu',
    actionId: 'act_eivkjbb2oiukzgzpp47m2zx6le',
    cardMasked: '**** 4242 (Alex Morgan)',
    reference: 'CAPT-CHE-1526486',
    processingReferenceNumber: '217605052297',
    processingTransactionUid: '11000011986',
    processingEntity: 'silkrute',
    previousPaymentId: '',
    transactionForOrderId: '18420996'
  },
  items: [
    {
      id: 1,
      oiId: 'OI-1001',
      name: 'Wavytalk Hair Straightener Brush, Straightening Brush with Negative Ionic Nourishing',
      sku: 'WAVY-STB-8752',
      image: '/images/product-1.svg',
      scrapedPrice: '69.90',
      procuredPrice: '63.40',
      sellPrice: '88.20',
      asin: 'B0DCK8P752',
      amazonPurchaseReference: 'AMZ-PR-552701',
      storeSource: 'Amazon.com',
      storeId: 'AMZ-US-1001',
      storeUrl: 'https://www.amazon.com/Wavytalk-Straightener-Straightening-Nourishing-Experiences/dp/B0DCK8P752',
      scrapedWeight: '0.66 kg',
      aiWeight: '0.68 kg',
      invoiceDescription: 'Electric hair straightener brush with ionic heating elements, retail boxed',
      hsCode: '8516.32',
      declaredValue: '69.90',
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
      journeyLogs: [
        {
          timestamp: '2026-04-21T06:32:00+05:30',
          action: 'Item purchased on Amazon',
          actorName: 'Nisha Patel',
          actorRole: 'Procurement Executive',
          location: 'Amazon.com sourcing desk',
          details: 'Purchase placed against PO PO-US-2026-0419-117 with Purchase Ref AMZ-PR-552701.'
        },
        {
          timestamp: '2026-04-21T07:10:00+05:30',
          action: 'Departed from seller warehouse',
          actorName: 'Evan Ross',
          actorRole: 'Seller Dispatch Lead',
          location: 'Supplier Warehouse, Newark, USA',
          details: 'Parcel handed to first-mile internal transfer lane.'
        },
        {
          timestamp: '2026-04-21T09:18:00+05:30',
          action: 'Item check-in completed',
          actorName: 'Mia Gonzalez',
          actorRole: 'Inbound Associate',
          location: 'Consolidation Center - Delaware, USA',
          details: 'Inbound scan successful. Package condition marked intact.'
        },
        {
          timestamp: '2026-04-21T09:46:00+05:30',
          action: 'Quality check completed',
          actorName: 'Noah Wilson',
          actorRole: 'QC Specialist',
          location: 'Consolidation Center - Delaware, USA',
          details: 'QC passed. Seal and label verified.'
        },
        {
          timestamp: '2026-04-21T10:02:00+05:30',
          action: 'Box and bin assigned before packing',
          actorName: 'Sara Lee',
          actorRole: 'Warehouse Operator',
          location: 'Consolidation Center - Delaware, USA',
          details: 'Assigned Box ID BX-DLW-1072 and Bin ID BIN-DLW-C12.'
        },
        {
          timestamp: '2026-04-21T13:48:00+05:30',
          action: 'Arrived in India (destination airport)',
          actorName: 'Arjun Singh',
          actorRole: 'Airport Ops Coordinator',
          location: 'IGI Cargo Terminal, Delhi, India',
          details: 'Air shipment received from middle-mile flight and moved to bonded area.'
        },
        {
          timestamp: '2026-04-21T17:34:00+05:30',
          action: 'Distribution shelf allocation',
          actorName: 'Ritika Sharma',
          actorRole: 'Distribution Associate',
          location: 'Distribution Delhi, India',
          details: 'Placed on Shelf ID J/1/1. Awaiting packing wave assignment.'
        },
        {
          timestamp: '2026-04-21T18:02:00+05:30',
          action: 'Packed for last-mile staging',
          actorName: 'Kabir Mehta',
          actorRole: 'Packing Specialist',
          location: 'Distribution Delhi, India',
          details: 'Packed and staged in Bin ID DEL-LM-B08 for last-mile handover.'
        }
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
      name: 'Wavytalk Hair Straightener Brush, Straightening Brush with Negative Ionic Nourishing',
      sku: 'WAVY-STB-8752',
      image: '/images/product-1.svg',
      scrapedPrice: '69.90',
      procuredPrice: '63.40',
      sellPrice: '88.20',
      asin: 'B0DCK8P752',
      amazonPurchaseReference: 'AMZ-PR-552702',
      storeSource: 'Amazon.com',
      storeId: 'AMZ-US-1002',
      storeUrl: 'https://www.amazon.com/Wavytalk-Straightener-Straightening-Nourishing-Experiences/dp/B0DCK8P752',
      scrapedWeight: '0.66 kg',
      aiWeight: '0.68 kg',
      invoiceDescription: 'Electric hair straightener brush with ionic heating elements, retail boxed',
      hsCode: '8516.32',
      declaredValue: '69.90',
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
      journeyLogs: [
        {
          timestamp: '2026-04-21T06:15:00+05:30',
          action: 'Item purchased on Amazon',
          actorName: 'Rahul Menon',
          actorRole: 'Procurement Executive',
          location: 'Amazon.com sourcing desk',
          details: 'Purchase recorded under AMZ-PR-552702 by sourcing team.'
        },
        {
          timestamp: '2026-04-21T06:45:00+05:30',
          action: 'Departed from seller warehouse',
          actorName: 'Olivia Brown',
          actorRole: 'Seller Dispatch Lead',
          location: 'Supplier Warehouse, Newark, USA',
          details: 'Seller handoff completed to first-mile movement.'
        },
        {
          timestamp: '2026-04-21T08:02:00+05:30',
          action: 'Item check-in completed',
          actorName: 'Mia Gonzalez',
          actorRole: 'Inbound Associate',
          location: 'Consolidation Center - Delaware, USA',
          details: 'Inbound scan and quantity verification completed.'
        },
        {
          timestamp: '2026-04-21T08:28:00+05:30',
          action: 'Quality check completed',
          actorName: 'Noah Wilson',
          actorRole: 'QC Specialist',
          location: 'Consolidation Center - Delaware, USA',
          details: 'Item cleared QC with no packaging defects.'
        },
        {
          timestamp: '2026-04-21T09:02:00+05:30',
          action: 'Box and bin assigned before packing',
          actorName: 'Sara Lee',
          actorRole: 'Warehouse Operator',
          location: 'Consolidation Center - Delaware, USA',
          details: 'Assigned Box ID BX-DLW-1411 and Bin ID BIN-DLW-D27.'
        },
        {
          timestamp: '2026-04-21T10:35:00+05:30',
          action: 'Arrived in India (destination airport)',
          actorName: 'Arjun Singh',
          actorRole: 'Airport Ops Coordinator',
          location: 'IGI Cargo Terminal, Delhi, India',
          details: 'HAWB-DEL-775410 marked landed and released to local ops.'
        },
        {
          timestamp: '2026-04-21T17:12:00+05:30',
          action: 'Delhi distribution check-in',
          actorName: 'Ritika Sharma',
          actorRole: 'Distribution Associate',
          location: 'Distribution Delhi, India',
          details: 'Check-in completed at Delhi hub for downstream processing.'
        },
        {
          timestamp: '2026-04-21T17:38:00+05:30',
          action: 'Distribution QC completed',
          actorName: 'Vivek Arora',
          actorRole: 'Distribution QC Lead',
          location: 'Distribution Delhi, India',
          details: 'QC completed and item routed to shelf allocation.'
        },
        {
          timestamp: '2026-04-21T18:10:00+05:30',
          action: 'Shelf and bin mapped before packing',
          actorName: 'Karan Dutta',
          actorRole: 'Inventory Controller',
          location: 'Distribution Delhi, India',
          details: 'Placed on Shelf ID H/3/4 and Bin ID DEL-PK-A19 before packing queue.'
        }
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
      name: 'Shark HD6052S SmoothStyle Powerful Hair Dryer Brush & Straightener',
      sku: 'SHRK-HD6052S',
      image: '/images/product-2.svg',
      scrapedPrice: '179.00',
      procuredPrice: '160.50',
      sellPrice: '219.00',
      asin: 'B0FKCW7R9K',
      amazonPurchaseReference: 'AMZ-PR-552703',
      storeSource: 'Amazon.com',
      storeId: 'AMZ-US-1003',
      storeUrl: 'https://www.amazon.com/Shark-Powerful-Straightener-Straightening-HD6052S/dp/B0FKCW7R9K',
      scrapedWeight: '1.10 kg',
      aiWeight: '1.15 kg',
      invoiceDescription: 'Electric hair dryer and straightening styler tool, consumer retail pack',
      hsCode: '8516.31',
      declaredValue: '179.00',
      alternativeUrl: '',
      currentStatus: 2,
      stepEddTimestamps: [
        '2026-04-21T06:45:00+05:30',
        '2026-04-21T10:10:00+05:30',
        '2026-04-21T15:15:00+05:30',
        '2026-04-21T21:40:00+05:30',
        '2026-04-22T10:10:00+05:30',
        '2026-04-22T16:00:00+05:30'
      ],
      stepTimestamps: [
        '2026-04-21T06:58:00+05:30',
        '2026-04-21T09:58:00+05:30',
        '2026-04-21T15:02:00+05:30',
        null,
        null,
        null
      ],
      journeyLogs: [
        {
          timestamp: '2026-04-21T06:10:00+05:30',
          action: 'Item purchased on Amazon',
          actorName: 'Rahul Menon',
          actorRole: 'Procurement Executive',
          location: 'Amazon.com sourcing desk',
          details: 'Purchase recorded under AMZ-PR-552703.'
        },
        {
          timestamp: '2026-04-21T06:58:00+05:30',
          action: 'Departed from seller warehouse',
          actorName: 'Olivia Brown',
          actorRole: 'Seller Dispatch Lead',
          location: 'Supplier Warehouse, Newark, USA',
          details: 'Parcel picked by internal transfer route to Delaware consolidation.'
        },
        {
          timestamp: '2026-04-21T09:58:00+05:30',
          action: 'Consolidation check-in and QC completed',
          actorName: 'Mia Gonzalez',
          actorRole: 'Inbound Associate',
          location: 'Consolidation Center - Delaware, USA',
          details: 'Inbound scan, QC and box assignment completed for linehaul.'
        },
        {
          timestamp: '2026-04-21T15:02:00+05:30',
          action: 'Middle-mile departed',
          actorName: 'Arjun Singh',
          actorRole: 'Airport Ops Coordinator',
          location: 'JFK Cargo, USA',
          details: 'Loaded on HAWB-DEL-775410 and departed to Delhi.'
        }
      ],
      checkpointDetails: {
        consolidationDelaware: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T09:58:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T10:06:00+05:30' },
            { label: 'Assigned Box ID - BX-DLW-1420', timestamp: '2026-04-21T10:14:00+05:30' },
            { label: 'Departure from Consolidation', timestamp: '2026-04-21T10:38:00+05:30' }
          ]
        },
        middleMile: {
          hawb: 'HAWB-DEL-775410',
          departedAt: '2026-04-21T15:02:00+05:30',
          arrivedAt: null,
          edd: '2026-04-21T15:15:00+05:30',
          movementHistory: [
            { label: 'Flight Booking Confirmed', timestamp: '2026-04-21T11:08:00+05:30' },
            { label: 'Departed Origin Airport', timestamp: '2026-04-21T15:02:00+05:30' },
            { label: 'Landed at Destination Airport', timestamp: null },
            { label: 'Received by Ground Ops', timestamp: null }
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
          awb: 'AWB-DEL-551230',
          departedAt: null,
          arrivedAt: null,
          edd: '2026-04-22T10:10:00+05:30',
          movementHistory: [
            { label: 'AWB Generated', timestamp: '2026-04-21T23:05:00+05:30' },
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
      id: 4,
      oiId: 'OI-1004',
      name: 'MacuHealth Eye Health Supplement - Omega Formula',
      sku: 'MACU-OME-3-120',
      image: '/images/product-3.svg',
      scrapedPrice: '75.00',
      procuredPrice: '68.40',
      sellPrice: '89.00',
      asin: 'B093TF3SZW',
      amazonPurchaseReference: 'AMZ-PR-552704',
      storeSource: 'Amazon.com',
      storeId: 'AMZ-US-1004',
      storeUrl: 'https://www.amazon.com/gp/product/B093TF3SZW/ref=ewc_pr_img_1?smid=A1XRKYE4FI5ZK6&psc=1',
      scrapedWeight: '0.38 kg',
      aiWeight: '0.40 kg',
      invoiceDescription: 'Dietary omega-3 softgel supplement bottle, non-hazardous, retail pack',
      hsCode: '2106.90',
      declaredValue: '75.00',
      alternativeUrl: '',
      currentStatus: 3,
      stepEddTimestamps: [
        '2026-04-21T06:55:00+05:30',
        '2026-04-21T09:00:00+05:30',
        '2026-04-21T13:20:00+05:30',
        '2026-04-21T18:10:00+05:30',
        '2026-04-22T08:15:00+05:30',
        '2026-04-22T14:10:00+05:30'
      ],
      stepTimestamps: [
        '2026-04-21T07:02:00+05:30',
        '2026-04-21T08:56:00+05:30',
        '2026-04-21T13:08:00+05:30',
        '2026-04-21T17:52:00+05:30',
        null,
        null
      ],
      journeyLogs: [
        {
          timestamp: '2026-04-21T06:18:00+05:30',
          action: 'Item purchased on Amazon',
          actorName: 'Nisha Patel',
          actorRole: 'Procurement Executive',
          location: 'Amazon.com sourcing desk',
          details: 'Purchase recorded under AMZ-PR-552704.'
        },
        {
          timestamp: '2026-04-21T08:56:00+05:30',
          action: 'Consolidation check-in completed',
          actorName: 'Mia Gonzalez',
          actorRole: 'Inbound Associate',
          location: 'Consolidation Center - Delaware, USA',
          details: 'Inbound scan, QC and shelf booking done.'
        },
        {
          timestamp: '2026-04-21T13:08:00+05:30',
          action: 'Arrived in India',
          actorName: 'Arjun Singh',
          actorRole: 'Airport Ops Coordinator',
          location: 'IGI Cargo Terminal, Delhi, India',
          details: 'Linked to middle-mile HAWB-DEL-775410.'
        },
        {
          timestamp: '2026-04-21T17:52:00+05:30',
          action: 'Distribution check-in completed',
          actorName: 'Ritika Sharma',
          actorRole: 'Distribution Associate',
          location: 'Distribution Delhi, India',
          details: 'Checked in and staged for packing queue.'
        }
      ],
      checkpointDetails: {
        consolidationDelaware: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T08:56:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T09:12:00+05:30' },
            { label: 'Assigned Box ID - BX-DLW-1444', timestamp: '2026-04-21T09:24:00+05:30' },
            { label: 'Departure from Consolidation', timestamp: '2026-04-21T09:40:00+05:30' }
          ]
        },
        middleMile: {
          hawb: 'HAWB-DEL-775410',
          departedAt: '2026-04-21T12:40:00+05:30',
          arrivedAt: '2026-04-21T13:08:00+05:30',
          edd: '2026-04-21T13:20:00+05:30',
          movementHistory: [
            { label: 'Flight Booking Confirmed', timestamp: '2026-04-21T10:42:00+05:30' },
            { label: 'Departed Origin Airport', timestamp: '2026-04-21T12:40:00+05:30' },
            { label: 'Landed at Destination Airport', timestamp: '2026-04-21T13:08:00+05:30' },
            { label: 'Received by Ground Ops', timestamp: '2026-04-21T13:20:00+05:30' }
          ]
        },
        distributionDelhi: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T17:52:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T18:02:00+05:30' },
            { label: 'Item Shelving', timestamp: '2026-04-21T18:14:00+05:30' },
            { label: 'Item Packing', timestamp: null },
            { label: 'Assigned for Last Mile', timestamp: null }
          ]
        },
        lastMile: {
          awb: 'AWB-DEL-551230',
          departedAt: null,
          arrivedAt: null,
          edd: '2026-04-22T08:15:00+05:30',
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
      id: 5,
      oiId: 'OI-1005',
      name: 'Metagenics OmegaGenics Fish Oil EPA-DHA 720 mg - 120 Softgels',
      sku: 'META-EPAL7120',
      image: '/images/product-1.svg',
      scrapedPrice: '62.90',
      procuredPrice: '55.75',
      sellPrice: '74.40',
      asin: 'B001HJYUDG',
      amazonPurchaseReference: 'AMZ-PR-552705',
      storeSource: 'Amazon.com',
      storeId: 'AMZ-US-1005',
      storeUrl: 'https://www.amazon.com/gp/product/B001HJYUDG/ref=ewc_pr_img_2?smid=ATVPDKIKX0DER&psc=1',
      scrapedWeight: '0.44 kg',
      aiWeight: '0.45 kg',
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
      journeyLogs: [
        {
          timestamp: '2026-04-21T06:32:00+05:30',
          action: 'Item purchased on Amazon',
          actorName: 'Nisha Patel',
          actorRole: 'Procurement Executive',
          location: 'Amazon.com sourcing desk',
          details: 'Purchase placed against PO PO-US-2026-0419-117 with Purchase Ref AMZ-PR-552705.'
        },
        {
          timestamp: '2026-04-21T07:10:00+05:30',
          action: 'Departed from seller warehouse',
          actorName: 'Evan Ross',
          actorRole: 'Seller Dispatch Lead',
          location: 'Supplier Warehouse, Newark, USA',
          details: 'Parcel handed to first-mile internal transfer lane.'
        },
        {
          timestamp: '2026-04-21T09:18:00+05:30',
          action: 'Item check-in completed',
          actorName: 'Mia Gonzalez',
          actorRole: 'Inbound Associate',
          location: 'Consolidation Center - Delaware, USA',
          details: 'Inbound scan successful. Package condition marked intact.'
        }
      ],
      checkpointDetails: {
        consolidationDelaware: {
          milestones: [
            { label: 'Item Check IN', timestamp: '2026-04-21T09:18:00+05:30' },
            { label: 'Item QC', timestamp: '2026-04-21T09:46:00+05:30' },
            { label: 'Assigned Box ID - BX-DLW-1460', timestamp: null },
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
