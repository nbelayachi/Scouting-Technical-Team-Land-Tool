import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';
import { AlertIcon, CheckCircleIcon, InfoIcon } from './icons';

interface LogConsoleProps {
    logs: LogEntry[];
}

const LogIcon = ({ type }: { type: LogEntry['type'] }) => {
  switch (type) {
    case 'success':
      return <CheckCircleIcon className="text-green-400" />;
    case 'error':
      return <AlertIcon className="text-red-400" />;
    case 'info':
    default:
      return <InfoIcon className="text-green-400" />;
  }
};

const getTextColor = (type: LogEntry['type']) => {
    switch (type) {
        case 'success': return 'text-green-300';
        case 'error': return 'text-red-300';
        case 'info':
        default: return 'text-slate-300';
    }
}


export const LogConsole = ({ logs }: LogConsoleProps) => {
    const consoleEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="w-full mt-6 h-64 bg-slate-950/70 rounded-lg border border-slate-700 p-4 font-mono text-sm overflow-y-auto shadow-inner">
            {logs.length === 0 && <span className="text-slate-500">Awaiting transformation...</span>}
            {logs.map((log) => (
                <div key={log.timestamp + log.message} className={`flex items-start gap-3 mb-2 ${getTextColor(log.type)}`}>
                    <div className="flex-shrink-0 mt-0.5 w-4 h-4"><LogIcon type={log.type} /></div>
                    <span className="flex-grow whitespace-pre-wrap break-words">{log.message}</span>
                </div>
            ))}
            <div ref={consoleEndRef} />
        </div>
    );
};