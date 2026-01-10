import { PrismaClient, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';
import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '../utils/errors';

const prisma = new PrismaClient();

export interface LoginCredentials {
  email: string;
  password: string;
  restaurantSlug: string;
}

export interface PinLoginCredentials {
  pin: string;
  restaurantId: string;
}

export interface RegisterRestaurantInput {
  restaurant: {
    name: string;
    slug: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
    gstin?: string;
    fssaiNumber?: string;
  };
  owner: {
    name: string;
    email: string;
    phone: string;
    password: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  restaurantId: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
}

class AuthService {
  // Token expiry in seconds
  private readonly accessTokenExpirySeconds = 86400; // 24 hours
  private readonly refreshTokenExpirySeconds = 604800; // 7 days

  // Generate JWT tokens
  generateTokens(userId: string, restaurantId: string, role: string): TokenPair {
    const accessPayload: JWTPayload = {
      userId,
      restaurantId,
      role,
      type: 'access',
    };

    const refreshPayload: JWTPayload = {
      userId,
      restaurantId,
      role,
      type: 'refresh',
    };

    const accessToken = jwt.sign(
      accessPayload,
      process.env.JWT_SECRET as jwt.Secret,
      { expiresIn: this.accessTokenExpirySeconds }
    );

    const refreshToken = jwt.sign(
      refreshPayload,
      process.env.JWT_REFRESH_SECRET as jwt.Secret,
      { expiresIn: this.refreshTokenExpirySeconds }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpirySeconds
    };
  }

  // Login with email/password
  async login(credentials: LoginCredentials): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const { email, password, restaurantSlug } = credentials;

    // Find restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    if (!restaurant || !restaurant.isActive) {
      throw new AuthenticationError('Restaurant not found or inactive');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: {
        restaurantId_email: {
          restaurantId: restaurant.id,
          email,
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = this.generateTokens(user.id, restaurant.id, user.role);

    // Store session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: restaurant.id,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
        },
      },
      tokens,
    };
  }

  // Quick PIN login for POS
  async loginWithPin(credentials: PinLoginCredentials): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const { pin, restaurantId } = credentials;

    const user = await prisma.user.findFirst({
      where: {
        restaurantId,
        pin,
        isActive: true,
      },
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });

    if (!user || !user.restaurant.isActive) {
      throw new AuthenticationError('Invalid PIN');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.restaurantId, user.role);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        restaurant: {
          id: user.restaurant.id,
          name: user.restaurant.name,
          slug: user.restaurant.slug,
        },
      },
      tokens,
    };
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!
      ) as JWTPayload;

      if (decoded.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type');
      }

      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: { user: true },
      });

      if (!session || !session.user.isActive) {
        throw new AuthenticationError('Session not found');
      }

      // Generate new tokens
      const tokens = this.generateTokens(
        decoded.userId,
        decoded.restaurantId,
        decoded.role
      );

      // Update session
      await prisma.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        },
      });

      return tokens;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Refresh token has expired');
      }
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  // Logout
  async logout(token: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  // Register a new restaurant with owner
  async registerRestaurant(input: RegisterRestaurantInput): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const { restaurant: restaurantData, owner: ownerData } = input;

    // Check if slug is taken
    const existingRestaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantData.slug },
    });

    if (existingRestaurant) {
      throw new ConflictError('Restaurant slug is already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(ownerData.password, 12);

    // Create restaurant and owner in a transaction
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const restaurant = await tx.restaurant.create({
        data: restaurantData,
      });

      const user = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          email: ownerData.email,
          phone: ownerData.phone,
          name: ownerData.name,
          passwordHash,
          role: UserRole.OWNER,
          pin: '1234', // Default PIN, should be changed
        },
      });

      return { restaurant, user };
    });

    // Generate tokens
    const tokens = this.generateTokens(
      result.user.id,
      result.restaurant.id,
      result.user.role
    );

    // Create session
    await prisma.session.create({
      data: {
        userId: result.user.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    });

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        restaurantId: result.restaurant.id,
        restaurant: {
          id: result.restaurant.id,
          name: result.restaurant.name,
          slug: result.restaurant.slug,
        },
      },
      tokens,
    };
  }

  // Get current user
  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      restaurant: user.restaurant,
    };
  }

  // Change password
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new ValidationError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate all sessions except current
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  // Update PIN
  async updatePin(userId: string, newPin: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Check if PIN is unique within restaurant
    const existingPin = await prisma.user.findFirst({
      where: {
        restaurantId: user.restaurantId,
        pin: newPin,
        NOT: { id: userId },
      },
    });

    if (existingPin) {
      throw new ConflictError('PIN is already in use');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { pin: newPin },
    });
  }
}

export const authService = new AuthService();
