import React, { useState, useEffect, useRef } from 'react';
import './VideoBackground.css';

export default function VideoBackground({ isTalking, emotion }) {
  const [currentVideo, setCurrentVideo] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRef1 = useRef(null);
  const videoRef2 = useRef(null);

  const videos = [
    '/videos/video1.mp4',

    '/videos/video2.mp4',

    '/videos/video3.mp4',

    '/videos/video4.mp4',

    '/videos/video5.mp4',

    '/videos/video6.mp4',

    '/videos/video7.mp4'
  ];

  useEffect(() => {
    // Switch videos every 30 seconds with glitch transition
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentVideo(prev => (prev + 1) % videos.length);
        setIsTransitioning(false);
      }, 500);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Add pulsing effect when talking
  const containerClass = `video-background-container ${isTalking ? 'talking' : ''} ${isTransitioning ? 'glitch' : ''}`;

  return (
    <div className={containerClass}>
      {/* Glitch overlay effect */}
      {isTransitioning && (
        <div className="glitch-overlay">
          <div className="glitch-line"></div>
          <div className="glitch-line"></div>
          <div className="glitch-line"></div>
        </div>
      )}

      {/* Video 1 */}
      <video
        ref={videoRef1}
        className={`video-layer ${currentVideo === 0 ? 'active' : ''}`}
        src={videos[0]}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Video 2 */}
      <video
        ref={videoRef2}
        className={`video-layer ${currentVideo === 1 ? 'active' : ''}`}
        src={videos[1]}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Emotion overlay */}
      <div className={`emotion-overlay emotion-${emotion}`}></div>
    </div>
  );
}
