import { zodResolver } from '@hookform/resolvers/zod'
import {
  ImagePlus,
  Trash2,
  UploadCloud,
  Plus,
  ArrowUpRight,
  ChevronDown,
  Check,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

  const selectedCategory = watch('category')

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.url))
    }
  }, [images])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mt-2 sm:mb-8 xl:flex-nowrap xl:items-center">
          <div className="w-full xl:w-auto">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              Add Product
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 sm:text-base">
              Define a new SKU within your inventory.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 xl:flex xl:w-auto xl:shrink-0 xl:flex-nowrap xl:gap-3">
            {/* Discard button */}
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="group flex items-center justify-center gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-3 shadow-sm transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-md active:scale-[0.98] xl:justify-start xl:px-4 xl:py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 transition-colors group-hover:bg-slate-200 dark:group-hover:bg-slate-600">
                ✕
              </span>
              <span className="flex flex-col items-start leading-none">
                <span className="mb-1 inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-rose-500 dark:text-rose-400 ring-1 ring-rose-100 dark:ring-rose-900/50">
                  Draft
                </span>
                <span className="text-sm font-black tracking-[-0.02em] text-slate-800 dark:text-slate-200">
                  Discard Draft
                </span>
                <span className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  Remove unsaved changes
                </span>
              </span>
            </button>

            {/* Save button */}
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={loading}
              className="group flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-3 py-3 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 transition-all duration-200 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-900/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 xl:justify-start xl:px-4 xl:py-2.5"
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

        <form className="grid grid-cols-1 gap-5 xl:grid-cols-[1.9fr_0.9fr] xl:gap-6">
          <div className="flex flex-col gap-5">

            {/* Basic Info */}
            <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700 sm:p-7">
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Basic Info
              </p>

              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Product Name
                  </label>
                  <input
                    {...register('name')}
                    placeholder="e.g. Minimalist Ceramic Vessel"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    rows={4}
                    placeholder="Describe the product…"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Category dropdown */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Category
                    </label>

                    <div ref={categoryDropdownRef} className="relative">
                      <input type="hidden" {...register('category')} />

                      <button
                        type="button"
                        onClick={() => setIsCategoryOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 px-4 py-3 text-left text-sm text-slate-800 dark:text-slate-200 shadow-sm outline-none transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-white dark:hover:bg-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]" />
                          <span className="truncate font-medium">{selectedCategory}</span>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                            isCategoryOpen ? 'rotate-180 text-indigo-500' : ''
                          }`}
                        />
                      </button>

                      {isCategoryOpen && (
                        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.4)] ring-1 ring-slate-100 dark:ring-slate-700">
                          <div className="max-h-64 overflow-y-auto">
                            {categories.map((category) => {
                              const isSelected = selectedCategory === category
                              return (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => {
                                    setValue('category', category, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    })
                                    setIsCategoryOpen(false)
                                  }}
                                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm transition-colors ${
                                    isSelected
                                      ? 'bg-indigo-50 dark:bg-indigo-950/60 font-semibold text-indigo-700 dark:text-indigo-400'
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  <span>{category}</span>
                                  {isSelected && <Check size={16} className="text-indigo-600 dark:text-indigo-400" />}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SKU */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      SKU / Barcode
                    </label>
                    <input
                      {...register('sku')}
                      placeholder="EM-100452-9"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30"
                    />
                    {errors.sku && (
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.sku.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <input
              type="hidden"
              {...register('selling_price', {
                setValueAs: (value) => (value === '' ? 0 : Number(value)),
              })}
            />

            <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
              {/* Pricing */}
              <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700 sm:p-7">
                <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Pricing
                </p>
                <div className="space-y-4">
                  {[
                    { label: 'Buying Price', field: 'buying_price' as const },
                    { label: 'MRP (Retail)', field: 'mrp' as const },
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {label}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400 dark:text-slate-500">
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
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 py-3 pl-8 pr-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30"
                        />
                      </div>
                      {errors[field] && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors[field]?.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Inventory */}
              <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700 sm:p-7">
                <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Inventory
                </p>
                <div className="space-y-4">
                  {[
                    { label: 'Stock Quantity', field: 'stock_quantity' as const, placeholder: '0' },
                    { label: 'Low Stock Threshold', field: 'low_stock_threshold' as const, placeholder: '5' },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {label}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={placeholder}
                        {...register(field, {
                          setValueAs: (value) => (value === '' ? 0 : Number(value)),
                        })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none transition focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30"
                      />
                      {errors[field] && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{(errors[field] as any)?.message}</p>
                      )}
                    </div>
                  ))}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Unit
                    </label>
                    <input
                      {...register('unit')}
                      placeholder="pcs"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* API error */}
            {apiError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-600 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-900/50">
                {apiError}
              </div>
            )}
          </div>

          {/* Media sidebar */}
          <div className="xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Media
                </p>
                <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {imageCountText}
                </span>
              </div>

              {/* Upload zone */}
              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-700/30 px-5 py-8 text-center transition hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 sm:py-10">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-slate-700 text-indigo-500 dark:text-indigo-400 shadow-sm ring-1 ring-slate-100 dark:ring-slate-600 transition group-hover:scale-105 group-hover:ring-indigo-200 dark:group-hover:ring-indigo-700">
                  <UploadCloud size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Upload Product Images
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
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
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <ImagePlus size={14} className="text-indigo-500 dark:text-indigo-400" />
                  Gallery Preview
                </div>

                {images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-2">
                    {images.map((image, index) => (
                      <div
                        key={image.url}
                        className={`group relative overflow-hidden rounded-xl border bg-slate-50 dark:bg-slate-700 transition hover:-translate-y-0.5 hover:shadow-md ${
                          index === 0
                            ? 'border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-100 dark:ring-indigo-900/50'
                            : 'border-slate-200 dark:border-slate-600'
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
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 text-red-500 dark:text-red-400 shadow-sm backdrop-blur-sm transition hover:scale-105 hover:bg-red-50 dark:hover:bg-red-950/60"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 py-7 text-center text-sm text-slate-400 dark:text-slate-500">
                    No images selected yet.
                  </div>
                )}
              </div>

              {/* Tips */}
              <div className="mt-5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 p-4 text-xs text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-100 dark:ring-indigo-900/50">
                <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.45)]" />
                  Smart media tips
                </div>
                <p className="leading-relaxed text-indigo-600 dark:text-indigo-400">
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