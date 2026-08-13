/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, MessageSquare, MessageCircle, Type, Search, X, Link as LinkIcon } from 'lucide-react';
import { type SearchResult } from '../hooks/usePdfSearch';

interface SidebarProps {
  isOpen: boolean;
  annotations: any[];
  setAnnotations: (anns: any[]) => void;
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;
  // Search Props
  onSearch: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  searchProgress: number;
  onResultClick: (result: SearchResult) => void;
  activeTab: 'Comments' | 'Search';
  setActiveTab: (tab: 'Comments' | 'Search') => void;
}

export default function Sidebar({ 
  isOpen, annotations, setAnnotations, selectedAnnotationId, setSelectedAnnotationId,
  onSearch, searchResults, isSearching, searchProgress, onResultClick,
  activeTab, setActiveTab
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, 200), 600);
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, onSearch]);

  useEffect(() => {
    const handleFocusSearch = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    };
    window.addEventListener('action-focus-search', handleFocusSearch);
    return () => window.removeEventListener('action-focus-search', handleFocusSearch);
  }, []);

  const comments = annotations.filter(a => ['note', 'callout', 'text', 'link'].includes(a.type));

  const handleDelete = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  return (
    <div style={{
      width: isOpen ? `${sidebarWidth}px` : '0px',
      height: '100%',
      backgroundColor: '#f9fafb',
      display: 'flex',
      flexShrink: 0,
      zIndex: 10,
      transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative'
    }}>
      {/* Inner container to clip content smoothly */}
      <div style={{
        width: `${sidebarWidth}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flexShrink: 0
        }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={() => setActiveTab('Search')}
            style={{ 
              background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontSize: '14px',
              fontWeight: activeTab === 'Search' ? 600 : 400, color: activeTab === 'Search' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'Search' ? '2px solid var(--primary)' : '2px solid transparent'
            }}
          >
            Search
          </button>
          <button 
            onClick={() => setActiveTab('Comments')}
            style={{ 
              background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontSize: '14px',
              fontWeight: activeTab === 'Comments' ? 600 : 400, color: activeTab === 'Comments' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'Comments' ? '2px solid var(--primary)' : '2px solid transparent'
            }}
          >
            Comments
          </button>
        </div>

        {activeTab === 'Search' && (
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '8px 32px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '13px', outline: 'none'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {activeTab === 'Comments' && (
          <>
            {comments.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
                No comments on this document.
              </div>
            )}
            {comments.map(comment => (
              <div 
                key={comment.id}
                onClick={() => setSelectedAnnotationId(comment.id)}
            style={{
              padding: '12px',
              backgroundColor: '#fff',
              border: selectedAnnotationId === comment.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                {comment.type === 'note' && <MessageSquare size={14} />}
                {comment.type === 'callout' && <MessageCircle size={14} />}
                {comment.type === 'text' && <Type size={14} />}
                {comment.type === 'link' && <LinkIcon size={14} />}
                <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>{comment.type}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDelete(comment.id); }}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                title="Delete Comment"
              >
                <Trash2 size={14} />
              </button>
            </div>
            
            <div style={{ fontSize: '14px', color: 'var(--text-color)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {comment.type === 'link' ? (
                <a href={comment.linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  {comment.linkUrl || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Empty link</span>}
                </a>
              ) : (
                comment.text || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Empty comment</span>
              )}
            </div>
          </div>
          ))}
          </>
        )}

        {activeTab === 'Search' && (
          <>
            {isSearching && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '16px' }}>
                Searching... {searchProgress}%
              </div>
            )}
            {!isSearching && searchQuery && searchResults.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '16px' }}>
                No results found.
              </div>
            )}
            {!isSearching && searchResults.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {searchResults.length} results found
              </div>
            )}
            
            {/* Group results by page */}
            {!isSearching && Array.from(new Set(searchResults.map(r => r.pageIndex))).map(pageNum => {
              const pageResults = searchResults.filter(r => r.pageIndex === pageNum);
              return (
                <div key={`page-${pageNum}`} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Page {pageNum}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {pageResults.map(result => (
                      <div 
                        key={result.id} 
                        onClick={() => onResultClick(result)}
                        style={{
                          padding: '8px',
                          backgroundColor: '#fff',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: 'var(--text-color)'
                        }}
                      >
                        {result.snippet.substring(0, result.matchStartIndex)}
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {result.snippet.substring(result.matchStartIndex, result.matchStartIndex + result.matchLength)}
                        </span>
                        {result.snippet.substring(result.matchStartIndex + result.matchLength)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
        
      </div>
      
      </div>

      {/* Resizer Handle */}
      {isOpen && (
        <div 
          onMouseDown={() => setIsResizing(true)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '6px',
            height: '100%',
            cursor: 'col-resize',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent'
          }}
        >
          {/* Vertical Pill */}
          <div style={{
            width: '6px',
            height: '40px',
            backgroundColor: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ width: '1px', height: '16px', backgroundColor: '#9ca3af' }} />
            <div style={{ width: '1px', height: '16px', backgroundColor: '#9ca3af' }} />
          </div>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '1px', height: '100%', backgroundColor: 'var(--border-color)', zIndex: -1 }} />
        </div>
      )}
    </div>
  );
}
