const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');
const Guard = require('../models/Guard');
const NotificationDelivery = require('../models/NotificationDelivery');
const Detection = require('../models/Detection');
const { evaluateAndClearDetection, reopenDetection } = require('./detectionStatusService');

const token = process.env.TELEGRAM_BOT_TOKEN;
const isEnabled = process.env.TELEGRAM_ENABLED === 'true';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

let bot;
let io;

/**
 * Initializes the Telegram bot and socket instance
 */
const init = (socketIo) => {
  io = socketIo;
  
  if (token && isEnabled && !bot) {
    try {
      bot = new TelegramBot(token, { polling: true });
      console.log('✅ Telegram Bot initialized with polling enabled');
      
      bot.getMe().then(me => {
        console.log(`✅ Bot Identity: @${me.username} (${me.first_name})`);
      }).catch(err => {
        console.error('❌ Telegram Bot Token error:', err.message);
      });

      // Handle /start command
      bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, "Welcome to Lanka Beacon! 🐘\n\nTo receive alerts, we need to link your Telegram account to your registration. Please click the button below to share your phone number.", {
          reply_markup: {
            keyboard: [[{ text: "📲 Share Phone Number", request_contact: true }]],
            one_time_keyboard: true,
            resize_keyboard: true
          }
        });
      });

      // Handle shared contact
      bot.on('contact', async (msg) => {
        const chatId = msg.chat.id;
        const phoneNumber = msg.contact.phone_number;
        const normalizedPhone = phoneNumber.replace(/^\+/, '').replace(/^00/, '');
        
        try {
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
          
          bot.sendMessage(chatId, "❌ We couldn't find a registered phone number matching yours. Please ensure you are registered on the Lanka Beacon website first.", {
            reply_markup: { remove_keyboard: true }
          });
        } catch (err) {
          console.error('Error linking Telegram contact:', err.message);
        }
      });

      // Handle callback queries for resident responses
      bot.on('callback_query', async (callbackQuery) => {
        const { data, message, from } = callbackQuery;
        const chatId = from.id.toString();

        // Format: lb:{deliveryId}:{action}
        if (data.startsWith('lb:')) {
          const parts = data.split(':');
          if (parts.length < 3) return;

          const deliveryId = parts[1];
          const action = parts[2];

          try {
            const delivery = await NotificationDelivery.findById(deliveryId).populate('residentId');
            if (!delivery) {
              return bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Delivery record not found." });
            }

            // Validate Telegram Chat ID
            if (delivery.telegramChatId !== chatId) {
              console.warn(`Unauthorized Telegram response attempt for delivery ${deliveryId} by chat ${chatId}`);
              return bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Unauthorized action." });
            }

            let residentStatus = 'pending';
            let confirmationText = '';

            switch (action) {
              case 'help':
                residentStatus = 'help_requested';
                confirmationText = 'Your urgent help request has been sent to the responsible guard.';
                break;
              case 'protected':
                residentStatus = 'protected';
                confirmationText = 'Your safety status has been recorded as Protected.';
                break;
              case 'cannot':
                residentStatus = 'cannot_protect';
                confirmationText = "Your warning has been sent to the responsible guard. Please move to a safe location if possible.";
                break;
              default:
                return bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Invalid action." });
            }

            // Update delivery record
            delivery.residentResponse = {
              status: residentStatus,
              respondedAt: new Date(),
              telegramUserId: from.id.toString(),
              telegramChatId: chatId
            };
            await delivery.save();

            // Answer callback and update message
            bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Status updated!" });
            
            // Edit message to remove buttons and show confirmation
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: message.message_id });
            bot.sendMessage(chatId, confirmationText);

            // Check for status changes
            let clearResult = null;
            let reopenResult = null;

            const detection = await Detection.findById(delivery.detectionId);
            if (detection) {
              if (detection.status === 'cleared' && residentStatus !== 'protected') {
                reopenResult = await reopenDetection(detection._id, `Resident responded as ${residentStatus.replace(/_/g, ' ')} via Telegram.`, {
                  source: 'resident_response',
                  residentId: delivery.residentId._id,
                  deliveryId: delivery._id
                });
              } else if (detection.status === 'active' && residentStatus === 'protected') {
                clearResult = await evaluateAndClearDetection(delivery.detectionId, {
                  residentId: delivery.residentId._id,
                  deliveryId: delivery._id
                });
              }
            }

            // Emit socket event to guard
            if (io) {
              const guardId = delivery.guardId.toString();
              
              const getEffectiveSafetyStatus = (d) => {
                if (d.residentResponse?.status === 'help_requested' || d.guardAssessment?.status === 'help_requested') return 'help_requested';
                if (d.guardAssessment?.status === 'attacked') return 'attacked';
                if (d.residentResponse?.status === 'cannot_protect') return 'cannot_protect';
                if (d.guardAssessment?.status === 'protected' || d.residentResponse?.status === 'protected') return 'protected';
                return 'pending';
              };

              const payload = {
                deliveryId: delivery._id,
                detectionId: delivery.detectionId,
                alertId: delivery.alertId,
                residentId: delivery.residentId._id,
                residentResponse: delivery.residentResponse,
                guardAssessment: delivery.guardAssessment,
                effectiveSafetyStatus: getEffectiveSafetyStatus(delivery)
              };

              // Emit to the specific guard room
              io.to(guardId).emit('resident-safety-response', payload);
              // Also emit general delivery-updated for simpler listeners
              io.emit('delivery-updated', delivery);

              // If detection was cleared, emit status update
              if (clearResult && clearResult.cleared) {
                io.to(guardId).emit('detection-status-updated', {
                  detectionId: clearResult.detection._id,
                  alertId: delivery.alertId,
                  status: 'cleared',
                  clearedAt: clearResult.detection.clearedAt,
                  clearedBy: clearResult.detection.clearedBy,
                  clearReason: clearResult.detection.clearReason
                });
              }

              // If detection was reopened, emit status update
              if (reopenResult) {
                io.to(guardId).emit('detection-status-updated', {
                  detectionId: reopenResult._id,
                  alertId: delivery.alertId,
                  status: 'active',
                  reopenedAt: new Date(),
                  reason: reopenResult.statusHistory[reopenResult.statusHistory.length-1].reason
                });
              }
            }
          } catch (err) {
            console.error('Telegram callback error:', err);
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Error processing response." });
          }
        }
      });

    } catch (err) {
      console.error('❌ Telegram Bot error:', err.message);
    }
  }
};

// Initial call if bot was already partially initialized by file load
if (token && isEnabled) {
  init();
}

const escapeHTML = (str) => {
  if (!str) return '';
  return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const formatDistance = (distanceMeters) => {
  if (!Number.isFinite(distanceMeters)) return 'Unavailable';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(2)} km`;
};

/**
 * Sends a telegram alert to a specific chat ID
 */
const sendAlert = async (chatId, alert) => {
  if (!bot || !chatId) return { success: false, error: 'Bot or Chat ID missing' };

  const { deliveryId, areaName, detectedAt, latitude, longitude, distanceFromResident } = alert;
  const timeStr = detectedAt ? new Date(detectedAt).toLocaleString('en-US', { 
    month: 'long', day: 'numeric', year: 'numeric', 
    hour: 'numeric', minute: '2-digit', hour12: true 
  }) : new Date().toLocaleString();

  const distanceStr = formatDistance(distanceFromResident);

  let message = `🚨 <b>Topic: Elephant Attack</b>

An elephant has been detected near your registered area.

<b>Distance:</b> ${distanceStr} from your registered location
<b>Location:</b> ${escapeHTML(areaName || `${latitude}, ${longitude}`)}
<b>Detected at:</b> ${timeStr}

Choose your current safety status below.`;

  try {
    const sentMsg = await bot.sendMessage(chatId, message, { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🆘 Need Help",
              callback_data: `lb:${deliveryId}:help`
            }
          ],
          [
            {
              text: "✅ Protected",
              callback_data: `lb:${deliveryId}:protected`
            },
            {
              text: "⚠️ Can't Protect",
              callback_data: `lb:${deliveryId}:cannot`
            }
          ]
        ]
      }
    });
    return { success: true, messageId: sentMsg.message_id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = { sendAlert, init };
