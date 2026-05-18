const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const META_TOKEN = process.env.whatsapp || process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

async function sendWhatsAppMessage(phone, text) {
  if (!META_TOKEN || !phone) {
    console.log('[Dispatch] WhatsApp skipped — token or phone missing');
    return false;
  }

  try {
    const cleanPhone = String(phone).replace(/\D/g, '');
    await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${META_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );
    console.log(`[Dispatch] WhatsApp sent to ${phone}`);
    return true;
  } catch (error) {
    console.error('[Dispatch] WhatsApp error:', error.response?.data || error.message);
    return false;
  }
}

async function sendTruckDispatch(driverPhone, routeInfo) {
  const message =
    routeInfo.messageUrdu ||
    `*Bazar:* ${routeInfo.blockedRoad} band hai. ${routeInfo.alternateRoad} se jao.\nMaal: ${(routeInfo.goods || []).join(', ')}\nETA: +${routeInfo.extraMinutes} min`;
  await sendWhatsAppMessage(driverPhone, message);
}

async function sendDukandarAlert(shopPhone, priceInfo) {
  const message = `*Bazar:*\n${priceInfo.dukandar_message_urdu}\nFair daam: Rs ${priceInfo.fair_price}`;
  await sendWhatsAppMessage(shopPhone, message);
}

module.exports = { sendTruckDispatch, sendDukandarAlert, sendWhatsAppMessage };
