import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  private readonly users = {};
  private readonly events = [
    { id: 1, name: 'Concert A' },
    { id: 2, name: 'Concert B' },
  ];

  constructor(private readonly httpService: HttpService) {}

  async handleMessage(from: string, messageText: string) {
    console.log('Received message:', messageText);

    if (messageText.toLowerCase() === 'hi') {
      if (!this.users[from]) {
        this.users[from] = { step: 'ASK_USERNAME' };
        return 'greeting_message';
      } else {
        return {
          template: 'event_list',
          parameters: [{ type: 'text', text: this.listEvents() }],
        };
      }
    }

    const user = this.users[from];
    if (user?.step === 'ASK_USERNAME') {
      user.username = messageText;
      user.step = 'CHOOSE_EVENT';
      return {
        template: 'thank_you_username',
        parameters: [
          { type: 'text', text: messageText },
          { type: 'text', text: this.listEvents() },
        ],
      };
    }

    if (user?.step === 'CHOOSE_EVENT') {
      const eventId = parseInt(messageText);
      const event = this.events.find((e) => e.id === eventId);
      if (!event) return 'invalid_event';

      user.event = event;
      user.step = 'CHOOSE_PAYMENT';
      return 'choose_payment';
    }

    if (user?.step === 'CHOOSE_PAYMENT') {
      if (messageText !== '1' && messageText !== '2') return 'invalid_payment_method';

      const paymentMethod = messageText === '1' ? 'Airtel Money' : 'Mpamba';
      user.paymentMethod = paymentMethod;
      user.step = 'PAYMENT';

      const ticketId = uuidv4();
      const qrCodeUrl = await this.generateQRCode(ticketId);
      const eventName = user.event.name;

      return {
        template: 'ticket_qr_code_images',
        image: qrCodeUrl,
        parameters: [
          { type: 'text', text: user.username },
          { type: 'text', text: eventName },
        ],
      };
    }

    return 'error_message';
  }

  private listEvents(): string {
    return this.events.map((e) => `${e.id}. ${e.name}`).join('\n');
  }

  private async generateQRCode(ticketId: string): Promise<string> {
    try {
      const qrCodePath = `./qrcodes/${ticketId}.png`;
      await QRCode.toFile(qrCodePath, ticketId);
      return qrCodePath;
    } catch (err) {
      console.error('QR Code generation failed:', err);
      throw new Error('Failed to generate QR code.');
    }
  }

  async sendTemplateMessage(to: string, template: string, components: any[] = []) {
    const ACCESS_TOKEN = 'EAAIZCPFZAYWO8BO4BpECSY6RUXnbLcTo3zBlgIy2XXSo5kFZAZCDw9kzcKnq3HxK7MwQfQpDzz4pcYP9Slq8ZC7DbOMjgAwXkZCZAiWe6OGLkTSj1zkN55tcZCILRc324rKwRfcWjhimyC90JA2fdyDj7ZCYxgqTEbcOsMABaFaT65ZBWzyjLyQUZACOXR3VJVvd2aQZCZClIEaNzIDN6OoroZAK3q2hedl2wZD';
    const PHONE_NUMBER_ID = '524888984044537';

    try {
      await lastValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: template,
              language: { code: 'en' },
              components: components.length ? [{ type: 'body', parameters: components }] : [],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        )
      );
    } catch (err) {
      console.error(`Failed to send template message "${template}" to ${to}:`, err);
    }
  }

  async sendWhatsAppImageMessage(to: string, imagePath: string, parameters: any[]) {
    const ACCESS_TOKEN = 'EAAIZCPFZAYWO8BO4BpECSY6RUXnbLcTo3zBlgIy2XXSo5kFZAZCDw9kzcKnq3HxK7MwQfQpDzz4pcYP9Slq8ZC7DbOMjgAwXkZCZAiWe6OGLkTSj1zkN55tcZCILRc324rKwRfcWjhimyC90JA2fdyDj7ZCYxgqTEbcOsMABaFaT65ZBWzyjLyQUZACOXR3VJVvd2aQZCZClIEaNzIDN6OoroZAK3q2hedl2wZD';
    const PHONE_NUMBER_ID = '524888984044537';

    try {
      const uploadResponse = await lastValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/media`,
          {
            messaging_product: 'whatsapp',
            file: imagePath,
            type: 'image/png',
          },
          {
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        )
      );

      const mediaId = uploadResponse.data.id;

      await lastValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: {
              id: mediaId,
              caption: 'Your QR code for the ticket.',
            },
          },
          {
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        )
      );
    } catch (err) {
      console.error(`Failed to send image message to ${to}:`, err);
    }
  }
}
