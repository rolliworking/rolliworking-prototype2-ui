/**
 * Centralized watch brand and model constants.
 * Import from here to avoid duplication across files.
 */

export const WATCH_BRANDS = ["Rolex", "Tudor", "Cellini", "Other"] as const;
export type WatchBrand = (typeof WATCH_BRANDS)[number];

export const ROLEX_MODELS = [
  "Air-King",
  "Air-King-Date",
  "Big Bubbleback",
  "Bubbleback",
  "Cellini",
  "Cellini Moonphase",
  "Cosmograph Daytona",
  "Datejust",
  "Datejust II",
  "Datejust Turn-O-Graph",
  "Day-Date",
  "Deepsea",
  "Deepsea Challenge",
  "Explorer",
  "Explorer II",
  "GMT-Master",
  "GMT-Master II",
  "King Midas",
  "Lady-Datejust",
  "Lady Oyster Perpetual",
  "Milgauss",
  "Oyster Perpetual",
  "Oysterquartz",
  "Pearlmaster",
  "Perpetual 1908",
  "Sea-Dweller",
  "Sea-Dweller 4000",
  "Sky-Dweller",
  "Submariner",
  "Submariner Date",
  "Yacht-Master",
  "Yacht-Master II",
] as const;

export const TUDOR_MODELS = [
  "Black Bay",
  "Black Bay 58",
  "Black Bay GMT",
  "Black Bay Chrono",
  "Black Bay Bronze",
  "Pelagos",
  "Pelagos FXD",
  "Prince OysterDate",
  "Royal",
  "Ranger",
  "Submariner",
  "1926",
  "Glamour",
] as const;

/**
 * Tudor Submariner reference number prefixes.
 */
export const TUDOR_SUBMARINER_REFS = [
  "7016", "7016/0", "7021", "7021/0", "7928", "7924", "7922", "9401", "9401/0",
  "79090", "79190", "94010", "94110",
] as const;

/**
 * Tudor Prince OysterDate reference number prefixes.
 */
export const TUDOR_PRINCE_OYSTERDATE_REFS = [
  "7996", "7996/0",
] as const;

export const CELLINI_MODELS = [
  "Cellini Date",
  "Cellini Dual Time",
  "Cellini Moonphase",
  "Cellini Time",
] as const;

/**
 * Get model suggestions based on brand.
 */
export function getModelsByBrand(brand: string): readonly string[] {
  switch (brand) {
    case "Rolex":
      return ROLEX_MODELS;
    case "Tudor":
      return TUDOR_MODELS;
    case "Cellini":
      return CELLINI_MODELS;
    default:
      return [];
  }
}

/**
 * Rolex Submariner reference number prefixes.
 * When a reference number starts with one of these, auto-fill brand=Rolex, model=Submariner.
 */
export const SUBMARINER_REFS = [
  "6204", "6205", "6200", "6536", "6536/1", "6538", "6538A",
  "5508", "5510", "5512", "5513", "5514", "5517",
  "1680", "1680/8",
  "16800", "16808", "16803", "168000",
  "16610", "16613", "16618",
  "14060", "14060M",
  "116610", "116613", "116618", "116619", "116659",
  "114060", "124060",
  "126610", "126613", "126618", "126619",
] as const;

/**
 * Rolex Day-Date reference number prefixes.
 */
export const DAY_DATE_REFS = [
  "6510", "6511", "6611", "6612", "6613",
  "1802", "1803", "1804", "1806", "1807", "1811",
  "18026", "18028", "18038", "18039", "18048", "18049", "18078", "18079", "18108",
  "18206", "18208", "18238", "18239", "18248", "18249", "18296", "18308", "18338",
  "18346", "18348", "18349", "18366", "18378", "18388", "18389",
  "18946", "18948", "18956", "18958",
  "19018", "19019", "19028", "19038", "19048", "19049", "19058", "19068", "19148", "19168",
  "118135", "118138", "118139", "118205", "118206", "118208", "118209", "118235", "118238", "118239",
  "118296", "118338", "118339", "118346", "118348", "118366", "118388", "118389", "118398", "118399",
  "128159", "128235", "128238", "128239", "128345", "128348", "128349", "128395", "128459",
  "218206", "218235", "218238", "218239", "218348", "218396",
  "228206", "228235", "228236", "228238", "228239", "228345", "228348", "228349", "228396", "228398",
] as const;

/**
 * Rolex Daytona reference number prefixes.
 */
export const DAYTONA_REFS = [
  "6239", "6240", "6241", "6262", "6263", "6264", "6265", "6269", "6270",
  "16518", "16519", "16520", "16523", "16528", "16559", "16568", "16588", "16589", "16598", "16599",
  "116500", "116503", "116505", "116506", "116508", "116509", "116515", "116518", "116519", "116520",
  "116523", "116528", "116568", "116576", "116578", "116588", "116589", "116595", "116596", "116598", "116599",
  "126500", "126503", "126505", "126506", "126508", "126509", "126515", "126518", "126519", "126525",
  "126528", "126529", "126535", "126538", "126539", "126576", "126579", "126589", "126595", "126598", "126599",
] as const;

/**
 * Rolex Date reference number prefixes.
 */
export const DATE_REFS = [
  "1500", "1501", "1502", "1503", "1504", "1505", "1506", "1507", "1508", "1509",
  "1510", "1511", "1512", "1513", "1514", "1520", "1521", "1522", "1523", "1530", "1550", "1560", "1570",
  "5075", "6075", "6335", "6518", "6530", "6534", "6535", "6537", "6605", "6625", "6627",
  "7576A", "7600A", "7606", "7916", "7919", "7924", "7972",
  "15000", "15003", "15007", "15008", "15010", "15017", "15018", "15037", "15038", "15053",
  "15200", "15203", "15210", "15223", "15233", "15238", "15505",
  "115200", "115210", "115234",
] as const;

/**
 * Rolex Datejust reference number prefixes.
 */
export const DATEJUST_REFS = [
  "4467", "5030", "5031", "6031", "6074", "6075", "6104", "6105", "6304", "6305", "6309", "6604", "6605",
  "1600", "1601", "1602", "1603", "1604", "1605", "1607", "1610", "1611", "1625", "1630", "1530",
  "16000", "16003", "16008", "16009", "16013", "16014", "16018", "16019", "16030", "16078",
  "16250", "16253", "16258", "16263", "16264", "16200", "16203", "16220", "16233", "16234", "16238", "16248",
  "116135", "116138", "116139", "116185", "116188", "116189", "116200", "116201", "116203", "116208",
  "116231", "116233", "116234", "116238", "116243", "116244", "116261", "116263", "116264",
  "116300", "116333", "116334",
  "126200", "126201", "126203", "126231", "126233", "126234", "126300", "126301", "126303", "126331", "126333", "126334",
  "6824", "6827", "68240", "68243", "68248", "68273", "68274", "68278", "68279",
  "78240", "78243", "78248", "78273", "78274", "78278", "78279",
  "178240", "178241", "178243", "178245", "178246", "178248", "178273", "178274", "178275", "178278", "178279",
  "178313", "178341", "178343", "178344", "178383", "178384",
  "278240", "278241", "278243", "278245", "278248", "278271", "278273", "278274", "278275", "278278",
  "6516", "6517", "6519", "6916", "6917", "6919", "6924",
  "69160", "69163", "69168", "69173", "69174", "69178", "69179", "69190", "69240",
  "79160", "79163", "79166", "79168", "79173", "79174", "79178", "79179", "79190", "79240",
  "179136", "179138", "179158", "179159", "179160", "179161", "179163", "179165", "179166", "179168",
  "179171", "179173", "179174", "179175", "179178", "179179", "179239", "179298", "179313", "179368", "179459",
  "279135", "279138", "279160", "279161", "279163", "279165", "279166", "279171", "279173", "279174", "279175", "279178",
] as const;

/**
 * Rolex Deepsea reference number prefixes.
 */
export const DEEPSEA_REFS = [
  "116660", "126660", "136660", "136668", "126067",
] as const;

/**
 * Rolex Air-King reference number prefixes.
 */
export const AIR_KING_REFS = [
  "4365", "4499", "4925",
  "5500", "5501", "5502", "5504", "5506", "5520",
  "5700", "5701",
  "6552",
  "14000", "14000M", "14010", "14010M",
  "114200", "114210", "114234",
  "116900",
  "126900",
] as const;

/**
 * Rolex Explorer reference number prefixes.
 */
export const EXPLORER_REFS = [
  "6150", "6350", "6610", "1016", "14270", "114270", "214270", "124270", "124273", "224270",
] as const;

/**
 * Rolex Explorer II reference number prefixes.
 */
export const EXPLORER_II_REFS = [
  "1655", "16550", "16570", "216570", "226570",
] as const;

/**
 * Rolex GMT-Master reference number prefixes.
 */
export const GMT_MASTER_REFS = [
  "6542", "1675", "16750", "16753", "16758", "16700",
] as const;

/**
 * Rolex GMT-Master II reference number prefixes.
 */
export const GMT_MASTER_II_REFS = [
  "16760", "16710", "16713", "16718", "116710", "116713", "116718", "116719",
  "116758", "116759", "116769", "126710", "126711", "126713", "126715", "126718",
  "126719", "126720", "126755", "126758", "126759",
] as const;

/**
 * Rolex Milgauss reference number prefixes.
 */
export const MILGAUSS_REFS = [
  "6541", "6543", "1019", "116400",
] as const;

/**
 * Rolex Oyster Perpetual Date reference number prefixes.
 */
export const OYSTER_PERPETUAL_DATE_REFS = [
  "1102", "1500", "1501", "1502", "1503", "1503G", "1504", "1505", "1506", "1507", "1508", "1509",
  "1510", "1511", "1512", "1513", "1514", "1520", "1521", "1522", "1523", "1530", "1550", "1560",
  "1603", "1625", "5075", "6530", "6534", "6535", "6537", "6547", "6625", "6627", "6740", "6924", "6944",
  "7576A", "7600A", "7606", "7916", "7919", "7924", "7972",
  "15000", "15003", "15007", "15008", "15010", "15017", "15018", "15037", "15038", "15053", "15148",
  "15200", "15203", "15210", "15223", "15238", "15505",
  "69160A", "69190A", "69240",
] as const;

/**
 * Rolex Oyster Manual Wind reference number prefixes.
 */
export const OYSTER_MANUAL_REFS = [
  "1069", "1070", "1147", "1237", "1387", "1573", "1880", "1921", "1925", "1936",
  "2005", "2081", "2136", "2280", "2318", "2319", "2331", "2416", "2420", "2496", "2518", "2574", "2593", "2595",
  "2701", "2849", "2891", "2942", "2949", "2984",
  "3059", "3078", "3096", "3116", "3121", "3136", "3139", "3140", "3270", "3351", "3359", "3492", "3511", "3540", "3640", "3646", "3765", "3868", "3882", "3978",
  "4052", "4068", "4070", "4119", "4125", "4127", "4181", "4219", "4220", "4222", "4271", "4330", "4361", "4365", "4437", "4444", "4448", "4461", "4476", "4483", "4499", "4547", "4556", "4626", "4647",
  "5000", "5004", "5020", "5025", "5056",
  "6020", "6021", "6022", "6044", "6066", "6144", "6244", "6246", "6266", "6363", "6418", "6420", "6421", "6422", "6423", "6424", "6425", "6426", "6427", "6429", "6430", "6431", "6432", "6444", "6466", "6480", "6494", "6664", "6694",
  "7535A", "8011", "8012", "8015", "8023", "8027", "8389", "9659",
] as const;

/**
 * Rolex Oyster Perpetual reference number prefixes.
 */
export const OYSTER_PERPETUAL_REFS = [
  "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1010", "1011", "1012", "1013", "1014",
  "1022", "1023", "1024", "1025", "1026", "1027", "1028", "1029", "1030", "1031", "1035", "1036", "1038", "1039",
  "1420", "1423",
  "3172", "3202", "3272", "3323", "3352", "3370", "3483", "3490", "3495", "3496", "3497", "3505", "3536", "3538", "3593", "3594", "3596", "3597", "3627", "3639", "3645", "3685", "3686", "3708", "3724", "3772", "3778", "3785", "3869", "3885", "3886", "3887", "3888", "3926", "3938", "3967",
  "4013", "4021", "4024", "4025", "4027", "4055", "4130", "4134", "4163", "4164", "4165", "4166", "4167", "4168", "4171", "4172", "4185", "4186", "4187", "4190", "4203", "4214", "4242", "4255", "4302", "4306", "4337", "4350", "4362", "4408", "4436", "4449", "4480", "4486", "4487", "4528", "4534", "4672", "4686", "4804", "4846", "4857", "4937",
  "5023", "5065", "5080", "5552",
  "6018", "6023", "6050", "6082", "6084", "6085", "6088", "6092", "6099", "6100", "6101", "6102", "6103", "6107", "6119", "6284", "6285", "6286", "6290", "6301", "6303", "6332", "6334", "6502", "6503", "6504", "6507", "6508", "6509", "6532", "6539", "6540", "6543", "6544", "6545", "6546", "6548", "6549", "6551", "6552", "6553", "6554", "6558", "6559", "6560", "6564", "6565", "6566", "6567", "6569", "6580", "6583", "6584", "6585", "6586", "6587", "6590", "6592", "6594", "6598", "6599", "6614", "6618", "6619", "6621", "6623", "6634", "6706", "6707", "6710", "6711", "6712", "6713", "6715", "6717", "6718", "6719", "6720", "6721", "6723", "6724", "6744", "6745", "6747", "6748", "6749", "6751", "6753", "6754", "6757", "6771",
  "7575A", "7603", "7605", "7608", "7609", "7614", "7618", "7619", "7623", "7624", "7701", "7708", "7748", "7751", "7806", "7807", "7811",
  "9210", "9211", "9220", "9221",
  "14203", "14208", "14233", "14238",
  "67180", "67183", "67187", "67188", "67193", "67194", "67197", "67198", "67230", "67243", "67480", "67483", "67488", "67513", "67514", "67518",
] as const;

/**
 * Rolex OysterQuartz reference number prefixes.
 */
export const OYSTERQUARTZ_REFS = [
  "17000", "17013", "17014",
] as const;

/**
 * Rolex OysterQuartz Day-Date reference number prefixes.
 */
export const OYSTERQUARTZ_DAY_DATE_REFS = [
  "19018", "19019", "19028", "19038", "19048", "19049", "19058", "19068", "19078", "19148", "19168",
] as const;

/**
 * Rolex Sky-Dweller reference number prefixes.
 */
export const SKY_DWELLER_REFS = [
  "326135", "326138", "326139", "326235", "326238", "326239", "326259",
  "326933", "326934", "326935", "326938", "326939", "326959",
  "336235", "336238", "336239", "336933", "336934", "336935", "336938", "336959",
] as const;

/**
 * Rolex Yacht-Master reference number prefixes.
 */
export const YACHT_MASTER_REFS = [
  "16622", "16623", "16628", "68623", "68628", "168622", "168623", "168628", "169623", "169628",
] as const;

/**
 * Rolex Tru-Beat reference number prefixes.
 */
export const TRU_BEAT_REFS = [
  "1020", "6556",
] as const;

/**
 * Rolex Sea-Dweller reference number prefixes.
 */
export const SEA_DWELLER_REFS = [
  "1660", "1665", "1666", "16600", "16650", "16660",
] as const;

/**
 * Rolex Prince reference number prefixes.
 */
export const PRINCE_REFS = [
  "1343", "1541", "1768", "1855", "2730", "2771", "2996", "3361", "4402", "1564", "1599", "1871", "1490", "3937",
] as const;

/**
 * Rolex Datejust Turn-O-Graph reference number prefixes.
 */
export const TURN_O_GRAPH_REFS = [
  "6202", "6309", "6609", "1625", "16250", "16253", "16263", "16264", "116261", "116263", "116264",
] as const;

/**
 * Detect if a reference number indicates a known Rolex model.
 * Reference format: <model-ref>-<serial>, e.g. "16613-X930492"
 * Returns { brand, model } if matched, otherwise null.
 */
export function detectWatchFromReference(referenceNumber: string): { brand: string; model: string } | null {
  if (!referenceNumber) return null;
  
  // Extract the model reference part (before the dash)
  const refPart = referenceNumber.split("-")[0].trim().toUpperCase();
  
  // Check against Submariner refs
  for (const subRef of SUBMARINER_REFS) {
    if (refPart === subRef.toUpperCase()) {
      return { brand: "Rolex", model: "Submariner" };
    }
  }
  
  // Check against Day-Date refs
  for (const ddRef of DAY_DATE_REFS) {
    if (refPart === ddRef.toUpperCase()) {
      return { brand: "Rolex", model: "Day-Date" };
    }
  }
  
  // Check against Daytona refs
  for (const daytonaRef of DAYTONA_REFS) {
    if (refPart === daytonaRef.toUpperCase()) {
      return { brand: "Rolex", model: "Daytona" };
    }
  }
  
  // Check against Date refs
  for (const dateRef of DATE_REFS) {
    if (refPart === dateRef.toUpperCase()) {
      return { brand: "Rolex", model: "Date" };
    }
  }
  
  // Check against Datejust refs
  for (const djRef of DATEJUST_REFS) {
    if (refPart === djRef.toUpperCase()) {
      return { brand: "Rolex", model: "Datejust" };
    }
  }
  
  // Check against Deepsea refs
  for (const dsRef of DEEPSEA_REFS) {
    if (refPart === dsRef.toUpperCase()) {
      return { brand: "Rolex", model: "Deepsea" };
    }
  }
  
  // Check against Air-King refs
  for (const akRef of AIR_KING_REFS) {
    if (refPart === akRef.toUpperCase()) {
      return { brand: "Rolex", model: "Air-King" };
    }
  }
  
  // Check against Explorer refs
  for (const expRef of EXPLORER_REFS) {
    if (refPart === expRef.toUpperCase()) {
      return { brand: "Rolex", model: "Explorer" };
    }
  }
  
  // Check against Explorer II refs
  for (const exp2Ref of EXPLORER_II_REFS) {
    if (refPart === exp2Ref.toUpperCase()) {
      return { brand: "Rolex", model: "Explorer II" };
    }
  }
  
  // Check against GMT-Master refs
  for (const gmtRef of GMT_MASTER_REFS) {
    if (refPart === gmtRef.toUpperCase()) {
      return { brand: "Rolex", model: "GMT-Master" };
    }
  }
  
  // Check against GMT-Master II refs
  for (const gmt2Ref of GMT_MASTER_II_REFS) {
    if (refPart === gmt2Ref.toUpperCase()) {
      return { brand: "Rolex", model: "GMT-Master II" };
    }
  }
  
  // Check against Milgauss refs
  for (const milRef of MILGAUSS_REFS) {
    if (refPart === milRef.toUpperCase()) {
      return { brand: "Rolex", model: "Milgauss" };
    }
  }
  
  // Check against Oyster Perpetual Date refs
  for (const opdRef of OYSTER_PERPETUAL_DATE_REFS) {
    if (refPart === opdRef.toUpperCase()) {
      return { brand: "Rolex", model: "Oyster Perpetual Date" };
    }
  }
  
  // Check against Oyster Manual Wind refs
  for (const omRef of OYSTER_MANUAL_REFS) {
    if (refPart === omRef.toUpperCase()) {
      return { brand: "Rolex", model: "Oyster (Manual Wind)" };
    }
  }
  
  // Check against Oyster Perpetual refs
  for (const opRef of OYSTER_PERPETUAL_REFS) {
    if (refPart === opRef.toUpperCase()) {
      return { brand: "Rolex", model: "Oyster Perpetual" };
    }
  }
  
  // Check against OysterQuartz refs
  for (const oqRef of OYSTERQUARTZ_REFS) {
    if (refPart === oqRef.toUpperCase()) {
      return { brand: "Rolex", model: "Oysterquartz" };
    }
  }
  
  // Check against OysterQuartz Day-Date refs
  for (const oqddRef of OYSTERQUARTZ_DAY_DATE_REFS) {
    if (refPart === oqddRef.toUpperCase()) {
      return { brand: "Rolex", model: "Oysterquartz Day-Date" };
    }
  }
  
  // Check against Sky-Dweller refs
  for (const skyRef of SKY_DWELLER_REFS) {
    if (refPart === skyRef.toUpperCase()) {
      return { brand: "Rolex", model: "Sky-Dweller" };
    }
  }
  
  // Check against Yacht-Master refs
  for (const ymRef of YACHT_MASTER_REFS) {
    if (refPart === ymRef.toUpperCase()) {
      return { brand: "Rolex", model: "Yacht-Master" };
    }
  }
  
  // Check against Tru-Beat refs
  for (const tbRef of TRU_BEAT_REFS) {
    if (refPart === tbRef.toUpperCase()) {
      return { brand: "Rolex", model: "Tru-Beat" };
    }
  }
  
  // Check against Sea-Dweller refs
  for (const sdRef of SEA_DWELLER_REFS) {
    if (refPart === sdRef.toUpperCase()) {
      return { brand: "Rolex", model: "Sea-Dweller" };
    }
  }
  
  // Check against Prince refs
  for (const prRef of PRINCE_REFS) {
    if (refPart === prRef.toUpperCase()) {
      return { brand: "Rolex", model: "Prince" };
    }
  }
  
  // Check against Turn-O-Graph refs
  for (const togRef of TURN_O_GRAPH_REFS) {
    if (refPart === togRef.toUpperCase()) {
      return { brand: "Rolex", model: "Datejust Turn-O-Graph" };
    }
  }
  
  // Check against Tudor Submariner refs
  for (const tsRef of TUDOR_SUBMARINER_REFS) {
    if (refPart === tsRef.toUpperCase().replace("/", "")) {
      return { brand: "Tudor", model: "Submariner" };
    }
  }
  // Also check with slash for refs like 7016/0
  const refPartWithSlash = referenceNumber.split("-")[0].trim().toUpperCase();
  for (const tsRef of TUDOR_SUBMARINER_REFS) {
    if (refPartWithSlash === tsRef.toUpperCase()) {
      return { brand: "Tudor", model: "Submariner" };
    }
  }
  
  // Check against Tudor Prince OysterDate refs
  for (const tpRef of TUDOR_PRINCE_OYSTERDATE_REFS) {
    if (refPart === tpRef.toUpperCase().replace("/", "")) {
      return { brand: "Tudor", model: "Prince OysterDate" };
    }
  }
  // Also check with slash for refs like 7996/0
  for (const tpRef of TUDOR_PRINCE_OYSTERDATE_REFS) {
    if (refPartWithSlash === tpRef.toUpperCase()) {
      return { brand: "Tudor", model: "Prince OysterDate" };
    }
  }
  
  return null;
}
