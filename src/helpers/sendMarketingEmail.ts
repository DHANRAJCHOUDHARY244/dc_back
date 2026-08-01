import { advertisingRepository } from "@repositories";
import { sendMarketingEmail } from "@services/email.service";

const CHUNK_SIZE = 50;
const MAX_LIMIT = 400;
const CONCURRENCY = 3;
const BATCH_DELAY = 3000;
const RESEND_AFTER_DAYS = 30;
const DAILY_LIMIT = 400;
const MAX_RETRIES = 2;

const antiSpam = false;

const mails = [
  { id: 1, name: "Aman Choudhary", email: "amanchoudhary9116@gmail.com" },
  { id: 2, name: "Vikash Sangwan", email: "sangwanvikash23@gmail.com" },
  { id: 3, name: "Somudh Attarwal", email: "somudhattarwal22@gmail.com" },
  { id: 4, name: "CIHE Student", email: "cihe231402@student.cihe.edu.au" },
  { id: 5, name: "Vikash Sangwan", email: "vikashsangwan2023@gmail.com" },
  { id: 6, name: "Aman Dhattarwal", email: "amandhattarwal5555@gmail.com" },
  { id: 7, name: "Sangwan Dairy Farm", email: "sangwandairyfarmdamkora@gmail.com" },
  { id: 8, name: "Smile Short", email: "smileshort45@gmail.com" },
  { id: 9, name: "Triloki Records Bhakti", email: "trilokirecordsbhakti@gmail.com" },
  { id: 10, name: "C Junction", email: "cjunction25@gmail.com" },
  { id: 11, name: "Damkora Records", email: "damkorarecords@gmail.com" },
  { id: 12, name: "Haryan Viraag", email: "haryanviraag86@gmail.com" },
  { id: 13, name: "Utt Music Haryanvi", email: "uttmusicharyanvi@gmail.com" },
  { id: 14, name: "Haryan Vibeatss", email: "haryanvibeatss@gmail.com" },
  { id: 15, name: "Som Hello", email: "somhello33@gmail.com" },
  { id: 16, name: "Hello Som", email: "hellosom41@gmail.com" },
  { id: 17, name: "Sangu Films", email: "sangufilms01@gmail.com" },
  { id: 18, name: "Neelam Fitness Marcelart", email: "neelamfitnessmarcelart@gmail.com" },
  { id: 19, name: "Sumit Dhattarwal", email: "sumitdhattarwal4444@gmail.com" },
  { id: 20, name: "Ronak Somsenergy", email: "ronaksomsenergy@gmail.com" },
  { id: 21, name: "Ronak Sahu", email: "ronaksahu308@gmail.com" },
  { id: 22, name: "Ojasvi Sharma", email: "ojasvisharma121095@gmail.com" },
  { id: 23, name: "Dhanraj Choudhary", email: "choudharydhanraj239@gmail.com" },
  { id: 24, name: "CURAJ Student", email: "2020btcse009@curaj.ac.in" },
  { id: 25, name: "Web Dev Setup", email: "webdevsetup239@gmail.com" },
  { id: 26, name: "Golu Dhattarwal", email: "Dhattarwalgolu51@gmail.com" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number) {
  const results: Promise<T>[] = [];
  const executing: Promise<T>[] = [];
  for (const task of tasks) {
    const p = task().finally(() => executing.splice(executing.indexOf(p), 1));
    results.push(p);
    executing.push(p);
    if (executing.length >= limit) await Promise.race(executing);
  }
  return Promise.allSettled(results);
}

async function sendWithRetry(email: string, name: string, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      await sendMarketingEmail(email, name);
      return true;
    } catch {
      if (i < retries - 1) await sleep(500 * (i + 1));
    }
  }
  return false;
}

export async function sendMarketingEmails() {
  try {
    let emails = antiSpam ? mails : [];

    if (!antiSpam) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RESEND_AFTER_DAYS);

      const records = await advertisingRepository.find(
        {
          $or: [
            { mail_sent: false },
            { mail_sent: true, updated_at: { $lte: cutoff } },
          ],
        },
        {
          select: "id email full_name mail_sent updated_at",
          sort: { updated_at: 1 },
          limit: MAX_LIMIT,
          lean: true,
        },
      );

      emails = records.map((r: any) => ({
        id: r.id,
        email: r.email,
        name: r.full_name,
      }));
    }

    if (!emails.length) return;

    if (emails.length > DAILY_LIMIT) emails = emails.slice(0, DAILY_LIMIT);

    for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
      await sleep(BATCH_DELAY);
      const chunk = emails.slice(i, i + CHUNK_SIZE);

      const tasks = chunk.map(({ id, email, name }) => async () => ({
        id,
        success: await sendWithRetry(email, name),
      }));

      const results = await runWithConcurrency(tasks, CONCURRENCY);

      const successIds = results
        .filter((r) => r.status === "fulfilled" && r.value.success)
        .map((r: any) => r.value.id);

      if (!antiSpam && successIds.length) {
        await advertisingRepository.updateMany(
          { id: { $in: successIds } },
          { $set: { mail_sent: true } },
        );
      }

      await sleep(BATCH_DELAY);
    }
  } catch (err) {
    console.error(err);
  }
}
