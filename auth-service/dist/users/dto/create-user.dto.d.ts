export declare class CreateUserDto {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    isActive?: boolean;
    apps?: string[];
    roles?: Record<string, string[]>;
}
