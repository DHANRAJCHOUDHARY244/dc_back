import { advertisingRepository } from "@repositories";
import * as XLSX from "xlsx";
import path from "path";

const filePath = path.resolve(__dirname, "./MELBOURNE_EMAIL_DATA.xlsx");

export async function importAdvertisingData() {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

    const records = jsonData.map((row) => ({
      full_name: row.full_name || "",
      email: row.email || "",
      phone_number: row.phone_number || "",
      region: row.region || "",
      state: row.state || "",
      mail_sent: false,
      post_code: row.post_code?.toString() || "",
      locality: row.locality || "",
    }));

    const chunkSize = 1000;
    await advertisingRepository.create({
      id: 0,
      full_name: "Test",
      email: "test@example.com",
      phone_number: "1234567890",
    });
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await advertisingRepository.createMany(chunk);
      console.log(`✅ Inserted ${i + chunk.length}/${records.length} records`);
    }

    console.log(`✅ Inserted ${records.length} records into advertisings table`);
  } catch (err) {
    console.error("❌ Error importing data:", err);
  }
}
