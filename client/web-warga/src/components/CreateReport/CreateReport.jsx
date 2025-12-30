import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../services/reportService';
import { useNotificationStore } from '../../store/notificationStore';
import Button from '../Button';
import Input from '../Input';
import Card from '../Card';
import './CreateReport.css';

const CreateReport = ({ onSuccess }) => {
  const navigate = useNavigate();
  const addNotification = useNotificationStore((state) => state.addNotification);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    privacy: 'public', // public, private, anonymous
  });
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const categories = [
    'Sampah',
    'Jalan Rusak',
    'Drainase',
    'Fasilitas Umum',
    'Lampu Jalan',
    'Polusi',
    'Traffic & Transport',
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, image: 'Ukuran gambar maksimal 5MB' }));
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({ ...prev, image: 'File harus berupa gambar' }));
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      if (errors.image) {
        setErrors((prev) => ({ ...prev, image: '' }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Judul wajib diisi';
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Judul minimal 5 karakter';
    } else if (formData.title.trim().length > 150) {
      newErrors.title = 'Judul maksimal 150 karakter';
    }
    
    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = 'Deskripsi wajib diisi';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Deskripsi minimal 10 karakter';
    } else if (formData.description.trim().length > 2000) {
      newErrors.description = 'Deskripsi maksimal 2000 karakter';
    }
    
    // Category validation
    if (!formData.category) {
      newErrors.category = 'Kategori wajib dipilih';
    }
    
    // Location validation
    if (!formData.location.trim()) {
      newErrors.location = 'Lokasi wajib diisi';
    } else if (formData.location.trim().length < 3) {
      newErrors.location = 'Lokasi minimal 3 karakter';
    } else if (formData.location.trim().length > 100) {
      newErrors.location = 'Lokasi maksimal 100 karakter';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      let imageUrl = null;
      
      // Upload image first if selected
      if (selectedImage) {
        const uploadResult = await reportService.uploadImage(selectedImage);
        imageUrl = uploadResult.data.url;
      }
      
      // Create report with privacy metadata
      const reportData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        location: formData.location,
        imageUrl: imageUrl,
        privacy: formData.privacy, // "public", "private", "anonymous"
      };
      
      await reportService.createReport(reportData);
      
      addNotification({
        type: 'success',
        title: 'Laporan Berhasil Dibuat',
        message: 'Laporan Anda telah berhasil dikirim',
      });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: '',
        location: '',
        privacy: 'public',
      });
      setSelectedImage(null);
      setImagePreview(null);
      
      if (onSuccess) {
        onSuccess();
      } else {
        // Redirect to feed to see the new report
        navigate('/feed');
      }
    } catch (error) {
      console.error('Error creating report:', error);
      addNotification({
        type: 'error',
        title: 'Gagal Membuat Laporan',
        message: error.response?.data?.message || 'Terjadi kesalahan saat membuat laporan',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="create-report">
      <h2 className="create-report__title">Buat Laporan Baru</h2>
      
      <form onSubmit={handleSubmit} className="create-report__form">
        <Input
          label="Judul Laporan"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Contoh: Jalan Berlubang di Jl. Sudirman"
          error={errors.title}
          required
        />
        
        <div className="input-wrapper">
          <label htmlFor="description" className="input-label">
            Deskripsi Laporan<span className="input-required">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Jelaskan detail masalah yang Anda laporkan..."
            className={`create-report__textarea ${errors.description ? 'input-field--error' : ''}`}
            rows="5"
            required
          />
          {errors.description && <span className="input-error">{errors.description}</span>}
        </div>
        
        <div className="input-wrapper">
          <label htmlFor="category" className="input-label">
            Kategori<span className="input-required">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={`create-report__select ${errors.category ? 'input-field--error' : ''}`}
            required
          >
            <option value="">Pilih Kategori</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.category && <span className="input-error">{errors.category}</span>}
        </div>
        
        <Input
          label="Lokasi"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="Contoh: Jl. Sudirman No. 123, Jakarta Pusat"
          error={errors.location}
          required
        />
        
        {/* Privacy Toggle - Critical Feature */}
        <div className="create-report__privacy">
          <label className="input-label">Privasi Laporan</label>
          <div className="privacy-options">
            <label className={`privacy-option ${formData.privacy === 'public' ? 'privacy-option--active' : ''}`}>
              <input
                type="radio"
                name="privacy"
                value="public"
                checked={formData.privacy === 'public'}
                onChange={handleChange}
              />
              <div className="privacy-option__content">
                <div className="privacy-option__icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <div>
                  <div className="privacy-option__title">Publik</div>
                  <div className="privacy-option__desc">Ditampilkan di feed publik dengan identitas Anda</div>
                </div>
              </div>
            </label>
            
            <label className={`privacy-option ${formData.privacy === 'private' ? 'privacy-option--active' : ''}`}>
              <input
                type="radio"
                name="privacy"
                value="private"
                checked={formData.privacy === 'private'}
                onChange={handleChange}
              />
              <div className="privacy-option__content">
                <div className="privacy-option__icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <div className="privacy-option__title">Privat</div>
                  <div className="privacy-option__desc">Hanya Anda dan dinas terkait yang bisa melihat</div>
                </div>
              </div>
            </label>
            
            <label className={`privacy-option ${formData.privacy === 'anonymous' ? 'privacy-option--active' : ''}`}>
              <input
                type="radio"
                name="privacy"
                value="anonymous"
                checked={formData.privacy === 'anonymous'}
                onChange={handleChange}
              />
              <div className="privacy-option__content">
                <div className="privacy-option__icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                    <path d="M2 2l20 20" />
                  </svg>
                </div>
                <div>
                  <div className="privacy-option__title">Anonim</div>
                  <div className="privacy-option__desc">Identitas Anda disembunyikan dari publik</div>
                </div>
              </div>
            </label>
          </div>
        </div>
        
        {/* Image Upload */}
        <div className="create-report__image-upload">
          <label className="input-label">Foto (Opsional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="create-report__file-input"
            id="image-upload"
          />
          <label htmlFor="image-upload" className="create-report__file-label">
            {imagePreview ? 'Ganti Foto' : 'Pilih Foto'}
          </label>
          {errors.image && <span className="input-error">{errors.image}</span>}
          
          {imagePreview && (
            <div className="create-report__image-preview">
              <img src={imagePreview} alt="Preview" />
              <button
                type="button"
                className="create-report__remove-image"
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
        
        <div className="create-report__actions">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            disabled={loading}
          >
            Kirim Laporan
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default CreateReport;
