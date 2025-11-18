import React from 'react';

export const UploadIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
    </svg>
);

export const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
    </svg>
);

export const AlertIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
    </svg>
);

export const SpinnerIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

export const RocketIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 00-11.03-3.04m11.03 3.04L9.04 4.135a14.95 14.95 0 018.342 12.083m-12.083 0L3.06 9.04a14.95 14.95 0 0112.083-8.342m0 12.083L19.5 7.5" />
  </svg>
);

export const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414L9 7.586V13a1 1 0 102 0V8a1 1 0 00-.293-.707zM9 5a1 1 0 112 0 1 1 0 01-2 0z" clipRule="evenodd" />
    </svg>
);

export const RicLogoIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M106.667 42.6667C75.4733 42.6667 50.1333 68.0067 50.1333 99.2C50.1333 130.393 75.4733 155.733 106.667 155.733C137.86 155.733 163.2 130.393 163.2 99.2C163.2 68.0067 137.86 42.6667 106.667 42.6667Z" />
        <path d="M0 204.8V294.4C138.24 253.44 296.96 335.36 512 294.4V204.8C373.76 245.76 215.04 163.84 0 204.8Z" />
        <path d="M0 311.467V426.667C186.347 375.467 322.133 448 512 426.667V337.067C398.933 366.933 211.2 320 0 311.467Z" />
        <path d="M0 469.333H512V512H0V469.333Z" />
    </svg>
);