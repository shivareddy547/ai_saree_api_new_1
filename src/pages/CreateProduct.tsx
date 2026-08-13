import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Edit,
} from "lucide-react";
import { uploadToImageKit } from "../utils/imageKitUpload";
import { uploadToCloudinary, getCloudinaryVideoUrl } from "../utils/cloudinaryUpload";
import ProductDetails from "../components/ProductDetails";
import ImageUpload from "../components/ImageUpload";
import VideoConfiguration from "../components/VideoConfiguration";
import VideoPreviewComponent from "../components/VideoPreview";
import PostToInstagram from "../components/PostToInstagram";
import ImageLightbox from "../components/ImageLightbox";
import VideoEditor from "../components/VideoEditor";
const API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:3000/api";
const UNSPLASH_ACCESS_KEY =
  "bzBups-AqyogXRdO5QpQxSkcu9peuTSc8yZXGMGcGPs";
// Create axios instance with auth header
const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});
// Add token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
const steps = [
  { id: 1, label: "Product Details" },
  { id: 2, label: "Upload Images" },
  { id: 3, label: "Video Configuration" },
  { id: 4, label: "Preview" },
  { id: 5, label: "Post to Instagram" },
];
interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  price: string;
  costPrice: string;
  stockQuantity: string;
}
interface Subcategory {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  subcategories: Subcategory[];
}
interface UserVoice {
  id: number;
  name: string;
  sampleAudioUrl: string | null;
  createdAt: string;
}
const createEmptyVariant = (): ProductVariant => ({
  id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sku: "",
  size: "",
  color: "",
  price: "",
  costPrice: "",
  stockQuantity: "",
});
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const length = buffer.length;
  const dataLength = length * numChannels * (bitDepth / 8);
  const headerLength = 44;
  const totalLength = headerLength + dataLength;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);
  const writeString = (
    v: DataView,
    offset: number,
    s: string
  ) => {
    for (let i = 0; i < s.length; i++) {
      v.setUint8(offset + i, s.charCodeAt(i));
    }
  };
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * numChannels * (bitDepth / 8),
    true
  );
  view.setUint16(
    32,
    numChannels * (bitDepth / 8),
    true
  );
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(
        -1,
        Math.min(1, channels[c][i])
      );
      sample =
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], {
    type: "audio/wav",
  });
};
const generateFallbackAudio = (
  duration: number = 5,
  frequency: number = 440
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const sampleRate = 44100;
      const numSamples = sampleRate * duration;
      const audioCtx = new AudioContext();
      const buffer = audioCtx.createBuffer(
        1,
        numSamples,
        sampleRate
      );
      const channelData =
        buffer.getChannelData(0);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        channelData[i] =
          Math.sin(
            2 * Math.PI * frequency * t
          ) * 0.5;
      }
      const wavBlob =
        audioBufferToWav(buffer);
      audioCtx.close();
      resolve(wavBlob);
    } catch (e) {
      reject(e);
    }
  });
};
const pitchShiftBlob = async (
  blob: Blob,
  ratio: number
): Promise<Blob> => {
  const audioCtx = new AudioContext();
  const arrayBuffer =
    await blob.arrayBuffer();
  const sourceBuffer =
    await audioCtx.decodeAudioData(
      arrayBuffer
    );
  const offlineLength = Math.ceil(
    sourceBuffer.length / ratio
  );
  const offlineCtx =
    new OfflineAudioContext(
      sourceBuffer.numberOfChannels,
      offlineLength,
      sourceBuffer.sampleRate
    );
  const bufferSource =
    offlineCtx.createBufferSource();
  bufferSource.buffer = sourceBuffer;
  bufferSource.playbackRate.value = ratio;
  bufferSource.connect(
    offlineCtx.destination
  );
  bufferSource.start();
  const rendered =
    await offlineCtx.startRendering();
  audioCtx.close();
  return audioBufferToWav(rendered);
};
const loopAudioToDuration = async (
  blob: Blob,
  targetDurationSec: number
): Promise<Blob> => {
  const audioCtx = new AudioContext();
  const arrayBuffer =
    await blob.arrayBuffer();
  const source =
    await audioCtx.decodeAudioData(
      arrayBuffer
    );
  const srcDuration =
    source.length / source.sampleRate;
  if (srcDuration >= targetDurationSec) {
    audioCtx.close();
    return blob;
  }
  const totalSamples = Math.round(
    targetDurationSec *
      source.sampleRate
  );
  const offlineCtx =
    new OfflineAudioContext(
      source.numberOfChannels,
      totalSamples,
      source.sampleRate
    );
  const channelData: Float32Array[] = [];
  for (
    let c = 0;
    c < source.numberOfChannels;
    c++
  ) {
    channelData.push(
      source.getChannelData(c)
    );
  }
  const destBuffer =
    offlineCtx.createBuffer(
      source.numberOfChannels,
      totalSamples,
      source.sampleRate
    );
  for (
    let c = 0;
    c < source.numberOfChannels;
    c++
  ) {
    const destData =
      destBuffer.getChannelData(c);
    for (
      let i = 0;
      i < totalSamples;
      i++
    ) {
      const srcIdx =
        i % source.length;
      destData[i] =
        channelData[c][srcIdx];
    }
  }
  const bufferSource =
    offlineCtx.createBufferSource();
  bufferSource.buffer = destBuffer;
  bufferSource.connect(
    offlineCtx.destination
  );
  bufferSource.start();
  const rendered =
    await offlineCtx.startRendering();
  audioCtx.close();
  return audioBufferToWav(rendered);
};
const CreateProduct: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const sessionExpiry = localStorage.getItem('sessionExpiry');
    if (!token || !sessionExpiry) {
      navigate('/login');
      return;
    }
    const expiryTime = parseInt(sessionExpiry, 10);
    if (Date.now() >= expiryTime) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('sessionExpiry');
      localStorage.removeItem('sessionId');
      navigate('/login');
      return;
    }
  }, [navigate]);
  const editId =
    searchParams.get("edit");
  const isEditMode =
    !!editId;
  const [currentStep, setCurrentStep] =
    useState(1);
  const [productName, setProductName] =
    useState("");
  const [price, setPrice] =
    useState("");
  const [costPrice, setCostPrice] =
    useState("");
  const [stockQuantity, setStockQuantity] =
    useState("");
  const [sku, setSku] =
    useState("");
  const [description, setDescription] =
    useState("");
  const [errors, setErrors] =
    useState<{
      [key: string]: string;
    }>({});
  // Categories state
  const [categories, setCategories] =
    useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [
    selectedCategoryId,
    setSelectedCategoryId,
  ] = useState("");
  const [
    selectedSubcategoryId,
    setSelectedSubcategoryId,
  ] = useState("");
  const [
    showAddCategory,
    setShowAddCategory,
  ] = useState(false);
  const [
    newCategoryName,
    setNewCategoryName,
  ] = useState("");
  const [
    newCategoryError,
    setNewCategoryError,
  ] = useState<string | null>(null);
  const [
    showAddSubcategory,
    setShowAddSubcategory,
  ] = useState(false);
  const [
    newSubcategoryName,
    setNewSubcategoryName,
  ] = useState("");
  const [
    newSubcategoryError,
    setNewSubcategoryError,
  ] = useState<string | null>(null);
  // New flag states
  const [showInFeaturedProducts, setShowInFeaturedProducts] = useState(false);
  const [showInBestSellers, setShowInBestSellers] = useState(false);
  const [showInNewArrivals, setShowInNewArrivals] = useState(false);
  const [showInPremiumProducts, setShowInPremiumProducts] = useState(false);
  // Fetch categories from API
  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const response = await apiClient.get('/categories');
      const cats = response.data.map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        subcategories: (cat.subCategories || []).map((sub: any) => ({
          id: String(sub.id),
          name: sub.name,
        })),
      }));
      setCategories(cats);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
      setCategoriesError(err.response?.data?.message || 'Failed to load categories');
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);
  const [
    variants,
    setVariants,
  ] = useState<ProductVariant[]>([
    createEmptyVariant(),
  ]);
  const [images, setImages] =
    useState<File[]>([]);
  const [previews, setPreviews] =
    useState<string[]>([]);
  const [imageKitUrls, setImageKitUrls] =
    useState<string[]>([]);
  const [
    imageUploadingStates,
    setImageUploadingStates,
  ] = useState<boolean[]>([]);
  const [
    imageUploadErrors,
    setImageUploadErrors,
  ] = useState<string[]>([]);
  const fileInputRef =
    useRef<HTMLInputElement>(null);
  const [
    activeImageTab,
    setActiveImageTab,
  ] = useState<
    "upload" | "unsplash"
  >("upload");
  const [
    unsplashQuery,
    setUnsplashQuery,
  ] = useState("");
  const [
    unsplashResults,
    setUnsplashResults,
  ] = useState<any[]>([]);
  const [
    isSearchingUnsplash,
    setIsSearchingUnsplash,
  ] = useState(false);
  const [
    unsplashError,
    setUnsplashError,
  ] = useState<string | null>(null);
  const [
    downloadingUnsplashIds,
    setDownloadingUnsplashIds,
  ] = useState<Set<string>>(
    new Set()
  );
  const [
    showConfig,
    setShowConfig,
  ] = useState(true);
  const [
    audioMode,
    setAudioMode,
  ] = useState<
    "text" | "upload" | "record" | "clone"
  >("text");
  const [
    audioScript,
    setAudioScript,
  ] = useState("");
  const [
    audioLanguage,
    setAudioLanguage,
  ] = useState<
    "en" | "te" | "hi"
  >("en");
  const [
    voiceGender,
    setVoiceGender,
  ] = useState<
    "female" | "male"
  >("female");
  const [
    customAudioFile,
    setCustomAudioFile,
  ] = useState<File | null>(null);
  const [
    customAudioUrl,
    setCustomAudioUrl,
  ] = useState<string | null>(null);
  const [
    ttsPreviewUrl,
    setTtsPreviewUrl,
  ] = useState<string | null>(null);
  const [
    isRecording,
    setIsRecording,
  ] = useState(false);
  const [
    recordedAudioBlob,
    setRecordedAudioBlob,
  ] = useState<Blob | null>(null);
  const [
    recordedAudioUrl,
    setRecordedAudioUrl,
  ] = useState<string | null>(null);
  const [
    recordingError,
    setRecordingError,
  ] = useState<string | null>(null);
  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);
  const audioChunksRef =
    useRef<Blob[]>([]);
  const [
    videoLength,
    setVideoLength,
  ] = useState(30);
  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);
  const [
    generationProgress,
    setGenerationProgress,
  ] = useState(0);
  const [
    generationMessage,
    setGenerationMessage,
  ] = useState("");
  const [
    videoUrl,
    setVideoUrl,
  ] = useState<string | null>(null);
  const [
    videoKitUrl,
    setVideoKitUrl,
  ] = useState<string | null>(null);
  const [
    generationError,
    setGenerationError,
  ] = useState<string | null>(null);
  const [
    videoUploadProgress,
    setVideoUploadProgress,
  ] = useState(false);
  const [
    audioGenerating,
    setAudioGenerating,
  ] = useState(false);
  const [
    audioError,
    setAudioError,
  ] = useState<string | null>(null);
  const [
    isPosting,
    setIsPosting,
  ] = useState(false);
  const [
    postSuccess,
    setPostSuccess,
  ] = useState(false);
  const [
    createError,
    setCreateError,
  ] = useState<string | null>(null);
  const [
    isLoadingProduct,
    setIsLoadingProduct,
  ] = useState(false);
  const [
    existingVideoUrl,
    setExistingVideoUrl,
  ] = useState<string | null>(null);
  const [
    isUploadingImages,
    setIsUploadingImages,
  ] = useState(false);
  // Cloudinary upload states
  const [
    cloudinaryUploadStatus,
    setCloudinaryUploadStatus,
  ] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [
    cloudinaryUploadProgress,
    setCloudinaryUploadProgress,
  ] = useState(0);
  const [
    cloudinaryUploadMessage,
    setCloudinaryUploadMessage,
  ] = useState("");
  const [
    cloudinaryPublicId,
    setCloudinaryPublicId,
  ] = useState<string | null>(null);
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  // Video editor state
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [editedVideoBlob, setEditedVideoBlob] = useState<Blob | null>(null);
  const [editedVideoUrl, setEditedVideoUrl] = useState<string | null>(null);
  // Update only states
  const [isUpdatingOnly, setIsUpdatingOnly] = useState(false);
  const [updateOnlyError, setUpdateOnlyError] = useState<string | null>(null);
  // Product ID for tracking saved product
  const [productId, setProductId] = useState<string | null>(null);
  // Clone voice states
  const [voices, setVoices] = useState<UserVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<number | null>(null);
  const [clonedAudioBlob, setClonedAudioBlob] = useState<Blob | null>(null);
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);
  const [isGeneratingClonedAudio, setIsGeneratingClonedAudio] = useState(false);
  const [clonedAudioError, setClonedAudioError] = useState<string | null>(null);
  // Video source states
  const [videoSource, setVideoSource] = useState<"generate" | "upload">("generate");
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  // Load audio from URL
  const loadAudioFromUrl =
    useCallback(
      async (
        url: string
      ): Promise<Blob> => {
        const response =
          await fetch(url);
        if (!response.ok) {
          throw new Error(
            "Failed to load existing audio"
          );
        }
        return await response.blob();
      },
      []
    );
  // Fetch voices with full URL for sample audio
  const fetchVoices = useCallback(async () => {
    try {
      const response = await apiClient.get('/user-voices');
      // Prepend API base URL to sampleAudioUrl for proper playback
      const baseUrl = API_BASE.replace('/api', '');
      const voicesWithFullUrl = response.data.map((voice: any) => ({
        ...voice,
        sampleAudioUrl: voice.sampleAudioUrl ? `${baseUrl}${voice.sampleAudioUrl}` : null
      }));
      setVoices(voicesWithFullUrl);
    } catch (err: any) {
      console.error('Failed to fetch voices:', err);
    }
  }, []);
  // Create voice
  const createVoice = useCallback(async (name: string, sampleFile: File) => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('sample', sampleFile);
    const response = await apiClient.post('/user-voices', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }, []);
  // Delete voice
  const deleteVoice = useCallback(async (voiceId: number) => {
    await apiClient.delete(`/user-voices/${voiceId}`);
  }, []);
  // Generate cloned audio
  const generateClonedAudio = useCallback(async (voiceId: number, language: string, text: string): Promise<Blob> => {
    const response = await apiClient.post('/user-voices/generate', {
      voiceId,
      language,
      text,
    }, {
      responseType: 'blob',
    });
    return response.data;
  }, []);
  // Upload video to Cloudinary
  const uploadVideoToCloudinary = useCallback(async (file: File, onProgress?: (progress: number) => void) => {
    // This will be handled by the existing uploadToCloudinary utility
    // We'll use it in handleGenerateVideo when videoSource is "upload"
    // We'll return a promise that resolves with publicId
    return new Promise<{ publicId: string }>((resolve, reject) => {
      // We'll implement this in handleGenerateVideo
      // Just a placeholder to satisfy the prop type
      reject(new Error("Direct upload not implemented"));
    });
  }, []);
  useEffect(() => {
    if (editId) {
      fetchProductData(editId);
    }
  }, [editId]);
  const fetchProductData =
    async (id: string) => {
      setIsLoadingProduct(true);
      try {
        const response =
          await apiClient.get(
            `/products/${id}`
          );
        if (response.data.success) {
          const product =
            response.data.data;
          setProductId(id);
          setProductName(
            product.name || ""
          );
          setPrice(
            product.basePrice?.toString() ||
              ""
          );
          setCostPrice(
            product.costPrice?.toString() ||
              ""
          );
          setStockQuantity(
            product.stockQuantity?.toString() ||
              ""
          );
          setSku(
            product.defaultSku || ""
          );
          setDescription(
            product.description || ""
          );
          setSelectedCategoryId(
            product.categoryId ? String(product.categoryId) : ""
          );
          setSelectedSubcategoryId(
            product.subcategoryId ? String(product.subcategoryId) : ""
          );
          setShowInFeaturedProducts(product.showInFeaturedProducts || false);
          setShowInBestSellers(product.showInBestSellers || false);
          setShowInNewArrivals(product.showInNewArrivals || false);
          setShowInPremiumProducts(product.showInPremiumProducts || false);
          setAudioMode(
            product.audioMode || "text"
          );
          setAudioScript(
            product.audioScript || ""
          );
          setAudioLanguage(
            (product.audioLanguage as
              | "en"
              | "te"
              | "hi") || "en"
          );
          setVoiceGender(
            product.voiceGender ||
              "female"
          );
          setVideoLength(
            product.videoLength || 30
          );
          if (
            product.images &&
            product.images.length > 0
          ) {
            const imageUrls =
              product.images
                .map(
                  (img: any) =>
                    img.url
                )
                .filter(Boolean);
            setImageKitUrls(
              imageUrls
            );
            setPreviews(
              imageUrls
            );
            setImages([]);
            setImageUploadingStates(
              imageUrls.map(
                () => false
              )
            );
            setImageUploadErrors(
              imageUrls.map(
                () => ""
              )
            );
          } else {
            setImages([]);
            setPreviews([]);
            setImageKitUrls([]);
          }
          if (
            product.variants &&
            product.variants.length > 0
          ) {
            setVariants(
              product.variants.map(
                (v: any) => ({
                  id: `var-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
                  sku: v.sku || "",
                  size: v.size || "",
                  color: v.color || "",
                  price:
                    v.price?.toString() ||
                    "",
                  costPrice:
                    v.costPrice?.toString() ||
                    "",
                  stockQuantity:
                    v.stockQuantity?.toString() ||
                    "",
                })
              )
            );
          }
          // Handle video URL
          if (product.cloudinaryVideoPublicId) {
            const cloudinaryUrl = getCloudinaryVideoUrl(product.cloudinaryVideoPublicId);
            if (cloudinaryUrl) {
              setExistingVideoUrl(cloudinaryUrl);
              setCloudinaryPublicId(product.cloudinaryVideoPublicId);
              setCloudinaryUploadStatus("success");
            }
          } else if (product.videoUrl && product.videoUrl.startsWith('http')) {
            setExistingVideoUrl(product.videoUrl);
          }
          const existingAudioUrl =
            product.audioUrl ||
            product.audioFileUrl ||
            product.audioKitUrl ||
            null;
          if (existingAudioUrl) {
            setCustomAudioUrl(
              existingAudioUrl
            );
          }
          const existingRecordedAudioUrl =
            product.recordedAudioUrl ||
            null;
          if (
            existingRecordedAudioUrl
          ) {
            setRecordedAudioUrl(
              existingRecordedAudioUrl
            );
          }
          // Load voices
          fetchVoices();
        }
      } catch (err: any) {
        console.error(
          "Failed to fetch product:",
          err
        );
        setCreateError(
          err.message ||
            "Failed to load product details"
        );
      } finally {
        setIsLoadingProduct(false);
      }
    };
  useEffect(() => {
    if (
      typeof window !==
        "undefined" &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.getVoices();
      if (
        window.speechSynthesis
          .onvoiceschanged !==
        undefined
      ) {
        window.speechSynthesis.onvoiceschanged =
          () => {
            window.speechSynthesis.getVoices();
          };
      }
    }
  }, []);
  useEffect(() => {
    if (
      currentStep === 3 &&
      videoSource === "generate" &&
      audioMode === "text" &&
      !audioScript &&
      !isEditMode
    ) {
      const script = `Introducing ${
        productName ||
        "our amazing product"
      }. ${
        description ||
        "This is a high-quality item designed for you."
      } Priced at just ${
        price || "affordable"
      } rupees. Don't miss out!`;
      setAudioScript(script);
    }
  }, [
    currentStep,
    productName,
    description,
    price,
    videoSource,
    audioMode,
    audioScript,
    isEditMode,
  ]);
  useEffect(() => {
    if (ttsPreviewUrl) {
      URL.revokeObjectURL(
        ttsPreviewUrl
      );
      setTtsPreviewUrl(null);
    }
  }, [
    audioScript,
    audioLanguage,
    voiceGender,
  ]);
  useEffect(() => {
    return () => {
      previews.forEach(
        (url) => {
          if (
            url.startsWith("blob:")
          ) {
            URL.revokeObjectURL(
              url
            );
          }
        }
      );
      if (
        videoUrl &&
        videoUrl.startsWith("blob:")
      ) {
        URL.revokeObjectURL(
          videoUrl
        );
      }
      if (
        customAudioUrl &&
        customAudioUrl.startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          customAudioUrl
        );
      }
      if (
        ttsPreviewUrl &&
        ttsPreviewUrl.startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          ttsPreviewUrl
        );
      }
      if (
        recordedAudioUrl &&
        recordedAudioUrl.startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          recordedAudioUrl
        );
      }
      if (clonedAudioUrl && clonedAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(clonedAudioUrl);
      }
      if (uploadedVideoUrl && uploadedVideoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(uploadedVideoUrl);
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current
          .state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);
  const selectedCategory =
    categories.find(
      (c) =>
        c.id ===
        selectedCategoryId
    );
  const handleCategoryChange = (
    categoryId: string
  ) => {
    if (
      categoryId ===
      "__add_new__"
    ) {
      setShowAddCategory(true);
      setSelectedCategoryId("");
      setSelectedSubcategoryId("");
      setShowAddSubcategory(false);
      setNewSubcategoryName("");
      setNewSubcategoryError(null);
      setErrors((prev) => {
        const {
          category,
          subcategory,
          ...rest
        } = prev as any;
        return rest;
      });
      return;
    }
    setSelectedCategoryId(
      categoryId
    );
    setSelectedSubcategoryId("");
    setShowAddSubcategory(false);
    setNewSubcategoryName("");
    setNewSubcategoryError(null);
    setShowAddCategory(false);
    setNewCategoryName("");
    setNewCategoryError(null);
    setErrors((prev) => {
      const {
        category,
        subcategory,
        ...rest
      } = prev as any;
      return rest;
    });
  };
  const handleSubcategoryChange = (
    subcategoryId: string
  ) => {
    if (
      subcategoryId ===
      "__add_new__"
    ) {
      setShowAddSubcategory(true);
      setSelectedSubcategoryId("");
      return;
    }
    setSelectedSubcategoryId(
      subcategoryId
    );
    setShowAddSubcategory(false);
    setNewSubcategoryError(null);
    setErrors((prev) => {
      const {
        subcategory,
        ...rest
      } = prev;
      return rest;
    });
  };
  const handleAddNewCategory = async () => {
    const name =
      newCategoryName.trim();
    if (!name) {
      setNewCategoryError(
        "Category name cannot be empty"
      );
      return;
    }
    const existing =
      categories.find(
        (c) =>
          c.name.toLowerCase() ===
          name.toLowerCase()
      );
    if (existing) {
      setNewCategoryError(
        "A category with this name already exists"
      );
      return;
    }
    setNewCategoryError(null);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', '');
      formData.append('order', '0');
      formData.append('isActive', 'true');
      formData.append('showInCategoryGrid', 'true');
      formData.append('showInHero', 'false');
      const response = await apiClient.post('/categories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newCat = response.data;
      await fetchCategories();
      setSelectedCategoryId(String(newCat.id));
      setSelectedSubcategoryId("");
      setShowAddSubcategory(false);
      setNewSubcategoryName("");
      setNewSubcategoryError(null);
      setShowAddCategory(false);
      setNewCategoryName("");
      setNewCategoryError(null);
      setErrors((prev) => {
        const {
          category,
          subcategory,
          ...rest
        } = prev as any;
        return rest;
      });
    } catch (err: any) {
      console.error('Error creating category:', err);
      setNewCategoryError(err.response?.data?.message || 'Failed to create category');
    }
  };
  const handleCancelAddCategory =
    () => {
      setShowAddCategory(false);
      setNewCategoryName("");
      setNewCategoryError(null);
    };
  const handleAddNewSubcategory = async () => {
    const name =
      newSubcategoryName.trim();
    if (!name) {
      setNewSubcategoryError(
        "Subcategory name cannot be empty"
      );
      return;
    }
    if (!selectedCategoryId) {
      setNewSubcategoryError(
        "Please select a category first"
      );
      return;
    }
    const existing =
      categories
        .find(
          (c) =>
            c.id ===
            selectedCategoryId
        )
        ?.subcategories.find(
          (s) =>
            s.name.toLowerCase() ===
            name.toLowerCase()
        );
    if (existing) {
      setNewSubcategoryError(
        "A subcategory with this name already exists"
      );
      return;
    }
    setNewSubcategoryError(null);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('parentId', selectedCategoryId);
      formData.append('description', '');
      formData.append('order', '0');
      formData.append('isActive', 'true');
      formData.append('showInCategoryGrid', 'true');
      formData.append('showInHero', 'false');
      const response = await apiClient.post('/categories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newSub = response.data;
      await fetchCategories();
      setSelectedSubcategoryId(String(newSub.id));
      setShowAddSubcategory(false);
      setNewSubcategoryName("");
      setNewSubcategoryError(null);
    } catch (err: any) {
      console.error('Error creating subcategory:', err);
      setNewSubcategoryError(err.response?.data?.message || 'Failed to create subcategory');
    }
  };
  const handleCancelAddSubcategory =
    () => {
      setShowAddSubcategory(false);
      setNewSubcategoryName("");
      setNewSubcategoryError(null);
    };
  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      createEmptyVariant(),
    ]);
  };
  const handleRemoveVariant = (
    id: string
  ) => {
    setVariants((prev) => {
      if (prev.length === 1) {
        return [
          createEmptyVariant(),
        ];
      }
      return prev.filter(
        (v) => v.id !== id
      );
    });
  };
  const handleVariantChange = (
    id: string,
    field: keyof Omit<
      ProductVariant,
      "id"
    >,
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              [field]: value,
            }
          : v
      )
    );
  };
  const handleFillAllVariantsPrice =
    () => {
      if (!price) return;
      setVariants((prev) =>
        prev.map((v) => ({
          ...v,
          price:
            v.price || price,
        }))
      );
    };
  const startRecording =
    async () => {
      setRecordingError(null);
      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: true,
            }
          );
        const mediaRecorder =
          new MediaRecorder(stream);
        mediaRecorderRef.current =
          mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable =
          (event) => {
            if (
              event.data.size > 0
            ) {
              audioChunksRef.current.push(
                event.data
              );
            }
          };
        mediaRecorder.onstop =
          () => {
            const blob =
              new Blob(
                audioChunksRef.current,
                {
                  type: "audio/webm",
                }
              );
            const url =
              URL.createObjectURL(
                blob
              );
            setRecordedAudioBlob(
              blob
            );
            setRecordedAudioUrl(
              url
            );
            setIsRecording(false);
            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );
          };
        mediaRecorder.onerror =
          () => {
            setRecordingError(
              "Recording error occurred."
            );
            setIsRecording(false);
            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );
          };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err: any) {
        if (
          err.name ===
            "NotAllowedError" ||
          err.name ===
            "PermissionDeniedError"
        ) {
          setRecordingError(
            "Microphone permission denied. Please allow access to record."
          );
        } else {
          setRecordingError(
            err.message ||
              "Could not start recording."
          );
        }
      }
    };
  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current
        .state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  };
  const generateAudioFromText =
    useCallback(
      async (
        text: string,
        language: string,
        gender:
          | "female"
          | "male",
        targetDurationSec: number
      ): Promise<Blob> => {
        setAudioGenerating(true);
        setAudioError(null);
        try {
          const freq =
            gender === "male"
              ? 180
              : 440;
          const langFreqMod =
            language === "te"
              ? 1.1
              : language === "hi"
              ? 1.2
              : 1.0;
          let blob =
            await generateFallbackAudio(
              Math.min(
                targetDurationSec ||
                  5,
                30
              ),
              freq *
                langFreqMod
            );
          if (
            gender === "male"
          ) {
            blob =
              await pitchShiftBlob(
                blob,
                0.78
              );
          }
          if (
            targetDurationSec >
            0
          ) {
            blob =
              await loopAudioToDuration(
                blob,
                targetDurationSec
              );
          }
          return blob;
        } catch (err: any) {
          setAudioError(
            err.message ||
              "TTS failed, using fallback audio"
          );
          const freq =
            gender === "male"
              ? 180
              : 440;
          return generateFallbackAudio(
            Math.min(
              targetDurationSec ||
                5,
              30
            ),
            freq
          );
        } finally {
          setAudioGenerating(false);
        }
      },
      []
    );
  const handlePreviewTTS =
    () => {
      if (
        !audioScript.trim()
      ) {
        return;
      }
      setAudioGenerating(true);
      setAudioError(null);
      window.speechSynthesis.cancel();
      const utterance =
        new SpeechSynthesisUtterance(
          audioScript
        );
      const langMap: Record<
        string,
        string
      > = {
        en: "en-US",
        hi: "hi-IN",
        te: "te-IN",
      };
      utterance.lang =
        langMap[
          audioLanguage
        ] || "en-US";
      const voices =
        window.speechSynthesis.getVoices();
      const genderKeyword =
        voiceGender ===
        "female"
          ? "Female"
          : "Male";
      const matchingVoices =
        voices.filter(
          (v) =>
            v.lang.includes(
              utterance.lang
            ) &&
            v.name.includes(
              genderKeyword
            )
        );
      if (
        matchingVoices.length >
        0
      ) {
        utterance.voice =
          matchingVoices[0];
      } else {
        const fallbackVoice =
          voices.find((v) =>
            v.lang.includes(
              utterance.lang
            )
          );
        if (fallbackVoice) {
          utterance.voice =
            fallbackVoice;
        }
      }
      utterance.onend = () => {
        setAudioGenerating(false);
      };
      utterance.onerror = (
        e
      ) => {
        console.error(
          "Speech synthesis error",
          e
        );
        setAudioGenerating(false);
        setAudioError(
          "Failed to generate speech. Please try again."
        );
      };
      window.speechSynthesis.speak(
        utterance
      );
    };
  const uploadAllImages =
    async (): Promise<
      string[]
    > => {
      const uploadedUrls: string[] =
        [];
      for (
        let i = 0;
        i < imageKitUrls.length;
        i++
      ) {
        const existingUrl =
          imageKitUrls[i];
        if (
          existingUrl &&
          existingUrl.startsWith(
            "http"
          )
        ) {
          uploadedUrls.push(
            existingUrl
          );
        }
      }
      for (
        let i = 0;
        i < images.length;
        i++
      ) {
        const file = images[i];
        if (
          file &&
          file.size > 0
        ) {
          try {
            const uploadedUrl =
              await uploadToImageKit(
                file
              );
            if (uploadedUrl) {
              uploadedUrls.push(
                uploadedUrl
              );
            } else {
              throw new Error(
                `Failed to upload image ${
                  i + 1
                }`
              );
            }
          } catch (err) {
            throw new Error(
              `Failed to upload image ${
                i + 1
              }: ${err}`
            );
          }
        }
      }
      return uploadedUrls;
    };
  // Core function to save product to database
  const saveProductToDB = async () => {
    setIsUploadingImages(true);
    try {
      const uploadedImageUrls =
        await uploadAllImages();
      setIsUploadingImages(false);
      // Determine audio URL: for clone mode use cloned audio URL
      let audioUrl = customAudioUrl || undefined;
      if (audioMode === "clone" && clonedAudioUrl) {
        audioUrl = clonedAudioUrl;
      }
      // Determine video URL: if videoSource is "upload" and we have cloudinaryPublicId from upload, use that
      // If videoSource is "generate", use generated video
      let videoUrlToSave = videoKitUrl || videoUrl;
      if (videoSource === "upload" && cloudinaryPublicId) {
        const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'lovecart';
        videoUrlToSave = `https://res.cloudinary.com/${cloudName}/video/upload/${cloudinaryPublicId}`;
      }
      const productData = {
        name: productName,
        price,
        costPrice,
        stockQuantity,
        sku,
        description,
        categoryId: selectedCategoryId ? parseInt(selectedCategoryId, 10) : null,
        subcategoryId: selectedSubcategoryId ? parseInt(selectedSubcategoryId, 10) : null,
        showInFeaturedProducts,
        showInBestSellers,
        showInNewArrivals,
        showInPremiumProducts,
        variants:
          variants.map((v) => ({
            sku: v.sku,
            size: v.size,
            color: v.color,
            price: v.price,
            costPrice:
              v.costPrice,
            stockQuantity:
              v.stockQuantity,
          })),
        images:
          uploadedImageUrls.filter(
            (url) =>
              url &&
              url.startsWith(
                "http"
              )
          ),
        videoUrl: videoUrlToSave,
        audioMode,
        audioScript,
        audioLanguage,
        voiceGender,
        videoLength,
        audioUrl: audioUrl,
        cloudinaryVideoPublicId:
          cloudinaryPublicId,
        cloudinaryAudioPublicId:
          null,
      };
      let response;
      if (isEditMode) {
        response =
          await apiClient.put(
            `/products/${editId}`,
            productData
          );
      } else {
        response =
          await apiClient.post(
            `/products`,
            productData
          );
      }
      if (response.data) {
        if (!isEditMode && response.data?.data?.id) {
          setProductId(response.data.data.id);
        } else if (isEditMode) {
          setProductId(editId);
        }
        return response.data;
      } else {
        throw new Error('Failed to save product');
      }
    } catch (err: any) {
      console.error(
        "Error saving product:",
        err
      );
      throw err;
    } finally {
      setIsUploadingImages(false);
    }
  };
  const handleSaveOnly =
    async () => {
      setIsUpdatingOnly(true);
      setUpdateOnlyError(null);
      try {
        await saveProductToDB();
        setPostSuccess(true);
      } catch (err: any) {
        setUpdateOnlyError(
          err.response?.data
            ?.message ||
            err.message ||
            "Failed to save product"
        );
      } finally {
        setIsUpdatingOnly(false);
      }
    };
  const handlePostToInstagram = async () => {
    // no-op
  };
  const resetAllState = () => {
    previews.forEach(
      (url) => {
        if (
          url.startsWith("blob:")
        ) {
          URL.revokeObjectURL(
            url
          );
        }
      }
    );
    if (
      videoUrl &&
      videoUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        videoUrl
      );
    }
    if (
      customAudioUrl &&
      customAudioUrl.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        customAudioUrl
      );
    }
    if (
      ttsPreviewUrl &&
      ttsPreviewUrl.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        ttsPreviewUrl
      );
    }
    if (
      recordedAudioUrl &&
      recordedAudioUrl.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        recordedAudioUrl
      );
    }
    if (clonedAudioUrl && clonedAudioUrl.startsWith("blob:")) {
      URL.revokeObjectURL(clonedAudioUrl);
    }
    if (uploadedVideoUrl && uploadedVideoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current
        .state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    setCurrentStep(1);
    setProductName("");
    setPrice("");
    setCostPrice("");
    setStockQuantity("");
    setSku("");
    setDescription("");
    setErrors({});
    setSelectedCategoryId("");
    setSelectedSubcategoryId("");
    setShowAddCategory(false);
    setNewCategoryName("");
    setNewCategoryError(null);
    setShowAddSubcategory(false);
    setNewSubcategoryName("");
    setNewSubcategoryError(null);
    setShowInFeaturedProducts(false);
    setShowInBestSellers(false);
    setShowInNewArrivals(false);
    setShowInPremiumProducts(false);
    setVariants([
      createEmptyVariant(),
    ]);
    setImages([]);
    setPreviews([]);
    setImageKitUrls([]);
    setImageUploadingStates([]);
    setImageUploadErrors([]);
    setActiveImageTab("upload");
    setUnsplashQuery("");
    setUnsplashResults([]);
    setIsSearchingUnsplash(false);
    setUnsplashError(null);
    setDownloadingUnsplashIds(
      new Set()
    );
    setShowConfig(true);
    setAudioMode("text");
    setAudioScript("");
    setAudioLanguage("en");
    setVoiceGender("female");
    setCustomAudioFile(null);
    setCustomAudioUrl(null);
    setTtsPreviewUrl(null);
    setIsRecording(false);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setRecordingError(null);
    mediaRecorderRef.current =
      null;
    audioChunksRef.current = [];
    setVideoLength(30);
    setIsGenerating(false);
    setGenerationProgress(0);
    setGenerationMessage("");
    setVideoUrl(null);
    setVideoKitUrl(null);
    setGenerationError(null);
    setVideoUploadProgress(false);
    setAudioGenerating(false);
    setAudioError(null);
    setIsPosting(false);
    setPostSuccess(false);
    setCreateError(null);
    setExistingVideoUrl(null);
    setCloudinaryUploadStatus("idle");
    setCloudinaryUploadProgress(0);
    setCloudinaryUploadMessage("");
    setCloudinaryPublicId(null);
    setEditedVideoBlob(null);
    setEditedVideoUrl(null);
    setShowVideoEditor(false);
    setIsUpdatingOnly(false);
    setUpdateOnlyError(null);
    setProductId(null);
    // Reset clone state
    setVoices([]);
    setSelectedVoiceId(null);
    setClonedAudioBlob(null);
    if (clonedAudioUrl) {
      URL.revokeObjectURL(clonedAudioUrl);
      setClonedAudioUrl(null);
    }
    setIsGeneratingClonedAudio(false);
    setClonedAudioError(null);
    // Reset video source
    setVideoSource("generate");
    setUploadedVideoFile(null);
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
      setUploadedVideoUrl(null);
    }
  };
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(
        currentStep - 1
      );
    }
  };
  const handleNext = () => {
    if (currentStep === 1) {
      const newErrors: {
        [key: string]: string;
      } = {};
      if (
        !productName.trim()
      ) {
        newErrors.productName =
          "Product name is required";
      }
      if (!price.trim()) {
        newErrors.price =
          "Price is required";
      }
      if (!selectedCategoryId) {
        newErrors.category =
          "Category is required";
      }
      if (
        !selectedSubcategoryId
      ) {
        newErrors.subcategory =
          "Subcategory is required";
      }
      setErrors(newErrors);
      if (
        Object.keys(
          newErrors
        ).length > 0
      ) {
        return;
      }
    }
    if (currentStep === 2) {
      if (
        images.length === 0 &&
        imageKitUrls.length === 0
      ) {
        return;
      }
    }
    if (currentStep < 5) {
      setCurrentStep(
        (prev) => prev + 1
      );
    }
  };
  const handleUnsplashSearch =
    async () => {
      if (
        !unsplashQuery.trim()
      ) {
        return;
      }
      setIsSearchingUnsplash(true);
      setUnsplashError(null);
      try {
        const res =
          await axios.get(
            "https://api.unsplash.com/search/photos",
            {
              params: {
                query:
                  unsplashQuery,
                per_page: 20,
              },
              headers: {
                Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
              },
            }
          );
        setUnsplashResults(
          res.data.results || []
        );
      } catch (err: any) {
        setUnsplashError(
          err.message ||
            "Failed to search Unsplash"
        );
      } finally {
        setIsSearchingUnsplash(
          false
        );
      }
    };
  const handleDownloadUnsplash =
    async (
      photo: any
    ) => {
      const photoId =
        photo.id;
      if (
        downloadingUnsplashIds.has(
          photoId
        )
      ) {
        return;
      }
      setDownloadingUnsplashIds(
        (prev) =>
          new Set(
            prev
          ).add(photoId)
      );
      try {
        const imageUrl =
          photo.urls?.regular ||
          photo.urls?.small;
        const res =
          await axios.get(
            imageUrl,
            {
              responseType:
                "blob",
            }
          );
        const file =
          new File(
            [res.data],
            `unsplash-${photoId}.jpg`,
            {
              type: "image/jpeg",
            }
          );
        const previewUrl =
          URL.createObjectURL(
            file
          );
        setImages(
          (prev) => [
            ...prev,
            file,
          ]
        );
        setPreviews(
          (prev) => [
            ...prev,
            previewUrl,
          ]
        );
        setImageKitUrls(
          (prev) => [
            ...prev,
            "",
          ]
        );
        setImageUploadingStates(
          (prev) => [
            ...prev,
            false,
          ]
        );
        setImageUploadErrors(
          (prev) => [
            ...prev,
            "",
          ]
        );
      } catch (err: any) {
        console.error(
          "Failed to download Unsplash image",
          err
        );
      } finally {
        setDownloadingUnsplashIds(
          (prev) => {
            const next =
              new Set(prev);
            next.delete(
              photoId
            );
            return next;
          }
        );
      }
    };
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files =
      e.target.files;
    if (!files) {
      return;
    }
    const newPreviews: string[] =
      [];
    const newFiles: File[] =
      [];
    for (
      let i = 0;
      i < files.length;
      i++
    ) {
      const file =
        files[i];
      if (
        file.type.startsWith(
          "image/"
        )
      ) {
        newFiles.push(file);
        newPreviews.push(
          URL.createObjectURL(
            file
          )
        );
      }
    }
    setImages(
      (prev) => [
        ...prev,
        ...newFiles,
      ]
    );
    setPreviews(
      (prev) => [
        ...prev,
        ...newPreviews,
      ]
    );
    setImageKitUrls(
      (prev) => [
        ...prev,
        ...new Array(
          newFiles.length
        ).fill(""),
      ]
    );
    setImageUploadingStates(
      (prev) => [
        ...prev,
        ...new Array(
          newFiles.length
        ).fill(false),
      ]
    );
    setImageUploadErrors(
      (prev) => [
        ...prev,
        ...new Array(
          newFiles.length
        ).fill(""),
      ]
    );
    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  };
  const removeImage = (
    index: number
  ) => {
    setImages(
      (prev) =>
        prev.filter(
          (_, i) =>
            i !== index
        )
    );
    setPreviews(
      (prev) => {
        const url =
          prev[index];
        if (
          url?.startsWith(
            "blob:"
          )
        ) {
          URL.revokeObjectURL(
            url
          );
        }
        return prev.filter(
          (_, i) =>
            i !== index
        );
      }
    );
    setImageKitUrls(
      (prev) =>
        prev.filter(
          (_, i) =>
            i !== index
        )
    );
    setImageUploadingStates(
      (prev) =>
        prev.filter(
          (_, i) =>
            i !== index
        )
    );
    setImageUploadErrors(
      (prev) =>
        prev.filter(
          (_, i) =>
            i !== index
        )
    );
  };
  const handleUploadToImageKit =
    async (
      index: number
    ) => {
      const file =
        images[index];
      if (!file) {
        return;
      }
      setImageUploadingStates(
        (prev) => {
          const updated = [
            ...prev,
          ];
          updated[index] = true;
          return updated;
        }
      );
      setImageUploadErrors(
        (prev) => {
          const updated = [
            ...prev,
          ];
          updated[index] = "";
          return updated;
        }
      );
      try {
        const uploadedUrl =
          await uploadToImageKit(
            file
          );
        if (uploadedUrl) {
          setImageKitUrls(
            (prev) => {
              const updated = [
                ...prev,
              ];
              updated[index] =
                uploadedUrl;
              return updated;
            }
          );
        }
      } catch (err: any) {
        setImageUploadErrors(
          (prev) => {
            const updated = [
              ...prev,
            ];
            updated[index] =
              err.message ||
              "Upload failed";
            return updated;
          }
        );
      } finally {
        setImageUploadingStates(
          (prev) => {
            const updated = [
              ...prev,
            ];
            updated[index] =
              false;
            return updated;
          }
        );
      }
    };
  // Modified video generation function
  const handleGenerateVideo =
    async () => {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationMessage(
        "Preparing assets..."
      );
      setGenerationError(null);
      let generatedVideoObjectUrl:
        | string
        | null = null;
      try {
        // If videoSource is "upload", we just upload the video to Cloudinary
        if (videoSource === "upload") {
          if (!uploadedVideoFile) {
            throw new Error("No video file uploaded");
          }
          setGenerationMessage(
            "Uploading video to Cloudinary..."
          );
          setGenerationProgress(10);
          const cloudinaryResult = await uploadToCloudinary(
            uploadedVideoFile,
            (progress) => {
              setCloudinaryUploadProgress(progress);
              setGenerationProgress(10 + progress * 0.8); // 10-90%
              setCloudinaryUploadMessage(`Uploading... ${Math.round(progress)}%`);
            }
          );
          if (cloudinaryResult && cloudinaryResult.publicId) {
            setCloudinaryPublicId(cloudinaryResult.publicId);
            setCloudinaryUploadStatus("success");
            setCloudinaryUploadMessage("Video uploaded successfully!");
            setGenerationMessage("Video uploaded to Cloudinary successfully!");
            const cloudinaryUrl = getCloudinaryVideoUrl(cloudinaryResult.publicId);
            if (cloudinaryUrl) {
              setExistingVideoUrl(cloudinaryUrl);
              setVideoUrl(cloudinaryUrl);
              setVideoKitUrl(cloudinaryUrl);
            }
            setGenerationProgress(100);
          } else {
            throw new Error("Failed to upload video to Cloudinary");
          }
          setIsGenerating(false);
          return;
        }
        // Original video generation for "generate" source
        let audioBlob:
          | Blob
          | null = null;
        const targetDuration =
          videoLength;
        if (
          audioMode === "text"
        ) {
          setGenerationMessage(
            "Generating voiceover..."
          );
          setGenerationProgress(
            10
          );
          audioBlob =
            await generateAudioFromText(
              audioScript ||
                "Welcome to our product video",
              audioLanguage,
              voiceGender,
              targetDuration
            );
        }
        else if (
          audioMode ===
          "upload"
        ) {
          setGenerationMessage(
            "Loading uploaded audio..."
          );
          setGenerationProgress(
            10
          );
          if (
            customAudioFile
          ) {
            audioBlob =
              await customAudioFile
                .arrayBuffer()
                .then(
                  (arrayBuffer) =>
                    new Blob(
                      [arrayBuffer],
                      {
                        type:
                          customAudioFile.type ||
                          "audio/mpeg",
                      }
                    )
                );
          } else if (
            customAudioUrl
          ) {
            audioBlob =
              await loadAudioFromUrl(
                customAudioUrl
              );
          }
        }
        else if (
          audioMode ===
          "record"
        ) {
          setGenerationMessage(
            "Using recorded audio..."
          );
          setGenerationProgress(
            10
          );
          if (
            recordedAudioBlob
          ) {
            audioBlob =
              recordedAudioBlob;
          } else if (
            recordedAudioUrl
          ) {
            audioBlob =
              await loadAudioFromUrl(
                recordedAudioUrl
              );
          }
        }
        else if (
          audioMode === "clone"
        ) {
          setGenerationMessage(
            "Using cloned voice audio..."
          );
          setGenerationProgress(
            10
          );
          if (clonedAudioBlob) {
            audioBlob = clonedAudioBlob;
          } else if (clonedAudioUrl) {
            audioBlob = await loadAudioFromUrl(clonedAudioUrl);
          }
          if (!audioBlob) {
            throw new Error(
              "No cloned audio available. Please generate audio first."
            );
          }
        }
        if (!audioBlob) {
          throw new Error(
            "No audio available for video generation"
          );
        }
        setGenerationMessage(
          "Processing audio..."
        );
        setGenerationProgress(
          15
        );
        const audioCtx =
          new AudioContext();
        const audioBuffer =
          await audioCtx.decodeAudioData(
            await audioBlob.arrayBuffer()
          );
        const audioDuration =
          audioBuffer.duration;
        let finalAudioBlob =
          audioBlob;
        if (
          audioDuration <
          targetDuration
        ) {
          setGenerationMessage(
            `Extending audio from ${audioDuration.toFixed(
              1
            )}s to ${targetDuration}s...`
          );
          finalAudioBlob =
            await loopAudioToDuration(
              audioBlob,
              targetDuration
            );
        }
        await audioCtx.close();
        setGenerationMessage(
          "Loading product images..."
        );
        setGenerationProgress(
          20
        );
        const imageElements:
          HTMLImageElement[] = [];
        const imageUrls =
          previews.length > 0
            ? previews
            : imageKitUrls.filter(
                Boolean
              );
        for (
          const previewUrl of imageUrls
        ) {
          if (!previewUrl) {
            continue;
          }
          const img =
            new Image();
          if (
            previewUrl.startsWith(
              "http"
            )
          ) {
            img.crossOrigin =
              "anonymous";
          }
          await new Promise<void>(
            (
              resolve,
              reject
            ) => {
              img.onload =
                () =>
                  resolve();
              img.onerror =
                () =>
                  reject(
                    new Error(
                      `Failed to load image: ${previewUrl}`
                    )
                  );
              img.src =
                previewUrl;
            }
          );
          imageElements.push(
            img
          );
        }
        if (
          imageElements.length ===
          0
        ) {
          const canvas =
            document.createElement(
              "canvas"
            );
          canvas.width = 1280;
          canvas.height = 720;
          const ctx =
            canvas.getContext(
              "2d"
            )!;
          const gradient =
            ctx.createLinearGradient(
              0,
              0,
              1280,
              720
            );
          gradient.addColorStop(
            0,
            "#7C3AED"
          );
          gradient.addColorStop(
            1,
            "#6D28D9"
          );
          ctx.fillStyle =
            gradient;
          ctx.fillRect(
            0,
            0,
            1280,
            720
          );
          ctx.fillStyle =
            "white";
          ctx.font =
            "bold 48px Arial";
          ctx.textAlign =
            "center";
          ctx.textBaseline =
            "middle";
          ctx.fillText(
            productName ||
              "Product",
            640,
            360
          );
          const placeholderBlob =
            await new Promise<Blob>(
              (resolve) =>
                canvas.toBlob(
                  (b) =>
                    resolve(b!),
                  "image/png"
                )
            );
          const placeholderUrl =
            URL.createObjectURL(
              placeholderBlob
            );
          const img =
            new Image();
          await new Promise<void>(
            (resolve) => {
              img.onload =
                () =>
                  resolve();
              img.src =
                placeholderUrl;
            }
          );
          imageElements.push(
            img
          );
          URL.revokeObjectURL(
            placeholderUrl
          );
        }
        setGenerationMessage(
          "Creating video with embedded audio..."
        );
        setGenerationProgress(
          30
        );
        const canvas =
          document.createElement(
            "canvas"
          );
        const ctx =
          canvas.getContext(
            "2d"
          )!;
        const width = 1280;
        const height = 720;
        canvas.width = width;
        canvas.height = height;
        const canvasStream =
          canvas.captureStream(
            30
          );
        const finalAudioUrl =
          URL.createObjectURL(
            finalAudioBlob
          );
        const audioElement =
          new Audio(
            finalAudioUrl
          );
        await new Promise<void>(
          (resolve) => {
            audioElement.onloadedmetadata =
              () =>
                resolve();
            audioElement.load();
          }
        );
        const audioContext =
          new AudioContext();
        const source =
          audioContext.createMediaElementSource(
            audioElement
          );
        const destination =
          audioContext.createMediaStreamDestination();
        source.connect(
          destination
        );
        const combinedStream =
          new MediaStream();
        canvasStream
          .getVideoTracks()
          .forEach(
            (track) => {
              combinedStream.addTrack(
                track
              );
            }
          );
        destination.stream
          .getAudioTracks()
          .forEach(
            (track) => {
              combinedStream.addTrack(
                track
              );
            }
          );
        const mimeTypes = [
          'video/mp4;codecs=avc1,mp4a',
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=h264',
          'video/webm;codecs=vp9,opus',
        ];
        let selectedMimeType = mimeTypes[0];
        let mediaRecorder: MediaRecorder | null = null;
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            mediaRecorder = new MediaRecorder(combinedStream, {
              mimeType: mimeType,
              videoBitsPerSecond: 5000000,
              audioBitsPerSecond: 128000,
            });
            break;
          }
        }
        if (!mediaRecorder) {
          mediaRecorder = new MediaRecorder(combinedStream, {
            videoBitsPerSecond: 5000000,
            audioBitsPerSecond: 128000,
          });
        }
        const chunks: Blob[] =
          [];
        mediaRecorder.ondataavailable =
          (e) => {
            if (
              e.data.size > 0
            ) {
              chunks.push(
                e.data
              );
            }
          };
        mediaRecorder.start(
          1000
        );
        await audioContext.resume();
        await audioElement
          .play()
          .catch((e) =>
            console.warn(
              "Audio play warning:",
              e
            )
          );
        const fps = 30;
        const actualDuration =
          audioElement.duration ||
          targetDuration;
        const totalFrames =
          Math.ceil(
            actualDuration *
              fps
          );
        const frameInterval =
          1000 / fps;
        let currentFrame = 0;
        let imageIndex = 0;
        setGenerationProgress(
          40
        );
        await new Promise<void>(
          (resolve) => {
            const renderFrame =
              () => {
                if (
                  currentFrame >=
                  totalFrames
                ) {
                  resolve();
                  return;
                }
                const progress =
                  currentFrame /
                  totalFrames;
                ctx.clearRect(
                  0,
                  0,
                  width,
                  height
                );
                const gradient =
                  ctx.createLinearGradient(
                    0,
                    0,
                    width,
                    height
                  );
                gradient.addColorStop(
                  0,
                  "#1a1a2e"
                );
                gradient.addColorStop(
                  0.5,
                  "#16213e"
                );
                gradient.addColorStop(
                  1,
                  "#0f3460"
                );
                ctx.fillStyle =
                  gradient;
                ctx.fillRect(
                  0,
                  0,
                  width,
                  height
                );
                if (
                  imageElements.length >
                  0
                ) {
                  const img =
                    imageElements[
                      imageIndex %
                        imageElements.length
                    ];
                  const imgWidth = img.width;
                  const imgHeight = img.height;
                  const paddingPercent = 0.02;
                  const maxWidth = width * (1 - paddingPercent);
                  const maxHeight = height * (1 - paddingPercent);
                  const scaleX = maxWidth / imgWidth;
                  const scaleY = maxHeight / imgHeight;
                  const scale = Math.min(scaleX, scaleY);
                  let drawWidth = imgWidth * scale;
                  let drawHeight = imgHeight * scale;
                  let drawX = (width - drawWidth) / 2;
                  let drawY = (height - drawHeight) / 2;
                  const zoom =
                    1 +
                    Math.sin(
                      progress *
                        Math.PI *
                        4
                    ) *
                      0.015;
                  const scaledWidth =
                    drawWidth *
                    zoom;
                  const scaledHeight =
                    drawHeight *
                    zoom;
                  const offsetX =
                    (drawWidth -
                      scaledWidth) /
                    2;
                  const offsetY =
                    (drawHeight -
                      scaledHeight) /
                    2;
                  ctx.save();
                  ctx.shadowColor =
                    "rgba(0, 0, 0, 0.2)";
                  ctx.shadowBlur =
                    20;
                  ctx.shadowOffsetX =
                    0;
                  ctx.shadowOffsetY =
                    0;
                  const x =
                    drawX +
                    offsetX;
                  const y =
                    drawY +
                    offsetY;
                  const cornerRadius =
                    8;
                  ctx.beginPath();
                  ctx.moveTo(
                    x +
                      cornerRadius,
                    y
                  );
                  ctx.lineTo(
                    x +
                      scaledWidth -
                      cornerRadius,
                    y
                  );
                  ctx.quadraticCurveTo(
                    x +
                      scaledWidth,
                    y,
                    x +
                      scaledWidth,
                    y +
                      cornerRadius
                  );
                  ctx.lineTo(
                    x +
                      scaledWidth,
                    y +
                      scaledHeight -
                      cornerRadius
                  );
                  ctx.quadraticCurveTo(
                    x +
                      scaledWidth,
                    y +
                      scaledHeight,
                    x +
                      scaledWidth -
                      cornerRadius,
                    y +
                      scaledHeight
                  );
                  ctx.lineTo(
                    x +
                      cornerRadius,
                    y +
                      scaledHeight
                  );
                  ctx.quadraticCurveTo(
                    x,
                    y +
                      scaledHeight,
                    x,
                    y +
                      scaledHeight -
                      cornerRadius
                  );
                  ctx.lineTo(
                    x,
                    y +
                      cornerRadius
                  );
                  ctx.quadraticCurveTo(
                    x,
                    y,
                    x +
                      cornerRadius,
                    y
                  );
                  ctx.closePath();
                  ctx.clip();
                  ctx.drawImage(
                    img,
                    x,
                    y,
                    scaledWidth,
                    scaledHeight
                  );
                  ctx.restore();
                  ctx.save();
                  ctx.strokeStyle =
                    `rgba(255, 255, 255, ${
                      0.05 +
                      Math.sin(
                        progress *
                          Math.PI *
                          4
                      ) *
                        0.03
                    })`;
                  ctx.lineWidth = 1;
                  ctx.shadowColor =
                    "rgba(255, 255, 255, 0.05)";
                  ctx.shadowBlur =
                    10;
                  ctx.strokeRect(
                    drawX +
                      offsetX,
                    drawY +
                      offsetY,
                    scaledWidth,
                    scaledHeight
                  );
                  ctx.restore();
                }
                const overlayGradient =
                  ctx.createLinearGradient(
                    0,
                    height - 100,
                    0,
                    height
                  );
                overlayGradient.addColorStop(
                  0,
                  "rgba(0,0,0,0)"
                );
                overlayGradient.addColorStop(
                  1,
                  "rgba(0,0,0,0.7)"
                );
                ctx.fillStyle =
                  overlayGradient;
                ctx.fillRect(
                  0,
                  height - 100,
                  width,
                  100
                );
                ctx.textAlign =
                  "center";
                ctx.textBaseline =
                  "bottom";
                const nameScale =
                  1 +
                  Math.sin(
                    progress *
                      Math.PI *
                      2
                  ) *
                    0.015;
                ctx.save();
                ctx.translate(
                  width / 2,
                  height - 45
                );
                ctx.scale(
                  nameScale,
                  nameScale
                );
                ctx.font =
                  "bold 40px Arial";
                ctx.fillStyle =
                  "#ffffff";
                ctx.shadowColor =
                  "rgba(0, 0, 0, 0.8)";
                ctx.shadowBlur =
                  12;
                ctx.fillText(
                  productName ||
                    "Product",
                  0,
                  0
                );
                ctx.restore();
                const priceScale =
                  1 +
                  Math.sin(
                    progress *
                      Math.PI *
                      2 +
                      0.5
                  ) *
                    0.015;
                ctx.save();
                ctx.translate(
                  width / 2,
                  height - 12
                );
                ctx.scale(
                  priceScale,
                  priceScale
                );
                ctx.font =
                  "bold 24px Arial";
                ctx.fillStyle =
                  "#fbbf24";
                ctx.shadowColor =
                  "rgba(251, 191, 36, 0.3)";
                ctx.shadowBlur =
                  15;
                ctx.fillText(
                  `₹${
                    price || "0"
                  }`,
                  0,
                  0
                );
                ctx.restore();
                ctx.shadowBlur =
                  0;
                ctx.strokeStyle =
                  `rgba(251, 191, 36, ${
                    0.15 +
                    Math.sin(
                      progress *
                        Math.PI *
                        4
                    ) *
                      0.1
                  })`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(
                  width / 2 -
                    70,
                  height - 35
                );
                ctx.lineTo(
                  width / 2 +
                    70,
                  height - 35
                );
                ctx.stroke();
                const progressPercent =
                  40 +
                  (currentFrame /
                    totalFrames) *
                    55;
                setGenerationProgress(
                  Math.min(
                    progressPercent,
                    95
                  )
                );
                if (
                  currentFrame >
                    0 &&
                  currentFrame %
                    (fps * 4) ===
                    0
                ) {
                  imageIndex =
                    (imageIndex +
                      1) %
                    imageElements.length;
                }
                currentFrame++;
                setTimeout(
                  renderFrame,
                  frameInterval
                );
              };
            renderFrame();
          }
        );
        setGenerationProgress(
          97
        );
        setGenerationMessage(
          "Finalizing video..."
        );
        audioElement.pause();
        audioElement.currentTime =
          0;
        await audioContext.close();
        const finalBlob =
          await new Promise<Blob>(
            (resolve) => {
              if (mediaRecorder) {
                mediaRecorder.onstop =
                  () => {
                    const blob =
                      new Blob(
                        chunks,
                        {
                          type: selectedMimeType,
                        }
                      );
                    resolve(blob);
                  };
                mediaRecorder.stop();
                setTimeout(() => {
                  if (
                    chunks.length >
                    0
                  ) {
                    resolve(
                      new Blob(
                        chunks,
                        {
                          type: selectedMimeType,
                        }
                      )
                    );
                  }
                }, 5000);
              } else {
                resolve(new Blob(chunks, { type: selectedMimeType }));
              }
            }
          );
        let uploadBlob = finalBlob;
        if (!selectedMimeType.startsWith('video/mp4')) {
          try {
            const videoElement = document.createElement('video');
            const videoUrl = URL.createObjectURL(finalBlob);
            videoElement.src = videoUrl;
            await new Promise<void>((resolve) => {
              videoElement.onloadedmetadata = () => resolve();
              videoElement.load();
            });
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Could not get canvas context');
            }
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, {
              mimeType: 'video/mp4;codecs=avc1,mp4a',
              videoBitsPerSecond: 5000000,
              audioBitsPerSecond: 128000,
            });
            const newChunks: Blob[] = [];
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) newChunks.push(e.data);
            };
            recorder.start(1000);
            videoElement.play();
            const duration = videoElement.duration || targetDuration;
            const fps = 30;
            const totalFrames = Math.ceil(duration * fps);
            let frame = 0;
            await new Promise<void>((resolve) => {
              const interval = setInterval(() => {
                if (frame >= totalFrames) {
                  clearInterval(interval);
                  recorder.stop();
                  resolve();
                  return;
                }
                ctx.drawImage(videoElement, 0, 0, 1280, 720);
                frame++;
              }, 1000 / fps);
            });
            URL.revokeObjectURL(videoUrl);
            const convertedBlob = await new Promise<Blob>((resolve) => {
              recorder.onstop = () => {
                resolve(new Blob(newChunks, { type: 'video/mp4' }));
              };
              setTimeout(() => {
                if (newChunks.length > 0) {
                  resolve(new Blob(newChunks, { type: 'video/mp4' }));
                }
              }, 5000);
            });
            uploadBlob = convertedBlob as Blob;
          } catch (conversionError) {
            console.warn('MP4 conversion failed, using original format:', conversionError);
            uploadBlob = finalBlob;
          }
        }
        generatedVideoObjectUrl =
          URL.createObjectURL(
            uploadBlob
          );
        setVideoUrl(
          generatedVideoObjectUrl
        );
        setVideoKitUrl(
          generatedVideoObjectUrl
        );
        setExistingVideoUrl(
          generatedVideoObjectUrl
        );
        setGenerationProgress(
          98
        );
        setGenerationMessage(
          "Uploading to Cloudinary..."
        );
        setCloudinaryUploadStatus("uploading");
        setCloudinaryUploadProgress(0);
        setCloudinaryUploadMessage("Starting upload...");
        const cloudinaryResult = await uploadToCloudinary(
          uploadBlob,
          (progress) => {
            setCloudinaryUploadProgress(progress);
            setCloudinaryUploadMessage(`Uploading... ${Math.round(progress)}%`);
          }
        );
        if (cloudinaryResult && cloudinaryResult.publicId) {
          setCloudinaryPublicId(cloudinaryResult.publicId);
          setCloudinaryUploadStatus("success");
          setCloudinaryUploadMessage("Video uploaded successfully!");
          setGenerationMessage("Video uploaded to Cloudinary successfully!");
          const cloudinaryUrl = getCloudinaryVideoUrl(cloudinaryResult.publicId);
          if (cloudinaryUrl) {
            setExistingVideoUrl(cloudinaryUrl);
          }
        } else {
          throw new Error("Failed to upload to Cloudinary");
        }
        setGenerationProgress(
          100
        );
        URL.revokeObjectURL(
          finalAudioUrl
        );
      } catch (err: any) {
        console.error(
          "Video generation error:",
          err
        );
        setGenerationError(
          err.message ||
            "Failed to generate video"
        );
        setCloudinaryUploadStatus("error");
        setCloudinaryUploadMessage(err.message || "Upload failed");
        setGenerationProgress(
          0
        );
        setGenerationMessage("");
        if (
          generatedVideoObjectUrl
        ) {
          URL.revokeObjectURL(
            generatedVideoObjectUrl
          );
        }
      } finally {
        setIsGenerating(false);
      }
    };
  const renderProgress = () => (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map(
          (step, idx) => (
            <React.Fragment
              key={step.id}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 ${
                    currentStep >
                    step.id
                      ? "bg-purple-600 text-white shadow-md"
                      : currentStep ===
                        step.id
                      ? "bg-purple-600 text-white shadow-lg ring-4 ring-purple-200"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {currentStep >
                  step.id ? (
                    <Check
                      size={16}
                    />
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`text-[10px] sm:text-xs mt-1.5 hidden sm:block font-medium ${
                    currentStep >=
                    step.id
                      ? "text-purple-700"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx <
                steps.length -
                  1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-4 rounded-full ${
                    currentStep >
                    step.id
                      ? "bg-purple-500"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </React.Fragment>
          )
        )}
      </div>
      <p className="text-center text-sm font-medium text-purple-700 mt-2 sm:hidden">
        Step {currentStep} of{" "}
        {steps.length}:{" "}
        {
          steps[
            currentStep - 1
          ]?.label
        }
      </p>
    </div>
  );
  if (isLoadingProduct) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 px-3 sm:px-0">
        <div className="flex items-center gap-4 mb-6 sm:mb-8">
          <Link
            to="/all-videos"
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft
              size={20}
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
            {isEditMode
              ? "Edit Product"
              : "Create New Product"}
          </h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <Loader2
            size={32}
            className="animate-spin text-purple-600"
          />
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto space-y-8 px-3 sm:px-0">
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <Link
          to="/all-videos"
          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft
            size={20}
          />
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
          {isEditMode
            ? "Edit Product"
            : "Create New Product"}
        </h1>
      </div>
      <div className="card-glass p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
        {renderProgress()}
        <div className="space-y-6">
          {currentStep === 1 && (
            <ProductDetails
              productName={
                productName
              }
              setProductName={
                setProductName
              }
              price={price}
              setPrice={setPrice}
              costPrice={costPrice}
              setCostPrice={setCostPrice}
              stockQuantity={stockQuantity}
              setStockQuantity={setStockQuantity}
              sku={sku}
              setSku={setSku}
              description={
                description
              }
              setDescription={
                setDescription
              }
              errors={errors}
              categories={
                categories
              }
              selectedCategoryId={
                selectedCategoryId
              }
              setSelectedCategoryId={
                setSelectedCategoryId
              }
              selectedSubcategoryId={
                selectedSubcategoryId
              }
              setSelectedSubcategoryId={
                setSelectedSubcategoryId
              }
              showAddCategory={
                showAddCategory
              }
              setShowAddCategory={
                setShowAddCategory
              }
              newCategoryName={
                newCategoryName
              }
              setNewCategoryName={
                setNewCategoryName
              }
              newCategoryError={
                newCategoryError
              }
              setNewCategoryError={
                setNewCategoryError
              }
              showAddSubcategory={
                showAddSubcategory
              }
              setShowAddSubcategory={
                setShowAddSubcategory
              }
              newSubcategoryName={
                newSubcategoryName
              }
              setNewSubcategoryName={
                setNewSubcategoryName
              }
              newSubcategoryError={
                newSubcategoryError
              }
              setNewSubcategoryError={
                setNewSubcategoryError
              }
              variants={variants}
              setVariants={
                setVariants
              }
              handleAddVariant={
                handleAddVariant
              }
              handleRemoveVariant={
                handleRemoveVariant
              }
              handleVariantChange={
                handleVariantChange
              }
              handleFillAllVariantsPrice={
                handleFillAllVariantsPrice
              }
              handleAddNewCategory={
                handleAddNewCategory
              }
              handleCancelAddCategory={
                handleCancelAddCategory
              }
              handleAddNewSubcategory={
                handleAddNewSubcategory
              }
              handleCancelAddSubcategory={
                handleCancelAddSubcategory
              }
              handleCategoryChange={
                handleCategoryChange
              }
              handleSubcategoryChange={
                handleSubcategoryChange
              }
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
            <div>
              <ImageUpload
                images={images}
                previews={previews}
                imageKitUrls={
                  imageKitUrls
                }
                imageUploadingStates={
                  imageUploadingStates
                }
                imageUploadErrors={
                  imageUploadErrors
                }
                activeImageTab={
                  activeImageTab
                }
                setActiveImageTab={
                  setActiveImageTab
                }
                unsplashQuery={
                  unsplashQuery
                }
                setUnsplashQuery={
                  setUnsplashQuery
                }
                unsplashResults={
                  unsplashResults
                }
                isSearchingUnsplash={
                  isSearchingUnsplash
                }
                unsplashError={
                  unsplashError
                }
                downloadingUnsplashIds={
                  downloadingUnsplashIds
                }
                handleImageUpload={
                  handleImageUpload
                }
                removeImage={
                  removeImage
                }
                handleUploadToImageKit={
                  handleUploadToImageKit
                }
                handleUnsplashSearch={
                  handleUnsplashSearch
                }
                handleDownloadUnsplash={
                  handleDownloadUnsplash
                }
                onImageClick={(index: number) => {
                  const allImages = [...previews, ...imageKitUrls.filter(Boolean)];
                  if (allImages.length > 0) {
                    setLightboxIndex(index < allImages.length ? index : 0);
                    setLightboxOpen(true);
                  }
                }}
              />
            </div>
          )}
          {currentStep === 3 && (
            <VideoConfiguration
              audioMode={
                audioMode
              }
              setAudioMode={
                setAudioMode as (mode: "text" | "upload" | "record" | "clone") => void
              }
              audioScript={
                audioScript
              }
              setAudioScript={
                setAudioScript
              }
              audioLanguage={
                audioLanguage
              }
              setAudioLanguage={
                setAudioLanguage
              }
              voiceGender={
                voiceGender
              }
              setVoiceGender={
                setVoiceGender
              }
              customAudioFile={
                customAudioFile
              }
              setCustomAudioFile={
                setCustomAudioFile
              }
              customAudioUrl={
                customAudioUrl
              }
              setCustomAudioUrl={
                setCustomAudioUrl
              }
              isRecording={
                isRecording
              }
              setIsRecording={
                setIsRecording
              }
              recordedAudioBlob={
                recordedAudioBlob
              }
              setRecordedAudioBlob={
                setRecordedAudioBlob
              }
              recordedAudioUrl={
                recordedAudioUrl
              }
              setRecordedAudioUrl={
                setRecordedAudioUrl
              }
              recordingError={
                recordingError
              }
              videoLength={
                videoLength
              }
              setVideoLength={
                setVideoLength
              }
              isGenerating={
                isGenerating
              }
              generationProgress={
                generationProgress
              }
              generationMessage={
                generationMessage
              }
              generationError={
                generationError
              }
              imagesLength={
                previews.length
              }
              audioGenerating={
                audioGenerating
              }
              audioError={
                audioError
              }
              handlePreviewTTS={
                handlePreviewTTS
              }
              handleGenerateVideo={
                handleGenerateVideo
              }
              startRecording={
                startRecording
              }
              stopRecording={
                stopRecording
              }
              existingVideoUrl={
                existingVideoUrl
              }
              cloudinaryUploadStatus={cloudinaryUploadStatus}
              cloudinaryUploadProgress={cloudinaryUploadProgress}
              cloudinaryUploadMessage={cloudinaryUploadMessage}
              cloudinaryPublicId={cloudinaryPublicId}
              voices={voices}
              setVoices={setVoices}
              selectedVoiceId={selectedVoiceId}
              setSelectedVoiceId={setSelectedVoiceId}
              clonedAudioBlob={clonedAudioBlob}
              setClonedAudioBlob={setClonedAudioBlob}
              clonedAudioUrl={clonedAudioUrl}
              setClonedAudioUrl={setClonedAudioUrl}
              isGeneratingClonedAudio={isGeneratingClonedAudio}
              setIsGeneratingClonedAudio={setIsGeneratingClonedAudio}
              clonedAudioError={clonedAudioError}
              setClonedAudioError={setClonedAudioError}
              createVoice={createVoice}
              fetchVoices={fetchVoices}
              generateClonedAudio={generateClonedAudio}
              deleteVoice={deleteVoice}
              videoSource={videoSource}
              setVideoSource={setVideoSource}
              uploadedVideoFile={uploadedVideoFile}
              setUploadedVideoFile={setUploadedVideoFile}
              uploadedVideoUrl={uploadedVideoUrl}
              setUploadedVideoUrl={setUploadedVideoUrl}
              uploadVideoToCloudinary={uploadVideoToCloudinary}
            />
          )}
          {currentStep === 4 && (
            <VideoPreviewComponent
              videoUrl={videoUrl}
              previews={previews}
              setCurrentStep={
                setCurrentStep
              }
              setShowConfig={
                setShowConfig
              }
            />
          )}
          {currentStep === 5 && (
            <PostToInstagram
              isPosting={
                isPosting ||
                isUploadingImages
              }
              postSuccess={
                postSuccess
              }
              createError={
                createError
              }
              productName={
                productName
              }
              price={price}
              description={
                description
              }
              handlePostToInstagram={
                handlePostToInstagram
              }
              resetAllState={
                resetAllState
              }
              isEditMode={
                isEditMode
              }
              videoUrl={videoUrl || existingVideoUrl}
              cloudinaryPublicId={cloudinaryPublicId}
              onUpdateProductOnly={handleSaveOnly}
              isUpdatingOnly={isUpdatingOnly}
              updateOnlyError={updateOnlyError}
              onBack={handleBack}
              productId={productId}
            />
          )}
        </div>
        {currentStep < 5 && (
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-6 border-t">
            <button
              onClick={
                handleBack
              }
              disabled={
                currentStep ===
                  1 ||
                (currentStep ===
                  3 &&
                  isGenerating)
              }
              className="btn-secondary flex items-center justify-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowLeft
                size={20}
              />
              Back
            </button>
            <button
              onClick={
                handleNext
              }
              disabled={
                (currentStep ===
                  2 &&
                  images.length ===
                    0 &&
                  imageKitUrls.filter(
                    Boolean
                  ).length ===
                    0) ||
                (currentStep ===
                  3 &&
                  !videoUrl &&
                  !showConfig) ||
                (currentStep ===
                  3 &&
                  isGenerating) ||
                (currentStep ===
                  3 &&
                  generationError !==
                    null) ||
                (currentStep ===
                  3 &&
                  cloudinaryUploadStatus === "uploading")
              }
              className="btn-primary flex items-center justify-center gap-2 px-6 sm:px-8 py-2 sm:py-3"
            >
              {currentStep ===
              4
                ? "Continue to Post"
                : "Next"}
              <ArrowRight
                size={20}
              />
            </button>
          </div>
        )}
      </div>
      <ImageLightbox
        images={[...previews, ...imageKitUrls.filter(Boolean)]}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onImageChange={(index: number) => setLightboxIndex(index)}
      />
    </div>
  );
};
export default CreateProduct;
