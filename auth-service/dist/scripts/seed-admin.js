"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const users_service_1 = require("../src/users/users.service");
async function seedAdmin() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const usersService = app.get(users_service_1.UsersService);
    try {
        const existingAdmin = await usersService.findByEmail('admin@mhylle.com');
        if (!existingAdmin) {
            console.log('Creating default admin user...');
            const adminUser = await usersService.create({
                email: 'admin@mhylle.com',
                firstName: 'Admin',
                lastName: 'User',
                password: 'Admin123!',
                isActive: true,
                apps: ['app1', 'app2', 'auth-service'],
                roles: {
                    app1: ['admin', 'user'],
                    app2: ['admin', 'user'],
                    'auth-service': ['admin'],
                },
            });
            console.log('✅ Admin user created successfully');
            console.log(`📧 Email: ${adminUser.email}`);
            console.log(`🔑 Password: Admin123!`);
            console.log(`🏷️  Apps: ${adminUser.apps.join(', ')}`);
        }
        else {
            console.log('ℹ️  Admin user already exists');
        }
    }
    catch (error) {
        console.error('❌ Error seeding admin user:', error);
    }
    finally {
        await app.close();
    }
}
seedAdmin();
//# sourceMappingURL=seed-admin.js.map