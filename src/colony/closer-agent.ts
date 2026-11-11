// @ts-nocheck
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { HybridRouter } from '../services/hybrid-router.js';

dotenv.config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const CALENDLY_LINK = process.env.CALENDLY_LINK || 'https://calendly.com/faturachmanalkahfi7/15min';

const config = {
  imap: {
    user: EMAIL_USER!,
    password: EMAIL_PASS!,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false } // For testing/local
  }
};

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: true,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

async function evaluateIntent(emailContent: string): Promise<{ category: string, suggestedReply?: string }> {
  const prompt = `You are a B2B Sales Closer for JAGAT AI. We just received this email reply from a prospect.
  
Email Content:
"${emailContent}"

Evaluate the prospect's intent and categorize it as one of the following:
1. POSITIVE (Interested, asking for price, asking for demo, wants to meet)
2. NEGATIVE (Not interested, stop emailing me, unsubscribe, angry)
3. OTHER (Auto-reply, out of office, unrelated spam)

If POSITIVE, write a short, highly professional reply (in the same language they used) suggesting a quick 15-minute meeting and providing this placeholder link: [INSERT_CALENDLY_LINK].
If NEGATIVE or OTHER, leave the reply empty.

Respond ONLY with valid JSON in this format:
{"category": "POSITIVE|NEGATIVE|OTHER", "suggestedReply": "the reply text if positive"}`;

  try {
    const res = await HybridRouter.callGeminiSmart(prompt, "You are a professional B2B Sales closer. Only output JSON.");
    const text = res.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error("[CloserAgent] Failed to evaluate intent via LLM:", err);
    return { category: "OTHER" };
  }
}

async function main() {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error("Missing EMAIL_USER or EMAIL_PASS in .env");
    return;
  }

  console.log("🕵️ Starting JAGAT Closer Agent (Inbox Negotiator)...");
  
  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Search for unread messages
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: true // Mark as read so we don't process it again
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`[CloserAgent] Found ${messages.length} unread emails.`);

    let closedDeals = 0;

    for (const item of messages) {
      const allParts = item.parts.find(part => part.which === '');
      const id = item.attributes.uid;
      
      if (!allParts || !allParts.body) continue;

      const parsed = await simpleParser(allParts.body);
      const from = parsed.from?.value[0]?.address;
      const subject = parsed.subject || "No Subject";
      const text = parsed.text || "";

      // Skip obvious spam or internal emails
      if (!from || from.includes('google.com') || from === EMAIL_USER) continue;

      console.log(`\n📧 Reading email from ${from}: ${subject}`);
      
      const evaluation = await evaluateIntent(text);
      console.log(`[CloserAgent] Intent evaluated as: ${evaluation.category}`);

      if (evaluation.category === 'POSITIVE' && evaluation.suggestedReply) {
        console.log(`[CloserAgent] Hot Lead Detected! Sending auto-reply...`);
        
        // Ensure meeting link is inserted
        const finalReply = evaluation.suggestedReply.replace(
          /\[INSERT_CALENDLY_LINK\]/g, 
          CALENDLY_LINK
        );

        await transporter.sendMail({
          from: `"Faturachman (JAGAT AI)" <${EMAIL_USER}>`,
          to: from,
          subject: `Re: ${subject}`,
          text: finalReply
        });
        
        console.log(`[CloserAgent] ✅ Successfully replied to ${from} and pushed to book a meeting.`);
        closedDeals++;
      }
    }

    connection.end();
    
    if (closedDeals > 0) {
      console.log(`[CloserAgent] 🎯 Closer Agent successfully engaged ${closedDeals} hot prospects!`);
    } else {
      console.log(`[CloserAgent] 💤 No hot prospects to close right now.`);
    }

  } catch (err) {
    console.error("[CloserAgent] IMAP Connection Error:", err);
  }
}

main().catch(console.error);
