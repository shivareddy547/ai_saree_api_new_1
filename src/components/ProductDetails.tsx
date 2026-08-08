import React from "react";
import { Package, Plus, Trash2, ChevronDown, X } from "lucide-react";
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
interface ProductDetailsProps {
  productName: string;
  setProductName: (value: string) => void;
  price: string;
  setPrice: (value: string) => void;
  sku: string;
  setSku: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  errors: { [key: string]: string };
  categories: Category[];
  selectedCategoryId: string;
  setSelectedCategoryId: (value: string) => void;
  selectedSubcategoryId: string;
  setSelectedSubcategoryId: (value: string) => void;
  showAddCategory: boolean;
  setShowAddCategory: (value: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (value: string) => void;
  newCategoryError: string | null;
  setNewCategoryError: (value: string | null) => void;
  showAddSubcategory: boolean;
  setShowAddSubcategory: (value: boolean) => void;
  newSubcategoryName: string;
  setNewSubcategoryName: (value: string) => void;
  newSubcategoryError: string | null;
  setNewSubcategoryError: (value: string | null) => void;
  variants: ProductVariant[];
  setVariants: (value: ProductVariant[]) => void;
  handleAddVariant: () => void;
  handleRemoveVariant: (id: string) => void;
  handleVariantChange: (id: string, field: keyof Omit<ProductVariant, "id">, value: string) => void;
  handleFillAllVariantsPrice: () => void;
  handleAddNewCategory: () => void;
  handleCancelAddCategory: () => void;
  handleAddNewSubcategory: () => void;
  handleCancelAddSubcategory: () => void;
  handleCategoryChange: (categoryId: string) => void;
  handleSubcategoryChange: (subcategoryId: string) => void;
  // New flag props
  showInFeaturedProducts: boolean;
  setShowInFeaturedProducts: (value: boolean) => void;
  showInBestSellers: boolean;
  setShowInBestSellers: (value: boolean) => void;
  showInNewArrivals: boolean;
  setShowInNewArrivals: (value: boolean) => void;
  showInPremiumProducts: boolean;
  setShowInPremiumProducts: (value: boolean) => void;
  // New product-level cost price and stock
  costPrice: string;
  setCostPrice: (value: string) => void;
  stockQuantity: string;
  setStockQuantity: (value: string) => void;
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
const ProductDetails: React.FC<ProductDetailsProps> = ({
  productName,
  setProductName,
  price,
  setPrice,
  sku,
  setSku,
  description,
  setDescription,
  errors,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
  selectedSubcategoryId,
  setSelectedSubcategoryId,
  showAddCategory,
  setShowAddCategory,
  newCategoryName,
  setNewCategoryName,
  newCategoryError,
  setNewCategoryError,
  showAddSubcategory,
  setShowAddSubcategory,
  newSubcategoryName,
  setNewSubcategoryName,
  newSubcategoryError,
  setNewSubcategoryError,
  variants,
  setVariants,
  handleAddVariant,
  handleRemoveVariant,
  handleVariantChange,
  handleFillAllVariantsPrice,
  handleAddNewCategory,
  handleCancelAddCategory,
  handleAddNewSubcategory,
  handleCancelAddSubcategory,
  handleCategoryChange,
  handleSubcategoryChange,
  showInFeaturedProducts,
  setShowInFeaturedProducts,
  showInBestSellers,
  setShowInBestSellers,
  showInNewArrivals,
  setShowInNewArrivals,
  showInPremiumProducts,
  setShowInPremiumProducts,
  costPrice,
  setCostPrice,
  stockQuantity,
  setStockQuantity,
}) => {
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const renderVariantCard = (variant: ProductVariant, index: number) => (
    <div key={variant.id} className="bg-gray-50 rounded-lg p-4 sm:p-5 border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-purple-700">Variant {index + 1}</span>
        <button
          onClick={() => handleRemoveVariant(variant.id)}
          className="text-red-400 hover:text-red-600 transition-colors p-1"
          title="Remove variant"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">SKU</label>
          <input
            type="text"
            value={variant.sku}
            onChange={(e) => handleVariantChange(variant.id, "sku", e.target.value)}
            placeholder="e.g. SAR-001"
            className="input-field text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Size</label>
          <input
            type="text"
            value={variant.size}
            onChange={(e) => handleVariantChange(variant.id, "size", e.target.value)}
            placeholder="e.g. M, L, XL"
            className="input-field text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Color</label>
          <input
            type="text"
            value={variant.color}
            onChange={(e) => handleVariantChange(variant.id, "color", e.target.value)}
            placeholder="e.g. Red, Blue"
            className="input-field text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Price (₹)</label>
          <input
            type="number"
            value={variant.price}
            onChange={(e) => handleVariantChange(variant.id, "price", e.target.value)}
            placeholder="0.00"
            className="input-field text-sm"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Cost Price (₹)</label>
          <input
            type="number"
            value={variant.costPrice}
            onChange={(e) => handleVariantChange(variant.id, "costPrice", e.target.value)}
            placeholder="0.00"
            className="input-field text-sm"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Stock</label>
          <input
            type="number"
            value={variant.stockQuantity}
            onChange={(e) => handleVariantChange(variant.id, "stockQuantity", e.target.value)}
            placeholder="0"
            className="input-field text-sm"
            min="0"
          />
        </div>
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
        <Package size={22} className="text-purple-600" />
        Product Details
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Enter product name"
            className={`input-field ${errors.productName ? "border-red-400 focus:ring-red-400" : ""}`}
          />
          {errors.productName && (
            <p className="text-xs text-red-500 mt-1">{errors.productName}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className={`input-field ${errors.price ? "border-red-400 focus:ring-red-400" : ""}`}
            min="0"
            step="0.01"
          />
          {errors.price && (
            <p className="text-xs text-red-500 mt-1">{errors.price}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (₹)</label>
          <input
            type="number"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="0.00"
            className="input-field"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
          <input
            type="number"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            placeholder="0"
            className="input-field"
            min="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Stock keeping unit"
            className="input-field"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your product..."
          rows={3}
          className="input-field resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          {showAddCategory ? (
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter new category name"
                  className={`input-field ${newCategoryError ? "border-red-400 focus:ring-red-400" : ""}`}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddNewCategory(); }}
                />
                {newCategoryError && (
                  <p className="text-xs text-red-500 mt-1">{newCategoryError}</p>
                )}
              </div>
              <button
                onClick={handleAddNewCategory}
                className="btn-primary text-sm px-3 py-2"
              >
                Add
              </button>
              <button
                onClick={handleCancelAddCategory}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedCategoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={`input-field appearance-none bg-white pr-8 ${errors.category ? "border-red-400 focus:ring-red-400" : ""}`}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
                <option value="__add_new__">+ Add New Category</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              {errors.category && (
                <p className="text-xs text-red-500 mt-1">{errors.category}</p>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory *</label>
          {selectedCategoryId ? (
            showAddSubcategory ? (
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newSubcategoryName}
                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                    placeholder="Enter new subcategory name"
                    className={`input-field ${newSubcategoryError ? "border-red-400 focus:ring-red-400" : ""}`}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddNewSubcategory(); }}
                  />
                  {newSubcategoryError && (
                    <p className="text-xs text-red-500 mt-1">{newSubcategoryError}</p>
                  )}
                </div>
                <button
                  onClick={handleAddNewSubcategory}
                  className="btn-primary text-sm px-3 py-2"
                >
                  Add
                </button>
                <button
                  onClick={handleCancelAddSubcategory}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedSubcategoryId}
                  onChange={(e) => handleSubcategoryChange(e.target.value)}
                  className={`input-field appearance-none bg-white pr-8 ${errors.subcategory ? "border-red-400 focus:ring-red-400" : ""}`}
                >
                  <option value="">Select a subcategory</option>
                  {selectedCategory?.subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add New Subcategory</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {errors.subcategory && (
                  <p className="text-xs text-red-500 mt-1">{errors.subcategory}</p>
                )}
              </div>
            )
          ) : (
            <p className="text-sm text-gray-400 py-2">Please select a category first</p>
          )}
        </div>
      </div>
      {/* New Flags Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="showInFeaturedProducts"
            checked={showInFeaturedProducts}
            onChange={(e) => setShowInFeaturedProducts(e.target.checked)}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="showInFeaturedProducts" className="text-sm font-medium text-gray-700">
            Show in Featured Products
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="showInBestSellers"
            checked={showInBestSellers}
            onChange={(e) => setShowInBestSellers(e.target.checked)}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="showInBestSellers" className="text-sm font-medium text-gray-700">
            Show in Best Sellers
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="showInNewArrivals"
            checked={showInNewArrivals}
            onChange={(e) => setShowInNewArrivals(e.target.checked)}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="showInNewArrivals" className="text-sm font-medium text-gray-700">
            Show in New Arrivals
          </label>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="showInPremiumProducts"
            checked={showInPremiumProducts}
            onChange={(e) => setShowInPremiumProducts(e.target.checked)}
            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
          />
          <label htmlFor="showInPremiumProducts" className="text-sm font-medium text-gray-700">
            Show in Premium Products
          </label>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-700">Variants</h3>
          <div className="flex gap-2">
            <button
              onClick={handleFillAllVariantsPrice}
              className="text-xs text-purple-600 hover:text-purple-800 border border-purple-300 px-2 py-1 rounded"
              title="Fill empty variant prices with the base price"
            >
              Fill Prices
            </button>
            <button
              onClick={handleAddVariant}
              className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5"
            >
              <Plus size={14} /> Add Variant
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {variants.map((variant, idx) => renderVariantCard(variant, idx))}
        </div>
      </div>
    </div>
  );
};
export default ProductDetails;
