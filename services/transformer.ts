

type LogFunction = (message: string, type?: 'info' | 'error' | 'success') => void;

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface OutputData {
    scouted: any[];
    retrieved: any[];
    contacted: any[];
    csvScouted: any[];
    csvRetrieved: any[];
    csvContacted: any[];
}

// --- Helper Functions ---

const cleanOwnerName = (name: any): string => {
    if (name === null || typeof name === 'undefined' || typeof name !== 'string') {
        return '';
    }
    // Updated regex to handle 'nato a', 'nata a' and 'nato/a a'
    const cleanedName = name.split(/\s+nat[oa](?:\/a)?\s+a\s+/i)[0];
    return cleanedName.trim();
};

const truncate = (str: any, maxLength: number): string => {
    if (!str) return '';
    const s = String(str);
    if (s.length <= maxLength) return s;
    return s.substring(0, maxLength);
};

// Remove newlines, tabs, and excess whitespace to prevent CSV breakage
const sanitize = (val: any): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    // Replace newline/tab with space, then collapse multiple spaces
    return s.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const readFileSheets = (file: File): Promise<{ [sheetName: string]: any[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const result: { [sheetName: string]: any[] } = {};
                workbook.SheetNames.forEach((sheetName: string) => {
                    const worksheet = workbook.Sheets[sheetName];
                    // Use `defval: ''` to avoid null/undefined for empty cells
                    // Use `raw: false` to get formatted dates if any
                    const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, blankrows: false });
                    result[sheetName] = jsonData;
                });
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

const validateInputFile = (jsonData: { [sheetName: string]: any[] }): ValidationResult => {
    const errors: string[] = [];
    if (!jsonData['Hoja1'] && !jsonData['Sheet1']) {
        const foundSheets = Object.keys(jsonData).join(', ');
        errors.push(`Input file is missing required sheet: 'Hoja1' or 'Sheet1'. Found sheets: ${foundSheets || 'none'}`);
    } else {
        const sheet = jsonData['Hoja1'] || jsonData['Sheet1'];
        if (sheet.length === 0) {
             errors.push("Input file sheet is empty.");
        } else {
            const requiredCols = ['provincia', 'comune', 'foglio', 'particella', 'Area', 'Sezione', 'CP', 'Parcel_ID'];
            const firstRow = sheet[0] || {};
            const missingCols = requiredCols.filter(col => !(col in firstRow));
            if (missingCols.length > 0) {
                const foundCols = Object.keys(firstRow).join(', ');
                errors.push(`Input file is missing columns: ${missingCols.join(', ')}. Found columns: ${foundCols}`);
            }
        }
    }
    return { isValid: errors.length === 0, errors };
};

const validateResultsFile = (jsonData: { [sheetName: string]: any[] }): ValidationResult => {
    const errors: string[] = [];
    const requiredSheets = ['All_Raw_Data', 'Owners_Normalized', 'All_Companies_Found', 'Final_Mailing_By_Parcel'];

    const missingSheets = requiredSheets.filter(sheet => !jsonData[sheet]);
    if (missingSheets.length > 0) {
        const foundSheets = Object.keys(jsonData).join(', ');
        errors.push(`Results file is missing required sheets: ${missingSheets.join(', ')}. Found sheets: ${foundSheets || 'none'}`);
    }
    
    // Check columns for 'All_Raw_Data'
    if (jsonData['All_Raw_Data']) {
        const firstRow = jsonData['All_Raw_Data'][0] || {};
        const requiredCols = ['Parcel_ID', 'cf_owner', 'denominazione_owner', 'nome', 'cognome'];
        const missingCols = requiredCols.filter(col => !(col in firstRow));
        if (missingCols.length > 0) {
            const foundCols = Object.keys(firstRow).join(', ');
            errors.push(`Sheet 'All_Raw_Data' is missing columns: ${missingCols.join(', ')}. Found: ${foundCols}`);
        }
    }

    // Check columns for 'Owners_Normalized'
    if (jsonData['Owners_Normalized']) {
        const firstRow = jsonData['Owners_Normalized'][0] || {};
        const requiredCols = ['Parcel_ID', 'owner_name', 'owner_cf', 'quota'];
        const missingCols = requiredCols.filter(col => !(col in firstRow));
        if (missingCols.length > 0) {
             const foundCols = Object.keys(firstRow).join(', ');
            errors.push(`Sheet 'Owners_Normalized' is missing columns: ${missingCols.join(', ')}. Found: ${foundCols}`);
        }
    }

    // Check columns for 'All_Companies_Found'
    if (jsonData['All_Companies_Found']) {
        const firstRow = jsonData['All_Companies_Found'][0] || {};
        const requiredCols = ['cf', 'pec_email'];
        const missingCols = requiredCols.filter(col => !(col in firstRow));
        if (missingCols.length > 0) {
             const foundCols = Object.keys(firstRow).join(', ');
            errors.push(`Sheet 'All_Companies_Found' is missing columns: ${missingCols.join(', ')}. Found: ${foundCols}`);
        }
    }

    // Check columns for 'Final_Mailing_By_Parcel'
    if (jsonData['Final_Mailing_By_Parcel']) {
        const firstRow = jsonData['Final_Mailing_By_Parcel'][0] || {};
        const requiredCols = ['Parcel_ID'];
        const missingCols = requiredCols.filter(col => !(col in firstRow));
        if (missingCols.length > 0) {
             const foundCols = Object.keys(firstRow).join(', ');
            errors.push(`Sheet 'Final_Mailing_By_Parcel' is missing columns: ${missingCols.join(', ')}. Found: ${foundCols}`);
        }
    }

    return { isValid: errors.length === 0, errors };
};

// --- CSV Helpers & constants ---

// Master list of Italian Provinces with valid Salesforce names, Codes, and Regions
const ITALIAN_PROVINCES = [
    { name: "Agrigento", code: "AG", region: "Sicilia" },
    { name: "Alessandria", code: "AL", region: "Piemonte" },
    { name: "Ancona", code: "AN", region: "Marche" },
    { name: "Aosta", code: "AO", region: "Valle d'Aosta" },
    { name: "Arezzo", code: "AR", region: "Toscana" },
    { name: "Ascoli Piceno", code: "AP", region: "Marche" },
    { name: "Asti", code: "AT", region: "Piemonte" },
    { name: "Avellino", code: "AV", region: "Campania" },
    { name: "Bari", code: "BA", region: "Puglia" },
    { name: "Barletta-Andria-Trani", code: "BT", region: "Puglia" },
    { name: "Belluno", code: "BL", region: "Veneto" },
    { name: "Benevento", code: "BN", region: "Campania" },
    { name: "Bergamo", code: "BG", region: "Lombardia" },
    { name: "Biella", code: "BI", region: "Piemonte" },
    { name: "Bologna", code: "BO", region: "Emilia-Romagna" },
    { name: "Bolzano", code: "BZ", region: "Trentino-Alto Adige" },
    { name: "Brescia", code: "BS", region: "Lombardia" },
    { name: "Brindisi", code: "BR", region: "Puglia" },
    { name: "Cagliari", code: "CA", region: "Sardegna" },
    { name: "Caltanissetta", code: "CL", region: "Sicilia" },
    { name: "Campobasso", code: "CB", region: "Molise" },
    { name: "Carbonia-Iglesias", code: "CI", region: "Sardegna" },
    { name: "Caserta", code: "CE", region: "Campania" },
    { name: "Catania", code: "CT", region: "Sicilia" },
    { name: "Catanzaro", code: "CZ", region: "Calabria" },
    { name: "Chieti", code: "CH", region: "Abruzzo" },
    { name: "Como", code: "CO", region: "Lombardia" },
    { name: "Cosenza", code: "CS", region: "Calabria" },
    { name: "Cremona", code: "CR", region: "Lombardia" },
    { name: "Crotone", code: "KR", region: "Calabria" },
    { name: "Cuneo", code: "CN", region: "Piemonte" },
    { name: "Enna", code: "EN", region: "Sicilia" },
    { name: "Fermo", code: "FM", region: "Marche" },
    { name: "Ferrara", code: "FE", region: "Emilia-Romagna" },
    { name: "Firenze", code: "FI", region: "Toscana" },
    { name: "Foggia", code: "FG", region: "Puglia" },
    { name: "Forlì-Cesena", code: "FC", region: "Emilia-Romagna" },
    { name: "Frosinone", code: "FR", region: "Lazio" },
    { name: "Genova", code: "GE", region: "Liguria" },
    { name: "Gorizia", code: "GO", region: "Friuli-Venezia Giulia" },
    { name: "Grosseto", code: "GR", region: "Toscana" },
    { name: "Imperia", code: "IM", region: "Liguria" },
    { name: "Isernia", code: "IS", region: "Molise" },
    { name: "La Spezia", code: "SP", region: "Liguria" },
    { name: "L'Aquila", code: "AQ", region: "Abruzzo" },
    { name: "Latina", code: "LT", region: "Lazio" },
    { name: "Lecce", code: "LE", region: "Puglia" },
    { name: "Lecco", code: "LC", region: "Lombardia" },
    { name: "Livorno", code: "LI", region: "Toscana" },
    { name: "Lodi", code: "LO", region: "Lombardia" },
    { name: "Lucca", code: "LU", region: "Toscana" },
    { name: "Macerata", code: "MC", region: "Marche" },
    { name: "Mantova", code: "MN", region: "Lombardia" },
    { name: "Massa-Carrara", code: "MS", region: "Toscana" },
    { name: "Matera", code: "MT", region: "Basilicata" },
    { name: "Medio Campidano", code: "VS", region: "Sardegna" },
    { name: "Messina", code: "ME", region: "Sicilia" },
    { name: "Milano", code: "MI", region: "Lombardia" },
    { name: "Modena", code: "MO", region: "Emilia-Romagna" },
    { name: "Monza e della Brianza", code: "MB", region: "Lombardia" },
    { name: "Napoli", code: "NA", region: "Campania" },
    { name: "Novara", code: "NO", region: "Piemonte" },
    { name: "Nuoro", code: "NU", region: "Sardegna" },
    { name: "Ogliastra", code: "OG", region: "Sardegna" },
    { name: "Olbia-Tempio", code: "OT", region: "Sardegna" },
    { name: "Oristano", code: "OR", region: "Sardegna" },
    { name: "Padova", code: "PD", region: "Veneto" },
    { name: "Palermo", code: "PA", region: "Sicilia" },
    { name: "Parma", code: "PR", region: "Emilia-Romagna" },
    { name: "Pavia", code: "PV", region: "Lombardia" },
    { name: "Perugia", code: "PG", region: "Umbria" },
    { name: "Pesaro e Urbino", code: "PU", region: "Marche" },
    { name: "Pescara", code: "PE", region: "Abruzzo" },
    { name: "Piacenza", code: "PC", region: "Emilia-Romagna" },
    { name: "Pisa", code: "PI", region: "Toscana" },
    { name: "Pistoia", code: "PT", region: "Toscana" },
    { name: "Pordenone", code: "PN", region: "Friuli-Venezia Giulia" },
    { name: "Potenza", code: "PZ", region: "Basilicata" },
    { name: "Prato", code: "PO", region: "Toscana" },
    { name: "Ragusa", code: "RG", region: "Sicilia" },
    { name: "Ravenna", code: "RA", region: "Emilia-Romagna" },
    { name: "Reggio Calabria", code: "RC", region: "Calabria" },
    { name: "Reggio Emilia", code: "RE", region: "Emilia-Romagna" },
    { name: "Rieti", code: "RI", region: "Lazio" },
    { name: "Rimini", code: "RN", region: "Emilia-Romagna" },
    { name: "Roma", code: "RM", region: "Lazio" },
    { name: "Rovigo", code: "RO", region: "Veneto" },
    { name: "Salerno", code: "SA", region: "Campania" },
    { name: "Sassari", code: "SS", region: "Sardegna" },
    { name: "Savona", code: "SV", region: "Liguria" },
    { name: "Siena", code: "SI", region: "Toscana" },
    { name: "Siracusa", code: "SR", region: "Sicilia" },
    { name: "Sondrio", code: "SO", region: "Lombardia" },
    { name: "Taranto", code: "TA", region: "Puglia" },
    { name: "Teramo", code: "TE", region: "Abruzzo" },
    { name: "Terni", code: "TR", region: "Umbria" },
    { name: "Torino", code: "TO", region: "Piemonte" },
    { name: "Trapani", code: "TP", region: "Sicilia" },
    { name: "Trento", code: "TN", region: "Trentino-Alto Adige" },
    { name: "Treviso", code: "TV", region: "Veneto" },
    { name: "Trieste", code: "TS", region: "Friuli-Venezia Giulia" },
    { name: "Udine", code: "UD", region: "Friuli-Venezia Giulia" },
    { name: "Varese", code: "VA", region: "Lombardia" },
    { name: "Venezia", code: "VE", region: "Veneto" },
    { name: "Verbano-Cusio-Ossola", code: "VB", region: "Piemonte" },
    { name: "Vercelli", code: "VC", region: "Piemonte" },
    { name: "Verona", code: "VR", region: "Veneto" },
    { name: "Vibo Valentia", code: "VV", region: "Calabria" },
    { name: "Vicenza", code: "VI", region: "Veneto" },
    { name: "Viterbo", code: "VT", region: "Lazio" }
];

// Generate map for fast lookup by Name or Code (both uppercase)
const PROVINCE_MAP: { [key: string]: { code: string, region: string, name: string } } = {};

ITALIAN_PROVINCES.forEach(p => {
    const entry = { code: p.code, region: p.region, name: p.name };
    // Map Name Upper
    PROVINCE_MAP[p.name.toUpperCase()] = entry;
    // Map Code Upper
    PROVINCE_MAP[p.code.toUpperCase()] = entry;
    
    // Handle variants with accents (e.g. Forli vs Forlì)
    if (p.name.includes('ì') || p.name.includes('à') || p.name.includes('è') || p.name.includes('ò') || p.name.includes('ù')) {
         const normalized = p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
         PROVINCE_MAP[normalized] = entry;
    }
});

// Manual overrides for specific input variations
PROVINCE_MAP['MONZA E BRIANZA'] = PROVINCE_MAP['MONZA E DELLA BRIANZA'];
PROVINCE_MAP['CARBONIA IGLESIAS'] = PROVINCE_MAP['CARBONIA-IGLESIAS'];
PROVINCE_MAP['MEDIO-CAMPIDANO'] = PROVINCE_MAP['MEDIO CAMPIDANO'];
PROVINCE_MAP['OLBIA TEMPIO'] = PROVINCE_MAP['OLBIA-TEMPIO'];
PROVINCE_MAP['PESARO URBINO'] = PROVINCE_MAP['PESARO E URBINO'];
PROVINCE_MAP['REGGIO NELL\'EMILIA'] = PROVINCE_MAP['REGGIO EMILIA'];
PROVINCE_MAP['BOLZANO/BOZEN'] = PROVINCE_MAP['BOLZANO'];
PROVINCE_MAP['AOSTA/AOSTE'] = PROVINCE_MAP['AOSTA'];


const getProvinceDetails = (input: string) => {
    const key = String(input).toUpperCase().trim();
    if (PROVINCE_MAP[key]) {
        return PROVINCE_MAP[key];
    }
    // Fallback logic
    if (key.length === 2) {
        return { code: key, region: '', name: input }; // Use input as name if code is unknown
    }
    return { code: key.substring(0, 2).toUpperCase(), region: '', name: input }; // Use input as name
};

const generateExternalId = (provinceCode: string, municipality: string, section: string, sheet: string, parcel: string) => {
    const mun = String(municipality).toUpperCase().replace(/\s+/g, '');
    const sec = section && section.trim() !== '' ? section.trim() : 'X';
    
    // Pad Sheet to 4 digits
    const sheetNum = parseInt(sheet);
    const sheetStr = !isNaN(sheetNum) ? String(sheetNum).padStart(4, '0') : String(sheet).padStart(4, '0');
    
    // Pad Parcel to 5 digits
    const parcelNum = parseInt(parcel);
    const parcelStr = !isNaN(parcelNum) ? String(parcelNum).padStart(5, '0') : String(parcel).padStart(5, '0');

    return `${provinceCode}-${mun}-${sec}-${sheetStr}-${parcelStr}`;
};

const formatDecimalForCsv = (val: any): string => {
    if (val === null || val === undefined || val === '') return '';
    // Ensure it uses comma for decimal separator for European standard CSVs often used here
    return String(val).replace('.', ',');
};


const mapToCsvRow = (row: any, status: string) => {
    const provDetails = getProvinceDetails(row['Province']);
    const provinceCode = provDetails.code;
    const region = provDetails.region;
    // Use the official Salesforce Name if available (e.g. "Bergamo" instead of "BG")
    const provinceName = provDetails.name || row['Province'];
    
    // Generate External ID
    const externalId = generateExternalId(
        provinceCode, 
        row['Municipality'], 
        row['Section'], 
        row['Sheet'], 
        row['Parcel']
    );
    
    // 'True'/'False' strings for CSV
    let hasVariousOwners = 'False';
    let numberOfOwners = '';
    
    if (row['Number of Owners'] !== undefined && row['Number of Owners'] !== null && row['Number of Owners'] !== '') {
        numberOfOwners = String(row['Number of Owners']);
         if (Number(row['Number of Owners']) > 1) {
            hasVariousOwners = 'True';
        }
    }
    
    // Use 'Pending Owner' if status is Scouted (new leads) and we have no owner info.
    // This prevents "Required field missing: LastName" errors in Salesforce.
    // For other statuses (Retrieved, Contacted), we use what we have (even if empty, though ideally it shouldn't be).
    let lastName = sanitize(row['Main Owner Last Name']);
    if (!lastName && status === 'Scouted') {
        lastName = 'Pending Owner';
    } else if (!lastName) {
        // Fallback for empty last name in other stages to avoid SF errors if it's mandatory
        // We truncate External ID just in case, though it shouldn't be long.
        lastName = `Unknown ${externalId}`.substring(0, 80);
    }
    
    return {
        "Land External ID": sanitize(externalId),
        "Lead Status": status,
        "Land Province": sanitize(provinceName),
        "Land Region": sanitize(region),
        "Minimum Scope Group": "Pending Project Scope",
        "Municipality": sanitize(row['Municipality']),
        "Sezione": sanitize(row['Section']),
        "Foglio": sanitize(row['Sheet']),
        "Particella": sanitize(row['Parcel']),
        "Cadastral Area (Ha)": formatDecimalForCsv(row['Cadastral Area (Ha)']),
        "Main Owner Name": truncate(sanitize(row['Main Owner Name']), 40), // Standard SF limit
        "Main Owner Last Name": truncate(lastName, 80), // Standard SF limit
        "Email": sanitize(row['Email']),
        "Fiscal Code": sanitize(row['Fiscal Code']),
        "CP": sanitize(row['CP']),
        "Has Various Owners": hasVariousOwners,
        "Number of Owners": numberOfOwners,
        "All Owners": truncate(sanitize(row['All Owners']), 255) // Custom field limit
    };
};

// --- Core Transformation Logic ---
const runProcess = (inputData: any, resultsData: any, log: LogFunction, inputJson?: any, resultsJson?: any): OutputData => {

    const inputSheet = inputData['Hoja1'] || inputData['Sheet1'];

    // --- 1. PREPARE BASE DF (from Input file) ---
    log("Preparing base data (Carga 1)...");
    let raw_base = [...inputSheet];
    raw_base = raw_base.filter(row => row['Parcel_ID'] != null && row['Parcel_ID'] !== '');

    // Deduplication Logic: Ensure we only process unique External IDs from the input
    const seenIds = new Set<string>();
    const df_base: any[] = [];
    let duplicateCount = 0;

    raw_base.forEach(row => {
        // Map common fields
        row['Province'] = row['provincia'];
        row['Municipality'] = row['comune'];
        row['Sheet'] = String(row['foglio']).split('.')[0];
        row['Parcel'] = String(row['particella']).split('.')[0];
        row['Cadastral Area (Ha)'] = row['Area']; // Map to correct Salesforce label key
        row['Section'] = row['Sezione'];

        // Generate ID for deduplication check
        const provDetails = getProvinceDetails(row['Province']);
        const extId = generateExternalId(
            provDetails.code,
            row['Municipality'],
            row['Section'],
            row['Sheet'],
            row['Parcel']
        );

        if (!seenIds.has(extId)) {
            seenIds.add(extId);
            df_base.push(row);
        } else {
            duplicateCount++;
        }
    });

    if (duplicateCount > 0) {
        log(`Removed ${duplicateCount} duplicate parcel(s) based on generated External ID.`, 'info');
    }
    
    // --- GENERATE CARGA 1 ---
    log("Generating Carga 1: Scouted Lands...");
    const carga1_cols = ['Province', 'Municipality', 'Section', 'Sheet', 'Parcel', 'Cadastral Area (Ha)', 'CP'];
    const scouted = df_base.map(row => {
        const newRow: {[key: string]: any} = {};
        carga1_cols.forEach(col => newRow[col] = row[col] || '');
        return newRow;
    });

    // Generate CSV version
    const csvScouted = df_base.map(row => mapToCsvRow(row, 'Scouted'));

    log(`-> Carga 1 generated with ${scouted.length} rows.`, 'success');

    // --- 2. PREPARE RETRIEVED DATA (CARGA 2) ---
    log("Preparing 'Retrieved' data (Carga 2)...");

    // 2a. Create PEC map from 'All_Companies_Found'
    log("Mapping PEC emails from company data...");
    const pec_map = new Map<string, string>();
    resultsData['All_Companies_Found']
        .filter((row: any) => row.cf && row.pec_email && String(row.pec_email).trim() !== '')
        .forEach((row: any) => {
            if (!pec_map.has(row.cf)) {
                pec_map.set(row.cf, row.pec_email);
            }
        });

    // 2b/2c. Group owners, create simple string, and count owners
    log("Aggregating owner data into simple string...");
    const df_owners_clean = resultsData['Owners_Normalized'].filter((row: any) => row.Parcel_ID);
    const owners_by_parcel_id = df_owners_clean.reduce((acc: any, row: any) => {
        const parcelId = row.Parcel_ID;
        if (!acc[parcelId]) {
            acc[parcelId] = [];
        }
        acc[parcelId].push(row);
        return acc;
    }, {});

    const df_owners_grouped = new Map<string, any>();
    for (const parcelId in owners_by_parcel_id) {
        const group = owners_by_parcel_id[parcelId];
        const processed_owners = new Set<string>();
        const maxLength = 3000; // Keep high for Excel viewing, truncated only in CSV
        let current_string = "";

        for (const row of group) {
            const owner_name_cleaned = cleanOwnerName(String(row.owner_name || ''));
            const owner_cf_cleaned = String(row.owner_cf || '').trim();
            const quota_cleaned = String(row.quota || '').trim();
            
            const owner_key = `${owner_name_cleaned}|${owner_cf_cleaned}|${quota_cleaned}`;

            if ((owner_name_cleaned || owner_cf_cleaned) && !processed_owners.has(owner_key)) {
                const name_part = owner_name_cleaned || "";
                const cf_part = owner_cf_cleaned || "N/A";
                const quota_part = quota_cleaned || "N/A";

                const owner_str = `${name_part} [${cf_part}, ${quota_part}]`;
                
                // Check length before adding
                const separator = current_string ? ", " : "";
                if (current_string.length + separator.length + owner_str.length > maxLength) {
                     if (!current_string.endsWith("...")) {
                        current_string += ", ...";
                    }
                    break;
                }

                current_string += separator + owner_str;
                processed_owners.add(owner_key);
            }
        }
        
        df_owners_grouped.set(parcelId, {
            'All Owners': current_string,
            'Number of Owners': processed_owners.size,
        });
    }

    // 2d. Prepare Main Owner from 'All_Raw_Data'
    log("Selecting main owner for each parcel...");
    const df_main_owner = [];
    const seen_parcel_ids = new Set();
    for(const row of resultsData['All_Raw_Data']) {
        if(row.Parcel_ID && !seen_parcel_ids.has(row.Parcel_ID)) {
            df_main_owner.push(row);
            seen_parcel_ids.add(row.Parcel_ID);
        }
    }
    
    // Apply [COMPANY] logic
    df_main_owner.forEach((row: any) => {
        const cf = String(row.cf_owner || '').trim();
        const denominazione = cleanOwnerName(row.denominazione_owner);
        const nome = cleanOwnerName(row.nome);
        const cognome = cleanOwnerName(row.cognome);

        let main_name = "";
        let main_last_name = "";

        if (cf && /^\d/.test(cf)) { // Starts with a digit
            main_name = '[COMPANY]';
            main_last_name = denominazione || cognome;
        } else {
            if (nome || cognome) {
                main_name = nome;
                main_last_name = cognome;
            } else if (denominazione) {
                main_name = denominazione;
                main_last_name = "";
            }
        }
        
        row['Main Owner Name'] = main_name;
        row['Main Owner Last Name'] = main_last_name;
        row['Fiscal Code'] = cf;

        const isCompany = String(row.Tipo_Proprietario || '').toUpperCase().trim();
        if (isCompany === 'AZIENDA' || isCompany === 'COMPANY') {
            row['Email'] = pec_map.get(cf) || '';
        } else {
            row['Email'] = '';
        }
    });
    
    // 2f. Join everything for Carga 2
    log("Joining all data sources for Carga 2...");
    const df_raw_cp_map = new Map();
     resultsData['All_Raw_Data'].forEach((row:any) => {
        if (row.Parcel_ID && !df_raw_cp_map.has(row.Parcel_ID) && row.CP) {
            df_raw_cp_map.set(row.Parcel_ID, row.CP);
        }
    });

    const main_owner_map = new Map(df_main_owner.map(row => [row.Parcel_ID, row]));
    
    let df_carga_2 = df_base.map(base_row => {
        const main_owner_data = main_owner_map.get(base_row.Parcel_ID) || {};
        const owners_grouped_data = df_owners_grouped.get(base_row.Parcel_ID) || {};
        
        return {
            ...base_row,
            'CP': df_raw_cp_map.get(base_row.Parcel_ID) || base_row.CP, // Use raw data CP if available
            'Main Owner Name': main_owner_data['Main Owner Name'] || '',
            'Main Owner Last Name': main_owner_data['Main Owner Last Name'] || '',
            'Fiscal Code': main_owner_data['Fiscal Code'] || '',
            'Email': main_owner_data['Email'] || '',
            'Number of Owners': owners_grouped_data['Number of Owners'] || 0,
            'All Owners': owners_grouped_data['All Owners'] || '',
        };
    });
    
    // Filter rows that have owner data
    const df_carga_2_filtered = df_carga_2.filter(row => row['Fiscal Code'] && row['Fiscal Code'] !== '');
    
    // --- GENERATE CARGA 2 ---
    const carga2_cols = [
        'Province', 'Municipality', 'Section', 'Sheet', 'Parcel', 
        'Cadastral Area (Ha)', 'CP', 'Main Owner Name', 'Main Owner Last Name', 
        'Fiscal Code', 'Email', 'Number of Owners', 'All Owners'
    ];

    const retrieved = df_carga_2_filtered.map(row => {
        const newRow: {[key: string]: any} = {};
        carga2_cols.forEach(col => newRow[col] = row[col] ?? ''); // Use ?? to handle 0 for Number of Owners
        return newRow;
    });

    // Generate CSV version
    const csvRetrieved = df_carga_2_filtered.map(row => mapToCsvRow(row, 'Retrieved'));

    log(`-> Carga 2 generated with ${retrieved.length} rows.`, 'success');

    // --- 3. PREPARE CONTACTED DATA (CARGA 3) ---
    log("Preparing 'Contacted' data (Carga 3)...");
    const contacted_ids = new Set(resultsData['Final_Mailing_By_Parcel'].map((row: any) => row.Parcel_ID));
    
    const df_carga_3 = df_carga_2_filtered.filter(row => contacted_ids.has(row.Parcel_ID));

    // --- GENERATE CARGA 3 ---
    const contacted = df_carga_3.map(row => {
         const newRow: {[key: string]: any} = {};
        carga2_cols.forEach(col => newRow[col] = row[col] ?? '');
        return newRow;
    });

    // Generate CSV version
    const csvContacted = df_carga_3.map(row => mapToCsvRow(row, 'Contacted'));

    log(`-> Carga 3 generated with ${contacted.length} rows.`, 'success');

    return { scouted, retrieved, contacted, csvScouted, csvRetrieved, csvContacted };
};

// --- Main Exported Function ---

export async function transformData(
    mode: 'input' | 'results' | 'process',
    file: File | null,
    log: LogFunction,
    inputJson?: any,
    resultsJson?: any
): Promise<{ jsonData?: any, validation?: ValidationResult, output?: OutputData }> {
    if (mode === 'process') {
        if (!inputJson || !resultsJson) {
            throw new Error("Process mode requires both input and results data.");
        }
        const output = runProcess(inputJson, resultsJson, log);
        return { output };
    }

    if (!file) {
        throw new Error("File must be provided for validation.");
    }

    const jsonData = await readFileSheets(file);
    let validation: ValidationResult;

    if (mode === 'input') {
        validation = validateInputFile(jsonData);
    } else { // mode === 'results'
        validation = validateResultsFile(jsonData);
    }

    return { jsonData, validation };
}