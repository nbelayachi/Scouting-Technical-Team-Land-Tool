import React, { useCallback, useState } from 'react';
import type { FileStatus } from '../types';
import { AlertIcon, CheckCircleIcon, UploadIcon, SpinnerIcon, FileTextIcon } from './icons';

interface DropzoneProps {
    title: string;
    description: string;
    onFileSelect: (file: File) => void;
    status: FileStatus;
    fileName?: string;
    errorMessage?: string | null;
}

export const Dropzone: React.FC<DropzoneProps> = ({ title, description, onFileSelect, status, fileName, errorMessage }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            onFileSelect(files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onFileSelect(files[0]);
        }
    };

    const getStatusContent = () => {
        switch (status) {
            case 'loading':
                return {
                    icon: <SpinnerIcon className="animate-spin" />,
                    text: 'Processing...',
                    color: 'text-green-400',
                    borderColor: 'border-green-500'
                };
            case 'valid':
                return {
                    icon: <FileTextIcon />,
                    text: fileName || 'File Validated',
                    color: 'text-green-400',
                    borderColor: 'border-green-500'
                };
            case 'invalid':
                return {
                    icon: <AlertIcon />,
                    text: 'Invalid File',
                    color: 'text-red-400',
                    borderColor: 'border-red-500'
                };
            case 'waiting':
            default:
                return {
                    icon: <UploadIcon />,
                    text: 'Drop File Here or Click to Upload',
                    color: 'text-slate-400',
                    borderColor: 'border-slate-600'
                };
        }
    };

    const { icon, text, color, borderColor } = getStatusContent();
    const dropzoneClasses = `relative flex flex-col items-center justify-center w-full h-48 border-2 ${isDragOver ? 'border-green-500' : borderColor} border-dashed rounded-lg cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-all duration-300 group`;

    return (
        <div 
            className={dropzoneClasses}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => document.getElementById(`file-input-${title}`)?.click()}
        >
            <div className={`flex flex-col items-center justify-center pt-5 pb-6 text-center ${color} px-4`}>
                <div className="w-10 h-10 mb-3 transition-transform group-hover:scale-110 duration-300">{icon}</div>
                <p className="mb-2 text-sm font-semibold break-all line-clamp-2">{text}</p>
                
                {status === 'waiting' && (
                   <p className="text-xs text-slate-500">{description}</p>
                )}
                
                {status === 'valid' && (
                    <p className="text-xs text-green-500/80">Ready for transformation</p>
                )}

                {status === 'invalid' && errorMessage && (
                    <p className="text-xs text-red-400/90 mt-1 font-medium max-w-[250px] break-words">{errorMessage}</p>
                )}
            </div>
            <input 
                id={`file-input-${title}`} 
                type="file" 
                className="hidden" 
                onChange={handleFileChange}
                accept=".xlsx, .xls"
            />
        </div>
    );
};