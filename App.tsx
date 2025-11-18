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
import { DownloadIcon, RocketIcon, RicLogoIcon } from './components/icons';
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
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [outputData, setOutputData] = useState<OutputData | null>(null);

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

        try {
            const { jsonData, validation } = await transformData(type, file, addLog);
            if (validation.isValid) {
                fileDataCache.current[type] = jsonData;
                setFileStatus(prev => ({...prev, [type]: 'valid' }));
                addLog(`'${file.name}' loaded and validated successfully.`, 'success');
            } else {
                fileDataCache.current[type] = null;
                setFileStatus(prev => ({...prev, [type]: 'invalid' }));
                validation.errors.forEach(err => addLog(err, 'error'));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`Error processing ${file.name}: ${errorMessage}`, 'error');
            setFileStatus(prev => ({...prev, [type]: 'invalid' }));
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

    const handleDownload = (key: keyof OutputData, fileName: string) => {
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

    const canRun = fileStatus.input === 'valid' && fileStatus.results === 'valid';

    return (
        <div className="min-h-screen bg-slate-800/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
            <div className="w-full max-w-6xl mx-auto">
                <header className="text-center mb-8 border-b border-slate-700 pb-4">
                     <div className="flex items-center justify-center gap-4 text-green-400">
                        <RicLogoIcon className="w-16 h-16" />
                        <h1 className="text-4xl sm:text-5xl font-bold">
                           RIC Energy Italia
                        </h1>
                    </div>
                     <p className="text-lg font-semibold text-slate-300 mt-2">Scouting & Technical Team Land Tool</p>
                    <p className="text-slate-400 mt-2 max-w-3xl mx-auto">
                        This tool processes land acquisition Excel files locally in your browser. Your data is secure and never uploaded to a server.
                    </p>
                </header>

                <Tutorial />

                <main className="space-y-8">
                    <div className="bg-slate-900/70 p-6 rounded-2xl shadow-lg border border-slate-700">
                        <h2 className="text-2xl font-semibold mb-4 text-green-400">Step 1: Upload Source Data</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Dropzone
                                title="Input File"
                                description="e.g. Corrected_Input_Piemonte.xlsx"
                                onFileSelect={(file) => handleFileChange(file, 'input')}
                                status={fileStatus.input}
                            />
                            <Dropzone
                                title="Results File"
                                description="e.g. Campaign_Results.xlsx"
                                onFileSelect={(file) => handleFileChange(file, 'results')}
                                status={fileStatus.results}
                            />
                        </div>
                    </div>
                    
                    <div className="bg-slate-900/70 p-6 rounded-2xl shadow-lg border border-slate-700">
                        <h2 className="text-2xl font-semibold mb-4 text-green-500">Step 2: Processing</h2>
                        <div className="flex flex-col items-center">
                            <Button
                                onClick={handleRunTransformation}
                                disabled={!canRun || isProcessing}
                                className="w-full max-w-sm"
                            >
                                <RocketIcon />
                                {isProcessing ? 'Processing...' : 'Run Transformation'}
                            </Button>
                            <LogConsole logs={logs} />
                        </div>
                    </div>

                    {outputData && (
                        <div className="bg-slate-900/70 p-6 rounded-2xl shadow-lg border border-slate-700 animate-fade-in">
                            <h2 className="text-2xl font-semibold mb-4 text-green-400">Step 3: Download Outputs</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                               <Button variant="secondary" onClick={() => handleDownload('scouted', '1_Scouted_Lands.xlsx')}>
                                    <DownloadIcon /> Download Carga 1
                                </Button>
                                <Button variant="secondary" onClick={() => handleDownload('retrieved', '2_Retrieved_Data.xlsx')}>
                                    <DownloadIcon /> Download Carga 2
                                </Button>
                                <Button variant="secondary" onClick={() => handleDownload('contacted', '3_Contacted_Data.xlsx')}>
                                    <DownloadIcon /> Download Carga 3
                                </Button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;