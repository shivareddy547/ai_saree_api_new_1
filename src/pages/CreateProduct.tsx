import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProductDetails from '../components/ProductDetails';
import ImageUpload from '../components/ImageUpload';
import VideoConfiguration from '../components/VideoConfiguration';
import PostToInstagram from '../components/PostToInstagram';
import { ArrowLeft, Save } from 'lucide-react';
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
interface Variant {
  id: string;
  sku: string;
  size: string;
  color: string;
  price: string;
  costPrice: string;
  stockQuantity: string;
}
interface Category {
  id: string;
  name: string;
  subcategories: Subcategory[];
}
interface Subcategory {
  id: string;
  name: string;
}
const CreateProduct: React.FC = () => {
  const navigate = useNavigate();
  // Product details state
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  // Category state
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);
  const [showAddSubcategory, setShowAddSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [newSubcategoryError, setNewSubcategoryError] = useState<string | null>(null);
  // Variants state
  const [variants, setVariants] = useState<Variant[]>([
    {
      id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sku: '',
      size: '',
      color: '',
      price: '',
      costPrice: '',
      stockQuantity: '',
    }
  ]);
  // Flags
  const [showInFeaturedProducts, setShowInFeaturedProducts] = useState(false);
  const [showInBestSellers, setShowInBestSellers] = useState(false);
  const [showInNewArrivals, setShowInNewArrivals] = useState(false);
  const [showInPremiumProducts, setShowInPremiumProducts] = useState(false);
  // Image state
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [imageKitUrls, setImageKitUrls] = useState<string[]>([]);
  const [imageUploadingStates, setImageUploadingStates] = useState<boolean[]>([]);
  const [imageUploadErrors, setImageUploadErrors] = useState<string[]>([]);
  const [activeImageTab, setActiveImageTab] = useState<'upload' | 'unsplash'>('upload');
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [unsplashResults, setUnsplashResults] = useState<any[]>([]);
  const [isSearchingUnsplash, setIsSearchingUnsplash] = useState(false);
  const [unsplashError, setUnsplashError] = useState<string | null>(null);
  const [downloadingUnsplashIds, setDownloadingUnsplashIds] = useState<Set<string>>(new Set());
  // Video configuration state
  const [audioMode, setAudioMode] = useState<'text' | 'upload' | 'record'>('text');
  const [audioScript, setAudioScript] = useState('');
  const [audioLanguage, setAudioLanguage] = useState<'en' | 'te' | 'hi'>('en');
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [videoLength, setVideoLength] = useState(15);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  // Video result
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [cloudinaryPublicId, setCloudinaryPublicId] = useState<string | null>(null);
  const [cloudinaryUploadStatus, setCloudinaryUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [cloudinaryUploadProgress, setCloudinaryUploadProgress] = useState(0);
  const [cloudinaryUploadMessage, setCloudinaryUploadMessage] = useState('');
  // Posting state
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isUpdatingOnly, setIsUpdatingOnly] = useState(false);
  const [updateOnlyError, setUpdateOnlyError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  // Step state (assuming steps exist)
  const [currentStep, setCurrentStep] = useState(1);
  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await axios.get(`${API_BASE}/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCategories(response.data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);
  // Helper for adding category
  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) {
      setNewCategoryError('Category name is required');
      return;
    }
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${API_BASE}/categories`,
        { name: newCategoryName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newCategory = response.data;
      setCategories([...categories, { ...newCategory, subcategories: [] }]);
      setSelectedCategoryId(newCategory.id);
      setShowAddCategory(false);
      setNewCategoryName('');
      setNewCategoryError(null);
    } catch (error: any) {
      setNewCategoryError(error.response?.data?.message || 'Failed to create category');
    }
  };
  const handleCancelAddCategory = () => {
    setShowAddCategory(false);
    setNewCategoryName('');
    setNewCategoryError(null);
  };
  // Helper for adding subcategory
  const handleAddNewSubcategory = async () => {
    if (!newSubcategoryName.trim()) {
      setNewSubcategoryError('Subcategory name is required');
      return;
    }
    if (!selectedCategoryId) {
      setNewSubcategoryError('Please select a category first');
      return;
    }
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${API_BASE}/categories/${selectedCategoryId}/subcategories`,
        { name: newSubcategoryName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newSub = response.data;
      setCategories(prev => prev.map(cat => {
        if (cat.id === selectedCategoryId) {
          return { ...cat, subcategories: [...cat.subcategories, newSub] };
        }
        return cat;
      }));
      setSelectedSubcategoryId(newSub.id);
      setShowAddSubcategory(false);
      setNewSubcategoryName('');
      setNewSubcategoryError(null);
    } catch (error: any) {
      setNewSubcategoryError(error.response?.data?.message || 'Failed to create subcategory');
    }
  };
  const handleCancelAddSubcategory = () => {
    setShowAddSubcategory(false);
    setNewSubcategoryName('');
    setNewSubcategoryError(null);
  };
  const handleCategoryChange = (categoryId: string) => {
    if (categoryId === '__add_new__') {
      setShowAddCategory(true);
      setSelectedCategoryId('');
      return;
    }
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId('');
  };
  const handleSubcategoryChange = (subcategoryId: string) => {
    if (subcategoryId === '__add_new__') {
      setShowAddSubcategory(true);
      setSelectedSubcategoryId('');
      return;
    }
    setSelectedSubcategoryId(subcategoryId);
  };
  // Variant handlers
  const handleAddVariant = () => {
    setVariants([...variants, {
      id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sku: '',
      size: '',
      color: '',
      price: '',
      costPrice: '',
      stockQuantity: '',
    }]);
  };
  const handleRemoveVariant = (id: string) => {
    if (variants.length <= 1) return;
    setVariants(variants.filter(v => v.id !== id));
  };
  const handleVariantChange = (id: string, field: keyof Omit<Variant, 'id'>, value: string) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };
  const handleFillAllVariantsPrice = () => {
    const basePrice = parseFloat(price) || 0;
    setVariants(variants.map(v => ({
      ...v,
      price: v.price || basePrice.toString(),
    })));
  };
  // Image handlers (stubs)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Implement image upload logic if needed
  };
  const removeImage = (index: number) => {
    // Implement remove
  };
  const handleUploadToImageKit = (index: number) => {
    // Implement upload
  };
  const handleUnsplashSearch = () => {
    // Implement search
  };
  const handleDownloadUnsplash = (photo: any) => {
    // Implement download
  };
  // Video handlers (stubs)
  const handlePreviewTTS = () => {
    // Implement TTS preview
  };
  const startRecording = () => {
    // Implement recording
  };
  const stopRecording = () => {
    // Implement stop
  };
  const handleGenerateVideo = () => {
    // Implement video generation
  };
  // Save product
  const saveProduct = async (publishAfterSave = false) => {
    setCreateError(null);
    setUpdateOnlyError(null);
    // Validate required fields
    const newErrors: { [key: string]: string } = {};
    if (!productName.trim()) newErrors.productName = 'Product name is required';
    if (!price || parseFloat(price) <= 0) newErrors.price = 'Valid price is required';
    if (!selectedCategoryId) newErrors.category = 'Category is required';
    if (!selectedSubcategoryId) newErrors.subcategory = 'Subcategory is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    const payload: any = {
      name: productName,
      price: parseFloat(price),
      costPrice: costPrice ? parseFloat(costPrice) : null,
      stockQuantity: stockQuantity ? parseInt(stockQuantity, 10) : 0,
      sku: sku || undefined,
      description,
      categoryId: parseInt(selectedCategoryId, 10),
      subcategoryId: parseInt(selectedSubcategoryId, 10),
      showInFeaturedProducts,
      showInBestSellers,
      showInNewArrivals,
      showInPremiumProducts,
      variants: variants.map(v => ({
        sku: v.sku,
        size: v.size,
        color: v.color,
        price: parseFloat(v.price) || 0,
        costPrice: v.costPrice ? parseFloat(v.costPrice) : null,
        stockQuantity: v.stockQuantity ? parseInt(v.stockQuantity, 10) : 0,
      })),
      images: imageKitUrls.filter(Boolean),
      videoUrl,
      cloudinaryVideoPublicId: cloudinaryPublicId,
      audioMode,
      audioScript,
      audioLanguage,
      voiceGender,
      videoLength,
      customAudioUrl,
      recordedAudioUrl,
    };
    try {
      setIsPosting(true);
      const token = localStorage.getItem('authToken');
      const url = productId ? `${API_BASE}/products/${productId}` : `${API_BASE}/products`;
      const method = productId ? 'put' : 'post';
      const response = await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const product = response.data.data;
        setProductId(product.id);
        if (!publishAfterSave) {
          setPostSuccess(true);
        }
        // If we have video and want to publish, call publish
        if (publishAfterSave && cloudinaryPublicId) {
          // Publish logic handled in PostToInstagram component
        }
      } else {
        setCreateError(response.data.error || 'Failed to save product');
      }
    } catch (error: any) {
      setCreateError(error.response?.data?.error || error.message || 'Failed to save product');
    } finally {
      setIsPosting(false);
    }
  };
  const handlePostToInstagram = () => {
    // This is called from PostToInstagram to save and then post
    saveProduct(true);
  };
  const handleUpdateOnly = async () => {
    setIsUpdatingOnly(true);
    setUpdateOnlyError(null);
    await saveProduct(false);
    setIsUpdatingOnly(false);
  };
  const resetAllState = () => {
    // Reset all state to initial
    setProductName('');
    setPrice('');
    setCostPrice('');
    setStockQuantity('');
    setSku('');
    setDescription('');
    setSelectedCategoryId('');
    setSelectedSubcategoryId('');
    setShowInFeaturedProducts(false);
    setShowInBestSellers(false);
    setShowInNewArrivals(false);
    setShowInPremiumProducts(false);
    setVariants([{
      id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sku: '',
      size: '',
      color: '',
      price: '',
      costPrice: '',
      stockQuantity: '',
    }]);
    setImages([]);
    setPreviews([]);
    setImageKitUrls([]);
    setVideoUrl(null);
    setCloudinaryPublicId(null);
    setCloudinaryUploadStatus('idle');
    setPostSuccess(false);
    setProductId(null);
    setCreateError(null);
    setCurrentStep(1);
  };
  const goBack = () => {
    navigate(-1);
  };
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={goBack} className="text-gray-600 hover:text-gray-800">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-slate-800">Create New Product</h1>
      </div>
      {!postSuccess ? (
        <div className="space-y-8">
          {currentStep === 1 && (
            <ProductDetails
              productName={productName}
              setProductName={setProductName}
              price={price}
              setPrice={setPrice}
              costPrice={costPrice}
              setCostPrice={setCostPrice}
              stockQuantity={stockQuantity}
              setStockQuantity={setStockQuantity}
              sku={sku}
              setSku={setSku}
              description={description}
              setDescription={setDescription}
              errors={errors}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              setSelectedCategoryId={setSelectedCategoryId}
              selectedSubcategoryId={selectedSubcategoryId}
              setSelectedSubcategoryId={setSelectedSubcategoryId}
              showAddCategory={showAddCategory}
              setShowAddCategory={setShowAddCategory}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              newCategoryError={newCategoryError}
              setNewCategoryError={setNewCategoryError}
              showAddSubcategory={showAddSubcategory}
              setShowAddSubcategory={setShowAddSubcategory}
              newSubcategoryName={newSubcategoryName}
              setNewSubcategoryName={setNewSubcategoryName}
              newSubcategoryError={newSubcategoryError}
              setNewSubcategoryError={setNewSubcategoryError}
              variants={variants}
              setVariants={setVariants}
              handleAddVariant={handleAddVariant}
              handleRemoveVariant={handleRemoveVariant}
              handleVariantChange={handleVariantChange}
              handleFillAllVariantsPrice={handleFillAllVariantsPrice}
              handleAddNewCategory={handleAddNewCategory}
              handleCancelAddCategory={handleCancelAddCategory}
              handleAddNewSubcategory={handleAddNewSubcategory}
              handleCancelAddSubcategory={handleCancelAddSubcategory}
              handleCategoryChange={handleCategoryChange}
              handleSubcategoryChange={handleSubcategoryChange}
              showInFeaturedProducts={showInFeaturedProducts}
              setShowInFeaturedProducts={setShowInFeaturedProducts}
              showInBestSellers={showInBestSellers}
              setShowInBestSellers={setShowInBestSellers}
              showInNewArrivals={showInNewArrivals}
              setShowInNewArrivals={setShowInNewArrivals}
              showInPremiumProducts={showInPremiumProducts}
              setShowInPremiumProducts={setShowInPremiumProducts}
            />
          )}
          {currentStep === 2 && (
            <ImageUpload
              images={images}
              previews={previews}
              imageKitUrls={imageKitUrls}
              imageUploadingStates={imageUploadingStates}
              imageUploadErrors={imageUploadErrors}
              activeImageTab={activeImageTab}
              setActiveImageTab={setActiveImageTab}
              unsplashQuery={unsplashQuery}
              setUnsplashQuery={setUnsplashQuery}
              unsplashResults={unsplashResults}
              isSearchingUnsplash={isSearchingUnsplash}
              unsplashError={unsplashError}
              downloadingUnsplashIds={downloadingUnsplashIds}
              handleImageUpload={handleImageUpload}
              removeImage={removeImage}
              handleUploadToImageKit={handleUploadToImageKit}
              handleUnsplashSearch={handleUnsplashSearch}
              handleDownloadUnsplash={handleDownloadUnsplash}
            />
          )}
          {currentStep === 3 && (
            <VideoConfiguration
              audioMode={audioMode}
              setAudioMode={setAudioMode}
              audioScript={audioScript}
              setAudioScript={setAudioScript}
              audioLanguage={audioLanguage}
              setAudioLanguage={setAudioLanguage}
              voiceGender={voiceGender}
              setVoiceGender={setVoiceGender}
              customAudioFile={customAudioFile}
              setCustomAudioFile={setCustomAudioFile}
              customAudioUrl={customAudioUrl}
              setCustomAudioUrl={setCustomAudioUrl}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              recordedAudioBlob={recordedAudioBlob}
              setRecordedAudioBlob={setRecordedAudioBlob}
              recordedAudioUrl={recordedAudioUrl}
              setRecordedAudioUrl={setRecordedAudioUrl}
              recordingError={recordingError}
              videoLength={videoLength}
              setVideoLength={setVideoLength}
              isGenerating={isGenerating}
              generationProgress={generationProgress}
              generationMessage={generationMessage}
              generationError={generationError}
              imagesLength={previews.length + imageKitUrls.filter(Boolean).length}
              audioGenerating={audioGenerating}
              audioError={audioError}
              handlePreviewTTS={handlePreviewTTS}
              handleGenerateVideo={handleGenerateVideo}
              startRecording={startRecording}
              stopRecording={stopRecording}
              existingVideoUrl={videoUrl}
              cloudinaryUploadStatus={cloudinaryUploadStatus}
              cloudinaryUploadProgress={cloudinaryUploadProgress}
              cloudinaryUploadMessage={cloudinaryUploadMessage}
              cloudinaryPublicId={cloudinaryPublicId}
            />
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={resetAllState}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              onClick={() => saveProduct(false)}
              disabled={isPosting}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={18} />
              {isPosting ? 'Saving...' : 'Save Product'}
            </button>
          </div>
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {createError}
            </div>
          )}
        </div>
      ) : (
        <PostToInstagram
          isPosting={isPosting}
          postSuccess={postSuccess}
          createError={createError}
          productName={productName}
          price={price}
          description={description}
          handlePostToInstagram={handlePostToInstagram}
          resetAllState={resetAllState}
          isEditMode={!!productId}
          videoUrl={videoUrl}
          cloudinaryPublicId={cloudinaryPublicId}
          onUpdateProductOnly={handleUpdateOnly}
          isUpdatingOnly={isUpdatingOnly}
          updateOnlyError={updateOnlyError}
          onBack={goBack}
          productId={productId}
        />
      )}
    </div>
  );
};
export default CreateProduct;
