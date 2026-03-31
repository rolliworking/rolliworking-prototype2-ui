import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CONDITIONS = ["Excellent", "Very Good", "Good", "Fair", "Poor", "NONE"];

const SECTION_ORDER = ["dial", "hands", "bezel", "crown", "case", "crystal", "bracelet"] as const;

const SECTION_NOTES: Record<string, string[]> = {
  dial: [
    "Aftermarket (not made by Rolex)", "Chips along edge", "Lume Shedding", "Luminova",
    "Moisture Damage", "No Defects to Note", "No Major Defects", "Scuffs on Hour Markers",
    "Some Paint Defects", "Tritium",
  ],
  hands: [
    "Aftermarket (not made by Rolex)", "Hands Bent", "Light Scratches", "Lume Shedding",
    "Luminova", "No Defects to Note", "No Major Defects", "Scuffs", "Tritium",
  ],
  bezel: [
    "Aftermarket (not made by Rolex)", "No Defects to Note", "No Major Defects", "Normal Wear",
    "Recut Bezel + Welding?", "Scuffs", "Scuffs on gold ring", "Scuffs on insert",
    "Scuffs on steel ring", "Soft Flutes",
  ],
  crown: [
    "Aftermarket (not made by Rolex)", "Coronet polished down", "Dented/Damaged",
    "No Defects to Note", "No Major Defects", "Normal Wear", "Not threading properly", "Scuffs",
  ],
  case: [
    "Material Missing from Tips of Lugs (inner edge)", "Normal Wear", "Scuffs",
    "Some Nicks and Gashes", "Welding $140/hr",
  ],
  crystal: [
    "Aftermarket (not made by Rolex)", "Chips (edge)", "Micro Chips (edge)",
    "Polish Up $0 Yes / No?", "Scuffs",
  ],
  bracelet: [
    "Aftermarket (not made by Rolex)", "Coronet very faded",
    "Gold too thin to repair w/o Mold Work", "Might be 1mm narrower (material loss)",
    "No Defects to Note", "No Major Defects", "Normal Wear", "Scuffs", "Some Stretch",
  ],
};

// ── Prompt builders ─────────────────────────────────────────────

function buildSectionPrompt() {
  return Object.entries(SECTION_NOTES).map(([section, notes]) =>
    `  ${section.toUpperCase()}:\n    Condition: one of [${CONDITIONS.join(', ')}]\n    Checkbox notes: [${notes.join(' | ')}]`
  ).join('\n');
}

function buildExtractionPrompt() {
  const sectionPrompt = buildSectionPrompt();

  return `You are an expert at reading handwritten watch inspection scantron sheets from Rolliworks.
Your job is to extract ALL data from photographed scantron sheets with extreme accuracy.

## CRITICAL: SECTION LAYOUT (TOP TO BOTTOM ORDER)

The sheet is divided into clearly labeled sections in this EXACT vertical order:
1. DIAL (top)
2. HANDS
3. BEZEL
4. CROWN
5. CASE
6. CRYSTAL
7. BRACELET (bottom)

Each section is separated by a horizontal line/border and has its label printed in BOLD on the LEFT side.
EVERY note belongs ONLY to the section whose label appears ABOVE it and BEFORE the next section label.
When extracting notes, ALWAYS look at the section label printed to the LEFT to confirm which section you are reading.

## CRITICAL: DO NOT MIX UP BEZEL AND CROWN

BEZEL appears DIRECTLY ABOVE CROWN on the form. They are two SEPARATE sections with different notes.
- BEZEL-only notes: Soft Flutes, Recut Bezel + Welding?, Scuffs on steel ring, Scuffs on gold ring, Scuffs on insert
- CROWN-only notes: Coronet polished down, Not threading properly, Dented/Damaged
- Handwritten "Other" text with "case tube" or "thread" → belongs to CROWN
- Handwritten "Other" text with "flute" or "bezel" → belongs to BEZEL
- The "Other:" line with a price and Y/N checkbox ENDS each section — everything above it belongs to THAT section
- The handwritten note text, the dollar amount at the far RIGHT, and the Y/N checkbox all belong to the SAME horizontal "Other:" line
- NEVER carry a dollar amount down into the next section below it; if "$355" is on the BEZEL Other line, it belongs to BEZEL, not CROWN

## HOW TO READ CONDITION SELECTIONS

Each section has a condition row printed as:

  1 Excellent   2 Very Good   3 Good   4 Fair   5 Poor   6 NONE

DIAL and HANDS also have:  7 Waiver

The technician circles ONE condition WORD in RED INK.

ABSOLUTE RULES:
- READ THE WORD that has red ink around it — the word IS the answer
- If "Good" is circled → condition is "Good"
- If "Poor" is circled → condition is "Poor"
- IGNORE the printed numbers — only read the WORD
- Do NOT infer from position — READ the actual text inside the red circle/oval

## HOW TO READ NOTE SELECTIONS

Below each condition row is a grid of numbered notes (bold numbers with labels).
- Notes with RED circles around their numbers are SELECTED
- Notes WITHOUT red ink are NOT selected
- Read the EXACT label text — do not substitute similar-sounding notes
- Only include notes whose number has a clear red mark
- IMPORTANT: The note numbers RESTART at 1 for each section. Match each note to the section it physically appears under by checking the section label on the LEFT

## SECTION NOTE OPTIONS

${sectionPrompt}

## SPECIAL FIELDS

- DIAL and HANDS: "7 Waiver" — if circled in red, set waiverRequired: true
- Each section may have handwritten "Other" lines with dollar amounts and Y/N checkboxes → put in customNotes
- CASE: Retail Polish (checkbox), Case Restoration $ amount, Welding $140/hr

## BRACELET REPAIR OPTIONS

This section appears at the BOTTOM of the sheet in TWO COLUMNS:

- Line 1 LEFT:  "1 Might need extra links — Qty: ____ × $______"
- Line 1 RIGHT: "2 Steel Side pieces (inner corners) — ____ hrs @ $98/hr | Rec ☐ Not Rec ☐"
- Line 2 LEFT:  "3 Steel Center pieces (inner corners) — ____ hrs @ $98/hr | Rec ☐ Not Rec ☐"
- Line 2 RIGHT: "4 Gold Center pieces (inner corners) — Qty: ____ × $______ | Rec ☐ Not Rec ☐"
- Line 3 LEFT:  "5 Center pieces foil thin / Invert — Qty: ____ × $______"
- Line 3 RIGHT: "6 Band Polish (0-10): ☐ Include"

CRITICAL: Item 2 (Steel SIDE) is RIGHT of row 1. Item 3 (Steel CENTER) is LEFT of row 2. Do NOT swap.
Read the COMPLETE handwritten number for hours/quantities.
For DOLLAR AMOUNTS: carefully distinguish similar-looking digits (2 vs 9, 5 vs 3, 1 vs 7).

## ADDITIONAL NOTES SECTION
At the very bottom in a bordered box. Transcribe free-form handwritten text exactly.
Read dollar amounts digit by digit.

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation):
{
  "barcodeData": {
    "found": false,
    "name": "",
    "email": "",
    "phone": "",
    "referenceNumber": "",
    "estimateNumber": "",
    "serviceCodes": "",
    "serviceType": ""
  },
  "sections": {
    "dial": { "condition": "", "selectedNotes": [], "customNotes": [{"note": "", "price": 0, "addYesNo": false}], "waiverRequired": false },
    "hands": { "condition": "", "selectedNotes": [], "customNotes": [], "waiverRequired": false },
    "bezel": { "condition": "", "selectedNotes": [], "customNotes": [] },
    "crown": { "condition": "", "selectedNotes": [], "customNotes": [] },
    "case": { "condition": "", "selectedNotes": [], "customNotes": [], "retailPolish": false, "caseRestorePrice": 0 },
    "crystal": { "condition": "", "selectedNotes": [], "customNotes": [] },
    "bracelet": { "condition": "", "selectedNotes": [], "customNotes": [] }
  },
  "braceletRepair": {
    "extraLinks": { "checked": false, "qty": 0, "pricePerLink": 0 },
    "steelSidePieces": { "checked": false, "hours": "", "recommended": "none" },
    "steelCenterPieces": { "checked": false, "hours": "", "recommended": "none" },
    "goldCenterPieces": { "checked": false, "qty": 0, "pricePerPiece": 0, "recommended": "none" },
    "centerPiecesFoilThin": { "checked": false, "qty": 0, "pricePerPiece": 0 },
    "bandPolish": { "checked": false, "scale": "" }
  },
  "weldingPrice": 0,
  "additionalNotes": "",
  "confidence": "high|medium|low"
}

## RULES
- condition values MUST exactly match one of: ${CONDITIONS.join(', ')}
- selectedNotes MUST only contain values from the predefined lists above (exact spelling)
- Handwritten notes go in customNotes array
- BARCODE READING (CRITICAL): Look for a DataMatrix or PDF417 barcode label on the sheet. If present, set barcodeData.found=true. Read the PRINTED TEXT near the barcode carefully — it typically contains the client name, email, phone, reference number, estimate number, and service codes. Extract ALL of these fields into barcodeData. The text may be printed in a small font near or around the barcode. Read every character precisely
- Empty/unclear fields use empty string or zero defaults
- Set confidence based on image clarity`;
}

// ── Helpers ─────────────────────────────────────────────────────

async function callOpenAI(prompt: string, base64Images: string[], temperature = 0.1): Promise<string | null> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) {
    console.warn('LOVABLE_API_KEY not set, skipping AI call');
    return null;
  }

  const content: any[] = [{ type: 'text', text: prompt }];
  for (const img of base64Images) {
    const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${base64Data}` },
    });
  }

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.2',
      messages: [{ role: 'user', content }],
      temperature,
      max_completion_tokens: 4096,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.warn('OpenAI verification failed:', resp.status, errText);
    return null;
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || null;
}

function extractJson(text: string): any | null {
  let jsonStr = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  jsonStr = jsonStr.substring(start, end + 1);

  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      const repaired = jsonStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/[\x00-\x1F\x7F]/g, '');
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

function normalizePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;

  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/);
    if (match) {
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
  }

  return 0;
}

function inferPriceFromCustomNote(note: string): number | null {
  if (!note) return null;

  const explicitDollarAmounts = Array.from(note.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)).map((match) => Number(match[1]));
  if (explicitDollarAmounts.length === 1 && Number.isFinite(explicitDollarAmounts[0])) {
    return explicitDollarAmounts[0];
  }

  const arithmeticMatch = note.match(/(\d+(?:\.\d{1,2})?(?:\s*\+\s*\d+(?:\.\d{1,2})?)+)/);
  if (arithmeticMatch) {
    const total = arithmeticMatch[1]
      .split(/\s*\+\s*/)
      .map((part) => Number(part))
      .filter((part) => Number.isFinite(part))
      .reduce((sum, part) => sum + part, 0);

    if (total > 0) return total;
  }

  return null;
}

function normalizeCustomNotes(customNotes: unknown) {
  if (!Array.isArray(customNotes)) return [];

  return customNotes
    .map((entry: any) => {
      const note = typeof entry?.note === 'string' ? entry.note.trim() : '';
      const parsedPrice = normalizePrice(entry?.price);
      const inferredPrice = inferPriceFromCustomNote(note);

      return {
        note,
        price: inferredPrice ?? parsedPrice,
        addYesNo: Boolean(entry?.addYesNo),
      };
    })
    .filter((entry) => entry.note || entry.price > 0 || entry.addYesNo);
}

function normalizeConditions(parsed: any) {
  const conditionMap: Record<string, string> = {};
  CONDITIONS.forEach(c => {
    conditionMap[c.toLowerCase()] = c;
    conditionMap[c.toLowerCase().replace(/\s+/g, '_')] = c;
  });

  if (parsed.sections) {
    for (const [sectionName, sectionData] of Object.entries(parsed.sections)) {
      const section = sectionData as any;
      if (section?.condition) {
        const normalized = conditionMap[section.condition.toLowerCase()];
        if (normalized) section.condition = normalized;
      }
      if (section?.selectedNotes && SECTION_NOTES[sectionName]) {
        const validNotes = new Set(SECTION_NOTES[sectionName]);
        section.selectedNotes = section.selectedNotes.filter((n: string) => validNotes.has(n));
      }

      if (section) {
        section.customNotes = normalizeCustomNotes(section.customNotes);
      }
    }

    for (const sectionName of SECTION_ORDER) {
      if (!parsed.sections[sectionName]) {
        parsed.sections[sectionName] = { condition: '', selectedNotes: [], customNotes: [] };
      }
    }

    if (parsed.sections.case) {
      parsed.sections.case.caseRestorePrice = normalizePrice(parsed.sections.case.caseRestorePrice);
    }
  }

  parsed.weldingPrice = normalizePrice(parsed.weldingPrice);
}

// ── Main handler ────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { image, images, decodedBarcode } = await req.json();
    const imageList: string[] = images || (image ? [image] : []);
    if (imageList.length === 0) {
      return new Response(JSON.stringify({ error: 'No image(s) provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const barcodeContext = decodedBarcode
      ? `\n\nThe DataMatrix barcode on the label has been decoded client-side. Raw data:\n"${decodedBarcode}"\nParse using pipe-delimited format (N:Name|E:email|P:phone|R:reference|S:serial|D:date|#:estimate_number|SC:service_codes|ST:service_type|BM:bracelet_model) and set barcodeData.found=true.`
      : '';

    // ── Single pass: OpenAI GPT-5 ──
    console.log('=== OpenAI GPT-5 Single Pass ===');
    const prompt = buildExtractionPrompt() + `\n\nExtract all inspection data from these ${imageList.length} photo(s) of the handwritten scantron sheet.` + barcodeContext;
    const resultText = await callOpenAI(prompt, imageList, 0.05);

    if (!resultText) {
      return new Response(JSON.stringify({ error: 'AI processing failed - OpenAI unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = extractJson(resultText);

    if (!parsed) {
      console.error('No JSON in AI response:', resultText);
      return new Response(JSON.stringify({ error: 'No JSON in AI response', raw: resultText }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    normalizeConditions(parsed);
    console.log('FINAL conditions:', JSON.stringify(
      Object.fromEntries(Object.entries(parsed.sections || {}).map(([k, v]) => [k, (v as any).condition]))
    ));
    console.log('FINAL customNotes:', JSON.stringify(
      Object.fromEntries(Object.entries(parsed.sections || {}).map(([k, v]) => [k, (v as any).customNotes || []]))
    ));
    console.log('FINAL braceletRepair:', JSON.stringify(parsed.braceletRepair));
    console.log('FINAL additionalNotes:', parsed.additionalNotes);

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing scantron:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
