import React, { useState, useEffect, useRef } from 'react';
import './VideoBackground.css';

export default function VideoBackground({ isTalking, emotion }) {
  const [currentVideo, setCurrentVideo] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  const videos = [
    '/videos/video1.mp4',
    '/videos/video2.mp4',
    '/videos/video3.mp4',
    '/videos/video4.mp4',
    '/videos/video5.mp4',
    '/videos/video6.mp4',
    '/videos/video7.mp4',
    '/videos/video8.mp4',
    '/videos/video9.mp4',
    '/videos/video10.mp4'
  ];

  // Handle video playback for current video
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      setVideoError(false);
      // Set source and load
      video.src = videos[currentVideo];
      video.load();
      
      // Wait for video to be ready before playing
      const handleCanPlay = () => {
        video.play().catch(err => {
          console.log('Video autoplay issue:', err.message);
        });
      };
      
      // Handle video end - switch to next video
      const handleVideoEnd = () => {
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentVideo(prev => (prev + 1) % videos.length);
          setIsTransitioning(false);
        }, 500);
      };
      
      video.addEventListener('canplay', handleCanPlay, { once: true });
      video.addEventListener('ended', handleVideoEnd);
      
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('ended', handleVideoEnd);
      };
    }
  }, [currentVideo, videos]);

  const handleVideoError = (e) => {
    console.log('Video loading error:', e.target.error);
    setVideoError(true);
  };

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

      {/* Single video element that changes source */}
      <video
        ref={videoRef}
        className="video-layer active"
        muted
        playsInline
        crossOrigin="anonymous"
        preload="metadata"
        onError={handleVideoError}
        onLoadedData={() => {
          console.log(`Video ${currentVideo + 1} loaded`);
          setVideoError(false);
        }}
      />

      {/* Show message if video fails to load */}
      {videoError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#dc2626',
          fontSize: '14px',
          textAlign: 'center',
          zIndex: 10
        }}>
          <div>Загрузка видео...</div>
          <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
            Видео {currentVideo + 1} из {videos.length}
          </div>
        </div>
      )}

      {/* Emotion overlay */}
      <div className={`emotion-overlay emotion-${emotion}`}></div>
    </div>
  );
}