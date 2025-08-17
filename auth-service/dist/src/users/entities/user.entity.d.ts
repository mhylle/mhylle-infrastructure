export declare class User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    isActive: boolean;
    apps: string[];
    roles: Record<string, string[]>;
    createdAt: Date;
    updatedAt: Date;
}
