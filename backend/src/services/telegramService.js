const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');
const Guard = require('../models/Guard');

const token = process.env.TELEGRAM_BOT_TOKEN;
const isEnabled = process.env.TELEGRAM_ENABLED === 'true';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

let bot;

if (token && isEnabled) {
  try {
    // Enable polling to receive /start commands and contact sharing
    bot = new TelegramBot(token, { polling: true });
    console.log('✅ Telegram Bot initialized with polling enabled');
    
    // Verify bot token validity
    bot.getMe().then(me => {
      console.log(`✅ Bot Identity: @${me.username} (${me.first_name})`);
    }).catch(err => {
      console.error('❌ Telegram Bot Token seems invalid or cannot connect:', err.message);
    });

    // Handle /start command
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId, "Welcome to Lanka Beacon! 🐘\n\nTo receive alerts, we need to link your Telegram account to your registration. Please click the button below to share your phone number.", {
        reply_markup: {
          keyboard: [[{
            text: "📲 Share Phone Number",
            request_contact: true
          }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
    });

    // Handle shared contact
    bot.on('contact', async (msg) => {
      const chatId = msg.chat.id;
      const phoneNumber = msg.contact.phone_number;
      // Normalize phone: remove '+' and any leading '00'
      const normalizedPhone = phoneNumber.replace(/^\+/, '').replace(/^00/, '');
      
      console.log(`Debug: Received contact ${phoneNumber} for chatId ${chatId}`);

      try {
        // Search in Users (exact match and partial match for flexibility)
        let user = await User.findOne({ 
          $or: [
            { phone: phoneNumber },
            { phone: normalizedPhone },
            { phone: `+${normalizedPhone}` },
            { phone: new RegExp(normalizedPhone + '$') }
          ] 
        });

        if (user) {
          user.telegramChatId = chatId.toString();
          await user.save();
          bot.sendMessage(chatId, `✅ Success! Your account (User: ${user.name}) is now linked to Lanka Beacon. You will receive elephant alerts for ${user.village}.`, {
            reply_markup: { remove_keyboard: true }
          });
          return;
        }

        // Search in Guards
        // Note: Guard model doesn't have phone, so we might need to add it or skip this.
        // Assuming guards are linked manually for now as they use email/pass.
        
        bot.sendMessage(chatId, "❌ We couldn't find a registered phone number matching yours. Please ensure you are registered on the Lanka Beacon website first.", {
          reply_markup: { remove_keyboard: true }
        });
      } catch (err) {
        console.error('Error linking Telegram contact:', err.message);
        bot.sendMessage(chatId, "⚠️ An error occurred while linking your account. Please try again later.");
      }
    });

  } catch (err) {
    console.error('❌ Telegram Bot initialization error:', err.message);
  }
} else {
  console.log('⚠️ Telegram Bot NOT initialized. Reason:', !token ? 'Token missing' : 'Disabled in .env');
}

/**
 * Escapes HTML special characters
 */
const escapeHTML = (str) => {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Sends a telegram alert to a specific chat ID
 * @param {string} chatId - Telegram chat ID
 * @param {object} alert - Alert details
 * @returns {Promise<object>} - { success: boolean, error?: string }
 */
const sendAlert = async (chatId, alert) => {
  if (!bot || !chatId) {
    const reason = !bot ? 'Bot not ready' : 'Chat ID missing';
    console.log(`Skipping Telegram for chatId ${chatId}: ${reason}`);
    return { success: false, error: reason };
  }

  const { id, areaName, detectedAt, confidence, latitude, longitude, distanceFromResident, residentAreaName } = alert;
  
  // Format the detection time
  const timeStr = detectedAt ? new Date(detectedAt).toLocaleString() : new Date().toLocaleString();
  
  // Create internal website map link
  const internalMapLink = `${frontendUrl}/map/${id}`;

  let message = `🚨 <b>WARNING!</b> 🚨
Elephant detected near <b>${escapeHTML(areaName)}</b>

<b>Time:</b> ${timeStr}
<b>Confidence:</b> ${confidence}%

<b>Location:</b> ${latitude}, ${longitude}`;

  if (distanceFromResident !== undefined) {
    const distKm = (distanceFromResident / 1000).toFixed(2);
    message += `\n<b>Distance to your area (${escapeHTML(residentAreaName || 'Home')}):</b> ${distKm} km`;
  }

  message += `\n\n<b>View live map:</b>
<a href="${internalMapLink}">${internalMapLink}</a>

Stay safe.`;

  try {
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'HTML',
      disable_web_page_preview: false 
    });
    console.log(`🚀 Telegram alert sent to ${chatId}`);
    return { success: true };
  } catch (error) {
    let errorMsg = error.message;
    console.error(`❌ Telegram Send Error (${chatId}):`, error.message);
    if (error.response && error.response.body) {
      const body = error.response.body;
      errorMsg = body.description || error.message;
      if (body.error_code === 403) {
        console.error(`   -> Tip: The user hasn't started a chat with the bot yet.`);
      }
      console.error('   -> Details:', JSON.stringify(body));
    }
    return { success: false, error: errorMsg };
  }
};

module.exports = { sendAlert };
