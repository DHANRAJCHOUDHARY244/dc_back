const nodemailer = require("nodemailer");

export const emailClient = nodemailer.createTransport({
      host: process.env.EMAIL_HOSTNAME,
      secure: true,
      secureConnection: false,
      tls: {
        ciphers: "SSLv3",
      },
      requireTLS: true,
      port: process.env.EMAIL_PORT,
      debug: true,
      connectionTimeout: 30000,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
       pool: true,                // ✅ Enable connection pooling
       maxConnections: 3,         // up to 3 simultaneous connections
       maxMessages: 100,          // reuse each connection for 100 emails
       rateDelta: 2000,           // rate limit window (2 seconds)
       rateLimit: 5,              // max 5 messages per rateDelta
    });
    
export const marketingEmailClient = nodemailer.createTransport({
      host: process.env.EMAIL_HOSTNAME,
      secure: true,
      secureConnection: false,
      tls: {
        ciphers: "SSLv3",
      },
      requireTLS: true,
      port: process.env.EMAIL_PORT,
      debug: true,
      connectionTimeout: 30000,
      auth: {
        user: process.env.MARKETING_EMAIL_USERNAME,
        pass: process.env.MARKETING_EMAIL_PASSWORD,
      },
       pool: true,                // ✅ Enable connection pooling
       maxConnections: 3,         // up to 3 simultaneous connections
       maxMessages: 100,          // reuse each connection for 100 emails
       rateDelta: 2000,           // rate limit window (2 seconds)
       rateLimit: 5,              // max 5 messages per rateDelta
    });

  
