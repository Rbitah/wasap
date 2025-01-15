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
    if (messageText.toLowerCase() === 'hi') {
      if (!this.users[from]) {
        this.users[from] = { step: 'ASK_USERNAME' };
        return 'Hello! Please provide your username.';
      } else {
        return 'Welcome back! Here are the available events:\n' + this.listEvents();
      }
    }

    if (this.users[from]?.step === 'ASK_USERNAME') {
      this.users[from].username = messageText;
      this.users[from].step = 'CHOOSE_EVENT';
      return 'Thank you, ' + messageText + '! Here are the available events:\n' + this.listEvents();
    }

    if (this.users[from]?.step === 'CHOOSE_EVENT') {
      const eventId = parseInt(messageText);
      if (!this.events[eventId - 1]) {
        return 'Invalid event number. Please try again.';
      }
      this.users[from].event = this.events[eventId - 1];
      this.users[from].step = 'CHOOSE_PAYMENT';
      return 'You selected ' + this.events[eventId - 1].name + '. Choose a payment method:\n1. Airtel Money\n2. Mpamba';
    }

    if (this.users[from]?.step === 'CHOOSE_PAYMENT') {
      if (messageText !== '1' && messageText !== '2') {
        return 'Invalid choice. Please select 1 for Airtel Money or 2 for Mpamba.';
      }
      const paymentMethod = messageText === '1' ? 'Airtel Money' : 'Mpamba';
      this.users[from].paymentMethod = paymentMethod;
      this.users[from].step = 'PAYMENT';
      // Implement payment processing here
      // On success, proceed to generate a ticket
      const ticketId = uuidv4();
      const qrCode = await this.generateQRCode(ticketId);
      return 'Payment successful! Here is your ticket QR code:\n' + qrCode;
    }

    return 'Something went wrong. Please try again.';
  }

  private listEvents() {
    return this.events.map((e, index) => `${index + 1}. ${e.name}`).join('\n');
  }

  private async generateQRCode(ticketId: string) {
    try {
      const qrCodeUrl = await QRCode.toDataURL(ticketId);
      return qrCodeUrl;
    } catch (err) {
      console.error(err);
      return 'Failed to generate QR code.';
    }
  }

  async sendWhatsAppMessage(to: string, message: string) {
    const ACCESS_TOKEN = 'EAAIZCPFZAYWO8BO2wbZC2VYjHdrDTo8GcWWpanDTIbKljZB0y3akkrZB8TAosCodZAE1ZAKQJKeGrcFwzWKpTugH8H1mDsriHIrAZAXWPKio8wevIf6XHkvjmZBaqvSr3OITs9lJJPebvEqKdQiFM6490XV8GnGEdpRiisO2nQ28w62aB2aATDWRZBHYspP69x0ZBUYh2yrD1CmHWYiINZCJvGxQMEN0vGYZD';
    const PHONE_NUMBER_ID = '524888984044537';

    const response = await lastValueFrom(
      this.httpService.post(
        `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );
    return response.data;
  }
}
