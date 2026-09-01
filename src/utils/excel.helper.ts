import ExcelJS from "exceljs";

function cellValue(value: ExcelJS.CellValue): string | number | boolean | Date | "" {
  if (value == null) return "";
  if (typeof value === "object" && "result" in value) {
    return cellValue((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
  }
  if (value instanceof Date) return value;
  if (typeof value === "object" && "richText" in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join("");
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as ExcelJS.CellHyperlinkValue).text ?? "");
  }
  return value as string | number | boolean;
}

function toNodeBuffer(buffer: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(buffer)) return buffer;
  if (buffer instanceof ArrayBuffer) return Buffer.from(new Uint8Array(buffer));
  return Buffer.from(buffer);
}

export async function readExcelBuffer(buffer: Buffer | ArrayBuffer | Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toNodeBuffer(buffer) as unknown as ExcelJS.Buffer);
  return workbook;
}

export function worksheetToJson(worksheet: ExcelJS.Worksheet, defval: unknown = ""): Record<string, unknown>[] {
  const rawRows: ExcelJS.CellValue[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    rawRows.push(values.slice(1));
  });

  if (!rawRows.length) return [];

  const headers = rawRows[0].map((h) => String(h ?? "").trim());
  return rawRows.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = row[index];
      obj[header] = value == null || value === "" ? defval : cellValue(value);
    });
    return obj;
  });
}
