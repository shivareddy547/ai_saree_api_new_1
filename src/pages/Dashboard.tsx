import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, ShoppingBag, PlayCircle, PlusCircle, RefreshCw, Instagram, Eye, Calendar, Video, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
interface Product {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  defaultSku: string;
  videoUrl: string;
  videoKitUrl: string;
  cloudinaryVideoPublicId: string;
  views: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  images: { url: string; position: number }[];
  variants: { price: number; size: string; color: string }[];
}
interface InstagramStatus {
  connected: boolean;
  username?: string;
  accountType?: string;
  mediaCount?: number;
  error?: string;
  accountId?: string;
  tokenExpiresAt?: string;
}
interface DashboardStats {
  totalVideos: number;
  totalViews: number;
  conversionRate: string;
  publishedVideos: number;
  draftVideos: number;
}
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus>({ connected: false });
  const [isLoadingInstagram, setIsLoadingInstagram] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    totalViews: 0,
    conversionRate: '0%',
    publishedVideos: 0,
    draftVideos: 0,
  });
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
  // Fetch products and stats
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/products');
      if (response.data.success) {
        const productData = response.data.data || [];
        setProducts(productData);
        // Calculate stats
        const totalVideos = productData.length;
        const totalViews = productData.reduce((sum: number, p: Product) => sum + (p.views || 0), 0);
        const publishedVideos = productData.filter((p: Product) => p.status === 'published').length;
        const draftVideos = productData.filter((p: Product) => p.status === 'draft').length;
        const conversionRate = totalVideos > 0 
          ? ((publishedVideos / totalVideos) * 100).toFixed(1) + '%'
          : '0%';
        setStats({
          totalVideos,
          totalViews,
          conversionRate,
          publishedVideos,
          draftVideos,
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  // Fetch Instagram status
  const fetchInstagramStatus = async () => {
    setIsLoadingInstagram(true);
    try {
      const response = await apiClient.get('/instagram/status');
      if (response.data.success) {
        setInstagramStatus(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch Instagram status:', err);
      setInstagramStatus({ 
        connected: false, 
        error: err.response?.data?.message || 'Failed to check Instagram connection' 
      });
    } finally {
      setIsLoadingInstagram(false);
    }
  };
  // Initial data load
  useEffect(() => {
    fetchProducts();
    fetchInstagramStatus();
  }, []);
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  // Get recent videos (last 3)
  const recentVideos = products
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);
  const statCards = [
    { 
      label: 'Total Videos', 
      value: stats.totalVideos.toString(), 
      icon: Video, 
      color: 'text-blue-600', 
      bg: 'bg-blue-100',
      subText: `${stats.publishedVideos} published, ${stats.draftVideos} draft`
    },
    { 
      label: 'Total Views', 
      value: stats.totalViews > 1000 ? `${(stats.totalViews / 1000).toFixed(1)}k` : stats.totalViews.toString(), 
      icon: Eye, 
      color: 'text-purple-600', 
      bg: 'bg-purple-100' 
    },
    { 
      label: 'Conversion Rate', 
      value: stats.conversionRate, 
      icon: TrendingUp, 
      color: 'text-green-600', 
      bg: 'bg-green-100' 
    },
    { 
      label: 'Instagram Status', 
      value: instagramStatus.connected ? 'Connected' : 'Not Connected', 
      icon: Instagram, 
      color: instagramStatus.connected ? 'text-pink-600' : 'text-gray-400', 
      bg: instagramStatus.connected ? 'bg-pink-100' : 'bg-gray-100',
      subText: instagramStatus.connected 
        ? `@${instagramStatus.username || 'Unknown'} • ${instagramStatus.mediaCount || 0} posts` 
        : 'Connect to post videos'
    },
  ];
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your video products and Instagram integration</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              fetchProducts();
              fetchInstagramStatus();
            }}
            className="btn-secondary flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            disabled={loading || isLoadingInstagram}
          >
            {loading || isLoadingInstagram ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh
          </button>
          <Link to="/create-product" className="btn-primary flex items-center gap-2 px-4 py-2">
            <PlusCircle size={18} /> Create New Video
          </Link>
        </div>
      </div>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className="card-glass p-5 md:p-6 flex items-start gap-4">
            <div className={`${stat.bg} ${stat.color} p-3 rounded-xl flex-shrink-0`}>
              <stat.icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-slate-500 text-sm">{stat.label}</p>
              <p className="text-xl md:text-2xl font-bold text-slate-800 truncate">{stat.value}</p>
              {stat.subText && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{stat.subText}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Recent Videos */}
      <div className="card-glass p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-800">Recent Videos</h3>
          <Link to="/all-videos" className="text-sm text-purple-600 hover:text-purple-800 font-medium">
            View All →
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-purple-600" />
          </div>
        ) : recentVideos.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
            <Video size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No videos created yet</p>
            <Link to="/create-product" className="text-sm text-purple-600 hover:text-purple-800 font-medium mt-2 inline-block">
              Create your first video →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {recentVideos.map((video) => {
              const imageUrl = video.images?.[0]?.url || 
                'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=200&h=200&fit=crop';
              return (
                <Link 
                  key={video.id} 
                  to={`/edit-product?edit=${video.id}`}
                  className="group relative rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-300 bg-white"
                >
                  <div className="relative h-52 overflow-hidden bg-gray-100">
                    <img 
                      src={imageUrl} 
                      alt={video.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1610030469983-9857967a0196?w=200&h=200&fit=crop';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <p className="font-bold text-base leading-tight line-clamp-2">{video.name}</p>
                      <div className="flex items-center gap-3 text-xs opacity-80 mt-1">
                        <span className="flex items-center gap-1">
                          <Eye size={12} /> {video.views || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {formatDate(video.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full backdrop-blur-md ${
                      video.status === 'published' 
                        ? 'bg-green-500/80 text-white' 
                        : 'bg-yellow-500/80 text-white'
                    }`}>
                      {video.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    {video.cloudinaryVideoPublicId && (
                      <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-blue-500/80 text-white backdrop-blur-md">
                        Cloudinary
                      </span>
                    )}
                  </div>
                  {video.variants && video.variants.length > 0 && (
                    <div className="absolute bottom-16 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">
                      ₹{Math.min(...video.variants.map(v => v.price || 0))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {/* Instagram Connection Status Card */}
      <div className="card-glass p-6 border-l-4 border-l-pink-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${instagramStatus.connected ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-400'}`}>
              <Instagram size={22} />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800">Instagram Integration</h4>
              <p className="text-sm text-slate-500">
                {isLoadingInstagram ? (
                  'Checking connection...'
                ) : instagramStatus.connected ? (
                  `Connected as @${instagramStatus.username || 'Unknown'}`
                ) : (
                  instagramStatus.error || 'Not connected'
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {instagramStatus.connected ? (
              <>
                <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
                <button
                  onClick={() => {
                    navigate('/create-product?step=5');
                  }}
                  className="btn-primary text-sm px-4 py-2 flex items-center gap-1"
                >
                  <PlusCircle size={14} />
                  Post to Instagram
                </button>
              </>
            ) : (
              <Link
                to="/create-product?step=5"
                className="text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <Instagram size={14} />
                Connect Instagram
              </Link>
            )}
          </div>
        </div>
        {instagramStatus.connected && instagramStatus.tokenExpiresAt && (
          <div className="mt-3 text-xs text-slate-400 border-t border-gray-100 pt-3">
            Token expires: {new Date(instagramStatus.tokenExpiresAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric' 
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;
