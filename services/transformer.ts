type LogFunction = (message: string, type?: 'info' | 'error' | 'success') => void;

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface OutputData {
    scouted: any[];
    retrieved: any[];
    contacted: any[];
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
        errors.push("Input file is missing required sheet: 'Hoja1' or 'Sheet1'.");
    } else {
        const sheet = jsonData['Hoja1'] || jsonData['Sheet1'];
        const requiredCols = ['provincia', 'comune', 'foglio', 'particella', 'Area', 'Sezione', 'CP', 'Parcel_ID'];
        const firstRow = sheet[0] || {};
        const missingCols = requiredCols.filter(col => !(col in firstRow));
        if (missingCols.length > 0) {
            errors.push(`Input file is missing columns: ${missingCols.join(', ')}.`);
        }
    }
    return { isValid: errors.length === 0, errors };
};

const validateResultsFile = (jsonData: { [sheetName: string]: any[] }): ValidationResult => {
    const errors: string[] = [];
    const requiredSheets = ['All_Raw_Data', 'Owners_Normalized', 'All_Companies_Found', 'Final_Mailing_By_Parcel'];

    for (const sheet of requiredSheets) {
        if (!jsonData[sheet]) {
            errors.push(`Results file is missing required sheet: '${sheet}'.`);
        }
    }
    
    // Add column checks for critical sheets if needed
    if (jsonData['All_Raw_Data']) {
        const firstRow = jsonData['All_Raw_Data'][0] || {};
        const requiredCols = ['Parcel_ID', 'cf_owner', 'denominazione_owner', 'nome', 'cognome'];
        const missingCols = requiredCols.filter(col => !(col in firstRow));
        if (missingCols.length > 0) {
            errors.push(`Results file sheet 'All_Raw_Data' is missing columns: ${missingCols.join(', ')}.`);
        }
    }

     if (jsonData['Owners_Normalized']) {
        const firstRow = jsonData['Owners_Normalized'][0] || {};
        const requiredCols = ['Parcel_ID', 'owner_name', 'owner_cf', 'quota'];
        const missingCols = requiredCols.filter(col => !(col in firstRow));
        if (missingCols.length > 0) {
            errors.push(`Results file sheet 'Owners_Normalized' is missing columns: ${missingCols.join(', ')}.`);
        }
    }


    return { isValid: errors.length === 0, errors };
};

// --- Core Transformation Logic ---
const runProcess = (inputData: any, resultsData: any, log: LogFunction): OutputData => {

    const inputSheet = inputData['Hoja1'] || inputData['Sheet1'];

    // --- 1. PREPARE BASE DF (from Input file) ---
    log("Preparing base data (Carga 1)...");
    let df_base = [...inputSheet];
    df_base = df_base.filter(row => row['Parcel_ID'] != null && row['Parcel_ID'] !== '');

    df_base.forEach(row => {
        row['Province'] = row['provincia'];
        row['Municipality'] = row['comune'];
        row['Sheet'] = String(row['foglio']).split('.')[0];
        row['Parcel'] = String(row['particella']).split('.')[0];
        row['Catastral Area (Ha)'] = row['Area'];
        row['Section'] = row['Sezione'];
    });
    
    // --- GENERATE CARGA 1 ---
    log("Generating Carga 1: Scouted Lands...");
    const carga1_cols = ['Province', 'Municipality', 'Section', 'Sheet', 'Parcel', 'Catastral Area (Ha)', 'CP'];
    const scouted = df_base.map(row => {
        const newRow: {[key: string]: any} = {};
        carga1_cols.forEach(col => newRow[col] = row[col] || '');
        return newRow;
    });
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
        const maxLength = 250;
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
                        if (current_string === "") {
                             // First owner is already too long
                             current_string = owner_str.substring(0, maxLength - 3) + "...";
                        } else {
                            current_string += ", ...";
                        }
                    }
                    break; // Stop adding owners
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
    log("Selecing main owner for each parcel...");
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
        'Catastral Area (Ha)', 'CP', 'Main Owner Name', 'Main Owner Last Name', 
        'Fiscal Code', 'Email', 'Number of Owners', 'All Owners'
    ];

    const retrieved = df_carga_2_filtered.map(row => {
        const newRow: {[key: string]: any} = {};
        carga2_cols.forEach(col => newRow[col] = row[col] ?? ''); // Use ?? to handle 0 for Number of Owners
        return newRow;
    });
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
    log(`-> Carga 3 generated with ${contacted.length} rows.`, 'success');

    return { scouted, retrieved, contacted };
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