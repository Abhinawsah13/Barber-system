import axios from "axios";

import { API_BASE_URL } from '../config/server';

const API_URL = `${API_BASE_URL}/auth`;

export const registerUser = (data) => {
  return axios.post(`${API_URL}/register`, data);
};

export const loginUser = (data) => {
  return axios.post(`${API_URL}/login`, data);
};
