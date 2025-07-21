import Cookies from 'js-cookie';
import axios from 'axios';

export interface User {
  id: string;
  first_name?: string;
  coins?: number;
  // Add more fields as needed
}

export class UserService {
  static async getCurrentUser(): Promise<User> {
    const accessToken = Cookies.get('access_token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://wanesni.com';
    if (!accessToken) {
      throw new Error('No access token found');
    }
    const response = await axios.get(`${apiUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.data || !response.data.data) {
      throw new Error('Invalid /users/me response');
    }
    return response.data.data;
  }
} 