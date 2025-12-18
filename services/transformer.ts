

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
    let s = name;

    // 1. Remove "Unknown AA-BBBB-..." pattern (generated External ID fallback)
    s = s.replace(/Unknown\s+[A-Z]{2}-[\w\d]+-[A-Z0-9]+-\d{4}-\d{5}/gi, '');

    // 2. Remove "Timeout-Pending" text if present inside a name
    s = s.replace(/Timeout-Pending/gi, '');

    // 3. Handle 'nato a', 'nata a' and 'nato/a a' - keep part before it
    s = s.split(/\s+nat[oa](?:\/a)?\s+a\s+/i)[0];
    
    // 4. Handle semicolon separator (often used for parentage like "; DI ANTONIO")
    s = s.split(';')[0];

    // 5. Collapse multiple spaces and trim
    return s.replace(/\s+/g, ' ').trim();
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

const normalizeMuni = (m: any): string => {
    return String(m || '').trim().toLowerCase();
};

const parseQuota = (quotaStr: any): number => {
    if (quotaStr === null || quotaStr === undefined) return 0;
    const s = String(quotaStr).trim();
    
    // Handle fraction "1/2", "1000/1000"
    if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 2) {
            const num = parseFloat(parts[0]);
            const den = parseFloat(parts[1]);
            if (!isNaN(num) && !isNaN(den) && den !== 0) {
                return num / den;
            }
        }
    }
    
    // Handle decimal or integer (replace comma with dot for European formats)
    const f = parseFloat(s.replace(',', '.'));
    return isNaN(f) ? 0 : f;
};

// Helper to find column case-insensitive and handle aliases
const findCol = (row: any, candidates: string[]) => {
    const keys = Object.keys(row);
    for (const c of candidates) {
        const found = keys.find(k => k.toLowerCase() === c.toLowerCase());
        if (found) return row[found];
    }
    return undefined;
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
        const cols = Object.keys(firstRow).map(k => k.toLowerCase());
        const hasPid = cols.some(c => c === 'parcel_id' || c === 'elenco_parcel_id');
        const hasName = cols.some(c => c === 'full_name' || c === 'destinatario' || c === 'nominativo');
        const hasCf = cols.some(c => c === 'cf' || c === 'fiscal_code' || c === 'codice_fiscale');

        const errorsList = [];
        if (!hasPid) errorsList.push("Parcel_ID");
        if (!hasName) errorsList.push("Full_Name");
        if (!hasCf) errorsList.push("cf");

        if (errorsList.length > 0) {
             const foundCols = Object.keys(firstRow).join(', ');
            errors.push(`Sheet 'Final_Mailing_By_Parcel' is missing required columns (or aliases): ${errorsList.join(', ')}. Found: ${foundCols}`);
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
    
    // Logic: First Name/Last Name are prioritized in processOwnersForLand
    let firstName = sanitize(row['Main Owner Name']);
    let lastName = sanitize(row['Main Owner Last Name']);
    
    // Use 'Pending Owner' if status is Scouted (new leads) and we have no owner info.
    if (status === 'Scouted') {
        firstName = '';
        lastName = 'Pending Owner';
    } else if (!lastName && status !== 'Contacted') {
        // Fallback for empty last name in other stages to avoid SF errors if it's mandatory
        // We truncate External ID just in case, though it shouldn't be long.
        lastName = `Unknown ${externalId}`.substring(0, 80);
    }
    
    // We explicitly follow the mapping list provided:
    // Main Owner Name (FirstName) and Main Owner Last Name (LastName) separately.
    // "Minimum Scope Group" and "Name" (combined) are NOT in the list.

    return {
        "Land External ID": sanitize(externalId),
        "Lead Status": status,
        "Land Province": sanitize(provinceName),
        "Land Region": sanitize(region),
        "Municipality": sanitize(row['Municipality']),
        "Sezione": sanitize(row['Section']),
        "Foglio": sanitize(row['Sheet']),
        "Particella": sanitize(row['Parcel']),
        "Cadastral Area (Ha)": formatDecimalForCsv(row['Cadastral Area (Ha)']),
        "Main Owner Name": truncate(sanitize(firstName), 40),
        "Main Owner Last Name": truncate(lastName, 80),
        "Email": sanitize(row['Email']),
        "Fiscal Code": sanitize(row['Fiscal Code']),
        "CP": sanitize(row['CP']),
        "Has Various Owners": hasVariousOwners,
        "Number of Owners": numberOfOwners,
        "All Owners": truncate(sanitize(row['All Owners']), 255)
    };
};

// --- Core Transformation Logic ---
const runProcess = (inputData: any, resultsData: any, log: LogFunction, inputJson?: any, resultsJson?: any): OutputData => {

    const inputSheet = inputData['Hoja1'] || inputData['Sheet1'];

    // --- 1. PREPARE BASE DF (from Input file) ---
    log("Preparing base data (Carga 1)...");
    let raw_base = [...inputSheet];
    raw_base = raw_base.filter(row => row['Parcel_ID'] != null && row['Parcel_ID'] !== '');

    // Deduplication Logic & Ambiguity Detection
    const seenIds = new Set<string>();
    const pidMap = new Map<string, Set<string>>(); // ParcelID -> Set<ExternalID>
    const df_base: any[] = [];
    let duplicateCount = 0;

    raw_base.forEach(row => {
        // Map common fields
        row['Province'] = row['provincia'];
        row['Municipality'] = row['comune'];
        row['Sheet'] = String(row['foglio']).split('.')[0];
        row['Parcel'] = String(row['particella']).split('.')[0];
        row['Cadastral Area (Ha)'] = row['Area'];
        row['Section'] = row['Sezione'];

        const provDetails = getProvinceDetails(row['Province']);
        const extId = generateExternalId(
            provDetails.code,
            row['Municipality'],
            row['Section'],
            row['Sheet'],
            row['Parcel']
        );
        
        // Track External ID mapping for Ambiguity detection
        const pid = String(row['Parcel_ID']);
        if(!pidMap.has(pid)) pidMap.set(pid, new Set());
        pidMap.get(pid)?.add(extId);

        if (!seenIds.has(extId)) {
            seenIds.add(extId);
            df_base.push(row);
        } else {
            duplicateCount++;
        }
    });

    // Check for Ambiguous Parcel IDs (IDs mapping to multiple physical lands)
    const ambiguousPids = new Set<string>();
    pidMap.forEach((extIds, pid) => {
        if(extIds.size > 1) ambiguousPids.add(pid);
    });

    if (duplicateCount > 0) {
        log(`Removed ${duplicateCount} duplicate parcel(s).`, 'info');
    }
    
    if (ambiguousPids.size > 0) {
        log(`Warning: Detected ${ambiguousPids.size} Parcel_IDs associated with multiple distinct lands (Ambiguous IDs). Enabling geographic filtering...`, 'info');
    }
    
    // --- GENERATE CARGA 1 ---
    log("Generating Carga 1: Scouted Lands...");
    const carga1_cols = ['Province', 'Municipality', 'Section', 'Sheet', 'Parcel', 'Cadastral Area (Ha)', 'CP'];
    const scouted = df_base.map(row => {
        const newRow: {[key: string]: any} = {};
        carga1_cols.forEach(col => newRow[col] = row[col] || '');
        return newRow;
    });

    const csvScouted = df_base.map(row => mapToCsvRow(row, 'Scouted'));
    log(`-> Carga 1 generated with ${scouted.length} rows.`, 'success');

    // --- 2. PREPARE RETRIEVED DATA (CARGA 2) ---
    log("Preparing 'Retrieved' data (Carga 2)...");

    const pec_map = new Map<string, string>();
    resultsData['All_Companies_Found']
        .filter((row: any) => row.cf && row.pec_email)
        .forEach((row: any) => {
            if (!pec_map.has(row.cf)) pec_map.set(row.cf, row.pec_email);
        });

    // Determine if All_Raw_Data has geographic columns for filtering
    const rawData = resultsData['All_Raw_Data'] || [];
    const sampleRaw = rawData[0] || {};
    const muniColRaw = Object.keys(sampleRaw).find(k => /comune|municipality|city/i.test(k));
    
    // --- 2b. Smart Owner Processing ---
    // Instead of naively grouping Owners_Normalized by Parcel_ID, we use All_Raw_Data to find WHICH owners match the land's municipality
    
    // Group All_Raw_Data by Parcel_ID
    const raw_by_pid = rawData.reduce((acc: any, row: any) => {
        const pid = row.Parcel_ID;
        if (!acc[pid]) acc[pid] = [];
        acc[pid].push(row);
        return acc;
    }, {});

    // Group Owners_Normalized by Parcel_ID
    const df_owners_clean = resultsData['Owners_Normalized'].filter((row: any) => row.Parcel_ID);
    const owners_norm_by_pid = df_owners_clean.reduce((acc: any, row: any) => {
        const pid = row.Parcel_ID;
        if (!acc[pid]) acc[pid] = [];
        acc[pid].push(row);
        return acc;
    }, {});
    
    log("Resolving owner data with ambiguity checks, Corporate Priority, and Over-Ownership resolution...");

    let corporatePriorityCount = 0;
    let overOwnershipResolvedCount = 0;
    let dataConflictCount = 0;

    const processOwnersForLand = (landRow: any) => {
        const pid = landRow.Parcel_ID;
        const muni = landRow.Municipality;
        
        let validFiscalCodes = new Set<string>();
        let mainOwnerRow: any = null;
        let cpValue = '';

        const rawRows = raw_by_pid[pid] || [];
        
        // Step 1: Filter Raw Data to find matching owners (Geographic Filter)
        let filteredRaw = rawRows;
        
        // If ID is ambiguous and we have muni column, MUST filter.
        // Even if ID not ambiguous, filtering is safer if column exists.
        if (muniColRaw && (ambiguousPids.has(String(pid)) || rawRows.length > 0)) {
             filteredRaw = rawRows.filter((r: any) => {
                const rMuni = normalizeMuni(r[muniColRaw]);
                // Simple check: matches fully OR implies inclusion (e.g. "Comune di X" matches "X")
                return rMuni === normalizeMuni(muni) || rMuni.includes(normalizeMuni(muni));
             });
             // If aggressive filtering removed everyone (mismatch in naming), fall back to all rows ONLY if ID is NOT ambiguous
             if (filteredRaw.length === 0 && !ambiguousPids.has(String(pid))) {
                 filteredRaw = rawRows;
             }
        }
        
        // --- STEP 1b: Corporate Priority Rule ---
        // Check if any owner in the filtered list is a Company (CF starts with digit)
        const hasCompany = filteredRaw.some((r: any) => {
            const cf = String(r.cf_owner || '').trim();
            return cf.length > 0 && /^\d/.test(cf);
        });

        if (hasCompany) {
            const originalCount = filteredRaw.length;
            filteredRaw = filteredRaw.filter((r: any) => {
                const cf = String(r.cf_owner || '').trim();
                // Keep if it looks like a company (starts with digit)
                return /^\d/.test(cf);
            });
            
            if (filteredRaw.length < originalCount) {
                 corporatePriorityCount++; // Track that we modified this parcel
            }
        }
        // -----------------------------------------

        // Collect Valid CFs and CP from valid rows
        filteredRaw.forEach((r: any) => {
            if(r.cf_owner) validFiscalCodes.add(r.cf_owner);
            if(r.CP) cpValue = r.CP;
        });

        // Step 2: Determine Main Owner from Filtered Raw Rows
        if (filteredRaw.length > 0) {
            mainOwnerRow = filteredRaw[0];
        }

        // Step 3: Filter Normalized Owners using Valid Fiscal Codes
        const normRows = owners_norm_by_pid[pid] || [];
        let relevantNormRows = normRows.filter((r: any) => validFiscalCodes.has(r.owner_cf));
        
        // Step 4: Determine Main Owner from Normalized Data (Highest Quota)
        let maxQuota = -1;
        let mainOwnerNorm: any = null;
        
        relevantNormRows.forEach((r: any) => {
            const q = parseQuota(r.quota);
            if (q > maxQuota) {
                maxQuota = q;
                mainOwnerNorm = r;
            }
        });

        // Construct result for this parcel
        // We augment the original landRow with owner info
        const resultRow = { ...landRow };
        let finalFirstName = '';
        let finalLastName = '';
        
        if (mainOwnerNorm) {
            // Priority: Normalized Data
            
            // Try to find email
            if (pec_map.has(mainOwnerNorm.owner_cf)) {
                resultRow['Email'] = pec_map.get(mainOwnerNorm.owner_cf);
            }
            resultRow['Fiscal Code'] = mainOwnerNorm.owner_cf;

            // Try to find specific raw record for this normalized owner to get Split Names (Nome/Cognome)
            const matchingRaw = filteredRaw.find((r: any) => r.cf_owner === mainOwnerNorm.owner_cf);
            
            if (matchingRaw && matchingRaw.nome && matchingRaw.cognome) {
                // If we have distinct First/Last name in raw data, use them.
                finalFirstName = matchingRaw.nome;
                finalLastName = matchingRaw.cognome;
            } else {
                // If we only have the Full Name string from normalized data
                // We map Full Name to Last Name (to avoid duplication in Salesforce Name field)
                // and leave First Name empty.
                finalLastName = cleanOwnerName(mainOwnerNorm.owner_name);
                finalFirstName = ''; 
            }

        } else if (mainOwnerRow) {
            // Fallback: Raw Data
            resultRow['Fiscal Code'] = mainOwnerRow.cf_owner;
             if (pec_map.has(mainOwnerRow.cf_owner)) {
                resultRow['Email'] = pec_map.get(mainOwnerRow.cf_owner);
            }

            if (mainOwnerRow.nome && mainOwnerRow.cognome) {
                 finalFirstName = mainOwnerRow.nome;
                 finalLastName = mainOwnerRow.cognome;
            } else {
                 // Only have denominazione or composite
                 const name = mainOwnerRow.denominazione_owner || mainOwnerRow.owner_name || '';
                 finalLastName = cleanOwnerName(name);
                 finalFirstName = '';
            }
        }
        
        resultRow['Main Owner Name'] = finalFirstName;
        resultRow['Main Owner Last Name'] = finalLastName;
        
        resultRow['Number of Owners'] = relevantNormRows.length > 0 ? relevantNormRows.length : filteredRaw.length;
        
        // Generate All Owners String: Name [CF, Quota], ...
        if (relevantNormRows.length > 0) {
            resultRow['All Owners'] = relevantNormRows.map((r: any) => {
                const name = cleanOwnerName(r.owner_name);
                const cf = r.owner_cf || '';
                const q = r.quota || '';
                const extras = [cf, q].filter(Boolean).join(', ');
                return extras ? `${name} [${extras}]` : name;
            }).join(', ');
        } else {
             resultRow['All Owners'] = filteredRaw.map((r: any) => {
                 const name = cleanOwnerName(r.denominazione_owner || `${r.nome || ''} ${r.cognome || ''}`);
                 const cf = r.cf_owner || '';
                 const extras = [cf].filter(Boolean).join(', ');
                 return extras ? `${name} [${extras}]` : name;
             }).join(', ');
        }

        resultRow['CP'] = cpValue;
        
        return resultRow;
    };

    // Calculate owner data for all parcels (needed for both Retrieved and Contacted)
    const retrievedRaw = df_base.map(row => processOwnersForLand(row));
    
    if (corporatePriorityCount > 0) log(`Applied Corporate Priority to ${corporatePriorityCount} parcels.`, 'info');

    // --- GENERATE CSVs ---
    // Remove "Minimum Scope Group" from mapping if it exists (it was requested to be removed).
    
    // Filter retrievedRaw to only those where owner information was actually retrieved
    const retrieved = retrievedRaw.filter(row => {
        const n = row['Number of Owners'];
        return n !== undefined && n !== null && Number(n) > 0;
    });

    const csvRetrieved = retrieved.map(row => mapToCsvRow(row, 'Retrieved'));
    log(`-> Carga 2 generated with ${retrieved.length} rows.`, 'success');

    // --- 3. PREPARE CONTACTED DATA (CARGA 3) ---
    // Filter Carga 2 for those in Final_Mailing_By_Parcel
    log("Preparing 'Contacted' data (Carga 3)...");
    
    const mailingList = resultsData['Final_Mailing_By_Parcel'] || [];
    // Create set of external IDs or Parcel IDs to match
    // The requirement says match by Parcel_ID
    const mailingPids = new Set<string>();
    mailingList.forEach((r: any) => {
        if (r.Parcel_ID) mailingPids.add(String(r.Parcel_ID));
    });

    // Use retrievedRaw to filter for Contacted to ensure we capture all parcels in the mailing list,
    // regardless of whether the owner search logic in step 2 yielded > 0 owners (though usually they should overlap).
    // This maintains consistency with previous behavior for Carga 3 which the user noted was correct.
    const contacted = retrievedRaw.filter(row => mailingPids.has(String(row.Parcel_ID)));
    const csvContacted = contacted.map(row => mapToCsvRow(row, 'Contacted'));
    
    log(`-> Carga 3 generated with ${contacted.length} rows.`, 'success');

    return {
        scouted,
        retrieved,
        contacted,
        csvScouted,
        csvRetrieved,
        csvContacted
    };
};

export const transformData = async (
    type: 'input' | 'results' | 'process', 
    file: File | null, 
    log: LogFunction,
    inputJson?: any,
    resultsJson?: any
): Promise<{ jsonData?: any, validation?: any, output?: OutputData }> => {
    
    if (type === 'process') {
        if (!inputJson || !resultsJson) throw new Error("Missing data for processing");
        const output = runProcess(inputJson, resultsJson, log);
        return { output };
    }

    if (!file) throw new Error("No file provided");
    
    log(`Reading ${file.name}...`);
    const jsonData = await readFileSheets(file);
    
    let validation: ValidationResult = { isValid: true, errors: [] };
    if (type === 'input') {
        validation = validateInputFile(jsonData);
    } else {
        validation = validateResultsFile(jsonData);
    }

    return { jsonData, validation };
};
