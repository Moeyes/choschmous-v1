'use client';

import React, { useRef, useState, useEffect } from 'react';
import { CardData } from '../types';

interface CardIframeProps extends CardData {
  scale?: number;
}

const CardIframe: React.FC<CardIframeProps> = (props) => {
  const { scale = 1, ...cardData } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  // Send update to iframe when ready or cardData changes
  const sendUpdate = React.useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow && ready) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'CARD_UPDATE', ...cardData },
        '*'
      );
    }
  }, [ready, cardData]);

  useEffect(() => {
    if (ready) {
      sendUpdate();
    }
  }, [ready, sendUpdate]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'CARD_READY') {
        setReady(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const width = 310;
  const height = 437;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return (
    <div 
      style={{ 
        width: scaledWidth, 
        height: scaledHeight, 
        position: 'relative',
        overflow: 'hidden' 
      }}
    >
      {!ready && (
        <div 
          style={{ 
            width: width, 
            height: height, 
            background: '#f3f4f6', 
            borderRadius: '4px',
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            zIndex: 1
          }} 
        />
      )}
      <iframe
        ref={iframeRef}
        src="/card-template.html"
        width={width}
        height={height}
        style={{
          border: 'none',
          overflow: 'hidden',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          opacity: ready ? 1 : 0
        }}
        scrolling="no"
      />
    </div>
  );
};

export default CardIframe;
