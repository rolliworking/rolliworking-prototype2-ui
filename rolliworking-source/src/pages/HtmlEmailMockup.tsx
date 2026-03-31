import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Standalone mockup page showing what the HTML inspection email would look like.
 * This is for preview/review purposes only — not wired to real data.
 */
export default function HtmlEmailMockup() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sample data for the mockup
  const mockData = {
    customerName: "John Smith",
    firstName: "John",
    estimateNumber: "EST-2024-0847",
    brand: "Rolex",
    model: "Submariner",
    referenceNumber: "126610LN",
    targetDate: "March 15, 2026",
    approvalUrl: "https://rolliworking.com/approve-inspection?id=abc123",
    sections: [
      {
        title: "DIAL",
        condition: "Good",
        notes: ["Light scratches on face", "Lume plots intact"],
        price: 350,
      },
      {
        title: "HANDS",
        condition: "Very Good",
        notes: ["Minor oxidation on hour hand"],
        price: 0,
        waiverRequired: true,
      },
      {
        title: "BEZEL",
        condition: "Fair",
        notes: ["Faded insert", "Scratches on bezel edge"],
        price: 475,
      },
      {
        title: "CASE",
        condition: "Good",
        notes: ["Desk diving marks on clasp side", "Retail Case Restoration: $250"],
        price: 450,
      },
      {
        title: "CRYSTAL",
        condition: "Excellent",
        notes: [],
        price: 0,
      },
      {
        title: "BRACELET",
        condition: "Fair",
        notes: ["Stretch in center links", "Clasp spring weak"],
        price: 650,
      },
    ],
    yesNoItems: [
      {
        id: "crystal_polish",
        label: "Crystal Polish Up",
        price: 75,
      },
      {
        id: "steel_side",
        label: "OPTIONAL: Steel missing on inner corners of STEEL SIDE pieces — 2 hrs @ $98/hr",
        price: 196,
      },
      {
        id: "steel_center",
        label: "OPTIONAL: Steel missing on inner corners of STEEL CENTER pieces (Recommended) — 1.5 hrs @ $98/hr",
        price: 147,
      },
    ],
  };

  const htmlEmail = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rolliworks Inspection Notes</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f4f4f5;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#047857;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0;letter-spacing:1px;">ROLLIWORKS</h1>
              <p style="color:#a7f3d0;font-size:14px;margin:8px 0 0;font-weight:400;">Inspection Notes</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 16px;">
              <p style="font-size:16px;color:#1a1a1a;margin:0;">Dear ${mockData.firstName},</p>
              <p style="font-size:14px;color:#52525b;margin:12px 0 0;line-height:1.6;">
                Here are our inspection notes. We will be awaiting your reply before adding your jobs to our work queue. The target date is just a marker not a set due date.
              </p>
              <p style="font-size:14px;color:#52525b;margin:12px 0 0;line-height:1.6;">
                After all work is complete, we will email an invoice via QuickBooks.
              </p>
              <p style="font-size:14px;color:#52525b;margin:12px 0 0;line-height:1.6;">
                <strong>Pick up in person</strong> — Payment can be made during pick up time.
              </p>
              <p style="font-size:14px;color:#52525b;margin:12px 0 0;line-height:1.6;">
                <strong>Shipping out</strong> — You can use the link to your invoice to pay with a Credit or Debit Card. (We will ship after payment and will ALWAYS wait for a shipping address before shipping).
              </p>
            </td>
          </tr>

          <!-- Watch Details -->
          <tr>
            <td style="padding:16px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f9fafb;border-radius:8px;border:1px solid #e4e4e7;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td style="width:50%;vertical-align:top;">
                          <p style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Watch</p>
                          <p style="font-size:15px;font-weight:600;color:#1a1a1a;margin:0;">${mockData.brand} ${mockData.model}</p>
                          <p style="font-size:13px;color:#52525b;margin:4px 0 0;">Ref: ${mockData.referenceNumber}</p>
                        </td>
                        <td style="width:50%;vertical-align:top;text-align:right;">
                          <p style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Estimate</p>
                          <p style="font-size:15px;font-weight:600;color:#1a1a1a;margin:0;">${mockData.estimateNumber}</p>
                          <p style="font-size:13px;color:#52525b;margin:4px 0 0;">Target: ${mockData.targetDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section Divider -->
          <tr>
            <td style="padding:8px 40px;">
              <p style="font-size:12px;color:#047857;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0;border-bottom:2px solid #047857;padding-bottom:8px;">
                Inspection Findings — Complete Watch
              </p>
            </td>
          </tr>

          <!-- Findings -->
          ${mockData.sections.map(section => `
          <tr>
            <td style="padding:4px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-bottom:1px solid #f4f4f5;">
                <tr>
                  <td style="padding:12px 0;vertical-align:top;">
                    <p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0;">
                      ${section.waiverRequired ? '⚠️ ' : ''}${section.title}
                      <span style="font-size:12px;font-weight:400;color:#71717a;margin-left:8px;padding:2px 8px;background:#f4f4f5;border-radius:4px;">${section.condition}</span>
                    </p>
                    ${section.notes.length > 0 ? `<p style="font-size:13px;color:#52525b;margin:4px 0 0;line-height:1.5;">${section.notes.join(' · ')}</p>` : ''}
                    ${section.waiverRequired ? '<p style="font-size:12px;color:#dc2626;margin:4px 0 0;font-weight:500;">⚠️ Waiver Required</p>' : ''}
                  </td>
                  <td style="padding:12px 0;text-align:right;vertical-align:top;white-space:nowrap;">
                    ${section.price > 0 ? `<p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0;">$${section.price.toLocaleString()}</p>` : '<p style="font-size:14px;color:#a1a1aa;margin:0;">—</p>'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}

          <!-- Yes/No Items Section -->
          <tr>
            <td style="padding:24px 40px 8px;">
              <p style="font-size:12px;color:#047857;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0;border-bottom:2px solid #047857;padding-bottom:8px;">
                Please Select — Yes or No
              </p>
            </td>
          </tr>

          ${mockData.yesNoItems.map(item => `
          <tr>
            <td style="padding:8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#fefce8;border:1px solid #fde68a;border-radius:8px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px;color:#1a1a1a;margin:0 0 8px;font-weight:500;">${item.label}</p>
                    <p style="font-size:13px;color:#71717a;margin:0 0 12px;">Cost: <strong>$${item.price}</strong></p>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:8px;">
                          <a href="${mockData.approvalUrl}&item=${item.id}&choice=yes" style="display:inline-block;padding:8px 24px;background-color:#047857;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;text-align:center;">
                            ✓ YES
                          </a>
                        </td>
                        <td>
                          <a href="${mockData.approvalUrl}&item=${item.id}&choice=no" style="display:inline-block;padding:8px 24px;background-color:#ffffff;color:#dc2626;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;border:2px solid #dc2626;text-align:center;">
                            ✗ NO
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}

          <!-- Polish Question -->
          <tr>
            <td style="padding:16px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-size:14px;font-weight:600;color:#1e40af;margin:0 0 8px;">⭐ Question: Polish or No Polish for "BRACELET"</p>
                    <p style="font-size:13px;color:#1e3a5f;margin:0;line-height:1.6;">
                      0 = No polish<br>
                      1-2 = Vintage looking<br>
                      3-5 = Freshened up a bit but vintage<br>
                      7 = New-ish<br>
                      8-10 = As new as possible (Retail polish at $250)<br><br>
                      <strong>Please reply with a number between 0 to 10.</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Terms & Conditions -->
          <tr>
            <td style="padding:16px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <p style="font-size:14px;color:#52525b;margin:0 0 12px;">
                      By approving work, you agree to our Terms & Conditions:
                    </p>
                    <a href="https://www.rolliworks.com/serviceagreement" style="display:inline-block;padding:10px 28px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
                      📄 Read Terms & Conditions
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Approve All CTA -->
          <tr>
            <td style="padding:24px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                <tr>
                  <td style="text-align:center;">
                    <p style="font-size:14px;color:#52525b;margin:0 0 12px;">
                      Ready to approve? Click below to review and confirm your selections.
                    </p>
                    <a href="${mockData.approvalUrl}" style="display:inline-block;padding:14px 40px;background-color:#047857;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
                      Review & Approve Work →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;border-top:1px solid #e4e4e7;">
              <p style="font-size:14px;color:#1a1a1a;margin:0;">Thank you!</p>
              <p style="font-size:14px;color:#1a1a1a;margin:4px 0;font-weight:600;">Best, Ivy P.</p>
              <p style="font-size:13px;color:#71717a;margin:8px 0 0;line-height:1.6;">
                Rolliworks<br>
                14 N.E. 1st Ave Ste 403<br>
                Miami FL 33132<br>
                408-800-3244
              </p>
              <p style="font-size:12px;color:#a1a1aa;margin:8px 0 0;">
                M-F 9am to 5pm · Sat-Sun: Closed<br>
                IG: @mikerolliworks
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlEmail);
        doc.close();
      }
    }
  }, [htmlEmail]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-bold">HTML Email Mockup</h1>
          <p className="text-sm text-muted-foreground">Preview of what clients would receive — using sample data</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-muted/30">
        <iframe
          ref={iframeRef}
          title="HTML Email Preview"
          className="w-full border-0"
          style={{ height: "85vh" }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
