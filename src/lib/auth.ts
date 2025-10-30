import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface User {
  id: number;
  username: string;
  email: string;
  password?: string;
  full_name: string;
  role: 'client' | 'lawyer' | 'admin';
  profile_picture?: string;
  contact_address?: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  verification_token?: string;
  verification_token_expires?: string;
  reset_token?: string;
  reset_token_expires?: string;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  role: string;
  is_superuser: boolean;
  full_name: string;
  user: User;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateTokens = (user: User): { access: string; refresh: string } => {
  const accessToken = jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role,
      is_superuser: user.is_superuser 
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: '14d' }
  );

  return { access: accessToken, refresh: refreshToken };
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const getUserById = (id: number) => {
  return prisma.user.findUnique({ where: { id } });
};

export const getUserByUsername = (username: string) => {
  return prisma.user.findUnique({ where: { username } });
};

export const getUserByEmail = (email: string) => {
  return prisma.user.findUnique({ where: { email } });
};

export const createUser = async (userData: {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: 'client' | 'lawyer' | 'admin';
  profile_picture?: string;
  contact_address?: string;
  verification_token?: string;
  verification_token_expires?: string;
  is_verified?: boolean;
}) => {
  const hashedPassword = await hashPassword(userData.password);
  const created = await prisma.user.create({
    data: {
      username: userData.username,
      email: userData.email,
      password: hashedPassword,  // Change password_hash to password to match the schema
      full_name: userData.full_name,
      role: userData.role as any,
      profile_picture: userData.profile_picture ?? null,
      contact_address: userData.contact_address ?? null,
      verification_token: userData.verification_token ?? null,
      verification_token_expires: userData.verification_token_expires
        ? new Date(userData.verification_token_expires)
        : null,
      is_verified: Boolean(userData.is_verified),
    },
  });
  return created;
};

export const getUserByVerificationToken = (token: string) => {
  return prisma.user.findFirst({
    where: {
      verification_token: token,
      verification_token_expires: { gt: new Date() },
    },
  });
};

export const getUserByResetToken = (token: string) => {
  return prisma.user.findFirst({
    where: {
      reset_token: token,
      reset_token_expires: { gt: new Date() },
    },
  });
};

export const updateUserVerification = async (userId: number, isVerified: boolean) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        is_verified: isVerified,
        verification_token: null,
        verification_token_expires: null,
      },
    });
    return true;
  } catch (e) {
    console.error('Error updating user verification:', e);
    return false;
  }
};

export const updateUserResetToken = async (userId: number, resetToken: string, expiresAt: string) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        reset_token: resetToken,
        reset_token_expires: new Date(expiresAt),
      },
    });
    return true;
  } catch (e) {
    console.error('Error updating reset token:', e);
    return false;
  }
};

export const updateUserPassword = async (userId: number, newPassword: string) => {
  try {
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
      },
    });
    return true;
  } catch (e) {
    console.error('Error updating password:', e);
    return false;
  }
};

export const authenticateUser = async (username: string, password: string) => {
  const user = await getUserByUsername(username);
  if (!user || !user.password) return null;
  const isValid = await comparePassword(password, user.password);
  if (!isValid) return null;
  const { password: _omit, ...rest } = user as any;
  return rest;
};
