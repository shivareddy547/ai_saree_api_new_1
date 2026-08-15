const nodemailer = require('nodemailer');
const twilio = require('twilio');
const axios = require('axios');
const { Provider } = require('../models');
/**
 * Send OTP via email using the first enabled SMTP provider.
 * If no SMTP provider is enabled, logs and does nothing.
 * @param {string} email - recipient email
 * @param {string} otp - OTP to send
 */
const sendOtpEmail = async (email, otp) => {
  try {
    const smtpProvider = await Provider.findOne({
      where: { provider_type: 'smtp', is_enabled: true },
    });
    if (!smtpProvider) {
      console.log('No enabled SMTP provider found, cannot send email OTP');
      return;
    }
    const creds = smtpProvider.credentials;
    const {
      host,
      port,
      encryption,
      username,
      password,
      from_email,
      from_name,
    } = creds;
    // Determine secure option based on port or encryption string
    let secure = false;
    if (port === '465' || (encryption && encryption.toUpperCase() === 'SSL')) {
      secure = true;
    } else if (encryption && encryption.toUpperCase() === 'TLS') {
      secure = true;
    }
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure,
      auth: { user: username, pass: password },
      // For STARTTLS, we can set requireTLS: true if needed
      tls: encryption && encryption.toUpperCase() === 'STARTTLS' ? { rejectUnauthorized: false } : undefined,
    });
    await transporter.sendMail({
      from: `"${from_name || 'SareeStore'}" <${from_email}>`,
      to: email,
      subject: 'Your OTP for SareeStore',
      text: `Your OTP is ${otp}`,
      html: `<p>Your OTP is <strong>${otp}</strong></p>`,
    });
    console.log(`OTP email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send OTP email:', error.message);
    // Do not throw to avoid breaking signup flow
  }
};
/**
 * Send OTP via SMS using the first enabled SMS provider.
 * Supports multiple providers based on provider_key.
 * @param {string} phone - recipient phone number
 * @param {string} otp - OTP to send
 */
const sendOtpSms = async (phone, otp) => {
  try {
    const smsProvider = await Provider.findOne({
      where: { provider_type: 'sms', is_enabled: true },
    });
    if (!smsProvider) {
      console.log('No enabled SMS provider found, cannot send SMS OTP');
      return;
    }
    const { provider_key, credentials } = smsProvider;
    switch (provider_key) {
      case 'twilio': {
        const client = twilio(credentials.account_sid, credentials.auth_token);
        await client.messages.create({
          body: `Your OTP is ${otp}`,
          from: credentials.from_number,
          to: phone,
        });
        console.log(`OTP SMS sent to ${phone} via Twilio`);
        break;
      }
      case 'msg91': {
        // MSG91 API v5 (flow)
        const response = await axios.post(
          'https://api.msg91.com/api/v5/flow/',
          {
            sender: credentials.sender_id,
            mobiles: phone,
            authkey: credentials.auth_key,
            message: `Your OTP is ${otp}`,
            // For flow, you may need template_id; fallback to direct message
          },
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
        console.log(`OTP SMS sent to ${phone} via MSG91, response:`, response.data);
        break;
      }
      case 'textlocal': {
        await axios.post('https://api.textlocal.in/send/', null, {
          params: {
            apikey: credentials.api_key,
            sender: credentials.sender_id,
            numbers: phone,
            message: `Your OTP is ${otp}`,
          },
        });
        console.log(`OTP SMS sent to ${phone} via Textlocal`);
        break;
      }
      case 'vonage': {
        // Vonage (Nexmo) uses basic auth
        await axios.post(
          'https://rest.nexmo.com/sms/json',
          {
            api_key: credentials.api_key,
            api_secret: credentials.api_secret,
            from: credentials.from_number,
            to: phone,
            text: `Your OTP is ${otp}`,
          }
        );
        console.log(`OTP SMS sent to ${phone} via Vonage`);
        break;
      }
      case 'plivo': {
        await axios.post(
          'https://api.plivo.com/v1/Account/' + credentials.auth_id + '/Message/',
          {
            src: credentials.from_number,
            dst: phone,
            text: `Your OTP is ${otp}`,
          },
          {
            auth: {
              username: credentials.auth_id,
              password: credentials.auth_token,
            },
          }
        );
        console.log(`OTP SMS sent to ${phone} via Plivo`);
        break;
      }
      case 'aws_sns': {
        // AWS SNS requires AWS SDK; for simplicity, we skip or use generic HTTP?
        // But we can use AWS SDK if installed. Since we are not adding it now, log and skip.
        console.log('AWS SNS not implemented in this version');
        break;
      }
      case 'custom_sms':
      default: {
        // Attempt generic send using credentials: try to use base_url, api_key, etc.
        // This is a fallback; may work for some providers.
        const baseUrl = credentials.base_url || 'https://api.smsprovider.com/send';
        const payload = {
          api_key: credentials.api_key,
          api_secret: credentials.api_secret,
          sender: credentials.sender_id || credentials.from_number,
          to: phone,
          message: `Your OTP is ${otp}`,
        };
        await axios.post(baseUrl, payload);
        console.log(`OTP SMS sent to ${phone} via custom/generic provider`);
        break;
      }
    }
  } catch (error) {
    console.error('Failed to send OTP SMS:', error.message);
    // Do not throw to avoid breaking signup flow
  }
};
module.exports = {
  sendOtpEmail,
  sendOtpSms,
};
