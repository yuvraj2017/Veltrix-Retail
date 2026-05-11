import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Sparkles, Trash2, UploadCloud, Plus, ArrowUpRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { createProduct } from '../features/products/api'
import { productSchema, type ProductFormValues } from '../features/products/schemas'

const categories = ['Apparel', 'Electronics', 'Accessories', 'Footwear', 'Home Decor', 'Other']
const MAX_IMAGES = 5

type PreviewImage = {
  file: File
  url: string
}

export default function AddProductPage() {
  const navigate = useNavigate()
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<PreviewImage[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      category: 'Apparel',
      description: '',
      buying_price: 0,
      mrp: 0,
      selling_price: 0,
      stock_quantity: 0,
      low_stock_threshold: 5,
      unit: 'pcs',
      barcode: '',
      is_active: true,
      main_image_url: '',
    },
  })

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.url))
    }
  }, [images])

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return

    const incoming = Array.from(fileList)
      .filter((file) =>
        ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)
      )
      .slice(0, MAX_IMAGES - images.length)
      .map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }))

    setImages((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES))
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      const removed = prev[index]
      if (removed) URL.revokeObjectURL(removed.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  const onSubmit = async (values: ProductFormValues) => {
    setApiError('')
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('sku', values.sku)
      formData.append('category', values.category)
      formData.append('description', values.description || '')
      formData.append('buying_price', String(values.buying_price))
      formData.append('mrp', String(values.mrp))
      formData.append('selling_price', String(values.selling_price))
      formData.append('stock_quantity', String(values.stock_quantity))
      formData.append('low_stock_threshold', String(values.low_stock_threshold))
      formData.append('unit', values.unit)
      formData.append('barcode', values.barcode || '')
      formData.append('is_active', String(values.is_active))
      formData.append('main_image_url', '')

      images.forEach((image) => {
        formData.append('images', image.file)
      })

      await createProduct(formData)
      navigate('/products')
    } catch (error: any) {
      setApiError(error?.response?.data?.detail || 'Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  const imageCountText = useMemo(() => `${images.length}/${MAX_IMAGES} images selected`, [images.length])

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-5xl font-bold tracking-[-0.02em] text-slate-900">Add Product</h1>
            <p className="mt-2 text-2xl text-slate-600">Define a new SKU within your inventory.</p>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="group relative overflow-hidden rounded-[18px] border border-indigo-200/70 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-[1px] hover:border-violet-200 hover:bg-slate-50 hover:shadow-[0_10px_24px_rgba(99,102,241,0.10)] active:translate-y-0"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_35%)]" />
              <span className="relative flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition duration-300 group-hover:scale-105 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                  ✕
                </span>

                <span className="flex flex-col items-start leading-none">
                  <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-slate-400">
                    Draft
                  </span>
                  <span className="text-[15px] font-semibold">Discard Draft</span>
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={loading}
              className="group relative overflow-hidden rounded-[22px] border border-indigo-300/50 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-5 py-3.5 text-white shadow-[0_14px_32px_rgba(79,70,229,0.24)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_18px_38px_rgba(79,70,229,0.30)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_35%)]" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span className="relative flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/25 backdrop-blur-sm">
                  <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
                </span>

                <span className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/75">
                    Inventory
                  </span>
                  <span className="text-base font-semibold">
                    {loading ? 'Saving...' : 'Save Product'}
                  </span>
                </span>

                <ArrowUpRight
                  size={18}
                  className="ml-1 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
            </button>

            {/* <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={loading}
              className="group relative overflow-hidden rounded-[18px] border border-indigo-300/60 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-5 py-3 text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition-all duration-300 hover:-translate-y-[1px] hover:border-violet-200/80 hover:shadow-[0_12px_28px_rgba(99,102,241,0.28)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20),transparent_35%)]" />
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span className="relative flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-sm transition duration-300 group-hover:scale-105">
                  +
                </span>

                <span className="flex flex-col items-start leading-none">
                  <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/75">
                    Inventory
                  </span>
                  <span className="text-[15px] font-semibold">
                    {loading ? 'Saving...' : 'Save Product'}
                  </span>
                </span>

                <span className="ml-1 text-base opacity-80 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  ↗
                </span>
              </span>
            </button> */}
          </div>
        </div>

        <form className="grid grid-cols-[1.9fr_0.9fr] gap-8">
          <div className="space-y-8">
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <p className="mb-6 text-sm font-semibold tracking-[0.18em] text-slate-700">BASIC INFO</p>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">PRODUCT NAME</label>
                  <input
                    {...register('name')}
                    placeholder="e.g. Minimalist Ceramic Vessel"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">DESCRIPTION</label>
                  <textarea
                    {...register('description')}
                    rows={5}
                    placeholder="Describe the product..."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">CATEGORY</label>
                    <select
                      {...register('category')}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    >
                      {categories.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">SKU / BARCODE</label>
                    <input
                      {...register('sku')}
                      placeholder="EM-100452-9"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <p className="mb-6 text-sm font-semibold tracking-[0.18em] text-slate-700">PRICING</p>

                <div className="space-y-6">
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
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <p className="mb-6 text-sm font-semibold tracking-[0.18em] text-slate-700">INVENTORY</p>

                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">STOCK QUANTITY</label>
                    <input type="number" {...register('stock_quantity')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">LOW STOCK THRESHOLD</label>
                    <input type="number" {...register('low_stock_threshold')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">UNIT</label>
                    <input {...register('unit')} className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
                  </div>
                </div>
              </div>
            </div>

            {apiError && (
              <div className="rounded-2xl bg-red-50 px-4 py-4 text-sm text-red-600">
                {apiError}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-semibold tracking-[0.18em] text-slate-700">MEDIA</p>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                {imageCountText}
              </span>
            </div>

            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm transition group-hover:scale-105">
                <UploadCloud size={26} />
              </div>
              <p className="text-lg font-semibold text-slate-800">Upload Product Images</p>
              <p className="mt-2 text-sm text-slate-500">Click or drag images here • PNG, JPG, WEBP • Max 5</p>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>

            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ImagePlus size={16} className="text-indigo-600" />
                Gallery Preview
              </div>

              {images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((image, index) => (
                    <div
                      key={image.url}
                      className={`group relative overflow-hidden rounded-2xl border bg-slate-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        index === 0 ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'
                      }`}
                    >
                      <img src={image.url} alt={`Preview ${index + 1}`} className="h-32 w-full object-cover transition duration-300 group-hover:scale-105" />

                      {index === 0 && (
                        <span className="absolute left-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-sm">
                          Main
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm backdrop-blur-sm transition hover:scale-105 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No images selected yet.
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-indigo-50 p-4 text-sm text-slate-600">
              <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700">
                <Sparkles size={16} />
                Smart media tips
              </div>
              <p>The first image becomes the main product image automatically.</p>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  )
}