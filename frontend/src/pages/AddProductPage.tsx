import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus,  Trash2, UploadCloud, Plus, ArrowUpRight } from 'lucide-react'
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
      .map((file) => ({ file, url: URL.createObjectURL(file) }))
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
      images.forEach((image) => formData.append('images', image.file))
      await createProduct(formData)
      navigate('/products')
    } catch (error: any) {
      setApiError(error?.response?.data?.detail || 'Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  const imageCountText = useMemo(
    () => `${images.length}/${MAX_IMAGES} images`,
    [images.length]
  )

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">

        {/* ── Header ──
            sm/md   : stacked (title full-width, buttons in 2-col grid)
            lg      : still stacked — tablet-like layout (no flex row at lg)
            xl+     : single row, title left — buttons right (desktop layout restored)
        */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 sm:mb-8 xl:flex-nowrap xl:items-center">

          {/* Title — full width until xl */}
          <div className="w-full xl:w-auto">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Add Product
            </h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              Define a new SKU within your inventory.
            </p>
          </div>

          {/* Buttons
              xs–lg : full-width 2-column grid (tablet-like, including laptop)
              xl+   : shrink-to-fit flex row (desktop)
          */}
          <div className="grid w-full grid-cols-2 gap-2 xl:flex xl:w-auto xl:shrink-0 xl:flex-nowrap xl:gap-3">

            {/* Discard */}
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="group flex items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-[0.98] xl:justify-start xl:px-4 xl:py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500 transition-colors group-hover:bg-slate-200">
                ✕
              </span>
              <span className="flex flex-col items-start leading-none">
                <span className="mb-1 inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-rose-500 ring-1 ring-rose-100">
                  Draft
                </span>

                <span className="text-sm font-black tracking-[-0.02em] text-slate-800">
                  Discard Draft
                </span>

                <span className="mt-1 text-[11px] font-medium text-slate-400">
                  Remove unsaved changes
                </span>
              </span>
            </button>

            {/* Save */}
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={loading}
              className="group flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-3 py-3 text-white shadow-md shadow-indigo-200 transition-all duration-200 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 xl:justify-start xl:px-4 xl:py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:rotate-90">
                <Plus size={15} />
              </span>
              <span className="flex flex-col items-start leading-none">
                <span className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-indigo-200">
                  Inventory
                </span>
                <span className="text-sm font-semibold">
                  {loading ? 'Saving…' : 'Save Product'}
                </span>
              </span>
              <ArrowUpRight
                size={14}
                className="ml-auto opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 xl:ml-0"
              />
            </button>
          </div>
        </div>

        {/* ── Main Grid ──
            Mobile/tablet/laptop (up to lg): single column, stacked
            xl+: [1.9fr] left | [0.9fr] right, side by side (desktop restored)
        */}
        <form className="grid grid-cols-1 gap-5 xl:grid-cols-[1.9fr_0.9fr] xl:gap-6">

          {/* ──────────────── LEFT COLUMN ──────────────── */}
          <div className="flex flex-col gap-5">

            {/* Basic Info */}
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-7">
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Basic Info
              </p>

              <div className="space-y-4 sm:space-y-5">
                {/* Product Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Product Name
                  </label>
                  <input
                    {...register('name')}
                    placeholder="e.g. Minimalist Ceramic Vessel"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    rows={4}
                    placeholder="Describe the product…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                {/* Category + SKU — 1 col on mobile, 2 col on sm+ */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Category
                    </label>
                    <select
                      {...register('category')}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      SKU / Barcode
                    </label>
                    <input
                      {...register('sku')}
                      placeholder="EM-100452-9"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                    {errors.sku && (
                      <p className="mt-1 text-xs text-red-500">{errors.sku.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Pricing + Inventory — 1 col on mobile, 2 col on md+ */}
            <input
              type="hidden"
              {...register('selling_price', {
                setValueAs: (value) => (value === '' ? 0 : Number(value)),
              })}
            />

            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0">

              {/* Pricing */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-7">
                <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Pricing
                </p>
                <div className="space-y-4">
                  {[
                    { label: 'Buying Price', field: 'buying_price' as const },
                    { label: 'MRP (Retail)', field: 'mrp' as const },
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {label}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">
                          ₹
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*[.]?[0-9]*"
                          placeholder="0"
                          {...register(field, {
                            setValueAs: (value) => (value === '' ? 0 : Number(value)),
                          })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-8 pr-4 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                        />
                      </div>
                      {errors[field] && (
                        <p className="mt-1 text-xs text-red-500">{errors[field]?.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Inventory */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-7">
                <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Inventory
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Stock Quantity
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      {...register('stock_quantity', {
                        setValueAs: (value) => (value === '' ? 0 : Number(value)),
                      })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                    {errors.stock_quantity && (
                      <p className="mt-1 text-xs text-red-500">{errors.stock_quantity.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Low Stock Threshold
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="5"
                      {...register('low_stock_threshold', {
                        setValueAs: (value) => (value === '' ? 0 : Number(value)),
                      })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Unit
                    </label>
                    <input
                      {...register('unit')}
                      placeholder="pcs"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* API Error */}
            {apiError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
                {apiError}
              </div>
            )}
          </div>

          {/* ──────────────── RIGHT COLUMN — Media ──────────────── */}
          {/* xl+: sticky sidebar. lg and below: normal flow (stacked) */}
          <div className="xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-7">

              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Media
                </p>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
                  {imageCountText}
                </span>
              </div>

              {/* Upload Zone */}
              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30 sm:py-10">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-500 shadow-sm ring-1 ring-slate-100 transition group-hover:scale-105 group-hover:ring-indigo-200">
                  <UploadCloud size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-700">Upload Product Images</p>
                <p className="mt-1 text-xs text-slate-400">
                  Click or drag · PNG, JPG, WEBP · Max {MAX_IMAGES}
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </label>

              {/* Gallery */}
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <ImagePlus size={14} className="text-indigo-500" />
                  Gallery Preview
                </div>

                {images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-2">
                    {images.map((image, index) => (
                      <div
                        key={image.url}
                        className={`group relative overflow-hidden rounded-xl border bg-slate-50 transition hover:-translate-y-0.5 hover:shadow-md ${index === 0
                          ? 'border-indigo-300 ring-2 ring-indigo-100'
                          : 'border-slate-200'
                          }`}
                      >
                        <img
                          src={image.url}
                          alt={`Preview ${index + 1}`}
                          className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        {index === 0 && (
                          <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white shadow">
                            Main
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm backdrop-blur-sm transition hover:scale-105 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 py-7 text-center text-sm text-slate-400">
                    No images selected yet.
                  </div>
                )}
              </div>

              {/* Tip */}
              <div className="mt-5 rounded-xl bg-indigo-50 p-4 text-xs text-indigo-700 ring-1 ring-indigo-100">
                <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.45)]" />
                  Smart media tips
                </div>
                <p className="leading-relaxed text-indigo-600">
                  The first image becomes the main product image automatically.
                </p>
              </div>
            </section>
          </div>

        </form>
      </div>
    </AppShell>
  )
}
