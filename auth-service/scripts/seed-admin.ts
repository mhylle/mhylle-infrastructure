import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';

async function seedAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  try {
    // Check if admin user already exists
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
    } else {
      console.log('ℹ️  Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
  } finally {
    await app.close();
  }
}

// Run the seed script
seedAdmin();