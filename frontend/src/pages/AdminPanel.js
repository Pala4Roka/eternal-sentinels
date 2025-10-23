import React, { useState, useEffect } from 'react';
import { adminAPI, scpAPI, adminDossierAPI } from '../api';
import './AdminPanel.css';

export default function AdminPanel({ currentUser, onLogout, onBackToHome }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingObject, setEditingObject] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    number: '',
    name: '',
    codename: '',
    threat_class: 'Threat',
    description: '',
    special_procedures: '',
    secret_data: '',
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [dossiers, setDossiers] = useState([]);
  const [viewingDossier, setViewingDossier] = useState(null);

  useEffect(() => {
  if (activeTab === 'users') {
    fetchUsers();
  } else if (activeTab === 'objects') {
    fetchObjects();
  } else if (activeTab === 'dossiers') {
    fetchDossiers();
  }
}, [activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getUsers();
      setUsers(data);
      setError('');
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchObjects = async () => {
    setLoading(true);
    try {
      const data = await scpAPI.getAll();
      setObjects(data);
      setError('');
    } catch (err) {
      setError('Failed to fetch objects');
    } finally {
      setLoading(false);
    }
  };

  const handleClearanceChange = async (userId, newLevel) => {
    try {
      await adminAPI.updateClearance(userId, newLevel);
      fetchUsers();
    } catch (err) {
      setError('Failed to update clearance');
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      await adminAPI.updateStatus(userId, !currentStatus);
      fetchUsers();
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const fetchDossiers = async () => {
  setLoading(true);
  try {
    const data = await adminDossierAPI.getAllDossiers();
    setDossiers(data);
    setError('');
  } catch (err) {
    setError('Failed to fetch dossiers');
  } finally {
    setLoading(false);
  }
};

const handleViewDossier = async (dossierId) => {
  try {
    const data = await adminDossierAPI.getDossierDetail(dossierId);
    setViewingDossier(data);
  } catch (err) {
    setError('Failed to load dossier details');
  }
};

const handleModerateDossier = async (dossierId, status, adminComment = '') => {
  try {
    await adminDossierAPI.moderateDossier(dossierId, status, adminComment);
    setViewingDossier(null);
    fetchDossiers();
    setError('');
  } catch (err) {
    setError('Failed to moderate dossier');
  }
};

  const handleDeleteObject = async (number) => {
    if (!window.confirm(`Удалить объект ${number}?`)) return;
    
    try {
      await scpAPI.delete(number);
      fetchObjects();
    } catch (err) {
      setError('Failed to delete object');
    }
  };

  const handleEditObject = (obj) => {
    setEditingObject(obj);
    setEditForm({
      number: obj.number,
      name: obj.name,
      codename: obj.codename,
      threat_class: obj.threat_class,
      description: obj.description,
      special_procedures: obj.special_procedures || '',
      secret_data: obj.secret_data || ''
    });
  };

  const handleSaveEdit = async () => {
    try {
      await scpAPI.update(editingObject.number, editForm);
      setEditingObject(null);
      setEditForm({});
      fetchObjects();
      setError('');
    } catch (err) {
      setError('Ошибка при сохранении изменений');
    }
  };

  const handleCancelEdit = () => {
    setEditingObject(null);
    setEditForm({});
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check if file is .doc or .docx
      const fileExtension = file.name.split('.').pop().toLowerCase();
      if (fileExtension !== 'doc' && fileExtension !== 'docx') {
        setError('Пожалуйста, загрузите файл в формате .doc или .docx');
        return;
      }
      
      setUploadFile(file);
      
      // Try to read file content (basic text extraction for .doc files)
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        // For simple text extraction from .doc, we'll just append to description
        setUploadForm(prev => ({
          ...prev,
          description: prev.description + '\n\n[Содержимое загруженного файла]\n' + text
        }));
      };
      reader.readAsText(file);
    }
  };

  const handleUploadDossier = async () => {
    try {
      // Validate required fields
      if (!uploadForm.number || !uploadForm.name || !uploadForm.codename) {
        setError('Пожалуйста, заполните обязательные поля: номер, название и кодовое имя');
        return;
      }

      await scpAPI.create(uploadForm);
      setShowUploadModal(false);
      setUploadForm({
        number: '',
        name: '',
        codename: '',
        threat_class: 'Threat',
        description: '',
        special_procedures: '',
        secret_data: '',
      });
      setUploadFile(null);
      fetchObjects();
      setError('');
    } catch (err) {
      setError('Ошибка при загрузке досье: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCancelUpload = () => {
    setShowUploadModal(false);
    setUploadForm({
      number: '',
      name: '',
      codename: '',
      threat_class: 'Threat',
      description: '',
      special_procedures: '',
      secret_data: '',
    });
    setUploadFile(null);
    setError('');
  };

  const handleDownloadDossier = (obj) => {
    // Create a formatted text document
    const content = `
ETERNAL SENTINELS - ДОСЬЕ ОБЪЕКТА
═══════════════════════════════════════

ОБЪЕКТ: SCP-${obj.number}
НАЗВАНИЕ: ${obj.name}
КОДОВОЕ ИМЯ: "${obj.codename}"
КЛАСС УГРОЗЫ: ${obj.threat_class}

─────────────────────────────────────────

ОПИСАНИЕ:
${obj.description}

─────────────────────────────────────────

ПРОЦЕДУРЫ СОДЕРЖАНИЯ:
${obj.special_procedures || 'Данные отсутствуют'}

${obj.secret_data && obj.secret_data !== '[ТРЕБУЕТСЯ УРОВЕНЬ ДОПУСКА 5]' ? `
─────────────────────────────────────────

[УРОВЕНЬ ДОПУСКА 5 - СЕКРЕТНАЯ ИНФОРМАЦИЯ]
${obj.secret_data}
` : ''}

─────────────────────────────────────────
Документ создан: ${new Date().toLocaleString('ru-RU')}
Eternal Sentinels © 2025
    `.trim();

    // Create download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SCP-${obj.number}_${obj.codename}_Dossier.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getClearanceName = (level) => {
    const names = {
      1: 'Уровень 1 - Ограниченный',
      2: 'Уровень 2 - Базовый',
      3: 'Уровень 3 - Расширенный',
      4: 'Уровень 4 - Секретный',
      5: 'Уровень 5 - Максимальный'
    };
    return names[level] || `Уровень ${level}`;
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <h1>🛡️ АДМИН-ПАНЕЛЬ</h1>
          <p className="admin-user-info">
            Вошел как: <strong>{currentUser.username}</strong> (Уровень допуска: {currentUser.clearance_level})
          </p>
        </div>
        <div className="admin-header-actions">
          <button 
            onClick={onBackToHome} 
            className="back-to-home-btn" 
            data-testid="back-to-home-btn"
            title="Вернуться на главную страницу"
          >
            🏠 Выход на главную
          </button>
          <button 
            onClick={() => setShowUploadModal(true)} 
            className="upload-dossier-btn" 
            data-testid="upload-dossier-btn"
            title="Загрузить новое досье"
          >
            📤 Загрузить досье
          </button>
          <button 
            onClick={() => setActiveTab('pending')} 
            className="view-pending-btn" 
            data-testid="view-pending-btn"
            title="Просмотр досье от пользователей"
          >
            📋 Просмотр досье от пользователей
          </button>
          <button onClick={onLogout} className="logout-btn" data-testid="logout-btn">
            🚪 Выйти
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
          data-testid="users-tab"
        >
          Пользователи
        </button>
        <button
          className={`tab ${activeTab === 'objects' ? 'active' : ''}`}
          onClick={() => setActiveTab('objects')}
          data-testid="objects-tab"
        >
          SCP Объекты
        </button>
 <button
  className={`tab ${activeTab === 'dossiers' ? 'active' : ''}`}
  onClick={() => setActiveTab('dossiers')}
  data-testid="dossiers-tab"
>
  Досье на модерации
</button>
        <button
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
          data-testid="info-tab"
        >
          Информация
        </button>
      </div>

      {error && (
        <div className="admin-error" data-testid="error-message">
          {error}
        </div>
      )}

      <div className="admin-content">
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : (
          <>
            {activeTab === 'users' && (
              <div className="users-section">
                <h2>Управление пользователями</h2>
                <div className="users-list">
                  {users.map((user) => (
                    <div key={user.id} className="user-card" data-testid={`user-${user.id}`}>
                      <div className="user-info">
                        <h3>{user.username}</h3>
                        <p>ID: {user.id}</p>
                        <p className={`status ${user.is_active ? 'active' : 'inactive'}`}>
                          {user.is_active ? '🟢 Активен' : '🔴 Неактивен'}
                        </p>
                      </div>
                      
                      <div className="user-controls">
                        <div className="clearance-control">
                          <label>Уровень допуска:</label>
                          <select
                            value={user.clearance_level}
                            onChange={(e) => handleClearanceChange(user.id, parseInt(e.target.value))}
                            disabled={user.id === currentUser.id}
                            data-testid={`clearance-${user.id}`}
                          >
                            {[1, 2, 3, 4, 5].map((level) => (
                              <option key={level} value={level}>
                                {getClearanceName(level)}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <button
                          onClick={() => handleStatusToggle(user.id, user.is_active)}
                          disabled={user.id === currentUser.id}
                          className="toggle-status-btn"
                          data-testid={`toggle-status-${user.id}`}
                        >
                          {user.is_active ? 'Деактивировать' : 'Активировать'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'objects' && (
              <div className="objects-section">
                <h2>Управление SCP объектами</h2>
                <p className="section-note">Всего объектов: {objects.length}</p>
                
                <div className="objects-grid">
                  {objects.map((obj) => (
                    <div key={obj.number} className="object-card" data-testid={`object-${obj.number}`}>
                      <div className="object-header">
                        <h3>SCP-{obj.number}</h3>
                        <span className={`threat-badge threat-${obj.threat_class.toLowerCase()}`}>
                          {obj.threat_class}
                        </span>
                      </div>
                      
                      <h4>{obj.name}</h4>
                      <p className="codename">"{obj.codename}"</p>
                      
                      <p className="description">
                        {obj.description.substring(0, 150)}...
                      </p>
                      
                      <div className="object-actions">
                        <button 
                          onClick={() => handleEditObject(obj)}
                          className="edit-btn"
                          data-testid={`edit-${obj.number}`}
                        >
                          Редактировать
                        </button>
                        <button 
                          onClick={() => handleDownloadDossier(obj)}
                          className="download-btn"
                          data-testid={`download-${obj.number}`}
                        >
                          Скачать досье
                        </button>
                        <button 
                          onClick={() => handleDeleteObject(obj.number)}
                          className="delete-btn"
                          data-testid={`delete-${obj.number}`}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="info-section">
                <h2>Информация о системе</h2>
                
                <div className="info-card">
                  <h3>Уровни допуска</h3>
                  <ul className="clearance-info">
                    <li><strong>Уровень 1-2:</strong> Доступ к объектам класса "Угроза (Threat)"</li>
                    <li><strong>Уровень 3:</strong> Доступ к "Опасность (Hazard)" и "Катаклизм (Cataclysm)"</li>
                    <li><strong>Уровень 4:</strong> Доступ к "Крушение (Collapse)" и "Предел (Apex)"</li>
                    <li><strong>Уровень 5:</strong> Полный доступ ко всем объектам, секретным данным и админ-панели</li>
                  </ul>
                </div>

                <div className="info-card">
                  <h3>Классы угроз</h3>
                  <ul className="threat-info">
                    <li><span className="threat-badge threat-threat">Threat</span> - Угроза</li>
                    <li><span className="threat-badge threat-hazard">Hazard</span> - Опасность</li>
                    <li><span className="threat-badge threat-cataclysm">Cataclysm</span> - Катаклизм</li>
                    <li><span className="threat-badge threat-collapse">Collapse</span> - Крушение</li>
                    <li><span className="threat-badge threat-apex">Apex</span> - Предел</li>
                    <li><span className="threat-badge threat-absolute">Absolute</span> - Абсолют</li>
                    <li><span className="threat-badge threat-annihilation">Annihilation</span> - Аннигиляция</li>
                  </ul>
                </div>

                <div className="info-card">
                  <h3>MAL0 Ассистент</h3>
                  <p>MAL0 теперь работает в профессиональном режиме как ассистент базы данных.</p>
                  <p>Секретные команды и романтическое поведение удалены.</p>
                </div>
              </div>
            )}

            {activeTab === 'dossiers' && (
  <div className="dossiers-section">
    <h2>Досье на модерации</h2>
    <p className="section-note">Управление загруженными досье пользователей</p>
    
    {dossiers.length === 0 ? (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <p>Нет досье</p>
        <p className="empty-subtitle">Когда пользователи загрузят досье, они появятся здесь</p>
      </div>
    ) : (
      <div className="dossiers-list">
        {dossiers.map((dossier) => (
          <div 
            key={dossier.id} 
            className={`dossier-card status-${dossier.status}`}
          >
            <div className="dossier-header">
              <div className="dossier-user">
                <span className="user-icon">👤</span>
                <span className="user-name">{dossier.username}</span>
              </div>
              <div className={`dossier-status-badge status-${dossier.status}`}>
                {dossier.status === 'pending' && '⏳ На модерации'}
                {dossier.status === 'approved' && '✅ Одобрено'}
                {dossier.status === 'rejected' && '❌ Отклонено'}
              </div>
            </div>
            
            <div className="dossier-info">
              <div className="info-row">
                <span className="info-label">Файл:</span>
                <span className="info-value">{dossier.file_name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Размер:</span>
                <span className="info-value">
                  {(dossier.file_size / 1024).toFixed(2)} KB
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Отправлено:</span>
                <span className="info-value">
                  {new Date(dossier.submitted_at).toLocaleString('ru-RU')}
                </span>
              </div>
              {dossier.reviewed_at && (
                <div className="info-row">
                  <span className="info-label">Проверено:</span>
                  <span className="info-value">
                    {new Date(dossier.reviewed_at).toLocaleString('ru-RU')}
                  </span>
                </div>
              )}
              {dossier.reviewed_by && (
                <div className="info-row">
                  <span className="info-label">Проверил:</span>
                  <span className="info-value">{dossier.reviewed_by}</span>
                </div>
              )}
              {dossier.admin_comment && (
                <div className="info-row full-width">
                  <span className="info-label">Комментарий:</span>
                  <span className="info-value comment">{dossier.admin_comment}</span>
                </div>
              )}
            </div>
            
            <div className="dossier-actions">
              <button 
                className="view-btn"
                onClick={() => handleViewDossier(dossier.id)}
              >
                👁️ Просмотр
              </button>
              {dossier.status === 'pending' && (
                <>
                  <button 
                    className="approve-btn"
                    onClick={() => {
                      const comment = prompt('Комментарий (необязательно):');
                      if (comment !== null) {
                        handleModerateDossier(dossier.id, 'approved', comment);
                      }
                    }}
                  >
                    ✅ Одобрить
                  </button>
                  <button 
                    className="reject-btn"
                    onClick={() => {
                      const comment = prompt('Причина отклонения:');
                      if (comment) {
                        handleModerateDossier(dossier.id, 'rejected', comment);
                      }
                    }}
                  >
                    ❌ Отклонить
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
          </>
        )}
      </div>
{/* Dossier Viewer Modal */}
{viewingDossier && (
  <div className="modal-overlay" onClick={() => setViewingDossier(null)}>
    <div className="modal-content dossier-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>📄 Досье: {viewingDossier.file_name}</h2>
        <button className="modal-close" onClick={() => setViewingDossier(null)}>✕</button>
      </div>
      
      <div className="modal-body">
        <div className="dossier-details">
          <div className="detail-group">
            <label>Пользователь:</label>
            <p>{viewingDossier.username}</p>
          </div>
          <div className="detail-group">
            <label>Тип файла:</label>
            <p>{viewingDossier.file_type}</p>
          </div>
          <div className="detail-group">
            <label>Размер:</label>
            <p>{(viewingDossier.file_size / 1024).toFixed(2)} KB</p>
          </div>
          <div className="detail-group">
            <label>Дата загрузки:</label>
            <p>{new Date(viewingDossier.submitted_at).toLocaleString('ru-RU')}</p>
          </div>
        </div>

        <div className="file-preview">
          <label>Предпросмотр файла:</label>
          {viewingDossier.file_type.startsWith('image/') ? (
            <img 
              src={viewingDossier.file_data} 
              alt="Dossier preview" 
              className="preview-image"
            />
          ) : viewingDossier.file_type === 'application/pdf' ? (
            <div className="pdf-preview">
              <p>📄 PDF файл</p>
              <a 
                href={viewingDossier.file_data} 
                download={viewingDossier.file_name}
                className="download-link"
              >
                Скачать файл
              </a>
            </div>
          ) : (
            <div className="file-download">
              <p>📎 {viewingDossier.file_type}</p>
              <a 
                href={viewingDossier.file_data} 
                download={viewingDossier.file_name}
                className="download-link"
              >
                Скачать файл
              </a>
            </div>
          )}
        </div>

        {viewingDossier.status === 'pending' && (
          <div className="modal-actions">
            <button 
              className="approve-btn"
              onClick={() => {
                const comment = prompt('Комментарий (необязательно):');
                if (comment !== null) {
                  handleModerateDossier(viewingDossier.id, 'approved', comment);
                }
              }}
            >
              ✅ Одобрить
            </button>
            <button 
              className="reject-btn"
              onClick={() => {
                const comment = prompt('Причина отклонения:');
                if (comment) {
                  handleModerateDossier(viewingDossier.id, 'rejected', comment);
                }
              }}
            >
              ❌ Отклонить
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)}
      {/* Upload Dossier Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={handleCancelUpload}>
          <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📤 Загрузить новое досье</h2>
              <button className="modal-close" onClick={handleCancelUpload}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Номер объекта: <span className="required">*</span></label>
                <input
                  type="text"
                  value={uploadForm.number}
                  onChange={(e) => setUploadForm({...uploadForm, number: e.target.value})}
                  placeholder="0000"
                  data-testid="upload-number"
                />
              </div>

              <div className="form-group">
                <label>Название: <span className="required">*</span></label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                  placeholder="Название объекта"
                  data-testid="upload-name"
                />
              </div>

              <div className="form-group">
                <label>Кодовое имя: <span className="required">*</span></label>
                <input
                  type="text"
                  value={uploadForm.codename}
                  onChange={(e) => setUploadForm({...uploadForm, codename: e.target.value})}
                  placeholder="Кодовое имя"
                  data-testid="upload-codename"
                />
              </div>

              <div className="form-group">
                <label>Класс угрозы:</label>
                <select
                  value={uploadForm.threat_class}
                  onChange={(e) => setUploadForm({...uploadForm, threat_class: e.target.value})}
                  data-testid="upload-threat-class"
                >
                  <option value="Threat">Threat - Угроза</option>
                  <option value="Hazard">Hazard - Опасность</option>
                  <option value="Cataclysm">Cataclysm - Катаклизм</option>
                  <option value="Collapse">Collapse - Крушение</option>
                  <option value="Apex">Apex - Предел</option>
                  <option value="Absolute">Absolute - Абсолют</option>
                  <option value="Annihilation">Annihilation - Аннигиляция</option>
                </select>
              </div>

              <div className="form-group">
                <label>Описание:</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                  rows="6"
                  placeholder="Введите описание объекта или загрузите файл..."
                  data-testid="upload-description"
                />
              </div>

              <div className="form-group">
                <label>Загрузить файл .doc/.docx:</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    accept=".doc,.docx"
                    onChange={handleFileUpload}
                    id="file-upload"
                    style={{ display: 'none' }}
                    data-testid="upload-file-input"
                  />
                  <label htmlFor="file-upload" className="file-upload-button">
                    📎 Выбрать файл
                  </label>
                  {uploadFile && (
                    <span className="file-name">✓ {uploadFile.name}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Процедуры содержания:</label>
                <textarea
                  value={uploadForm.special_procedures}
                  onChange={(e) => setUploadForm({...uploadForm, special_procedures: e.target.value})}
                  rows="4"
                  placeholder="Специальные процедуры содержания"
                  data-testid="upload-procedures"
                />
              </div>

              <div className="form-group">
                <label>Секретная информация (Уровень 5):</label>
                <textarea
                  value={uploadForm.secret_data}
                  onChange={(e) => setUploadForm({...uploadForm, secret_data: e.target.value})}
                  rows="3"
                  placeholder="Секретные данные (только для уровня допуска 5)"
                  data-testid="upload-secret"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelUpload} data-testid="upload-cancel">
                Отмена
              </button>
              <button className="btn-save" onClick={handleUploadDossier} data-testid="upload-submit">
                Загрузить досье
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingObject && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Редактировать SCP-{editingObject.number}</h2>
              <button className="modal-close" onClick={handleCancelEdit}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Название:</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Кодовое имя:</label>
                <input
                  type="text"
                  value={editForm.codename}
                  onChange={(e) => setEditForm({...editForm, codename: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Класс угрозы:</label>
                <select
                  value={editForm.threat_class}
                  onChange={(e) => setEditForm({...editForm, threat_class: e.target.value})}
                >
                  <option value="Threat">Threat - Угроза</option>
                  <option value="Hazard">Hazard - Опасность</option>
                  <option value="Cataclysm">Cataclysm - Катаклизм</option>
                  <option value="Collapse">Collapse - Крушение</option>
                  <option value="Apex">Apex - Предел</option>
                  <option value="Absolute">Absolute - Абсолют</option>
                  <option value="Annihilation">Annihilation - Аннигиляция</option>
                </select>
              </div>

              <div className="form-group">
                <label>Описание:</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label>Процедуры содержания:</label>
                <textarea
                  value={editForm.special_procedures}
                  onChange={(e) => setEditForm({...editForm, special_procedures: e.target.value})}
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label>Секретная информация (Уровень 5):</label>
                <textarea
                  value={editForm.secret_data}
                  onChange={(e) => setEditForm({...editForm, secret_data: e.target.value})}
                  rows="3"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelEdit}>
                Отмена
              </button>
              <button className="btn-save" onClick={handleSaveEdit}>
                Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
