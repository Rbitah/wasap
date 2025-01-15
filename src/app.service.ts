import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { lastValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';

@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async handleMessage(from: string, messageText: string) {
    console.log('Received message from:', from, 'Message:', messageText);

    const user = await this.getUserByPhoneNumber(from);

    if (messageText.toLowerCase() === 'hi') {
      return await this.handleHiMessage(user, from);
    }

    if (user) {
      switch (user.step) {
        case 'ASK_USERNAME':
          return await this.handleAskUsername(user, messageText);
        case 'CHOOSE_EVENT':
          return await this.handleChooseEvent(user, messageText);
        case 'CHOOSE_PAYMENT':
          return await this.handleChoosePayment(user, messageText, from);
        default:
          return 'error_message';
      }
    } else {
      return 'error_message';
    }
  }

  private async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    return await this.userRepository.findOne({ where: { phoneNumber } });
  }

  private async handleHiMessage(user: User | undefined, from: string): Promise<any> {
    if (!user) {
      const newUser = this.userRepository.create({ phoneNumber: from, step: 'ASK_USERNAME' });
      await this.userRepository.save(newUser);
      return 'greeting_message';
    } else {
      const eventList = await this.listEvents();
      return {
        template: 'event_list',
        parameters: [{ type: 'text', text: eventList }],
      };
    }
  }

  private async handleAskUsername(user: User, username: string): Promise<any> {
    user.username = username;
    user.step = 'CHOOSE_EVENT';
    await this.userRepository.save(user);

    const eventList = await this.listEvents();
    return {
      template: 'thank_you_username',
      parameters: [
        { type: 'text', text: username },
        { type: 'text', text: eventList },
      ],
    };
  }

  private async handleChooseEvent(user: User, messageText: string): Promise<any> {
    const eventId = parseInt(messageText);
    const event = await this.eventRepository.findOne({ where: { id: eventId } });

    if (!event) {
      return 'invalid_event';
    }

    user.eventId = event.id;
    user.step = 'CHOOSE_PAYMENT';
    await this.userRepository.save(user);

    return 'choose_payment';
  }

  private async handleChoosePayment(user: User, messageText: string, from: string): Promise<any> {
    if (messageText !== '1' && messageText !== '2') {
      return 'invalid_payment_method';
    }

    user.paymentMethod = messageText === '1' ? 'Airtel Money' : 'Mpamba';
    user.step = 'PAYMENT';
    const ticketId = uuidv4();
    const qrCodeUrl = await this.generateQRCode(ticketId);
    const eventName = (await this.eventRepository.findOne({ where: { id: user.eventId } })).name;

    await this.userRepository.save(user);

    return {
      template: 'ticket_qr_code_images',
      image: qrCodeUrl,
      parameters: [
        { type: 'text', text: user.username },
        { type: 'text', text: eventName },
      ],
    };
  }

  private async listEvents(): Promise<string> {
    const events = await this.eventRepository.find();
    return events.map((e) => `${e.id}. ${e.name}`).join('\n');
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
    const ACCESS_TOKEN = 'EAAIZCPFZAYWO8BOzjZALkLo4LpWgCBUslHdkFcDvMS0ruS5gVJ3le34tL8dpoHPZAxLLacSH4850tzsN2e2pali8u7Yho7uI5fce3saXZAhG7oazHff91WtZB4lbQeWUZBd3Qn8IVozFBqgsg6KOZCggKsjAtRzGUlclMZCiZBivUeKSU43pzaC2GWZC8Y8zE5kHpqOe8pgGWawbKcvFATfbXJZCMpKQZBfsZD';
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
    const ACCESS_TOKEN = 'EAAIZCPFZAYWO8BOzjZALkLo4LpWgCBUslHdkFcDvMS0ruS5gVJ3le34tL8dpoHPZAxLLacSH4850tzsN2e2pali8u7Yho7uI5fce3saXZAhG7oazHff91WtZB4lbQeWUZBd3Qn8IVozFBqgsg6KOZCggKsjAtRzGUlclMZCiZBivUeKSU43pzaC2GWZC8Y8zE5kHpqOe8pgGWawbKcvFATfbXJZCMpKQZBfsZD';
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

  async createEvent(name: string) {
    const event = this.eventRepository.create({ name });
    await this.eventRepository.save(event);
    return event;
  }
}