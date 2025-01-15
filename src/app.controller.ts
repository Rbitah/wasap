import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller('webhook')
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET route for verification
  @Get()
  verifyToken(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    const validToken = 'tiyenitickets'; // Replace with your token

    if (mode === 'subscribe' && token === validToken) {
      return challenge;
    } else {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  // POST route for handling webhook events
  @Post()
  async handleWebhook(@Body() body: any, @Headers('X-Hub-Signature') hubSignature: string) {
    if (!this.isXHubSignatureValid(hubSignature, body)) {
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

  // Helper function to validate X-Hub-Signature
  private isXHubSignatureValid(hubSignature: string, body: any): boolean {
    const secret = process.env.APP_SECRET || 'default_secret';
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha1', secret)
      .update(JSON.stringify(body))
      .digest('hex');
    const expectedSignature = `sha1=${hash}`;

    return hubSignature === expectedSignature;
  }
}
