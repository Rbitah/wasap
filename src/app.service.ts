import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { lastValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';
import * as fs from 'fs';
import FormData from 'form-data';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  onModuleInit() {
    this.ensureQRCodeDirectoryExists();
  }

  async handleMessage(from: string, messageText: string) {
    const user = await this.getUser(from);

    if (!user) {
      // New user: Start the conversation
      if (messageText.toLowerCase() === 'hi') {
        await this.greetNewUser(from);
      }
      return;
    }

    // Existing user: Handle based on their current step
    switch (user.step) {
      case 'ASK_USERNAME':
        await this.setUsername(user, messageText);
        break;
      case 'CHOOSE_EVENT':
        await this.handleEventSelection(user, messageText);
        break;
      case 'CHOOSE_PAYMENT':
        await this.handlePaymentSelection(user, messageText);
        break;
      case 'PROVIDE_PHONE':
        await this.handlePhoneNumber(user, messageText);
        break;
      default:
        this.sendErrorMessage(from);
    }
  }

  private async getUser(from: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phoneNumber: from } });
  }

  private async greetNewUser(from: string) {
    const user = this.userRepository.create({ phoneNumber: from, step: 'ASK_USERNAME' });
    await this.userRepository.save(user);
    this.sendTemplateMessage(from, 'tiyeni_tickets', ['Welcome! Please enter your username.']);
  }

  private async setUsername(user: User, messageText: string) {
    user.username = messageText;
    user.step = 'CHOOSE_EVENT';
    await this.userRepository.save(user);
    const eventsList = await this.listEvents();
    this.sendTemplateMessage(user.phoneNumber, 'tiyeni_tickets', [
      `Hello ${user.username}! Here are the available events:\n${eventsList}\nPlease select an event by number.`,
    ]);
  }

  private async handleEventSelection(user: User, messageText: string) {
    const eventId = parseInt(messageText);
    const event = await this.eventRepository.findOne({ where: { id: eventId } });

    if (!event) {
      this.sendTemplateMessage(user.phoneNumber, 'tiyeni_tickets', ['Invalid event selection. Please try again.']);
      return;
    }

    user.eventId = event.id;
    user.step = 'CHOOSE_PAYMENT';
    await this.userRepository.save(user);
    this.sendTemplateMessage(user.phoneNumber, 'tiyeni_tickets', [
      'Please choose your payment method:\n1. Airtel Money\n2. Mpamba',
    ]);
  }

  private async handlePaymentSelection(user: User, messageText: string) {
    if (messageText !== '1' && messageText !== '2') {
      this.sendTemplateMessage(user.phoneNumber, 'tiyeni_tickets', ['Invalid payment method. Please choose 1 or 2.']);
      return;
    }

    user.paymentMethod = messageText === '1' ? 'Airtel Money' : 'Mpamba';
    user.step = 'PROVIDE_PHONE';
    await this.userRepository.save(user);
    this.sendTemplateMessage(user.phoneNumber, 'tiyeni_tickets', [
      'Please provide your phone number for payment confirmation.',
    ]);
  }

  private async handlePhoneNumber(user: User, messageText: string) {
    // Validate phone number (basic validation)
    if (!messageText.match(/^\d{10}$/)) {
      this.sendTemplateMessage(user.phoneNumber, 'tiyeni_tickets', ['Invalid phone number. Please try again.']);
      return;
    }

    user.phoneForPayment = messageText;
    user.step = 'TICKET_GENERATION';
    await this.userRepository.save(user);

    // Generate ticket and QR code
    const ticketId = uuidv4();
    const qrCodeUrl = await this.generateQRCode(ticketId);
    user.ticketId = ticketId;
    await this.userRepository.save(user);

    const eventName = (await this.eventRepository.findOne({ where: { id: user.eventId } })).name;

    // Send ticket as an image with QR code
    this.sendWhatsAppImageMessage(user.phoneNumber, qrCodeUrl, eventName, user.username);
  }

  private async listEvents(): Promise<string> {
    const events = await this.eventRepository.find();
    return events.map((e) => `${e.id}. ${e.name}`).join('\n');
  }

  private async generateQRCode(ticketId: string): Promise<string> {
    const qrCodePath = `./qrcodes/${ticketId}.png`;
    await QRCode.toFile(qrCodePath, ticketId);
    return qrCodePath;
  }

  public async sendTemplateMessage(to: string, template: string, parameters: string[]) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    try {
      await lastValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
              name: template,
              language: { code: 'en' },
              components: [{ type: 'body', parameters: parameters.map((text) => ({ type: 'text', text })) }],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    } catch (err) {
      console.error(`Failed to send template message "${template}" to ${to}:`, err);
    }
  }

  private async sendWhatsAppImageMessage(to: string, imagePath: string, eventName: string, username: string) {
    const accessToken = "EAAIZCPFZAYWO8BO4ivolk4AewAJGQVM0T0dIeILFzaevrXj8tvKIrkVLTyreG6u2yoMSpyUV4GKC33PaZCYcvzVev98KF8btZATW0uHdkZCCehG87V5uDi7DNxBJxPq2NVlxYSnU5ZC3R6y2X5quO7ZAJlly19cymdRdROFOFpZBotGoEl4RrUP4V2WGG5jL2zadqBofhSJaZAiIxZCSr7FbXq8nRbiX4ZD";
    const phoneNumberId = "524888984044537";

    try {
      const data = await fs.promises.readFile(imagePath);
      const form = new FormData();
      form.append('file', data, { filename: 'qr_code.png' });
      form.append('messaging_product', 'whatsapp');
      form.append('type', 'image/png');

      const uploadResponse = await lastValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
          form,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              ...form.getHeaders(),
            },
          },
        ),
      );

      const mediaId = uploadResponse.data.id;

      await lastValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: { id: mediaId },
            caption: `Your ticket for ${eventName}, ${username}.`,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    } catch (err) {
      console.error(`Failed to send image message to ${to}:`, err);
    }
  }

  private sendErrorMessage(to: string) {
    this.sendTemplateMessage(to, 'tiyeni_tickets', ['An error occurred. Please try again later.']);
  }

  private ensureQRCodeDirectoryExists() {
    if (!fs.existsSync('./qrcodes')) {
      fs.mkdirSync('./qrcodes');
    }
  }
  async createEvent(name: string) {
    const event = this.eventRepository.create({ name });
    await this.eventRepository.save(event);
    return event;
  }
}