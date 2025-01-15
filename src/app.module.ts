import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',  // PostgreSQL
      url: 'postgresql://wasap_tj3x_user:jwhiCKHkgm1M6TslZFkX1KCNnrrGhl9V@dpg-cu427b3v2p9s73dtekmg-a.oregon-postgres.render.com/wasap_tj3x', // Your connection URL
      entities: [User, Event],  // Your entities
      synchronize: true, // Set to false in production
      ssl: {
        rejectUnauthorized: false, // This tells PostgreSQL to accept the connection, even with invalid SSL certificates (be cautious in production)
      },
    }),
    TypeOrmModule.forFeature([User, Event]),
    HttpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
