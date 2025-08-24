import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    private readonly usersService;
    constructor(authService: AuthService, usersService: UsersService);
    register(registerDto: RegisterDto): Promise<{
        success: boolean;
        data: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
        };
        message: string;
    }>;
    login(loginDto: LoginDto, response: Response): Promise<{
        access_token?: string | undefined;
        success: boolean;
        data: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            permissions: {
                apps: string[];
                roles: Record<string, string[]>;
            };
        };
    }>;
    logout(response: Response): Promise<{
        success: boolean;
        message: string;
    }>;
    validate(request: Request): Promise<{
        success: boolean;
        data: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            permissions: {
                apps: string[];
                roles: Record<string, string[]>;
            };
        };
    }>;
    health(): {
        status: string;
        timestamp: string;
        service: string;
    };
}
