// Fix: Add global declarations for window.XLSX and window.saveAs
// to inform TypeScript that these variables are available on the global window object.
// They are likely loaded from <script> tags in the main HTML file.
declare global {
  interface Window {
    XLSX: any;
    saveAs: any;
  }
}

import React, { useState, useCallback, useRef } from 'react';
import { Dropzone } from './components/Dropzone';
import { LogConsole } from './components/LogConsole';
import { Button } from './components/Button';
import { Tutorial } from './components/Tutorial';
import { DownloadIcon, RocketIcon, RefreshIcon, CsvIcon, CheckCircleIcon } from './components/icons';
import { transformData } from './services/transformer';
import type { ValidationResult, OutputData } from './services/transformer';
import type { FileStatus, FileType, LogEntry } from './types';

const App = () => {
    const [files, setFiles] = useState<{ [key in FileType]: File | null }>({
        input: null,
        results: null,
    });
    const [fileStatus, setFileStatus] = useState<{ [key in FileType]: FileStatus }>({
        input: 'waiting',
        results: 'waiting',
    });
    const [fileErrors, setFileErrors] = useState<{ [key in FileType]: string | null }>({
        input: null,
        results: null,
    });
    
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [outputData, setOutputData] = useState<OutputData | null>(null);
    const [activeTab, setActiveTab] = useState<'scouted' | 'retrieved' | 'contacted'>('scouted');
    
    // Used to force remounting of Dropzones to clear internal file inputs completely
    const [resetKey, setResetKey] = useState<number>(0);

    const fileDataCache = useRef<{ [key in FileType]: any | null }>({
        input: null,
        results: null,
    });

    const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
        setLogs(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
    }, []);

    const handleFileChange = useCallback(async (file: File, type: FileType) => {
        setFiles(prev => ({ ...prev, [type]: file }));
        setOutputData(null); // Reset output on new file
        setFileStatus(prev => ({...prev, [type]: 'loading' }));
        setFileErrors(prev => ({...prev, [type]: null }));

        try {
            const { jsonData, validation } = await transformData(type, file, addLog);
            if (validation.isValid) {
                fileDataCache.current[type] = jsonData;
                setFileStatus(prev => ({...prev, [type]: 'valid' }));
                addLog(`'${file.name}' loaded and validated successfully.`, 'success');
            } else {
                fileDataCache.current[type] = null;
                setFileStatus(prev => ({...prev, [type]: 'invalid' }));
                const firstError = validation.errors[0];
                setFileErrors(prev => ({...prev, [type]: firstError }));
                validation.errors.forEach(err => addLog(err, 'error'));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`Error processing ${file.name}: ${errorMessage}`, 'error');
            setFileStatus(prev => ({...prev, [type]: 'invalid' }));
            setFileErrors(prev => ({...prev, [type]: errorMessage }));
            fileDataCache.current[type] = null;
        }
    }, [addLog]);

    const handleRunTransformation = useCallback(async () => {
        if (!fileDataCache.current.input || !fileDataCache.current.results) {
            addLog("Both Input and Results files must be loaded and valid before running.", 'error');
            return;
        }

        setIsProcessing(true);
        setOutputData(null);
        setLogs([]); // Clear logs for new run
        addLog("Starting transformation process...");

        // Slight delay to allow UI to update processing state before heavy synchronous work
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const { output } = await transformData('process', null, addLog, fileDataCache.current.input, fileDataCache.current.results);
            if (output) {
                setOutputData(output);
                addLog("Transformation complete. Output files are ready for download.", 'success');
            } else {
                throw new Error("Transformation did not produce any output data.");
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`An unexpected error occurred during transformation: ${errorMessage}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    }, [addLog]);

    const handleDownloadExcel = (key: 'scouted' | 'retrieved' | 'contacted', fileName: string) => {
        if (!outputData || !outputData[key] || outputData[key].length === 0) {
            addLog(`No data available to download for ${fileName}.`, 'error');
            return;
        }
        addLog(`Generating ${fileName}...`);
        try {
            const ws = window.XLSX.utils.json_to_sheet(outputData[key]);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            const excelBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
            window.saveAs(blob, fileName);
            addLog(`${fileName} downloaded successfully.`, 'success');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`Failed to generate ${fileName}: ${errorMessage}`, 'error');
        }
    };

    const handleDownloadCSV = (key: 'csvScouted' | 'csvRetrieved' | 'csvContacted', fileName: string) => {
        if (!outputData || !outputData[key] || outputData[key].length === 0) {
            addLog(`No data available to download for ${fileName}.`, 'error');
            return;
        }
        addLog(`Generating CSV ${fileName}...`);
        try {
            const data = outputData[key];
            if (data.length === 0) {
                addLog('No data to export', 'error');
                return;
            }

            // Get headers from the first row
            const headers = Object.keys(data[0]);
            
            // Build CSV string
            const csvRows = [
                // Header row
                headers.map(header => `"${header}"`).join(','),
                // Data rows
                ...data.map((row: any) => 
                    headers.map(header => {
                        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
                        // Escape quotes by doubling them
                        const escapedVal = val.replace(/"/g, '""');
                        return `"${escapedVal}"`;
                    }).join(',')
                )
            ];

            const csvString = '\uFEFF' + csvRows.join('\r\n'); // Add BOM for Excel compatibility
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            window.saveAs(blob, fileName);
            addLog(`${fileName} downloaded successfully.`, 'success');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`Failed to generate ${fileName}: ${errorMessage}`, 'error');
        }
    };

    const handleReset = () => {
        setFiles({ input: null, results: null });
        setFileStatus({ input: 'waiting', results: 'waiting' });
        setFileErrors({ input: null, results: null });
        setLogs([]);
        setOutputData(null);
        fileDataCache.current = { input: null, results: null };
        setResetKey(prev => prev + 1);
        setActiveTab('scouted');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-slate-200 p-8 pb-16 relative overflow-x-hidden">
            <div className="max-w-4xl mx-auto space-y-8 relative z-10">
                
                {/* Header */}
                <div className="flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10 shadow-lg backdrop-blur-sm">
                            <img src="/vite.svg" alt="RIC Energy" className="w-10 h-10 object-contain" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Land Data Tool</h1>
                            <p className="text-slate-400">Automated Land Acquisition Processing</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleReset}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Reset Application"
                    >
                        <RefreshIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Tutorial Section */}
                <Tutorial />

                {/* Pipeline Steps Container with visual connector */}
                <div className="relative space-y-8">
                    {/* Vertical Connecting Line */}
                    <div className="absolute left-[29px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-slate-700 via-green-900/50 to-slate-700 -z-10 hidden md:block"></div>

                    {/* Step 1: Upload */}
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm animate-fade-in delay-100 hover:border-slate-600 transition-colors duration-300">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-4 text-white">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-sm font-bold border border-slate-600 shadow-inner">1</span>
                            Upload Files
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-0 md:pl-12">
                            <Dropzone 
                                key={`input-${resetKey}`}
                                title="input"
                                description="Select 'Input File' (xlsx)"
                                onFileSelect={(f) => handleFileChange(f, 'input')}
                                status={fileStatus.input}
                                fileName={files.input?.name}
                                errorMessage={fileErrors.input}
                            />
                            <Dropzone 
                                key={`results-${resetKey}`}
                                title="results"
                                description="Select 'Results File' (xlsx)"
                                onFileSelect={(f) => handleFileChange(f, 'results')}
                                status={fileStatus.results}
                                fileName={files.results?.name}
                                errorMessage={fileErrors.results}
                            />
                    </div>
                    </div>

                    {/* Step 2: Process */}
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm animate-fade-in delay-200 hover:border-slate-600 transition-colors duration-300">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-4 text-white">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-sm font-bold border border-slate-600 shadow-inner">2</span>
                            Process Data
                        </h2>
                        
                        <div className="pl-0 md:pl-12">
                            <div className="flex flex-col items-center justify-center py-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                                <Button 
                                    onClick={handleRunTransformation} 
                                    disabled={isProcessing || fileStatus.input !== 'valid' || fileStatus.results !== 'valid'}
                                    className="w-full md:w-auto min-w-[200px] text-lg py-4 shadow-green-900/20 transform transition-transform active:scale-95"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="animate-spin mr-2 h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <RocketIcon className="w-5 h-5" />
                                            Run Transformation
                                        </>
                                    )}
                                </Button>
                                <p className="mt-4 text-sm text-slate-500">
                                    Validates structure, merges owners, and formats for Salesforce.
                                </p>
                            </div>

                            <LogConsole logs={logs} />
                        </div>
                    </div>

                    {/* Step 3: Download */}
                    <div className={`bg-slate-900/50 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm animate-fade-in delay-300 transition-all duration-500 ${outputData ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 grayscale'}`}>
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-4 text-white">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-sm font-bold border border-slate-600 shadow-inner">3</span>
                            Download Results
                        </h2>

                        <div className="pl-0 md:pl-12">
                            {outputData ? (
                                <>
                                    {/* Tabs */}
                                    <div className="flex space-x-1 bg-slate-800/80 p-1.5 rounded-xl mb-6">
                                    {['scouted', 'retrieved', 'contacted'].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab as any)}
                                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                                                activeTab === tab
                                                ? 'bg-slate-600 text-white shadow-md ring-1 ring-white/10'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                            }`}
                                        >
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                    </div>

                                    {/* Tab Content */}
                                    <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 hover:border-slate-600 transition-colors">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div>
                                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                    {activeTab === 'scouted' && 'Scouted Lands (Carga 1)'}
                                                    {activeTab === 'retrieved' && 'Retrieved Data (Carga 2)'}
                                                    {activeTab === 'contacted' && 'Contacted Data (Carga 3)'}
                                                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                                </h3>
                                                <p className="text-slate-400 text-sm mt-1 font-medium">
                                                    {outputData[activeTab].length} records ready for export
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                                {/* Secondary Action: Excel */}
                                                <Button 
                                                    variant="secondary"
                                                    onClick={() => handleDownloadExcel(activeTab, `${activeTab}_data.xlsx`)}
                                                    className="w-full sm:w-auto text-sm"
                                                    title="Download as Excel for verification"
                                                >
                                                    <DownloadIcon className="w-4 h-4" />
                                                    <span>Excel (Check)</span>
                                                </Button>

                                                {/* Primary Action: CSV */}
                                                <Button 
                                                    onClick={() => handleDownloadCSV(
                                                        activeTab === 'scouted' ? 'csvScouted' : 
                                                        activeTab === 'retrieved' ? 'csvRetrieved' : 'csvContacted', 
                                                        `${activeTab}_data.csv`
                                                    )}
                                                    className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30 border border-green-500/20"
                                                    title="Download formatted CSV for Salesforce"
                                                >
                                                    <CsvIcon className="w-5 h-5" />
                                                    <span>Download CSV</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                                    Complete step 2 to generate download files.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="mt-16 text-center border-t border-slate-800 pt-8">
                 <p className="text-sm font-bold text-slate-600 select-none">
                    RIC Energy &bull; Land Acquisition Tool
                 </p>
            </footer>
        </div>
    );
};

export default App;