"""Receipt generation: PDF with an embedded QR code.

Produces a self-contained invoice PDF (reportlab + qrcode/Pillow) and stores
the receipt metadata in the database.
"""

from __future__ import annotations

import io
import json
import logging
import random
from datetime import datetime, timezone
from pathlib import Path

import qrcode
from PIL import Image
from prisma import Prisma
from reportlab.lib import colors
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

logger = logging.getLogger(__name__)

RECEIPTS_DIR = Path(__file__).resolve().parent.parent / "receipts"
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)

BRAND = "AI Barista Coffee"
TAGLINE = "Order code of the future, brewed fresh."


def _new_invoice_number(db: Prisma) -> str:
    for _ in range(50):
        number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
        if db.receipt.find_first(where={"invoiceNumber": number}) is None:
            return number
    raise RuntimeError("Could not allocate a unique invoice number.")


def _qr_image(data: str, box_size: int = 6) -> Image.Image:
    qr = qrcode.QRCode(border=1, box_size=box_size)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB")


def build_receipt(db: Prisma, order: object) -> dict:
    """Generate the receipt PDF and persist its metadata."""
    invoice = _new_invoice_number(db)
    qr_payload = json.dumps(
        {
            "orderNumber": order.orderNumber,
            "invoice": invoice,
            "total": order.total,
            "date": order.createdAt.isoformat(),
        },
        ensure_ascii=False,
    )

    filename = f"{invoice}.pdf"
    file_path = RECEIPTS_DIR / filename
    _render_pdf(file_path, order, invoice, qr_payload)

    qr_data = f"coffeeshop://receipt?invoice={invoice}&order={order.orderNumber}"
    receipt = db.receipt.create(
        data={
            "orderId": order.id,
            "invoiceNumber": invoice,
            "qrCode": qr_data,
            "pdfUrl": f"/api/receipts/{filename}",
        }
    )
    logger.info("Receipt %s written to %s", invoice, file_path.name)
    return {"invoiceNumber": invoice, "qrCode": qr_data, "pdfUrl": f"/api/receipts/{filename}"}


def _render_pdf(path: Path, order: object, invoice: str, qr_payload: str) -> None:
    page_w, page_h = A5
    c = canvas.Canvas(str(path), pagesize=A5)

    # Header band.
    c.setFillColor(colors.HexColor("#6F4E37"))
    c.rect(0, page_h - 22 * mm, page_w, 22 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(12 * mm, page_h - 12 * mm, BRAND)
    c.setFont("Helvetica", 8)
    c.drawString(12 * mm, page_h - 17 * mm, TAGLINE)

    # Meta block.
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(12 * mm, page_h - 30 * mm, f"Invoice: {invoice}")
    c.setFont("Helvetica", 9)
    c.drawString(12 * mm, page_h - 35 * mm, f"Order:   {order.orderNumber}")
    c.drawString(12 * mm, page_h - 39 * mm, f"Date:    {order.createdAt.strftime('%Y-%m-%d %H:%M')}")

    # Items.
    y = page_h - 48 * mm
    c.setFont("Helvetica-Bold", 9)
    c.drawString(12 * mm, y, "Item")
    c.drawString(105 * mm, y, "Qty")
    c.drawString(120 * mm, y, "Price")
    y -= 4 * mm
    c.setStrokeColor(colors.HexColor("#CCCCCC"))
    c.line(12 * mm, y, page_w - 12 * mm, y)
    y -= 5 * mm

    c.setFont("Helvetica", 9)
    for item in order.items:
        name = item.name[:32]
        line_total = item.unitPrice * item.quantity
        c.drawString(12 * mm, y, name)
        c.drawString(105 * mm, y, str(item.quantity))
        c.drawRightString(page_w - 12 * mm, y, f"${line_total:.2f}")
        y -= 4.5 * mm
        if y < 40 * mm:
            c.showPage()
            y = page_h - 15 * mm

    # Totals.
    y -= 3 * mm
    c.setFont("Helvetica", 9)
    c.drawString(12 * mm, y, "Subtotal")
    c.drawRightString(page_w - 12 * mm, y, f"${order.subtotal:.2f}")
    y -= 4.5 * mm
    if order.discount:
        c.drawString(12 * mm, y, "Discount")
        c.drawRightString(page_w - 12 * mm, y, f"-${order.discount:.2f}")
        y -= 4.5 * mm
    c.drawString(12 * mm, y, "Tax")
    c.drawRightString(page_w - 12 * mm, y, f"${order.tax:.2f}")
    y -= 4.5 * mm
    if order.tip:
        c.drawString(12 * mm, y, "Tip")
        c.drawRightString(page_w - 12 * mm, y, f"${order.tip:.2f}")
        y -= 4.5 * mm
    c.setStrokeColor(colors.black)
    c.line(12 * mm, y, page_w - 12 * mm, y)
    y -= 5 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(12 * mm, y, "Total")
    c.drawRightString(page_w - 12 * mm, y, f"${order.total:.2f}")

    # QR.
    qr = _qr_image(qr_payload)
    reader = ImageReader(io.BytesIO(_pil_to_png(qr)))
    qr_size = 28 * mm
    c.drawImage(reader, page_w - qr_size - 12 * mm, 12 * mm, qr_size, qr_size, preserveAspectRatio=True)

    # Footer.
    c.setFillColor(colors.HexColor("#777777"))
    c.setFont("Helvetica", 7)
    c.drawString(12 * mm, 16 * mm, "Scan to verify your order.")
    c.drawString(12 * mm, 12 * mm, "Thank you! — AI Barista Coffee")

    c.showPage()
    c.save()


def _pil_to_png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
