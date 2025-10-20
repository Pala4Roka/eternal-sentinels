import React, { useState, useEffect } from 'react';
import './DossierCarousel.css';

export default function DossierCarousel({ objects, onObjectClick }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);

  // Автоматическая прокрутка каждые 5 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      handleNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex, objects.length]);

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % objects.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const handlePrev = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + objects.length) % objects.length);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const getVisibleObjects = () => {
    // Return all objects for 3D carousel animation
    return objects.map((obj, index) => ({
      ...obj,
      position: index
    }));
  };

  if (!objects || objects.length === 0) {
    return null;
  }

  const visibleObjects = getVisibleObjects();

  return (
    <div className="dossier-carousel">
      <div className="carousel-container">

        <div className="carousel-track">
          {visibleObjects.map((obj, idx) => (
            <div
              key={`${obj.id}-${idx}`}
              className={`carousel-card ${isTransitioning ? 'transitioning' : ''} ${obj.is_classified ? 'classified' : ''}`}
              onClick={() => onObjectClick(obj)}
              onMouseEnter={() => setHoveredCard(obj.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                animationDelay: `${-idx * (30 / objects.length)}s`
              }}
            >
              <div className="carousel-card-header">
                <span className="carousel-number">ES-{obj.number}</span>
                {obj.is_classified && (
                  <span className="carousel-classified-badge">ЗАСЕКРЕЧЕНО</span>
                )}
              </div>
              <h3 className="carousel-name">{obj.name}</h3>
              <p className="carousel-codename">"{obj.codename}"</p>
              <div className="carousel-threat">
                <span className="carousel-threat-label">Класс угрозы:</span>
                <span className="carousel-threat-value">{obj.threat_class}</span>
              </div>
              <button className="carousel-view-btn">Подробнее →</button>
            </div>
          ))}
        </div>

        
      </div>


    </div>
  );
}
