import React, { useEffect, useState } from 'react';
import { LeafyGreenProvider } from '@mongodb-js/compass-components';
import { useDetectVsCodeDarkMode } from './use-detect-vscode-dark-mode';
import DocumentTreeView from './document-tree-view';

declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

interface PreviewDocument {
  [key: string]: unknown;
}

const PreviewApp: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();
  const [documents, setDocuments] = useState<PreviewDocument[]>([]);

  useEffect(() => {
    const vscode = acquireVsCodeApi();

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'LOAD_DOCUMENTS') {
        setDocuments(message.documents || []);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial documents
    vscode.postMessage({ command: 'GET_DOCUMENTS' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <LeafyGreenProvider darkMode={darkMode}>
      <div
        style={{
          padding: '16px',
          backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF',
          minHeight: '100vh',
          color: darkMode ? '#CCCCCC' : '#000000',
        }}
      >
        <h2
          style={{
            marginBottom: '16px',
            color: darkMode ? '#CCCCCC' : '#000',
            fontSize: '14px',
            fontWeight: 400,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Preview ({documents.length} documents)
        </h2>
        {documents.map((doc, index) => (
          <DocumentTreeView key={index} document={doc} />
        ))}
      </div>
    </LeafyGreenProvider>
  );
};

export default PreviewApp;

