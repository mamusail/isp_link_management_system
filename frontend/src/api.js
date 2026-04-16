import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000",
});

// Attach token to every request
API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem("isp_user") || "null");
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// Auto-logout on 401
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("isp_user");
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default API;