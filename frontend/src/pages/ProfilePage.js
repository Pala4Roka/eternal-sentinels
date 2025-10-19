import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import './ProfilePage.css';

export default function ProfilePage({ user, onLogout }) {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(user);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchUserData();
    // Load profile image from localStorage
    const savedImage = localStorage.getItem(`profile_image_${user?.id}`);
    if (savedImage) {
      setProfileImage(savedImage);
    }
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const data = await authAPI.getMe();
      setUserData(data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setMessage('Пожалуйста, загрузите изображение (JPG, PNG, GIF или WebP)');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Размер файла не должен превышать 5MB');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    
    reader.onloadend = () => {
      const imageData = reader.result;
      setProfileImage(imageData);
      // Save to localStorage
      localStorage.setItem(`profile_image_${userData?.id}`, imageData);
      setMessage('Изображение профиля успешно обновлено!');
      setUploadingImage(false);
      setTimeout(() => setMessage(''), 3000);
    };

    reader.onerror = () => {
      setMessage('Ошибка при загрузке изображения');
      setUploadingImage(false);
    };

    reader.readAsDataURL(file);
  };

  const removeProfileImage = () => {
    setProfileImage(null);
    localStorage.removeItem(`profile_image_${userData?.id}`);
    setMessage('Изображение профиля удалено');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout(); // Вызываем функцию из App.js для обновления состояния
    }
    navigate('/login');
  };

  const getClearanceLevelName = (level) => {
    const levels = {
      1: 'Threat',
      2: 'Threat+',
      3: 'Hazard/Cataclysm',
      4: 'Collapse/Apex',
      5: 'Absolute/Annihilation'
    };
    return levels[level] || 'Unknown';
  };

  const getClearanceColor = (level) => {
    const colors = {
      1: '#4ade80',
      2: '#22d3ee',
      3: '#fbbf24',
      4: '#fb923c',
      5: '#dc2626'
    };
    return colors[level] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Загрузка профиля...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-top-buttons">
          <button 
            className="back-button"
            onClick={() => navigate('/')}
          >
            ← Вернуться на главную
          </button>
          <button 
            className="logout-button"
            onClick={handleLogout}
          >
            🚪 Выход
          </button>
        </div>
        
        <div className="profile-header">
          <div className="profile-avatar">
            {profileImage ? (
              <img 
                src={profileImage} 
                alt="Profile" 
                className="avatar-image"
              />
            ) : (
              <div className="avatar-icon">👤</div>
            )}
            <div className="avatar-status"></div>
          </div>
          <div className="avatar-controls">
            <input
              type="file"
              id="avatar-upload"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              disabled={uploadingImage}
            />
            <label htmlFor="avatar-upload" className="upload-label">
              {uploadingImage ? '⏳ Загрузка...' : '📷 Изменить аватар'}
            </label>
            {profileImage && (
              <button 
                onClick={removeProfileImage} 
                className="remove-avatar-btn"
                title="Удалить изображение"
              >
                🗑️ Удалить
              </button>
            )}
          </div>
          <h2>Личный кабинет</h2>
          <p className="profile-subtitle">
            Добро пожаловать, <strong>{userData?.username}</strong>
          </p>
        </div>

        <div className="profile-info">
          <div className="info-card">
            <div className="info-label">Идентификатор</div>
            <div className="info-value">{userData?.id || 'N/A'}</div>
          </div>

          <div className="info-card">
            <div className="info-label">Имя пользователя</div>
            <div className="info-value">{userData?.username || 'N/A'}</div>
          </div>

          <div className="info-card clearance-card">
            <div className="info-label">Уровень допуска</div>
            <div className="clearance-display">
              <div 
                className="clearance-level-badge"
                style={{ 
                  backgroundColor: getClearanceColor(userData?.clearance_level),
                  boxShadow: `0 0 20px ${getClearanceColor(userData?.clearance_level)}80`
                }}
              >
                <div className="clearance-number">{userData?.clearance_level || 1}</div>
                <div className="clearance-name">{getClearanceLevelName(userData?.clearance_level)}</div>
              </div>
              <div className="clearance-description">
                {userData?.clearance_level === 1 && 'Доступ к объектам класса Угроза'}
                {userData?.clearance_level === 2 && 'Доступ к объектам класса Угроза (расширенный)'}
                {userData?.clearance_level === 3 && 'Доступ к Опасным и Катаклизмическим объектам'}
                {userData?.clearance_level === 4 && 'Доступ к Критическим объектам и Пределу'}
                {userData?.clearance_level === 5 && 'Полный доступ ко всем объектам и секретным данным'}
              </div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-label">Статус</div>
            <div className="info-value status-badge">
              {userData?.is_active ? (
                <span className="status-active">
                  <span className="status-dot"></span> Активен
                </span>
              ) : (
                <span className="status-inactive">
                  <span className="status-dot"></span> Неактивен
                </span>
              )}
            </div>
          </div>

          <div className="info-card">
            <div className="info-label">Дата создания</div>
            <div className="info-value">
              {userData?.created_at 
                ? new Date(userData.created_at).toLocaleString('ru-RU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'N/A'}
            </div>
          </div>
        </div>

        {userData?.clearance_level >= 5 && (
          <div className="admin-badge-section">
            <div className="admin-badge">
              <div className="admin-badge-icon">🛡️</div>
              <div className="admin-badge-text">
                <div className="admin-badge-title">Статус администратора</div>
                <div className="admin-badge-desc">
                  У вас есть полный доступ ко всем функциям системы
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="clearance-info-section">
          <h3>Доступные объекты по уровню допуска</h3>
          <div className="clearance-levels">
            <div className={`clearance-level ${userData?.clearance_level >= 1 ? 'unlocked' : 'locked'}`}>
              <div className="level-number">1-2</div>
              <div className="level-name">Threat</div>
              <div className="level-desc">Базовые объекты</div>
            </div>
            <div className={`clearance-level ${userData?.clearance_level >= 3 ? 'unlocked' : 'locked'}`}>
              <div className="level-number">3</div>
              <div className="level-name">Hazard/Cataclysm</div>
              <div className="level-desc">Опасные объекты</div>
            </div>
            <div className={`clearance-level ${userData?.clearance_level >= 4 ? 'unlocked' : 'locked'}`}>
              <div className="level-number">4</div>
              <div className="level-name">Collapse/Apex</div>
              <div className="level-desc">Критические объекты</div>
            </div>
            <div className={`clearance-level ${userData?.clearance_level >= 5 ? 'unlocked' : 'locked'}`}>
              <div className="level-number">5</div>
              <div className="level-name">Absolute/Annihilation</div>
              <div className="level-desc">Все объекты + секретная информация</div>
            </div>
          </div>
        </div>

        {message && (
          <div className="profile-message">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
