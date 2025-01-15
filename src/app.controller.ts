import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('webhook')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async handleWebhook(@Body() body: any) {
    const incomingMessage = body.messages[0];
    const from = incomingMessage.from;
    const messageText = incomingMessage.text.body;

    const responseMessage = await this.appService.handleMessage(from, messageText);

    await this.appService.sendWhatsAppMessage(from, responseMessage);

    return { status: 'ok' };
  }
}
