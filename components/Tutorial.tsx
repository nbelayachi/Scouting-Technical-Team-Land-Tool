import React, { useState } from 'react';
import { BookOpenIcon, ChevronDownIcon } from './icons';

export const Tutorial = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    return (
        <div className="bg-slate-900/70 p-6 rounded-2xl shadow-lg border border-slate-700 mb-8">
            <button
                onClick={toggleOpen}
                className="w-full flex justify-between items-center text-left text-2xl font-semibold text-green-400 focus:outline-none"
                aria-expanded={isOpen}
                aria-controls="tutorial-content"
            >
                <div className="flex items-center gap-3">
                    <BookOpenIcon className="w-7 h-7" />
                    <span>How to Use This Tool</span>
                </div>
                <ChevronDownIcon className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div id="tutorial-content" className="mt-6 text-slate-300 space-y-6 animate-fade-in">
                    
                    {/* Phase 1 */}
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-3 border-b border-slate-600 pb-2">Phase 1: Generate Datasets with the Land Tool</h3>
                        <ol className="list-decimal list-inside space-y-2 pl-2">
                            <li><strong>Upload Files:</strong> In Step 1, upload the <code className="bg-slate-800 px-1 rounded">Input File</code> and the <code className="bg-slate-800 px-1 rounded">Results File</code>. Wait for the green "File Validated" status for both.</li>
                            <li><strong>Process Data:</strong> In Step 2, click the "Run Transformation" button.</li>
                            <li><strong>Download Outputs:</strong> In Step 3, three download buttons will appear. Download each file:
                                <ul className="list-disc list-inside pl-6 mt-1">
                                    <li><code className="bg-slate-800 px-1 rounded">1_Scouted_Lands.xlsx</code> (Carga 1)</li>
                                    <li><code className="bg-slate-800 px-1 rounded">2_Retrieved_Data.xlsx</code> (Carga 2)</li>
                                    <li><code className="bg-slate-800 px-1 rounded">3_Contacted_Data.xlsx</code> (Carga 3)</li>
                                </ul>
                            </li>
                        </ol>
                    </div>

                    {/* Phase 2 */}
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-3 border-b border-slate-600 pb-2">Phase 2: Prepare CSVs for the Campaign</h3>
                         <ol className="list-decimal list-inside space-y-2 pl-2">
                            <li><strong>Paste into Master Templates:</strong> For each of the three downloaded files, open it, copy all the data, and paste it into the corresponding official **Master Excel Template**.
                                <p className="text-sm text-amber-400 mt-1 pl-5">Note: Do not modify the downloaded files directly. Always use the Master Templates.</p>
                            </li>
                            <li><strong>Export to CSV:</strong> Inside each Master Template, specify the route where the CSV should be saved and use the template's functionality to export the data as a CSV file.</li>
                        </ol>
                    </div>

                    {/* Phase 3 */}
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-3 border-b border-slate-600 pb-2">Phase 3: Import into the CRM</h3>
                        <p className="mb-2">Use the exported CSVs to manage leads in the Campaign object as follows:</p>
                        <ul className="list-disc list-inside space-y-2 pl-2">
                            <li><strong className="text-green-400">Carga 1 (Scouted CSV):</strong> Perform a <strong className="text-sky-400">"Create Records"</strong> operation. This imports all scouted parcels as new leads.</li>
                            <li><strong className="text-green-400">Carga 2 (Retrieved CSV):</strong> Perform an <strong className="text-sky-400">"Update Records"</strong> operation. This updates the stage of the corresponding leads to <span className="font-semibold">"Retrieved"</span>.</li>
                            <li><strong className="text-green-400">Carga 3 (Contacted CSV):</strong> Perform another <strong className="text-sky-400">"Update Records"</strong> operation. This updates the stage of the leads to <span className="font-semibold">"Contacted"</span>.</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};