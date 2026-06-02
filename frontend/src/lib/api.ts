// // import axios from 'axios'
// // import { clearToken, getToken } from './auth-storage'

// // // export const api = axios.create({
// // //   baseURL: import.meta.env.VITE_API_BASE_URL,
// // //   headers: {
// // //     'Content-Type': 'application/json',
// // //   },
// // // })



// // export const api = axios.create({
// //   baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
// // })

// // api.interceptors.request.use((config) => {
// //   const token = localStorage.getItem('access_token')
// //   if (token) {
// //     config.headers.Authorization = `Bearer ${token}`
// //   }
// //   return config
// // })

// // api.interceptors.request.use((config) => {
// //   const token = getToken()

// //   if (token) {
// //     config.headers.Authorization = `Bearer ${token}`
// //   }

// //   return config
// // })

// // api.interceptors.response.use(
// //   (response) => response,
// //   (error) => {
// //     if (error.response?.status === 401) {
// //       clearToken()
// //     }
// //     return Promise.reject(error)
// //   }
// // )



// import axios from 'axios'

// export const api = axios.create({
//   baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
// })

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem('access_token')

//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`
//   }

//   return config
// })





import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})