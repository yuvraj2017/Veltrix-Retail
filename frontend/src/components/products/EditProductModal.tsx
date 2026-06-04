import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  PencilLine,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { deleteProductImage } from '../../features/products/api'
import { productSchema, type ProductFormValues } from '../../features/products/schemas'
import type { Product } from '../../features/products/types'

const categories = ['Apparel', 'Electronics', 'Accessories', 'Footwear', 'Home Decor', 'Other']
const MAX_IMAGES = 5
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

type PreviewImage = {
  file: File
  url: string
}

// ─── Category Dropdown ───────────────────────────────────────────────────────

function CategoryDropdown({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (cat: string) => {
    onChange(cat)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-4 text-left transition-all duration-200
          bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
          ${
            isOpen
              ? 'border-indigo-400 dark:border-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-900/40'
              : 'border-slate-300 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:ring-4 hover:ring-indigo-100 dark:hover:ring-indigo-900/40'
          }`}
      >
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-indigo-500" />
        <span className="flex-1 text-[15px] font-medium">{value}</span>
        <ChevronDown
          size={18}
          className={`text-indigo-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[18px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col gap-0.5 p-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelect(cat)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-[15px] text-left transition-colors duration-100
                  ${
                    cat === value
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-medium'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
              >
                <span>{cat}</span>
                {cat === value && <Check size={16} className="text-indigo-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Edit Product Modal ───────────────────────────────────────────────────────

export function EditProductModal({
  product,
  onClose,
  onSubmit,
  loading,
}: {
  product: Product | null
  onClose: () => void
  onSubmit: (values: ProductFormValues, newImages: File[]) => Promise<void>
  loading: boolean
}) {
  const [newImages, setNewImages] = useState<PreviewImage[]>([])
  const [existingImages, setExistingImages] = useState<Product['images']>([])
  const [removingImageId, setRemovingImageId] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  })

  useEffect(() => {
    if (product) {
      setExistingImages(product.images || [])
      setNewImages([])
      reset({
        name: product.name,
        sku: product.sku,
        category: product.category,
        description: product.description || '',
        buying_price: Number(product.buying_price),
        mrp: Number(product.mrp),
        selling_price: Number(product.selling_price),
        stock_quantity: product.stock_quantity,
        low_stock_threshold: product.low_stock_threshold,
        unit: product.unit,
        barcode: product.barcode || '',
        is_active: product.is_active,
        main_image_url: product.main_image_url || '',
      })
    }
  }, [product, reset])

  useEffect(() => {
    return () => {
      newImages.forEach((image) => URL.revokeObjectURL(image.url))
    }
  }, [newImages])

  if (!product) return null

  const remainingSlots = Math.max(0, MAX_IMAGES - existingImages.length - newImages.length)

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || remainingSlots <= 0) return
    const incoming = Array.from(fileList)
      .filter((file) => ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type))
      .slice(0, remainingSlots)
      .map((file) => ({ file, url: URL.createObjectURL(file) }))
    setNewImages((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES - existingImages.length))
  }

  const removeNewImage = (index: number) => {
    setNewImages((prev) => {
      const removed = prev[index]
      if (removed) URL.revokeObjectURL(removed.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleRemoveExistingImage = async (imageId: number) => {
    if (!window.confirm('Remove this image?')) return
    setRemovingImageId(imageId)
    try {
      await deleteProductImage(imageId)
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId))
    } finally {
      setRemovingImageId(null)
    }
  }

  const mainImageSrc = product.main_image_url
    ? product.main_image_url.startsWith('/uploads')
      ? `${API_BASE_URL}${product.main_image_url}`
      : product.main_image_url
    : null

  const inputClass =
    'w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 py-4 outline-none transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/40'

  const labelClass = 'mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300'

  const sectionHeadingClass =
    'text-sm font-semibold tracking-[0.14em] text-slate-700 dark:text-slate-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="custom-scrollbar modal-scroll max-h-[92vh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-[32px] bg-white dark:bg-slate-900 shadow-2xl dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)]">

        {/* Modal header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 px-8 py-7">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              INVENTORY EDITOR
            </p>
            <h2 className="mt-2 text-4xl font-bold text-slate-900 dark:text-slate-100">
              Edit Product: {product.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl p-3 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((values) =>
            onSubmit(values, newImages.map((item) => item.file))
          )}
          className="grid grid-cols-[1.5fr_1fr] gap-8 px-8 py-8"
        >
          {/* ── Left column ── */}
          <div className="space-y-6">
            <div>
              <p className={`mb-5 ${sectionHeadingClass}`}>PRODUCT DETAILS</p>

              <div className="space-y-5">
                {/* Product title */}
                <div>
                  <label className={labelClass}>PRODUCT TITLE</label>
                  <input {...register('name')} className={inputClass} />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                  )}
                </div>

                {/* Category + SKU */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>CATEGORY</label>
                    <Controller
                      name="category"
                      control={control}
                      render={({ field }) => (
                        <CategoryDropdown value={field.value} onChange={field.onChange} />
                      )}
                    />
                    {errors.category && (
                      <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>SKU ID</label>
                    <input {...register('sku')} className={inputClass} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={labelClass}>DESCRIPTION</label>
                  <textarea {...register('description')} rows={4} className={inputClass} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Pricing */}
              <div className="space-y-5">
                <p className={sectionHeadingClass}>PRICING</p>
                <div>
                  <label className={labelClass}>BUYING PRICE</label>
                  <input type="text" step="0.01" {...register('buying_price')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>MRP (RETAIL)</label>
                  <input type="text" step="0.01" {...register('mrp')} className={inputClass} />
                </div>
              </div>

              {/* Inventory */}
              <div className="space-y-5">
                <p className={sectionHeadingClass}>INVENTORY</p>
                <div>
                  <label className={labelClass}>STOCK QUANTITY</label>
                  <input type="text" {...register('stock_quantity')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>LOW STOCK ALERT</label>
                  <input type="text" {...register('low_stock_threshold')} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>UNIT</label>
                  <input {...register('unit')} className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className={sectionHeadingClass}>PRODUCT MEDIA</p>
              <span className="rounded-full bg-indigo-50 dark:bg-indigo-950 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {existingImages.length + newImages.length}/{MAX_IMAGES}
              </span>
            </div>

            {/* Main image */}
            {mainImageSrc ? (
              <div className="overflow-hidden rounded-3xl bg-[#f5f6fb] dark:bg-slate-800 p-3">
                <img
                  src={mainImageSrc}
                  alt={product.name}
                  className="h-72 w-full rounded-3xl object-cover"
                />
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                No Main Image
              </div>
            )}

            {/* Image grid */}
            <div className="grid grid-cols-4 gap-3">
              {existingImages.map((image) => {
                const src = image.image_url.startsWith('/uploads')
                  ? `${API_BASE_URL}${image.image_url}`
                  : image.image_url
                return (
                  <div
                    key={image.id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 transition hover:shadow-md"
                  >
                    <img
                      src={src}
                      alt="Product"
                      className="h-20 w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    {image.is_main && (
                      <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-semibold uppercase text-white">
                        Main
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={removingImageId === image.id}
                      onClick={() => handleRemoveExistingImage(image.id)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 text-red-500 shadow-sm backdrop-blur-sm transition hover:scale-105 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}

              {newImages.map((image, index) => (
                <div
                  key={image.url}
                  className="group relative overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-700 bg-slate-50 dark:bg-slate-800 ring-2 ring-indigo-100 dark:ring-indigo-900"
                >
                  <img
                    src={image.url}
                    alt="New upload"
                    className="h-20 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 text-red-500 shadow-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Upload zone */}
            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-6 py-8 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 hover:shadow-[0_10px_30px_rgba(99,102,241,0.10)]">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm transition duration-300 group-hover:scale-110 group-hover:shadow-md">
                <UploadCloud size={22} />
              </div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                Upload New Images
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                PNG, JPG, WEBP • Max 5 total
              </p>
              <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {remainingSlots > 0
                  ? `${remainingSlots} slot${remainingSlots > 1 ? 's' : ''} remaining`
                  : 'Image limit reached'}
              </p>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
                disabled={remainingSlots <= 0}
              />
            </label>

            {/* Smart assistant tip */}
            <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 p-4 text-sm text-slate-600 dark:text-slate-300 border border-transparent dark:border-indigo-900/50">
              <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-400">
                <Sparkles size={16} />
                Smart assistant
              </div>
              <p>
                Existing images can now be removed directly. Newly added images can be previewed
                before saving.
              </p>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="col-span-2 flex items-center justify-end gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-lg font-semibold text-slate-700 dark:text-slate-300 transition hover:text-slate-900 dark:hover:text-slate-100"
            >
              Discard Changes
            </button>

            <button
              type="submit"
              disabled={loading}
              className="group relative overflow-hidden rounded-[22px] bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-5 py-3.5 text-white shadow-[0_14px_32px_rgba(79,70,229,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(79,70,229,0.35)] active:translate-y-0 disabled:opacity-70"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_35%)]" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/25 backdrop-blur-sm">
                  <PencilLine
                    size={18}
                    className="transition-transform duration-300 group-hover:rotate-12"
                  />
                </span>
                <span className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/75">
                    Inventory
                  </span>
                  <span className="text-base font-semibold">
                    {loading ? 'Saving...' : 'Save Product Updates'}
                  </span>
                </span>
                <ArrowUpRight
                  size={18}
                  className="ml-1 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}