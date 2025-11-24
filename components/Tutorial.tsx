import React, { useState } from 'react';
import { BookOpenIcon, ChevronDownIcon } from './icons';

export const Tutorial = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    return (
        <div className="bg-slate-900/70 p-6 rounded-2xl shadow-lg border border-slate-700 mb-8 transition-all hover:bg-slate-900/90 hover:shadow-green-900/10 hover:border-slate-600">
            <button
                onClick={toggleOpen}
                className="w-full flex justify-between items-center text-left text-2xl font-semibold text-green-400 focus:outline-none"
                aria-expanded={isOpen}
                aria-controls="tutorial-content"
            >
                <div className="flex items-center gap-3">
                    <BookOpenIcon className="w-7 h-7" />
                    <span>Workflow Guide</span>
                </div>
                <ChevronDownIcon className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div id="tutorial-content" className="mt-6 text-slate-300 space-y-6 animate-fade-in">
                    
                    {/* Phase 1 */}
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-3 border-b border-slate-600 pb-2">Step 1: Process & Download</h3>
                        <ol className="list-decimal list-inside space-y-2 pl-2">
                            <li>Upload the <code className="bg-slate-800 px-1 rounded text-green-200">Input File</code> and <code className="bg-slate-800 px-1 rounded text-green-200">Results File</code> above.</li>
                            <li>Run the transformation to generate your datasets.</li>
                            <li>Download the <strong>CSV</strong> files for each stage:
                                <ul className="list-disc list-inside pl-6 mt-1 text-slate-400">
                                    <li>Scouted (Carga 1)</li>
                                    <li>Retrieved (Carga 2)</li>
                                    <li>Contacted (Carga 3)</li>
                                </ul>
                            </li>
                        </ol>
                    </div>

                    {/* Phase 2 */}
                    <div>
                        <h3 className="text-xl font-semibold text-slate-100 mb-3 border-b border-slate-600 pb-2">Step 2: Salesforce Import</h3>
                        <p className="mb-2">Upload the CSV files directly to the Campaign object in Salesforce:</p>
                        <div className="space-y-3 pl-2">
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <strong className="text-green-400 block mb-1">1. Scouted CSV</strong>
                                <span className="text-sm">Perform a <strong className="text-sky-400">"Create Records"</strong> operation. This imports all scouted parcels as new leads.</span>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <strong className="text-green-400 block mb-1">2. Retrieved CSV</strong>
                                <span className="text-sm">Perform an <strong className="text-sky-400">"Update Records"</strong> operation using the External ID. This updates the status to <span className="font-semibold text-white">"Retrieved"</span> and populates owner data.</span>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <strong className="text-green-400 block mb-1">3. Contacted CSV</strong>
                                <span className="text-sm">Perform an <strong className="text-sky-400">"Update Records"</strong> operation using the External ID. This updates the status to <span className="font-semibold text-white">"Contacted"</span>.</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};