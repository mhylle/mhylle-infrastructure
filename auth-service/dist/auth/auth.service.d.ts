import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
export interface JwtPayload {
    sub: string;
    email: string;
    firstName: string;
    lastName: string;
    apps: string[];
    roles: Record<string, string[]>;
}
export interface AuthResponse {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        permissions: {
            apps: string[];
            roles: Record<string, string[]>;
        };
    };
    access_token: string;
}
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    validateUser(email: string, password: string): Promise<User | null>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    validateToken(token: string): Promise<User | null>;
    getUserFromPayload(payload: JwtPayload): Promise<User | null>;
}
