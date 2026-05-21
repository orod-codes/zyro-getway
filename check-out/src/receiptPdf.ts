import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export interface ReceiptPdfData {
  approvalId: string;
  payerName: string;
  txReference: string;
  methodName: string;
  amountEtb: number;
  orderRef: string;
  approvedAt: string;
  qrPayload: string;
  merchantName?: string;
}

async function fetchImageDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatAmountEtb(amount: number) {
  return new Intl.NumberFormat("en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatReceiptDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-ET", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-ET", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

export async function downloadZyroReceiptPdf(data: ReceiptPdfData) {
  const pageWidth = 80;
  const margin = 6;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const doc = new jsPDF({
    unit: "mm",
    format: [pageWidth, 240],
    compress: true,
  });

  const { date, time } = formatReceiptDate(data.approvedAt);
  const merchant = data.merchantName ?? "Demo Store PLC";

  // Header — Telebirr-style orange band
  doc.setFillColor(255, 122, 24);
  doc.rect(0, y, pageWidth, 24, "F");
  y = 0;

  const logo = await fetchImageDataUrl(
    `${import.meta.env.BASE_URL}zyro-logo.png`,
  );
  if (logo) {
    doc.addImage(logo, "PNG", margin, 5, 14, 14);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ZYRO", margin + (logo ? 17 : 0), 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Payment Receipt", margin + (logo ? 17 : 0), 16);
  doc.setFontSize(7);
  doc.text("Express Checkout", margin + (logo ? 17 : 0), 20);

  y = 28;

  // Success status
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(margin, y, contentWidth, 11, 2, 2, "F");
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin, y, contentWidth, 11, 2, 2, "S");
  doc.setTextColor(4, 120, 87);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Transaction Successful", pageWidth / 2, y + 7, { align: "center" });
  y += 15;

  const divider = () => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  };

  const row = (label: string, value: string, boldValue = true) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 110);
    doc.text(label, margin, y);
    y += 3.5;
    doc.setFont("helvetica", boldValue ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(15, 15, 15);
    const lines = doc.splitTextToSize(value, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 3.8 + 3;
  };

  row("Transaction Date", date);
  row("Transaction Time", time);
  divider();

  row("Transaction ID", data.approvalId);
  row("Reference Number", data.txReference);
  row("Order Number", data.orderRef);
  divider();

  row("Paid By", data.payerName);
  row("Payment Method", data.methodName);
  row("Paid To", merchant);
  divider();

  // Amount block
  doc.setFillColor(255, 248, 242);
  doc.setDrawColor(255, 200, 150);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("Amount Paid (ETB)", margin + 3, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 122, 24);
  doc.text(formatAmountEtb(data.amountEtb), margin + 3, y + 12);
  y += 20;

  divider();

  // QR — verify approval
  const qrDataUrl = await QRCode.toDataURL(data.qrPayload, {
    width: 256,
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
  const qrSize = 34;
  doc.addImage(
    qrDataUrl,
    "PNG",
    (pageWidth - qrSize) / 2,
    y,
    qrSize,
    qrSize,
  );
  y += qrSize + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text("Approval QR — scan to verify", pageWidth / 2, y, {
    align: "center",
  });
  y += 8;

  divider();

  doc.setFontSize(6);
  doc.setTextColor(130, 130, 130);
  const footer = [
    "This is an official payment receipt issued by Zyro.",
    "Please retain for your records. For support contact your merchant.",
    "Generated electronically — valid without signature.",
  ];
  footer.forEach((line) => {
    const lines = doc.splitTextToSize(line, contentWidth);
    doc.text(lines, pageWidth / 2, y, { align: "center" });
    y += lines.length * 3.2 + 1;
  });

  doc.save(`Zyro-Receipt-${data.approvalId}.pdf`);
}
