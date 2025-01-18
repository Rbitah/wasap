import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  phoneNumber: string;

  @Column()
  phoneForPayment: string;

  @Column({ nullable: true })
  username: string;

  @Column()
  step: string;

  @Column("uuid", { nullable: true })
  ticketId: string;

  @Column({ nullable: true })
  eventId: number;

  @Column({ nullable: true })
  paymentMethod: string;
}
