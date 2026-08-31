/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */

import React, { useRef, useState, useEffect } from 'react';
import { GripVertical } from 'lucide-react';

interface CompareCurtainSliderProps {
  positionPercent: number; // 0 to 100
  onChangePosition: (pos: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function CompareCurtainSlider({
  positionPercent,
  onChangePosition,
  containerRef
}: CompareCurtainSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const newPercent = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
      onChangePosition(newPercent);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, containerRef, onChangePosition]);

  return (
    <div
      ref={sliderRef}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${positionPercent}%`,
        width: '4px',
        backgroundColor: '#0284c7',
        boxShadow: '0 0 8px rgba(2, 132, 199, 0.8)',
        zIndex: 90,
        cursor: 'ew-resize',
        transform: 'translateX(-50%)'
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
    >
      {/* Center Handle Badge */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '28px',
        height: '40px',
        backgroundColor: '#0284c7',
        color: '#ffffff',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        cursor: 'ew-resize'
      }}>
        <GripVertical size={16} />
      </div>
    </div>
  );
}
