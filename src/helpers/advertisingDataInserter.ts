import { advertisingRepository } from "@repositories";
import ExcelJS from "exceljs";
import path from "path";
import { worksheetToJson } from "@utils/excel.helper";

const filePath = path.resolve(__dirname, "./MELBOURNE_EMAIL_DATA.xlsx");

export async function importAdvertisingData() {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("No worksheet found in advertising import file");

    const jsonData: any[] = worksheetToJson(sheet);

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
