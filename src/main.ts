import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { INestApplication, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule) as INestApplication;
  
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  
  app.enableCors({
    origin: '*', // For dev, allow all
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-App-Version',
      'X-App-Build',
      'X-App-Device-Id',
      'X-App-Platform',
      'X-App-Timestamp',
      'X-App-Nonce',
      'X-App-Sign',
    ],
  });

  const config = new DocumentBuilder()
    .setTitle('RealDog API')
    .setDescription('The RealDog API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('api', app as any, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
