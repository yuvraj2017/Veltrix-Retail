import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowUpRight,
  // ImagePlus,
  PencilLine,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
      .filter((file) =>
        ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)
      )
      .slice(0, remainingSlots)
      .map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }))

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm">
      <div className="custom-scrollbar modal-scroll max-h-[92vh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-8 py-7">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-indigo-600">INVENTORY EDITOR</p>
            <h2 className="mt-2 text-4xl font-bold text-slate-900">Edit Product: {product.name}</h2>
          </div>

          <button onClick={onClose} className="rounded-2xl p-3 transition hover:bg-slate-100">
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((values) => onSubmit(values, newImages.map((item) => item.file)))}
          className="grid grid-cols-[1.5fr_1fr] gap-8 px-8 py-8"
        >
          <div className="space-y-6">
            <div>
              <p className="mb-5 text-sm font-semibold tracking-[0.14em] text-slate-700">PRODUCT DETAILS</p>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">PRODUCT TITLE</label>
                  <input {...register('name')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">CATEGORY</label>
                    <select {...register('category')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
                      {categories.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">SKU ID</label>
                    <input {...register('sku')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">DESCRIPTION</label>
                  <textarea {...register('description')} rows={4} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-5">
                <p className="text-sm font-semibold tracking-[0.14em] text-slate-700">PRICING</p>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">BUYING PRICE</label>
                  <input type="number" step="0.01" {...register('buying_price')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">MRP (RETAIL)</label>
                  <input type="number" step="0.01" {...register('mrp')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">SELLING PRICE</label>
                  <input type="number" step="0.01" {...register('selling_price')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                </div>
              </div>

              <div className="space-y-5">
                <p className="text-sm font-semibold tracking-[0.14em] text-slate-700">INVENTORY</p>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">STOCK QUANTITY</label>
                  <input type="number" {...register('stock_quantity')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">LOW STOCK ALERT</label>
                  <input type="number" {...register('low_stock_threshold')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">UNIT</label>
                  <input {...register('unit')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold tracking-[0.14em] text-slate-700">PRODUCT MEDIA</p>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                {existingImages.length + newImages.length}/{MAX_IMAGES}
              </span>
            </div>

            {mainImageSrc ? (
              <div className="overflow-hidden rounded-3xl bg-[#f5f6fb] p-3">
                <img
                  src={mainImageSrc}
                  alt={product.name}
                  className="h-72 w-full rounded-3xl object-cover"
                />
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                No Main Image
              </div>
            )}

            <div className="grid grid-cols-4 gap-3">
              {existingImages.map((image) => {
                const src = image.image_url.startsWith('/uploads')
                  ? `${API_BASE_URL}${image.image_url}`
                  : image.image_url

                return (
                  <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:shadow-md">
                    <img src={src} alt="Product" className="h-20 w-full object-cover transition duration-300 group-hover:scale-105" />

                    {image.is_main && (
                      <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-semibold uppercase text-white">
                        Main
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={removingImageId === image.id}
                      onClick={() => handleRemoveExistingImage(image.id)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm backdrop-blur-sm transition hover:scale-105 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}

              {newImages.map((image, index) => (
                <div key={image.url} className="group relative overflow-hidden rounded-2xl border border-indigo-200 bg-slate-50 ring-2 ring-indigo-100">
                  <img src={image.url} alt="New upload" className="h-20 w-full object-cover transition duration-300 group-hover:scale-105" />
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* {existingImages.length + newImages.length < MAX_IMAGES && (
                <label className="flex h-20 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50/40">
                  <ImagePlus size={18} />
                  <span className="mt-1 text-[11px] font-medium">Add</span>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>
              )} */}
            </div>

            {/* <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm transition group-hover:scale-105">
                <UploadCloud size={22} />
              </div>
              <p className="text-base font-semibold text-slate-800">Upload New Images</p>
              <p className="mt-1 text-sm text-slate-500">PNG, JPG, WEBP • Max 5 total</p>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label> */}



            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-[0_10px_30px_rgba(99,102,241,0.10)]">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm transition duration-300 group-hover:scale-110 group-hover:shadow-md">
                <UploadCloud size={22} />
              </div>

              <p className="text-base font-semibold text-slate-800">Upload New Images</p>

              <p className="mt-1 text-sm text-slate-500">
                PNG, JPG, WEBP • Max 5 total
              </p>

              <p className="mt-2 text-xs font-medium text-indigo-600">
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

            <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-slate-600">
              <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700">
                <Sparkles size={16} />
                Smart assistant
              </div>
              <p>Existing images can now be removed directly. Newly added images can be previewed before saving.</p>
            </div>
          </div>

          <div className="col-span-2 flex items-center justify-end gap-4 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-lg font-semibold text-slate-700 transition hover:text-slate-900"
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
                  <PencilLine size={18} className="transition-transform duration-300 group-hover:rotate-12" />
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