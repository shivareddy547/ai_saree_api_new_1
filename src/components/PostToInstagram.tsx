import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, Loader2, ExternalLink, RefreshCw, X, Play, Pause, Edit2, Check, Send, FileText, Save, ArrowLeft } from 'lucide-react';
import axios from 'axios';
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
interface PostToInstagramProps {
  isPosting: boolean;
  postSuccess: boolean;
  createError: string | null;
  productName: string;
  price: string;
  description: string;
  handlePostToInstagram: () => void;
  resetAllState: () => void;
  isEditMode?: boolean;
  videoUrl?: string | null;
  cloudinaryPublicId?: string | null;
  onUpdateProductOnly?: () => void;
  isUpdatingOnly?: boolean;
  updateOnlyError?: string | null;
  onBack?: () => void;
  productId?: string | null;
}
const PostToInstagram: React.FC<PostToInstagramProps> = ({
  isPosting,
  postSuccess,
  createError,
  productName,
  price,
  description,
  handlePostToInstagram,
  resetAllState,
  isEditMode = false,
  videoUrl = null,
  cloudinaryPublicId = null,
  onUpdateProductOnly,
  isUpdatingOnly = false,
  updateOnlyError = null,
  onBack,
  productId = null,
}) => {
  const [instagramStatus, setInstagramStatus] = useState<{
    connected: boolean;
    username?: string;
    accountType?: string;
    mediaCount?: number;
    error?: string;
  }>({ connected: false });
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authUrl, setAuthUrl] = useState<string>('');
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [showCaptionEditor, setShowCaptionEditor] = useState(false);
  const [caption, setCaption] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  // New state for media type selection
  const [mediaType, setMediaType] = useState<'REELS' | 'VIDEO'>('REELS');
  const videoRef = useRef<HTMLVideoElement>(null);
  const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
  });
  apiClient.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  const generateDefaultCaption = () => {
    let captionText = '';
    if (productName) captionText += `✨ ${productName}`;
    if (description) captionText += `\n\n${description}`;
    if (price) captionText += `\n\n💰 Price: ₹${price}`;
    captionText += `\n\n#Fashion #Style #NewCollection`;
    return captionText;
  };
  useEffect(() => {
    if (!showCaptionEditor && !caption) {
      setCaption(generateDefaultCaption());
    }
  }, [productName, description, price]);
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  const checkInstagramStatus = async () => {
    setIsLoadingStatus(true);
    setStatusError(null);
    try {
      const response = await apiClient.get('/instagram/status');
      if (response.data.success) {
        setInstagramStatus(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to check Instagram status:', err);
      setStatusError(err.response?.data?.message || 'Failed to check Instagram connection');
      setInstagramStatus({ connected: false });
    } finally {
      setIsLoadingStatus(false);
    }
  };
  const disconnectInstagram = async () => {
    try {
      await apiClient.post('/instagram/disconnect');
      setInstagramStatus({ connected: false });
      setStatusError(null);
      setPublishSuccess(null);
    } catch (err: any) {
      console.error('Failed to disconnect Instagram:', err);
      setStatusError(err.response?.data?.message || 'Failed to disconnect Instagram');
    }
  };
  const openAuthPopup = async () => {
    setConnectError(null);
    try {
      const redirectUri = `${window.location.origin}/instagram-callback`;
      const urlResponse = await apiClient.get('/instagram/oauth-url', {
        params: { redirectUri }
      });
      if (urlResponse.data.success) {
        sessionStorage.setItem('instagram_redirect_uri', redirectUri);
        const authUrl = urlResponse.data.data.url;
        setAuthUrl(authUrl);
        setShowAuthModal(true);
        const width = 500;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          authUrl,
          'instagram-auth',
          `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,scrollbars=yes`
        );
        if (!popup) {
          setConnectError('Please allow popups for this website to connect Instagram');
          setShowAuthModal(true);
          return;
        }
        setPopupWindow(popup);
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            setPopupWindow(null);
            setShowAuthModal(false);
          }
        }, 500);
      }
    } catch (err: any) {
      console.error('Failed to get OAuth URL:', err);
      setConnectError(err.response?.data?.message || 'Failed to initiate Instagram connection');
    }
  };
  const handleAuthComplete = async (code: string) => {
    const redirectUri = sessionStorage.getItem('instagram_redirect_uri');
    if (!redirectUri) return;
    try {
      setIsConnecting(true);
      const response = await apiClient.post('/instagram/connect', {
        code,
        redirectUri
      });
      if (response.data.success) {
        await checkInstagramStatus();
        setShowAuthModal(false);
        setConnectError(null);
        if (popupWindow) {
          popupWindow.close();
          setPopupWindow(null);
        }
        setStatusError(null);
      }
    } catch (err: any) {
      console.error('Failed to connect Instagram:', err);
      setConnectError(err.response?.data?.message || 'Failed to connect Instagram account');
    } finally {
      setIsConnecting(false);
      sessionStorage.removeItem('instagram_redirect_uri');
    }
  };
  const handlePublishToInstagram = async () => {
    if (!cloudinaryPublicId) {
      setPublishError('Please generate a video and upload to Cloudinary first');
      return;
    }
    const cloudinaryVideoUrl = `https://res.cloudinary.com/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'lovecart'}/video/upload/${cloudinaryPublicId}.mp4`;
    if (!instagramStatus.connected) {
      setPublishError('Please connect Instagram account first');
      return;
    }
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);
    try {
      const response = await apiClient.post('/instagram/post', {
        video_url: cloudinaryVideoUrl,
        media_type: mediaType, // send selected media type
        caption: caption || generateDefaultCaption()
      });
      if (response.data.success) {
        setPublishSuccess('Video posted to Instagram successfully! 🎉');
      }
    } catch (err: any) {
      console.error('Failed to post to Instagram:', err);
      setPublishError(err.response?.data?.message || 'Failed to post video to Instagram');
    } finally {
      setIsPublishing(false);
    }
  };
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      if (error) {
        setConnectError(`Instagram authorization failed: ${error}`);
        window.history.replaceState({}, document.title, window.location.pathname);
        setShowAuthModal(false);
        if (popupWindow) {
          popupWindow.close();
          setPopupWindow(null);
        }
        return;
      }
      if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        await handleAuthComplete(code);
      }
    };
    handleOAuthCallback();
  }, []);
  useEffect(() => {
    checkInstagramStatus();
  }, []);
  const renderVideoPreview = () => {
    if (!videoUrl) {
      return (
        <div className="bg-gray-100 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
          <Play size={40} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">No video generated yet</p>
          <p className="text-xs text-gray-400">Go back and generate a video first</p>
        </div>
      );
    }
    return (
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full max-h-80 object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          controls={false}
        />
        <div className="absolute bottom-4 left-4 flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="bg-white/20 backdrop-blur-sm text-white p-2 rounded-full hover:bg-white/30 transition-colors"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
            {cloudinaryPublicId ? 'Cloudinary ✅' : 'Local'}
          </span>
        </div>
        {cloudinaryPublicId && (
          <div className="absolute bottom-4 right-4 text-white text-xs bg-green-600/80 px-2 py-1 rounded">
            MP4 Ready
          </div>
        )}
      </div>
    );
  };
  const renderCaptionEditor = () => {
    if (showCaptionEditor) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Edit Caption</label>
            <button
              onClick={() => {
                setShowCaptionEditor(false);
                setCaption(generateDefaultCaption());
              }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
            placeholder="Write your Instagram caption..."
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{caption.length} characters</span>
            <button
              onClick={() => setShowCaptionEditor(false)}
              className="text-purple-600 hover:text-purple-800 font-medium"
            >
              <Check size={14} className="inline mr-1" />
              Done
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{caption || generateDefaultCaption()}</p>
            <p className="text-xs text-gray-400 mt-1">{caption.length} characters</p>
          </div>
          <button
            onClick={() => setShowCaptionEditor(true)}
            className="text-purple-600 hover:text-purple-800 p-1 hover:bg-purple-50 rounded transition-colors"
            title="Edit caption"
          >
            <Edit2 size={18} />
          </button>
        </div>
      </div>
    );
  };
  if (postSuccess) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-green-600">
          {isEditMode ? 'Product Updated Successfully!' : 'Product Created Successfully!'}
        </h3>
        <p className="text-gray-600">
          {isEditMode 
            ? 'Your product has been updated and is now ready to be posted.'
            : 'Your product has been created and is now ready to be posted.'
          }
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={resetAllState}
            className="btn-primary flex items-center justify-center gap-2"
          >
            Create Another Product
          </button>
          <button
            onClick={handlePublishToInstagram}
            disabled={!instagramStatus.connected || isPublishing || !cloudinaryPublicId}
            className={`bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${
              !instagramStatus.connected || isPublishing || !cloudinaryPublicId ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isPublishing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            {!cloudinaryPublicId ? 'Upload to Cloudinary First' : 'Post to Instagram'}
          </button>
        </div>
        {!cloudinaryPublicId && (
          <p className="text-sm text-yellow-600 text-center">
            ⚠️ Video must be uploaded to Cloudinary before posting to Instagram
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
        <span className="w-6 h-6 flex items-center justify-center">
          <svg className="w-6 h-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        </span>
        {isEditMode ? 'Update & Post to Instagram' : 'Post to Instagram'}
      </h2>
      {connectError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span>{connectError}</span>
        </div>
      )}
      {publishError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span>{publishError}</span>
        </div>
      )}
      {publishSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 text-green-700">
          <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span>{publishSuccess}</span>
        </div>
      )}
      {updateOnlyError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span>{updateOnlyError}</span>
        </div>
      )}
      <div className={`rounded-lg p-4 border ${
        instagramStatus.connected 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {isLoadingStatus ? (
              <Loader2 size={20} className="animate-spin text-purple-600" />
            ) : instagramStatus.connected ? (
              <>
                <CheckCircle size={20} className="text-green-600" />
                <div>
                  <p className="font-medium text-green-700">Connected to Instagram</p>
                  <p className="text-sm text-green-600">
                    @{instagramStatus.username || 'Unknown'} • {instagramStatus.accountType || 'Business'} • {instagramStatus.mediaCount || 0} posts
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={20} className="text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-700">Not Connected</p>
                  <p className="text-sm text-yellow-600">
                    {statusError || 'Connect your Instagram account to post videos'}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {instagramStatus.connected ? (
              <button
                onClick={disconnectInstagram}
                className="text-sm text-red-600 hover:text-red-800 border border-red-300 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={openAuthPopup}
                disabled={isConnecting}
                className="text-sm text-purple-600 hover:text-purple-800 border border-purple-300 px-3 py-1 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1"
              >
                {isConnecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {isConnecting ? 'Connecting...' : 'Connect Instagram'}
              </button>
            )}
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <ExternalLink size={14} />
              Open Instagram
            </a>
          </div>
        </div>
        {isConnecting && !instagramStatus.connected && (
          <div className="mt-2 text-sm text-purple-600 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Completing authentication...
          </div>
        )}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-medium text-slate-700 flex items-center gap-2">
            <Play size={18} className="text-purple-600" />
            Video Preview
          </h3>
        </div>
        <div className="p-4">
          {renderVideoPreview()}
        </div>
      </div>
      {cloudinaryPublicId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle size={16} className="flex-shrink-0" />
          <span>Video uploaded to Cloudinary: <strong>{cloudinaryPublicId}</strong></span>
        </div>
      )}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-medium text-slate-700 flex items-center gap-2">
            <FileText size={18} className="text-purple-600" />
            Caption
          </h3>
        </div>
        <div className="p-4">
          {renderCaptionEditor()}
          <button
            onClick={() => {
              setCaption(generateDefaultCaption());
              setShowCaptionEditor(true);
            }}
            className="mt-2 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
          >
            <RefreshCw size={12} />
            Regenerate from product details
          </button>
        </div>
      </div>
      {/* Media Type Selection */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-medium text-slate-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="2.18" />
              <line x1="8" y1="2" x2="8" y2="22" />
              <line x1="16" y1="2" x2="16" y2="22" />
              <line x1="2" y1="8" x2="22" y2="8" />
              <line x1="2" y1="16" x2="22" y2="16" />
            </svg>
            Post Type
          </h3>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-sm text-gray-600 mb-2">
            Select the type of post. If you see "AI Creator" label, try switching to "Video" instead of "Reels".
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mediaType"
                value="REELS"
                checked={mediaType === 'REELS'}
                onChange={() => setMediaType('REELS')}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">Reels</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mediaType"
                value="VIDEO"
                checked={mediaType === 'VIDEO'}
                onChange={() => setMediaType('VIDEO')}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700">Video (Feed)</span>
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Note: "Video" posts appear in the main feed, "Reels" appear in the Reels tab. The "AI Creator" label may appear based on Instagram's detection; changing the post type may help avoid it.
          </p>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6 space-y-3 border border-gray-200">
        <h3 className="font-medium text-slate-700">Product Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Name:</span>
            <span className="ml-2 font-medium">{productName || 'Not set'}</span>
          </div>
          <div>
            <span className="text-gray-500">Price:</span>
            <span className="ml-2 font-medium">₹{price || '0'}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-gray-500">Description:</span>
            <p className="mt-1 text-gray-700">{description || 'No description provided'}</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-gray-500">Cloudinary Video:</span>
            <span className="ml-2 font-medium">{cloudinaryPublicId ? '✅ Uploaded' : '❌ Not uploaded'}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-gray-500">Product Saved:</span>
            <span className="ml-2 font-medium">{productId ? '✅ Yes' : '❌ No'}</span>
          </div>
        </div>
      </div>
      {createError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span>{createError}</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        {onBack && (
          <button
            onClick={onBack}
            disabled={isPosting || isPublishing || isUpdatingOnly || isConnecting}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ArrowLeft size={20} />
            Back
          </button>
        )}
        <button
          onClick={handlePublishToInstagram}
          disabled={isPosting || !instagramStatus.connected || !cloudinaryPublicId || isConnecting || isPublishing || isUpdatingOnly || !productId}
          className={`flex-1 btn-primary flex items-center justify-center gap-2 py-3 ${
            (!instagramStatus.connected || !cloudinaryPublicId || isConnecting || isPublishing || isUpdatingOnly || !productId) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isPublishing || isPosting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              {isPublishing ? 'Posting to Instagram...' : isPosting ? 'Saving...' : ''}
            </>
          ) : isConnecting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Send size={20} />
              {!cloudinaryPublicId ? 'Upload to Cloudinary First' : 'Post to Instagram'}
            </>
          )}
        </button>
        <button
          onClick={() => {
            if (onUpdateProductOnly) {
              onUpdateProductOnly();
            } else {
              console.warn('onUpdateProductOnly prop is not provided');
            }
          }}
          disabled={isUpdatingOnly || isPosting || isPublishing || isConnecting}
          className={`flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
            (isUpdatingOnly || isPosting || isPublishing || isConnecting) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isUpdatingOnly ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              {isEditMode ? 'Updating...' : 'Saving...'}
            </>
          ) : (
            <>
              <Save size={20} />
              {isEditMode ? 'Update Only' : 'Save'}
            </>
          )}
        </button>
        <button
          onClick={resetAllState}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Start Over
        </button>
      </div>
      {!productId && !isEditMode && (
        <p className="text-sm text-yellow-600 text-center">
          ⚠️ Please save the product first before posting to Instagram.
        </p>
      )}
      {!instagramStatus.connected && !isConnecting && (
        <p className="text-sm text-yellow-600 text-center">
          ⚠️ Connect your Instagram account to enable posting
        </p>
      )}
      {!cloudinaryPublicId && (
        <p className="text-sm text-yellow-600 text-center">
          ⚠️ Video must be uploaded to Cloudinary before posting to Instagram
        </p>
      )}
      {isConnecting && (
        <p className="text-sm text-purple-600 text-center">
          🔄 Please wait while we connect your Instagram account...
        </p>
      )}
      {isPublishing && (
        <p className="text-sm text-purple-600 text-center">
          📤 Posting your video to Instagram...
        </p>
      )}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Connect Instagram</h3>
                  <p className="text-sm text-gray-500">Authorize your Instagram account</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  if (popupWindow) {
                    popupWindow.close();
                    setPopupWindow(null);
                  }
                  setConnectError('Authentication cancelled');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-800 mb-2">Redirecting to Instagram</h4>
              <p className="text-gray-600 text-sm mb-6">
                You'll be redirected to Instagram to authorize your account. 
                Please allow popups if prompted.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (authUrl) {
                      const width = 500;
                      const height = 700;
                      const left = window.screenX + (window.outerWidth - width) / 2;
                      const top = window.screenY + (window.outerHeight - height) / 2;
                      const popup = window.open(
                        authUrl,
                        'instagram-auth',
                        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,scrollbars=yes`
                      );
                      if (!popup) {
                        setConnectError('Please allow popups for this website');
                        return;
                      }
                      setPopupWindow(popup);
                      setShowAuthModal(false);
                    }
                  }}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <ExternalLink size={18} />
                  Open Instagram Login
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(authUrl).then(() => {
                      alert('Authorization URL copied to clipboard. You can paste it in a new tab to complete authentication.');
                    }).catch(() => {
                      alert(`Please open this URL in your browser:\n\n${authUrl}`);
                    });
                  }}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  Copy authorization URL
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-2xl">
              <p className="text-sm text-gray-500">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Secure connection
              </p>
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  if (popupWindow) {
                    popupWindow.close();
                    setPopupWindow(null);
                  }
                  setConnectError('Authentication cancelled');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PostToInstagram;
