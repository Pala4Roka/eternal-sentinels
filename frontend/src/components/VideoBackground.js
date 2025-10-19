import React, { useState, useEffect, useRef } from 'react';

import './VideoBackground.css';

export default function VideoBackground({ isTalking, emotion }) {

const [currentVideo, setCurrentVideo] = useState(0);

const [isTransitioning, setIsTransitioning] = useState(false);

const videoRef = useRef(null);

const videoBaseUrl = process.env.REACT_APP_VIDEO_BASE_URL || '';

const videos = [

`${videoBaseUrl}/videos/video1.mp4`,

`${videoBaseUrl}/videos/video2.mp4`,

`${videoBaseUrl}/videos/video3.mp4`,

`${videoBaseUrl}/videos/video4.mp4`,

`${videoBaseUrl}/videos/video5.mp4`,

`${videoBaseUrl}/videos/video6.mp4`,

`${videoBaseUrl}/videos/video7.mp4`,

`${videoBaseUrl}/videos/video8.mp4`, // Добавьте эту строку

`${videoBaseUrl}/videos/video9.mp4` // Добавьте эту строку

];

const handleVideoEnd = () => {

console.log('Video ended');

setIsTransitioning(true);


setTimeout(() => {

const nextVideo = (currentVideo + 1) % videos.length;

setCurrentVideo(nextVideo);

setIsTransitioning(false);


if (videoRef.current) {

videoRef.current.src = videos[nextVideo];

videoRef.current.load();

videoRef.current.play().catch(err => console.log('Play error:', err));

}

}, 500);

};

useEffect(() => {

if (videoRef.current) {

videoRef.current.src = videos[currentVideo];

videoRef.current.load();

}

}, []);

const containerClass = `video-background-container ${isTalking ? 'talking' : ''} ${isTransitioning ? 'glitch' : ''}`;

return (

<div className={containerClass}>

{isTransitioning && (

<div className="glitch-overlay">

<div className="glitch-line"></div>

<div className="glitch-line"></div>

<div className="glitch-line"></div>

</div>

)}

<video

ref={videoRef}

className="video-layer active"

autoPlay

muted

playsInline

onEnded={handleVideoEnd}

preload="auto"

>

<source src={videos[currentVideo]} type="video/mp4" />

Ваш браузер не поддерживает видео.

</video>

</div>

);

}
