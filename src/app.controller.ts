import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller('webhook')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async handleWebhook(@Body() body: any, @Headers('X-Webhook-Token') token: string) {
    if (!this.verifyToken(token)) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (!body || !body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
    }

    const incomingMessage = body.messages[0];
    const from = incomingMessage?.from;
    const messageText = incomingMessage?.text?.body;

    if (!from || !messageText) {
      throw new HttpException('Invalid message format', HttpStatus.BAD_REQUEST);
    }

    const response = await this.appService.handleMessage(from, messageText);

    if (typeof response === 'string') {
      await this.appService.sendTemplateMessage(from, response);
    } else if (response.template) {
      if (response.image) {
        await this.appService.sendWhatsAppImageMessage(from, response.image, response.parameters);
      } else {
        await this.appService.sendTemplateMessage(from, response.template, response.parameters);
      }
    }

    return { status: 'ok' };
  }

  private verifyToken(token: string): boolean {
    const validToken = 'tiyenitickets';
    return token === validToken;
  }
}
