'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';

interface LinePath {
  id: string;
  d: string;
  colorClass: string;
}

export default function ConnectorLines() {
  const { classes, trainingStatus } = useProjectStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [classLines, setClassLines] = useState<LinePath[]>([]);
  const [trainingLine, setTrainingLine] = useState<string | null>(null);

  const calculatePaths = () => {
    if (!svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const trainingCard = document.getElementById('training-card');
    const previewCard = document.getElementById('preview-card');

    if (!trainingCard || !previewCard) return;

    const trainingRect = trainingCard.getBoundingClientRect();
    const previewRect = previewCard.getBoundingClientRect();

    // 1. Calculate class card connections (curved bezier lines)
    const newClassLines: LinePath[] = [];
    const trainingLeftX = trainingRect.left - svgRect.left;
    // Connect to the left-center of the "Train Model" region of the training card, which is near y_center
    const trainingLeftY = trainingRect.top + 90 - svgRect.top; // approximate height of Train button area

    classes.forEach((cls, index) => {
      // Find element by sanitized class name ID
      const cardId = `class-card-${cls.name.replace(/\s+/g, '')}`;
      const cardEl = document.getElementById(cardId);
      if (cardEl) {
        const cardRect = cardEl.getBoundingClientRect();
        
        // Start from center-right of the class card
        const startX = cardRect.right - svgRect.left;
        const startY = cardRect.top + cardRect.height / 2 - svgRect.top;

        // Middle control point (converges halfway horizontally)
        const midX = startX + (trainingLeftX - startX) * 0.45;
        
        // Cubic bezier curve path
        const pathData = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${trainingLeftY}, ${trainingLeftX} ${trainingLeftY}`;
        
        newClassLines.push({
          id: cardId,
          d: pathData,
          colorClass: `class-bar-${index % 7}`
        });
      }
    });

    setClassLines(newClassLines);

    // 2. Calculate training-to-preview connection (straight horizontal line)
    const trainingRightX = trainingRect.right - svgRect.left;
    const trainingRightY = trainingRect.top + 90 - svgRect.top;
    const previewLeftX = previewRect.left - svgRect.left;
    const previewLeftY = previewRect.top + 50 - svgRect.top; // approximate center vertical of preview top card

    const trainPathData = `M ${trainingRightX} ${trainingRightY} L ${previewLeftX} ${previewLeftY}`;
    setTrainingLine(trainPathData);
  };

  useEffect(() => {
    // Calculate paths initially
    calculatePaths();

    // Calculate on resize, scroll and short delay after mount to ensure DOM is ready
    const handleUpdate = () => {
      calculatePaths();
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate);

    // Dynamic polling during transition/state updates
    const timer1 = setTimeout(calculatePaths, 150);
    const timer2 = setTimeout(calculatePaths, 600); // after animations finish

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [classes, trainingStatus]);

  const isTraining = trainingStatus === 'training';
  const isTrained = trainingStatus === 'success';

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 hidden lg:block"
      style={{ minHeight: '100%' }}
    >
      <defs>
        {/* Glow filter for active/trained connector lines */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        
        {/* Linear gradient for flowing line effect */}
        <linearGradient id="activeFlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#dadce0" />
          <stop offset="50%" stopColor="#1a73e8" />
          <stop offset="100%" stopColor="#1a73e8" />
        </linearGradient>
      </defs>

      {/* 1. Curved Bezier lines from each Class Card to Training Card */}
      {classLines.map((line) => (
        <g key={line.id}>
          {/* Background thick highlight for active styled state */}
          {isTraining && (
            <path
              d={line.d}
              fill="none"
              stroke="#e8f0fe"
              strokeWidth="6"
              strokeLinecap="round"
              className="opacity-70"
            />
          )}
          {/* Main bezier line */}
          <path
            d={line.d}
            fill="none"
            stroke={isTraining ? '#1a73e8' : '#dadce0'}
            strokeWidth={isTraining ? '3.5' : '2'}
            strokeLinecap="round"
            className={`transition-all duration-300 ${
              isTraining ? 'stroke-dasharray-anim' : ''
            }`}
            style={{
              strokeDasharray: isTraining ? '8, 4' : 'none',
              animation: isTraining ? 'flow 30s linear infinite' : 'none'
            }}
          />
        </g>
      ))}

      {/* 2. Straight line from Training Card to Preview Card */}
      {trainingLine && (
        <g>
          {isTrained && (
            <path
              d={trainingLine}
              fill="none"
              stroke="#e6f4ea"
              strokeWidth="6"
              strokeLinecap="round"
              className="opacity-70"
            />
          )}
          <path
            d={trainingLine}
            fill="none"
            stroke={isTrained ? '#0f9d58' : '#dadce0'}
            strokeWidth={isTrained ? '3.5' : '2'}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </g>
      )}
    </svg>
  );
}
