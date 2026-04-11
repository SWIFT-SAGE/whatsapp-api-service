// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse } = require('csv-parse');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Readable } = require('stream');
import PhoneContact, { IPhoneContact } from '../models/PhoneContact';
import { logger } from '../utils/logger';

interface ContactFilter {
  userId: string;
  search?: string;
  tags?: string[];
  isBlocked?: boolean;
  page?: number;
  limit?: number;
}

interface BulkImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; phone: string; reason: string }>;
}

class ContactService {
  /**
   * List contacts with optional search, tag filter, pagination.
   */
  async list(filter: ContactFilter): Promise<{ contacts: IPhoneContact[]; total: number }> {
    const { userId, search, tags, isBlocked, page = 1, limit = 50 } = filter;
    const query: any = { userId };

    if (typeof isBlocked === 'boolean') query.isBlocked = isBlocked;
    if (tags && tags.length > 0) query.tags = { $in: tags };
    if (search) query.$text = { $search: search };

    const [contacts, total] = await Promise.all([
      PhoneContact.find(query)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PhoneContact.countDocuments(query),
    ]);

    return { contacts, total };
  }

  async getById(userId: string, contactId: string): Promise<IPhoneContact | null> {
    return PhoneContact.findOne({ _id: contactId, userId });
  }

  async getByPhone(userId: string, phone: string): Promise<IPhoneContact | null> {
    return PhoneContact.findOne({ userId, phone });
  }

  async create(userId: string, data: Partial<IPhoneContact>): Promise<IPhoneContact> {
    const contact = new PhoneContact({ ...data, userId, source: data.source || 'manual' });
    return contact.save();
  }

  async update(userId: string, contactId: string, data: Partial<IPhoneContact>): Promise<IPhoneContact | null> {
    return PhoneContact.findOneAndUpdate(
      { _id: contactId, userId },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  async delete(userId: string, contactId: string): Promise<boolean> {
    const result = await PhoneContact.deleteOne({ _id: contactId, userId });
    return result.deletedCount > 0;
  }

  async block(userId: string, contactId: string): Promise<IPhoneContact | null> {
    return PhoneContact.findOneAndUpdate({ _id: contactId, userId }, { isBlocked: true }, { new: true });
  }

  async unblock(userId: string, contactId: string): Promise<IPhoneContact | null> {
    return PhoneContact.findOneAndUpdate({ _id: contactId, userId }, { isBlocked: false }, { new: true });
  }

  /**
   * Add or remove tags from a contact.
   */
  async updateTags(userId: string, contactId: string, add: string[], remove: string[]): Promise<IPhoneContact | null> {
    const update: any = {};
    if (add.length) update.$addToSet = { tags: { $each: add } };
    if (remove.length) update.$pull = { tags: { $in: remove } };
    return PhoneContact.findOneAndUpdate({ _id: contactId, userId }, update, { new: true });
  }

  /**
   * Check if a phone number is blocked by a user — used by message sending services.
   */
  async isBlocked(userId: string, phone: string): Promise<boolean> {
    const contact = await PhoneContact.findOne({ userId, phone, isBlocked: true }).lean();
    return !!contact;
  }

  /**
   * Import contacts from a CSV buffer.
   * Expected CSV columns: name, phone, email (optional), tags (optional, comma-separated)
   */
  async importFromCSV(userId: string, csvBuffer: Buffer): Promise<BulkImportResult> {
    const result: BulkImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    const records: any[] = await new Promise((resolve, reject) => {
      const rows: any[] = [];
      const stream = Readable.from(csvBuffer.toString('utf-8'));
      stream
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (row: any) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });

    let rowNum = 1;
    for (const record of records) {
      rowNum++;
      const phone = (record.phone || '').trim();
      const name = (record.name || '').trim();

      if (!phone || !name) {
        result.errors.push({ row: rowNum, phone, reason: 'Missing name or phone' });
        result.skipped++;
        continue;
      }

      // Normalise phone to E.164 if it starts with digits
      const normPhone = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`;
      if (!/^\+[1-9]\d{6,14}$/.test(normPhone)) {
        result.errors.push({ row: rowNum, phone, reason: 'Invalid phone format' });
        result.skipped++;
        continue;
      }

      const tags = record.tags
        ? record.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];

      try {
        const existing = await PhoneContact.findOne({ userId, phone: normPhone });
        if (existing) {
          await PhoneContact.updateOne(
            { _id: existing._id },
            { $set: { name, email: record.email || existing.email, tags, source: 'csv_import' } }
          );
          result.updated++;
        } else {
          await PhoneContact.create({
            userId,
            name,
            phone: normPhone,
            email: record.email || undefined,
            tags,
            source: 'csv_import',
          });
          result.created++;
        }
      } catch (err: any) {
        logger.warn(`CSV import row ${rowNum} failed:`, err.message);
        result.errors.push({ row: rowNum, phone: normPhone, reason: err.message });
        result.skipped++;
      }
    }

    logger.info('CSV import complete', { userId, ...result });
    return result;
  }

  /**
   * Get all unique tags used by a user's contacts.
   */
  async getAllTags(userId: string): Promise<string[]> {
    const result = await PhoneContact.aggregate([
      { $match: { userId } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags' } },
      { $sort: { _id: 1 } },
    ]);
    return result.map((r) => r._id);
  }
}

export default new ContactService();
