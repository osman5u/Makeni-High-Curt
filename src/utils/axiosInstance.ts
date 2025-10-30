import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 12000, // tighten default timeout for snappier failures
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Add Accept header to hint smaller payloads
    config.headers.Accept = 'application/json';
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Simple retry with backoff for transient network errors
async function retryRequest(originalRequest: any, retries = 1) {
  try {
    return await axiosInstance(originalRequest);
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((res) => setTimeout(res, 500));
    return retryRequest(originalRequest, retries - 1);
  }
}

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    // Fast retry on network timeouts or 5xx
    if (!error.response || (error.response.status >= 500 && error.response.status < 600)) {
      try {
        return await retryRequest(originalRequest, 1);
      } catch (_) {
        // fallthrough to normal handling
      }
    }

    // Avoid recursion for the refresh endpoint itself
    const isRefreshEndpoint = String(originalRequest?.url || '').includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshEndpoint) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh');
        if (refreshToken) {
          // Use a plain axios call (no interceptors) to refresh the token
          const baseURL = axiosInstance.defaults.baseURL || '/api';
          const response = await axios.post(`${baseURL}/auth/refresh`, {
            refresh: refreshToken,
          }, { timeout: 5000 }); // short timeout to avoid hanging

          const { access } = response.data;
          localStorage.setItem('access', access);

          // Retry the original request with new token
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${access}`,
          };
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('role');
        localStorage.removeItem('is_superuser');
        localStorage.removeItem('full_name');
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
