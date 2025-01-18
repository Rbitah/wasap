import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppService } from './app.service';

@Controller('webhook')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  verifyToken(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string
  ) {
    const validToken = 'tiyenitickets'; // Replace with your token

    if (mode === 'subscribe' && token === validToken) {
      return challenge;
    } else {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  @Post()
  async handleWebhook(@Body() body: any) {
    console.log('Incoming request body:', JSON.stringify(body, null, 2));

    if (!body || body.object !== 'whatsapp_business_account') {
      throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
    }

    const entries = body.entry;
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new HttpException('Invalid entry format', HttpStatus.BAD_REQUEST);
    }

    for (const entry of entries) {
      const changes = entry.changes;
      if (!Array.isArray(changes) || changes.length === 0) {
        continue;
      }

      for (const change of changes) {
        if (change.field !== 'messages' || !change.value) {
          continue;
        }

        const value = change.value;
        const messages = value.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
          continue;
        }

        const message = messages[0];
        const from = message.from;
        const messageText = message?.text?.body;

        if (!from || !messageText) {
          throw new HttpException('Invalid message format', HttpStatus.BAD_REQUEST);
        }

        try {
          await this.appService.handleMessage(from, messageText);
        } catch (error) {
          console.error('Error processing message:', error);
          await this.appService.sendTemplateMessage(from, 'tiyeni_tickets', [
            'An error occurred. Please try again later.',
          ]);
        }
      }
    }

    return { status: 'ok' };
  }

  @Post('create-event')
  async createEvent(@Body() body) {
    const { name } = body;

    if (!name) {
      throw new HttpException('Invalid event name', HttpStatus.BAD_REQUEST);
    }

    return this.appService.createEvent(name);
  }
}