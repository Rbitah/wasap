import { Controller, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('webhook')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async handleWebhook(@Body() body: any, @Headers('X-Webhook-Token') token: string) {
    // Verify the token
    if (!this.verifyToken(token)) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const incomingMessage = body.messages[0];
    const from = incomingMessage.from;
    const messageText = incomingMessage.text.body;

    const responseMessage = await this.appService.handleMessage(from, messageText);

    await this.appService.sendWhatsAppMessage(from, responseMessage);

    return { status: 'ok' };
  }

  // Token verification logic (hardcoded token "tiyenitickets")
  private verifyToken(token: string): boolean {
    const validToken = 'tiyenitickets'; // Hardcoded token
    return token === validToken;
  }
}
