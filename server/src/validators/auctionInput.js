
import { z } from 'zod';

export const auctionInput = z.object({
  title: z.string().trim().min(5).max(120),
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.coerce.number().int().min(1950).max(2100),
  mileageKm: z.coerce.number().min(0),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  location: z.string().max(120).optional(),
  startingPrice: z.coerce.number().int().min(1),
  minIncrement: z.coerce.number().int().min(1).default(500),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date()
}).refine(
  (data) => data.endsAt > data.startsAt,
  {
    message: 'Auction end time must be after start time',
    path: ['endsAt']
  }
);
