import { z } from 'zod';

// User schemas
export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createUserSchema = z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['FLOOR_STAFF', 'KITCHEN_STAFF']),
});

export const updateUserSchema = z.object({
    email: z.string().email('Invalid email address').optional(),
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    role: z.enum(['FLOOR_STAFF', 'KITCHEN_STAFF']).optional(),
});

// Category schemas
export const createCategorySchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    order: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    description: z.string().optional(),
    order: z.number().int().min(0).optional(),
});

// Menu item schemas
export const createMenuItemSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    price: z.number().positive('Price must be positive'),
    image: z.string().url().optional().or(z.literal('')),
    available: z.boolean().optional(),
    isSpecial: z.boolean().optional(),
    isPromotional: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    promotionalPrice: z.number().positive().optional().nullable(),
    categoryId: z.string().min(1, 'Category is required'),
    allergies: z.array(z.string()).optional(),
});

export const updateMenuItemSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    description: z.string().optional(),
    price: z.number().positive('Price must be positive').optional(),
    image: z.string().url().optional().or(z.literal('')),
    available: z.boolean().optional(),
    isSpecial: z.boolean().optional(),
    isPromotional: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    promotionalPrice: z.number().positive().optional().nullable(),
    categoryId: z.string().min(1, 'Category is required').optional(),
    allergies: z.array(z.string()).optional(),
});

// Table schemas
export const updateTableSchema = z.object({
    status: z.enum(['VACANT', 'OCCUPIED', 'RESERVED', 'ORDER_PENDING']).optional(),
    mergedWithId: z.string().nullable().optional(),
});

export const mergeTablesSchema = z.object({
    tableIds: z.array(z.string()).min(2, 'At least 2 tables required'),
});

// Order schemas
export const createOrderSchema = z.object({
    tableId: z.string().min(1, 'Table is required'),
    notes: z.string().optional(),
    items: z.array(z.object({
        menuItemId: z.string().min(1, 'Menu item is required'),
        quantity: z.number().int().positive('Quantity must be positive'),
        notes: z.string().optional(),
        allergies: z.array(z.string()).optional(),
    })).min(1, 'At least one item is required'),
});

export const addOrderItemSchema = z.object({
    menuItemId: z.string().min(1, 'Menu item is required'),
    quantity: z.number().int().positive('Quantity must be positive'),
    notes: z.string().optional(),
    allergies: z.array(z.string()).optional(),
});

export const updateOrderStatusSchema = z.object({
    status: z.enum(['CREATED', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED']),
});

export const updateOrderItemStatusSchema = z.object({
    status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED']),
});

// Payment schemas
export const createPaymentSchema = z.object({
    orderId: z.string().min(1, 'Order is required'),
    amount: z.number().positive('Amount must be positive'),
    method: z.enum(['CASH', 'CARD']),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type MergeTablesInput = z.infer<typeof mergeTablesSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdateOrderItemStatusInput = z.infer<typeof updateOrderItemStatusSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
