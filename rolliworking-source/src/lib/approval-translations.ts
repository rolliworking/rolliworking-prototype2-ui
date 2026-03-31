/**
 * Translations for the client-facing approval page.
 * Data values (yes/no choices, question keys) are always stored in English.
 */

export type ApprovalLang = "en" | "es";

interface ApprovalTranslations {
  // Page
  loadingReport: string;
  unableToLoad: string;
  approvalNotFound: string;
  invalidApprovalLink: string;

  // Header
  inspectionNotes: string;
  horologicalServices: string;

  // Greeting
  dear: string;
  greetingText: (isGroup: boolean) => string;

  // Watch info labels
  timepiece: string;
  items: string;
  estimateNo: string;
  target: string;
  ref: string;

  // Findings
  inspectionFindings: string;
  braceletOnly: string;
  completeWatch: string;
  findings: string;
  additionalNotes: string;

  // Section names
  dial: string;
  hands: string;
  bezel: string;
  crown: string;
  case_: string;
  crystal: string;
  bracelet: string;

  // Conditions
  good: string;
  fair: string;
  poor: string;
  notInspected: string;

  // Approval survey
  yourResponseRequired: string;
  selectYesOrNo: string;
  yesApprove: string;
  noDecline: string;

  // Client questions
  yourPreferences: string;
  selectYesOrNoQuestion: string;
  yes: string;
  no: string;

  // Scale question
  noPolishCleanOnly: string;
  orSelectLevel: string;
  vintageLooking: string;
  freshenedUp: string;
  newIsh: string;
  asNewAsPossible: string;
  retailPolishCost: string;
  selected: string;
  free: string;

  // Polish scale descriptions
  scaleQ4Description: string;

  // Waiver
  liabilityWaiver: string;
  waiverIntro: (parts: string) => string;
  waiverPreExisting: string;
  waiverLimitationOfLiability: string;
  waiverCustomerAcceptance: string;
  waiverAcknowledgeText: (parts: string) => string;
  waiverUnderstand: (parts: string) => string;
  waiverFurtherUnderstand: string;

  // Notes
  notesAndRequests: string;
  optional: string;
  notesPlaceholder: string;

  // Authorization
  authorization: string;
  fullName: string;
  typeFullLegalName: string;
  serviceAgreementText: string;
  serviceAgreement: string;
  answerAllQuestions: string;
  answerRequiredPreferences: string;
  acknowledgeWaiver: string;
  approveAndSubmit: string;
  processing: string;
  completeAllFields: string;

  // Completed
  approvalReceived: string;
  thankYouText: (isGroup: boolean, count: number) => string;
  itemsApproved: (count: number) => string;

  // What happens next
  whatHappensNext: string;
  whatHappensNextText: (isGroup: boolean) => string;
  pickUpInPerson: string;
  pickUpText: string;
  shipping: string;
  shippingText: string;

  // Footer
  allRightsReserved: string;

  // Toast messages (stay in English since staff sees these)
}

const en: ApprovalTranslations = {
  loadingReport: "Loading report…",
  unableToLoad: "Unable to Load",
  approvalNotFound: "Approval not found",
  invalidApprovalLink: "Invalid approval link",
  inspectionNotes: "Inspection Notes",
  horologicalServices: "Horological Services",
  dear: "Dear",
  greetingText: (isGroup) =>
    `Thank you for entrusting your ${isGroup ? "bracelets" : "timepiece"} to Rolliworks. Below are our detailed inspection findings. Please review and approve at your convenience.`,
  timepiece: "Timepiece",
  items: "Items",
  estimateNo: "Estimate No.",
  target: "Target",
  ref: "Ref.",
  inspectionFindings: "Inspection Findings",
  braceletOnly: "Bracelet Only",
  completeWatch: "Complete Watch",
  findings: "Findings",
  additionalNotes: "Additional Notes",
  dial: "Dial",
  hands: "Hands",
  bezel: "Bezel",
  crown: "Crown",
  case_: "Case",
  crystal: "Crystal",
  bracelet: "Bracelet",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  notInspected: "Not Inspected",
  yourResponseRequired: "Your Response Required",
  selectYesOrNo: "Please select YES or NO for each optional service below.",
  yesApprove: "Yes — Approve",
  noDecline: "No — Decline",
  yourPreferences: "Your Preferences",
  selectYesOrNoQuestion: "Please select YES or NO for each question below.",
  yes: "Yes",
  no: "No",
  noPolishCleanOnly: "No Polish — Clean Only",
  orSelectLevel: "or select level",
  vintageLooking: "Vintage looking",
  freshenedUp: "Freshened up a bit",
  newIsh: "New-ish",
  asNewAsPossible: "As new as possible",
  retailPolishCost: "This becomes a Retail polish at a cost of $250",
  selected: "Selected",
  free: "Free",
  scaleQ4Description:
    "Each band rebuild comes with 30 mins courtesy polish in our polish room at no cost. Please let us know how you expect the polish to look on a scale of 5-10 (10 being new). 5 = Freshened up a bit · 7 = New-ish · 8-10 = As new as possible (Retail polish at $250)",
  liabilityWaiver: "Liability Waiver — Acknowledgment Required",
  waiverIntro: (parts) =>
    `Our inspection has identified pre-existing condition concerns with your timepiece's ${parts || "component(s)"}. Please review the details below.`,
  waiverPreExisting: "Pre-Existing Condition",
  waiverLimitationOfLiability: "Limitation of Liability",
  waiverCustomerAcceptance: "Customer Acceptance",
  waiverAcknowledgeText: (parts) =>
    `I acknowledge the pre-existing condition of the ${parts || "noted part(s)"} and authorize Rolliworks to proceed with service despite the acknowledged risk.`,
  waiverUnderstand: (parts) =>
    `I, the undersigned, understand and acknowledge that the above watch has pre-existing condition issues with the ${parts || "noted component(s)"} at the time it was presented for service.`,
  waiverFurtherUnderstand: "I further understand and agree to the following:",
  notesAndRequests: "Notes & Requests",
  optional: "Optional",
  notesPlaceholder: "Any additional notes, special requests, or questions for our team…",
  authorization: "Authorization",
  fullName: "Full Name",
  typeFullLegalName: "Type your full legal name",
  serviceAgreementText: "I have read and agree to the",
  serviceAgreement: "Service Agreement",
  answerAllQuestions: "⚠ Please answer all questions above before submitting.",
  answerRequiredPreferences: "⚠ Please answer all required preference questions above before submitting.",
  acknowledgeWaiver: "⚠ Please acknowledge the liability waiver above before submitting.",
  approveAndSubmit: "Approve & Submit",
  processing: "Processing…",
  completeAllFields: "Complete all required fields to enable submission.",
  approvalReceived: "Approval Received",
  thankYouText: (isGroup, count) =>
    `Thank you for reviewing and approving the inspection report${isGroup ? ` for your ${count} bracelets` : " for your timepiece"}.`,
  itemsApproved: (count) => `${count} items approved`,
  whatHappensNext: "What Happens Next",
  whatHappensNextText: (isGroup) =>
    `We will await your approval before adding your ${isGroup ? "bracelets" : "timepiece"} to our work queue. The target date is an estimate, not a guaranteed completion date. Upon completion, we will email an invoice via QuickBooks.`,
  pickUpInPerson: "Pick Up In Person",
  pickUpText: "Payment can be made at the time of pickup.",
  shipping: "Shipping",
  shippingText: "Pay via invoice link. We ship after payment and always confirm the shipping address first.",
  allRightsReserved: "All rights reserved.",
};

const es: ApprovalTranslations = {
  loadingReport: "Cargando informe…",
  unableToLoad: "No se puede cargar",
  approvalNotFound: "Aprobación no encontrada",
  invalidApprovalLink: "Enlace de aprobación inválido",
  inspectionNotes: "Notas de Inspección",
  horologicalServices: "Servicios Horológicos",
  dear: "Estimado/a",
  greetingText: (isGroup) =>
    `Gracias por confiar ${isGroup ? "sus pulseras" : "su reloj"} a Rolliworks. A continuación se presentan los hallazgos detallados de nuestra inspección. Por favor revise y apruebe a su conveniencia.`,
  timepiece: "Reloj",
  items: "Artículos",
  estimateNo: "N.º de Estimado",
  target: "Fecha Estimada",
  ref: "Ref.",
  inspectionFindings: "Hallazgos de la Inspección",
  braceletOnly: "Solo Pulsera",
  completeWatch: "Reloj Completo",
  findings: "Hallazgos",
  additionalNotes: "Notas Adicionales",
  dial: "Esfera",
  hands: "Manecillas",
  bezel: "Bisel",
  crown: "Corona",
  case_: "Caja",
  crystal: "Cristal",
  bracelet: "Pulsera",
  good: "Bueno",
  fair: "Regular",
  poor: "Malo",
  notInspected: "No Inspeccionado",
  yourResponseRequired: "Se Requiere Su Respuesta",
  selectYesOrNo: "Por favor seleccione SÍ o NO para cada servicio opcional a continuación.",
  yesApprove: "Sí — Aprobar",
  noDecline: "No — Rechazar",
  yourPreferences: "Sus Preferencias",
  selectYesOrNoQuestion: "Por favor seleccione SÍ o NO para cada pregunta a continuación.",
  yes: "Sí",
  no: "No",
  noPolishCleanOnly: "Sin Pulido — Solo Limpieza",
  orSelectLevel: "o seleccione nivel",
  vintageLooking: "Aspecto vintage",
  freshenedUp: "Un poco renovado",
  newIsh: "Como nuevo",
  asNewAsPossible: "Lo más nuevo posible",
  retailPolishCost: "Esto se convierte en un pulido Retail a un costo de $250",
  selected: "Seleccionado",
  free: "Gratis",
  scaleQ4Description:
    "Cada reconstrucción de pulsera incluye 30 minutos de pulido de cortesía sin costo. Por favor indíquenos cómo espera que se vea el pulido en una escala del 5-10 (10 siendo nuevo). 5 = Un poco renovado · 7 = Como nuevo · 8-10 = Lo más nuevo posible (Pulido Retail a $250)",
  liabilityWaiver: "Exención de Responsabilidad — Se Requiere Reconocimiento",
  waiverIntro: (parts) =>
    `Nuestra inspección ha identificado problemas de condición preexistente con ${parts || "componente(s)"} de su reloj. Por favor revise los detalles a continuación.`,
  waiverPreExisting: "Condición Preexistente",
  waiverLimitationOfLiability: "Limitación de Responsabilidad",
  waiverCustomerAcceptance: "Aceptación del Cliente",
  waiverAcknowledgeText: (parts) =>
    `Reconozco la condición preexistente de ${parts || "la(s) parte(s) indicada(s)"} y autorizo a Rolliworks a proceder con el servicio a pesar del riesgo reconocido.`,
  waiverUnderstand: (parts) =>
    `Yo, el abajo firmante, entiendo y reconozco que el reloj mencionado tiene problemas de condición preexistente con ${parts || "el/los componente(s) indicado(s)"} al momento de ser presentado para servicio.`,
  waiverFurtherUnderstand: "Además entiendo y acepto lo siguiente:",
  notesAndRequests: "Notas y Solicitudes",
  optional: "Opcional",
  notesPlaceholder: "Notas adicionales, solicitudes especiales o preguntas para nuestro equipo…",
  authorization: "Autorización",
  fullName: "Nombre Completo",
  typeFullLegalName: "Escriba su nombre legal completo",
  serviceAgreementText: "He leído y acepto el",
  serviceAgreement: "Acuerdo de Servicio",
  answerAllQuestions: "⚠ Por favor responda todas las preguntas antes de enviar.",
  answerRequiredPreferences: "⚠ Por favor responda todas las preguntas de preferencia requeridas antes de enviar.",
  acknowledgeWaiver: "⚠ Por favor reconozca la exención de responsabilidad antes de enviar.",
  approveAndSubmit: "Aprobar y Enviar",
  processing: "Procesando…",
  completeAllFields: "Complete todos los campos requeridos para habilitar el envío.",
  approvalReceived: "Aprobación Recibida",
  thankYouText: (isGroup, count) =>
    `Gracias por revisar y aprobar el informe de inspección${isGroup ? ` de sus ${count} pulseras` : " de su reloj"}.`,
  itemsApproved: (count) => `${count} artículos aprobados`,
  whatHappensNext: "Próximos Pasos",
  whatHappensNextText: (isGroup) =>
    `Esperaremos su aprobación antes de agregar ${isGroup ? "sus pulseras" : "su reloj"} a nuestra cola de trabajo. La fecha estimada es un cálculo aproximado, no una fecha garantizada de finalización. Al completarse, le enviaremos una factura por correo electrónico a través de QuickBooks.`,
  pickUpInPerson: "Recoger en Persona",
  pickUpText: "El pago se puede realizar al momento de la recogida.",
  shipping: "Envío",
  shippingText: "Pague a través del enlace de la factura. Enviamos después del pago y siempre confirmamos la dirección de envío primero.",
  allRightsReserved: "Todos los derechos reservados.",
};

const translations: Record<ApprovalLang, ApprovalTranslations> = { en, es };

export function getApprovalTranslations(lang: ApprovalLang): ApprovalTranslations {
  return translations[lang] || translations.en;
}

/** Translate a condition value for display (data stays English) */
export function translateCondition(condition: string, lang: ApprovalLang): string {
  if (!condition) return "";
  const formatted = condition.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  if (lang !== "es") return formatted;

  const condMap: Record<string, string> = {
    "Good": "Bueno",
    "Very Good": "Muy Bueno",
    "Fair": "Regular",
    "Poor": "Malo",
    "Excellent": "Excelente",
    "Not Inspected": "No Inspeccionado",
  };
  return condMap[formatted] || formatted;
}

/** Translate section title for display */
export function translateSectionTitle(title: string, lang: ApprovalLang): string {
  if (lang !== "es") return title;
  const map: Record<string, string> = {
    "Dial": "Esfera",
    "Hands": "Manecillas",
    "Bezel": "Bisel",
    "Crown": "Corona",
    "Case": "Caja",
    "Crystal": "Cristal",
    "Bracelet": "Pulsera",
    "Additional Notes": "Notas Adicionales",
  };
  return map[title] || title;
}

/** Translate predefined inspection notes for client-facing display.
 *  Accepts an optional dynamic translation map (e.g. from AI) for custom notes. */
export function translateNote(note: string, lang: ApprovalLang, dynamicMap?: Record<string, string>): string {
  if (lang !== "es" || !note) return note;

  // Check dynamic AI translations first
  if (dynamicMap && dynamicMap[note]) return dynamicMap[note];

  const noteMap: Record<string, string> = {
    // --- Shared / Common ---
    "Scuffs": "Rasguños",
    "Normal Wear": "Desgaste Normal",
    "No Defects to Note": "Sin Defectos a Notar",
    "No Major Defects": "Sin Defectos Mayores",
    "Aftermarket (not made by Rolex)": "No original (no fabricado por Rolex)",
    "Light Scratches": "Rasguños Leves",

    // --- Dial ---
    "Some Paint Defects": "Algunos Defectos de Pintura",
    "Lume Shedding": "Desprendimiento de Luminiscencia",
    "Scuffs on Hour Markers": "Rasguños en los Marcadores de Hora",
    "Chips along edge": "Astillas en el borde",
    "Moisture Damage": "Daño por Humedad",
    "Tritium": "Tritio",
    "Luminova": "Luminova",

    // --- Hands ---
    "Hands Bent": "Manecillas Dobladas",

    // --- Bezel ---
    "Scuffs on steel ring": "Rasguños en el anillo de acero",
    "Scuffs on gold ring": "Rasguños en el anillo de oro",
    "Scuffs on insert": "Rasguños en el inserto",
    "Soft Flutes": "Estrías Suaves",
    "Recut Bezel + Welding?": "¿Recortar Bisel + Soldadura?",

    // --- Crown ---
    "Not threading properly": "No enrosca correctamente",
    "Coronet polished down": "Coroneta pulida",
    "Dented/Damaged": "Abollado/Dañado",
    "Catching on one thread. Might try new case tube $55": "Se atasca en un hilo. Se puede intentar un nuevo tubo de caja $55",

    // --- Case ---
    "Some Nicks and Gashes": "Algunos Golpes y Raspaduras",
    "Material Missing from Tips of Lugs (inner edge)": "Material faltante en las puntas de las asas (borde interior)",
    "Welding $140/hr": "Soldadura $140/hr",

    // --- Crystal ---
    "Chips (edge)": "Astillas (borde)",
    "Micro Chips (edge)": "Micro Astillas (borde)",
    "Polish Up $0 Yes / No?": "Pulir $0 ¿Sí / No?",

    // --- Bracelet ---
    "Some Stretch": "Algo de Estiramiento",
    "Coronet very faded": "Coroneta muy descolorida",
    "Gold too thin to repair w/o Mold Work": "Oro demasiado delgado para reparar sin trabajo de molde",
    "Might be 1mm narrower (material loss)": "Podría ser 1mm más estrecho (pérdida de material)",
    "CASE work only": "Solo trabajo de CAJA",

    // --- Waiver ---
    "⚠ Waiver Required": "⚠ Se Requiere Exención",
    "⚠️ Waiver Required": "⚠️ Se Requiere Exención",
  };

  return noteMap[note] || note;
}

/** Get the set of note keys that have a hardcoded translation */
export function getHardcodedNoteKeys(): Set<string> {
  // Mirror the keys from translateNote's noteMap
  return new Set([
    "Scuffs", "Normal Wear", "No Defects to Note", "No Major Defects",
    "Aftermarket (not made by Rolex)", "Light Scratches",
    "Some Paint Defects", "Lume Shedding", "Scuffs on Hour Markers",
    "Chips along edge", "Moisture Damage", "Tritium", "Luminova",
    "Hands Bent",
    "Scuffs on steel ring", "Scuffs on gold ring", "Scuffs on insert",
    "Soft Flutes", "Recut Bezel + Welding?",
    "Not threading properly", "Coronet polished down", "Dented/Damaged",
    "Catching on one thread. Might try new case tube $55",
    "Some Nicks and Gashes", "Material Missing from Tips of Lugs (inner edge)",
    "Welding $140/hr",
    "Chips (edge)", "Micro Chips (edge)", "Polish Up $0 Yes / No?",
    "Some Stretch", "Coronet very faded",
    "Gold too thin to repair w/o Mold Work",
    "Might be 1mm narrower (material loss)", "CASE work only",
    "⚠ Waiver Required", "⚠️ Waiver Required",
  ]);
}
