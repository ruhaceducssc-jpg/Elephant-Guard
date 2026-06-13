const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Lanka Beacon <no-reply@lankabeacon.gov.lk>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

const sendGuardRegistrationOtp = async ({ recipientEmail, recipientName, otp, expiresInMinutes }) => {
  const subject = 'Verify your Lanka Beacon guard registration';
  const message = `Lanka Beacon\n\nHello ${recipientName},\n\nUse the following verification code to confirm your guard registration:\n\n${otp}\n\nThis code expires in ${expiresInMinutes} minutes.\n\nDo not share this code with anyone.\n\nIf you did not request this registration, you can ignore this email.`;
  
  const html = `
    <div style="font-family: 'Plus Jakarta Sans', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dfe7f1; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 60px; height: 60px; background-color: #0b2d63; border-radius: 5px; padding: 10px;">
          <img src="https://lankabeacon.gov.lk/logo.png" alt="Lanka Beacon" style="width: 100%; height: auto;" />
        </div>
        <h1 style="color: #0f172a; font-size: 24px; font-weight: 800; margin-top: 20px;">Lanka Beacon</h1>
      </div>
      
      <div style="background-color: #f8fafc; padding: 30px; border-radius: 5px; border-left: 4px solid #1768d1;">
        <p style="color: #475569; font-size: 16px; font-weight: 600; margin-top: 0;">Hello ${recipientName},</p>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">Use the following verification code to confirm your guard registration:</p>
        
        <div style="background-color: #ffffff; border: 2px solid #1768d1; border-radius: 5px; padding: 20px; text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: 800; color: #1768d1; letter-spacing: 10px;">${otp}</span>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; tracking-widest: 0.1em; margin-bottom: 20px;">
          Code expires in ${expiresInMinutes} minutes
        </p>
        
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
          Do not share this code with anyone. If you did not request this registration, you can ignore this email safely.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 40px; color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
        &copy; 2026 Lanka Beacon Network :: Wildlife Protection Division
      </div>
    </div>
  `;

  await sendEmail({
    email: recipientEmail,
    subject,
    message,
    html
  });
};

module.exports = {
  sendEmail,
  sendGuardRegistrationOtp
};
