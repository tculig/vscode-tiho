import React, { useEffect, useState, useMemo } from 'react';
import {
  LeafyGreenProvider,
  Icon,
  IconButton,
  Select,
  Option,
  Menu,
  MenuItem,
  css,
  spacing,
} from '@mongodb-js/compass-components';
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

type SortOption = 'default' | 'asc' | 'desc';
type ViewType = 'tree' | 'json' | 'table';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Styles
const toolbarStyles = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing[2]}px ${spacing[3]}px`,
  borderBottom: '1px solid var(--vscode-panel-border, #444)',
  gap: spacing[3],
  flexWrap: 'wrap',
});

const toolbarLeftStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2],
});

const toolbarRightStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[3],
});

const toolbarGroupStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[2],
});

const toolbarLabelStyles = css({
  fontSize: '13px',
  fontWeight: 500,
});

const paginationInfoStyles = css({
  fontSize: '13px',
  whiteSpace: 'nowrap',
});

const selectWrapperStyles = css({
  minWidth: '100px',
});

const narrowSelectStyles = css({
  minWidth: '60px',
});

const settingsMenuStyles = css({
  position: 'relative',
});

const PreviewApp: React.FC = () => {
  const darkMode = useDetectVsCodeDarkMode();
  const [documents, setDocuments] = useState<PreviewDocument[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewType, setViewType] = useState<ViewType>('tree');
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  const totalDocuments = documents.length;
  const totalPages = Math.max(1, Math.ceil(totalDocuments / itemsPerPage));

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Calculate displayed documents based on pagination
  const displayedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return documents.slice(startIndex, endIndex);
  }, [documents, currentPage, itemsPerPage]);

  // Calculate pagination info
  const startItem = totalDocuments === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalDocuments);

  useEffect(() => {
    const vscode = acquireVsCodeApi();

    const handleMessage = (event: MessageEvent): void => {
      const message = event.data;
      if (message.command === 'LOAD_DOCUMENTS') {
        setDocuments(message.documents || []);
        setCurrentPage(1); // Reset to first page when new documents are loaded
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial documents
    vscode.postMessage({ command: 'GET_DOCUMENTS' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleRefresh = (): void => {
    const vscode = acquireVsCodeApi();
    vscode.postMessage({ command: 'REFRESH_DOCUMENTS' });
  };

  const handlePrevPage = (): void => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = (): void => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleSortChange = (value: string): void => {
    setSortOption(value as SortOption);
    // TODO: Implement actual sorting logic or send message to extension
  };

  const handleItemsPerPageChange = (value: string): void => {
    const newItemsPerPage = parseInt(value, 10);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleViewTypeChange = (value: string): void => {
    setViewType(value as ViewType);
    // TODO: Implement different view renderings
  };

  const toggleSettingsMenu = (): void => {
    setSettingsMenuOpen(!settingsMenuOpen);
  };

  return (
    <LeafyGreenProvider darkMode={darkMode}>
      <div
        style={{
          backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF',
          minHeight: '100vh',
          color: darkMode ? '#CCCCCC' : '#000000',
        }}
      >
        {/* Toolbar */}
        <div className={toolbarStyles}>
          {/* Left side - Insert Document */}
          <div className={toolbarLeftStyles}>
            <IconButton
              aria-label="Insert Document"
              title="Insert Document"
              onClick={(): void => {
                // TODO: Implement insert document functionality
              }}
            >
              <Icon glyph="Plus" />
            </IconButton>
            <span className={toolbarLabelStyles}>Insert Document</span>
          </div>

          {/* Right side - Actions */}
          <div className={toolbarRightStyles}>
            {/* Refresh */}
            <div className={toolbarGroupStyles}>
              <IconButton
                aria-label="Refresh"
                title="Refresh"
                onClick={handleRefresh}
              >
                <Icon glyph="Refresh" />
              </IconButton>
              <span className={toolbarLabelStyles}>Refresh</span>
            </div>

            {/* Sort */}
            <div className={toolbarGroupStyles}>
              <span className={toolbarLabelStyles}>Sort</span>
              <div className={selectWrapperStyles}>
                <Select
                  aria-label="Sort order"
                  value={sortOption}
                  onChange={handleSortChange}
                  size="xsmall"
                  allowDeselect={false}
                >
                  <Option value="default">Default</Option>
                  <Option value="asc">Ascending</Option>
                  <Option value="desc">Descending</Option>
                </Select>
              </div>
            </div>

            {/* Items per page */}
            <div className={toolbarGroupStyles}>
              <div className={narrowSelectStyles}>
                <Select
                  aria-label="Items per page"
                  value={itemsPerPage.toString()}
                  onChange={handleItemsPerPageChange}
                  size="xsmall"
                  allowDeselect={false}
                >
                  {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                    <Option key={option} value={option.toString()}>
                      {option}
                    </Option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Pagination info */}
            <span className={paginationInfoStyles}>
              {startItem}-{endItem} of {totalDocuments}
            </span>

            {/* Page navigation */}
            <div className={toolbarGroupStyles}>
              <IconButton
                aria-label="Previous page"
                title="Previous page"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
              >
                <Icon glyph="ChevronLeft" />
              </IconButton>
              <IconButton
                aria-label="Next page"
                title="Next page"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
              >
                <Icon glyph="ChevronRight" />
              </IconButton>
            </div>

            {/* View type */}
            <div className={toolbarGroupStyles}>
              <div className={selectWrapperStyles}>
                <Select
                  aria-label="View type"
                  value={viewType}
                  onChange={handleViewTypeChange}
                  size="xsmall"
                  allowDeselect={false}
                >
                  <Option value="tree">Tree view</Option>
                  <Option value="json">JSON view</Option>
                  <Option value="table">Table view</Option>
                </Select>
              </div>
            </div>

            {/* Settings dropdown */}
            <div className={settingsMenuStyles}>
              <Menu
                open={settingsMenuOpen}
                setOpen={setSettingsMenuOpen}
                trigger={
                  <IconButton
                    aria-label="Settings"
                    title="Settings"
                    onClick={toggleSettingsMenu}
                  >
                    <Icon glyph="Settings" />
                  </IconButton>
                }
              >
                <MenuItem>Show line numbers</MenuItem>
                <MenuItem>Expand all</MenuItem>
                <MenuItem>Collapse all</MenuItem>
                <MenuItem>Copy documents</MenuItem>
              </Menu>
            </div>
          </div>
        </div>

        {/* Documents content */}
        <div style={{ padding: '16px' }}>
          {displayedDocuments.map((doc, index) => (
            <DocumentTreeView key={`${currentPage}-${index}`} document={doc} />
          ))}
          {displayedDocuments.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '32px',
              color: darkMode ? '#888' : '#666'
            }}>
              No documents to display
            </div>
          )}
        </div>
      </div>
    </LeafyGreenProvider>
  );
};

export default PreviewApp;

