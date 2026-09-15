import React from 'react';
import type { OfficeFileType } from './types';
import { getOfficeBadgeMeta } from './officeDetector';

export interface OfficeLoadingOverlayProps {
  fileType: OfficeFileType;
  fileName?: string;
  error?: Error | null;
  onRetry?: () => void;
}

export const OfficeLoadingOverlay: React.FC<OfficeLoadingOverlayProps> = ({
  fileType,
  fileName,
  error,
  onRetry,
}) => {
  const meta = getOfficeBadgeMeta(fileType);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#1e293b',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Document Type Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: meta.brandColor,
            color: '#ffffff',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '20px',
            boxShadow: `0 4px 12px ${meta.brandColor}40`,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          {meta.extension} Document
        </div>

        {/* Icon & Animation */}
        {!error ? (
          <div style={{ position: 'relative', width: '64px', height: '64px', marginBottom: '20px' }}>
            <svg
              style={{
                animation: 'teamsync-spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                width: '64px',
                height: '64px',
              }}
              viewBox="0 0 50 50"
            >
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="4"
              />
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke={meta.brandColor}
                strokeWidth="4"
                strokeDasharray="80"
                strokeDashoffset="60"
                strokeLinecap="round"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '15px',
                color: meta.brandColor,
              }}
            >
              {meta.extension[0]}
            </div>
          </div>
        ) : (
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        )}

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '18px',
            fontWeight: 600,
            color: '#0f172a',
          }}
        >
          {error ? 'Conversion Failed' : `Preparing ${meta.name}`}
        </h3>

        {/* Filename if available */}
        {fileName && (
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              color: '#64748b',
              fontWeight: 500,
              maxWidth: '360px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={fileName}
          >
            {fileName}
          </p>
        )}

        {/* Body message */}
        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '13px',
            lineHeight: 1.5,
            color: error ? '#b91c1c' : '#475569',
          }}
        >
          {error
            ? error.message || 'An error occurred while converting the Office document.'
            : 'Rendering document with native fonts, vector graphics, and formatting…'}
        </p>

        {/* Action Button on Error */}
        {error && onRetry && (
          <button
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: meta.brandColor,
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.9')}
            onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Retry Conversion
          </button>
        )}
      </div>

      <style>{`
        @keyframes teamsync-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
