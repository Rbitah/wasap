import { TypeOrmModuleOptions } from "@nestjs/typeorm";

const typeOrmConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    url: 'postgresql://wasap_tj3x_user:jwhiCKHkgm1M6TslZFkX1KCNnrrGhl9V@dpg-cu427b3v2p9s73dtekmg-a.oregon-postgres.render.com/wasap_tj3x',
    entities: [__dirname + '/../**/*.entity.js'], // Use .js for CommonJS
    synchronize: true, // Disable in production
    ssl: { rejectUnauthorized: false },
  };
  